/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Pre-Docker project build preparation tests (api-build.projectbuild.ts).
 *
 * Verifies the "prepare build artifacts before docker build" behavior without
 * requiring a Docker daemon, a Maven installation or a database:
 *
 *   TEST 1  existing artifacts + Dockerfile  -> no build, context untouched
 *   TEST 2  Maven source + missing target/   -> controlled build runs, artifacts appear
 *   TEST 3  Maven build fails                -> clean failure, generated target/ + staging cleaned
 *   TEST 4  build succeeds but artifacts still missing -> precise error, no docker build
 *   TEST 5  non-Maven Docker projects        -> previous behavior preserved
 *   TEST 6  traversal/absolute COPY sources  -> never resolved outside the workspace
 *
 * Everything runs against temporary directories (os.tmpdir) with the build
 * runner injected through the module's test seam.
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/klyra_test';

// Module marker: keeps this file out of the global script scope shared by the
// other node:test suites.
export {};

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  dockerfileLogicalLines,
  parseDockerfileCopySources,
  missingDockerfileSources,
  planProjectBuilds,
  javaLevelFromPom,
  mavenImageFor,
  prepareDockerBuildContext,
} = require('../modules/api-build/api-build.projectbuild');

/** A generic Maven + war Dockerfile (same shape as the Swagger Petstore one). */
const MAVEN_DOCKERFILE = [
  'FROM eclipse-temurin:8-jre-alpine',
  'WORKDIR /app',
  'COPY target/lib/jetty-runner.jar /app/jetty-runner.jar',
  'COPY target/*.war /app/server.war',
  'COPY src/main/resources/openapi.yaml /app/openapi.yaml',
  'COPY inflector.yaml /app/',
  'EXPOSE 8080',
  'CMD ["java", "-jar", "/app/jetty-runner.jar", "/app/server.war"]',
  '',
].join('\n');

const POM = [
  '<project>',
  '  <artifactId>petstore</artifactId>',
  '  <packaging>war</packaging>',
  '  <build>',
  '    <directory>target</directory>',
  '    <plugins>',
  '      <plugin><artifactId>maven-compiler-plugin</artifactId>',
  '        <configuration><source>1.8</source><target>1.8</target></configuration>',
  '      </plugin>',
  '    </plugins>',
  '  </build>',
  '</project>',
].join('\n');

/** Source files every Maven fixture ships (so only target/ is missing). */
const SOURCE_FILES = {
  Dockerfile: MAVEN_DOCKERFILE,
  'pom.xml': POM,
  'inflector.yaml': 'inflector: true\n',
  'src/main/resources/openapi.yaml': 'openapi: 3.0.0\n',
};

/** Creates an isolated `<temp>/project` fixture and always cleans the temp root. */
async function withProject(
  files: Record<string, string>,
  run: (projectDir: string, root: string) => Promise<void>,
): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'klyra-projectbuild-'));
  const projectDir = path.join(root, 'project');
  try {
    for (const [relative, content] of Object.entries(files)) {
      const target = path.join(projectDir, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, 'utf-8');
    }
    await run(projectDir, root);
  } finally {
    await fs.rm(root, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

/** Staging directories the pipeline creates next to the project dir. */
async function stagingDirs(root: string): Promise<string[]> {
  const entries = await fs.readdir(root);
  return entries.filter((name) => name.startsWith('.klyra-maven-build-'));
}

/** Records log lines and build invocations. */
function recorder(): {
  logs: string[];
  log: (line: string) => void;
  builds: Array<{ system: string; dir: string }>;
} {
  const logs: string[] = [];
  const builds: Array<{ system: string; dir: string }> = [];
  return { logs, log: (line: string) => logs.push(line), builds };
}

// ---------------------------------------------------------------------------
// Dockerfile requirement parsing (pure)
// ---------------------------------------------------------------------------

test('dockerfileLogicalLines joins continuations and keeps plain instructions', () => {
  const lines = dockerfileLogicalLines('RUN a \\\n  b\nCOPY x y\n\nEXPOSE 80\n');
  // The backslash-newline becomes a space; the continuation's own indentation
  // is preserved, so compare token-level rather than byte-for-byte.
  assert.deepEqual(
    lines.map((line) => line.replace(/\s+/g, ' ')),
    ['RUN a b', 'COPY x y', 'EXPOSE 80'],
  );
});

test('parseDockerfileCopySources extracts context sources, skips flags/stages/URLs', () => {
  const sources = parseDockerfileCopySources(
    [
      '# COPY ignored.txt /app/',
      'FROM alpine',
      'COPY --chown=1000:1000 src/ /app/src/',
      'COPY --from=builder /out/app.jar /app/app.jar',
      'ADD https://example.test/x.jar /app/x.jar',
      'COPY . /app',
      'COPY ["a.txt", "b.txt", "/app/"]',
      'COPY target/*.war \\',
      '     /app/server.war',
      'RUN echo COPY not-an-instruction /app/',
      '',
    ].join('\n'),
  );
  assert.deepEqual(sources, ['src/', 'a.txt', 'b.txt', 'target/*.war']);
});

test('missingDockerfileSources distinguishes present, glob and missing sources', async () => {
  await withProject({ ...SOURCE_FILES }, async (projectDir) => {
    // target/ does not exist yet: both references to it count as missing.
    assert.deepEqual(missingDockerfileSources(projectDir, ['target/*.war', 'target/lib/x.jar']), [
      'target/*.war',
      'target/lib/x.jar',
    ]);
    // Present files are not reported.
    assert.deepEqual(
      missingDockerfileSources(projectDir, ['inflector.yaml', 'src/main/resources/openapi.yaml']),
      [],
    );

    await fs.mkdir(path.join(projectDir, 'target', 'lib'), { recursive: true });
    await fs.writeFile(path.join(projectDir, 'target', 'app.war'), 'war');
    await fs.writeFile(path.join(projectDir, 'target', 'lib', 'x.jar'), 'jar');
    // Glob matches an entry, exact path exists.
    assert.deepEqual(missingDockerfileSources(projectDir, ['target/*.war', 'target/lib/x.jar']), []);
    // A glob with no match is still missing.
    assert.deepEqual(missingDockerfileSources(projectDir, ['target/*.zip']), ['target/*.zip']);
  });
});

test('planProjectBuilds only claims missing sources under a detected Maven target/', async () => {
  await withProject(SOURCE_FILES, async (projectDir) => {
    assert.deepEqual(planProjectBuilds(projectDir, []), []);
    // Missing non-build asset: not owned by Maven -> no build (existing behavior).
    assert.deepEqual(planProjectBuilds(projectDir, ['config/missing.yml']), []);
    // Missing Maven output: the project's pom.xml owns it.
    const plans = planProjectBuilds(projectDir, [
      'target/lib/jetty-runner.jar',
      'config/missing.yml',
    ]);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].system, 'maven');
    assert.equal(plans[0].dir, projectDir);
  });
});

test('javaLevelFromPom/mavenImageFor map legacy and modern Java levels', () => {
  assert.equal(javaLevelFromPom('<source>1.8</source>'), 8);
  assert.equal(javaLevelFromPom('<maven.compiler.release>17</maven.compiler.release>'), 17);
  assert.equal(javaLevelFromPom('<java.version>11</java.version>'), 11);
  assert.equal(javaLevelFromPom('<project></project>'), null);
  assert.equal(mavenImageFor(null), 'maven:3.9-eclipse-temurin-8');
  assert.equal(mavenImageFor(8), 'maven:3.9-eclipse-temurin-8');
  assert.equal(mavenImageFor(17), 'maven:3.9-eclipse-temurin-17');
  assert.equal(mavenImageFor(21), 'maven:3.9-eclipse-temurin-21');

  process.env.KLYRA_MAVEN_IMAGE = 'registry.local/maven:custom';
  try {
    assert.equal(mavenImageFor(8), 'registry.local/maven:custom');
  } finally {
    delete process.env.KLYRA_MAVEN_IMAGE;
  }
});

// ---------------------------------------------------------------------------
// Prepare-the-Docker-build-context orchestration
// ---------------------------------------------------------------------------

type Recorder = ReturnType<typeof recorder>;

/** Test build runner that only records the invocation. */
function trackBuild(rec: Recorder) {
  return async (build: { system: string; dir: string }): Promise<void> => {
    rec.builds.push({ system: build.system, dir: build.dir });
  };
}

test('TEST 1: project that already ships its artifacts is never rebuilt', async () => {
  await withProject(
    {
      ...SOURCE_FILES,
      'target/lib/jetty-runner.jar': 'jar',
      'target/app.war': 'war',
    },
    async (projectDir) => {
      const rec = recorder();
      await prepareDockerBuildContext(projectDir, rec.log, { runBuild: trackBuild(rec) });
      assert.equal(rec.builds.length, 0, 'existing target artifacts must not be rebuilt');
      assert.ok(rec.logs.some((line) => /already present/.test(line)));
      assert.equal(await exists(path.join(projectDir, 'target', 'app.war')), true);
    },
  );
});

test('TEST 2: Maven source with missing target/ runs the controlled build', async () => {
  await withProject(SOURCE_FILES, async (projectDir) => {
    const rec = recorder();
    await prepareDockerBuildContext(projectDir, rec.log, {
      runBuild: async (build, stagingDir) => {
        rec.builds.push({ system: build.system, dir: build.dir });
        assert.ok(
          stagingDir.includes('.klyra-maven-build-'),
          'the build runs in its own staging directory',
        );
        await fs.mkdir(path.join(build.dir, 'target', 'lib'), { recursive: true });
        await fs.writeFile(path.join(build.dir, 'target', 'lib', 'jetty-runner.jar'), 'jar');
        await fs.writeFile(path.join(build.dir, 'target', 'app.war'), 'war');
      },
    });

    assert.equal(rec.builds.length, 1, 'a missing target/ triggers exactly one project build');
    assert.deepEqual(rec.builds[0], { system: 'maven', dir: projectDir });
    assert.equal(await exists(path.join(projectDir, 'target', 'lib', 'jetty-runner.jar')), true);
    assert.equal(await exists(path.join(projectDir, 'target', 'app.war')), true);
    assert.equal(
      missingDockerfileSources(projectDir, parseDockerfileCopySources(MAVEN_DOCKERFILE)).length,
      0,
      'after the build every Dockerfile COPY source exists — docker build can proceed',
    );
    assert.ok(rec.logs.some((line) => /Docker build can proceed/.test(line)));
  });
});

test('TEST 3: failed Maven build fails cleanly and cleans generated artifacts', async () => {
  await withProject(SOURCE_FILES, async (projectDir, root) => {
    const rec = recorder();
    await assert.rejects(
      () =>
        prepareDockerBuildContext(projectDir, rec.log, {
          runBuild: async () => {
            rec.builds.push({ system: 'maven', dir: projectDir });
            await fs.mkdir(path.join(projectDir, 'target'), { recursive: true });
            await fs.writeFile(path.join(projectDir, 'target', 'partial.war'), 'partial');
            throw new Error('simulated maven failure');
          },
        }),
      /simulated maven failure/,
      'the pipeline must throw, so docker build is never attempted after a failed build',
    );

    assert.equal(rec.builds.length, 1);
    assert.equal(
      await exists(path.join(projectDir, 'target')),
      false,
      'the target/ generated by the failed build is cleaned up',
    );
    assert.deepEqual(await stagingDirs(root), [], 'the build staging directory is cleaned up');
  });
});

test('TEST 4: build succeeds but a required artifact is still missing -> precise error', async () => {
  await withProject(SOURCE_FILES, async (projectDir, root) => {
    const rec = recorder();
    await assert.rejects(
      () =>
        prepareDockerBuildContext(projectDir, rec.log, {
          runBuild: async () => {
            // Produces only the war — the runner jar the Dockerfile COPYes stays missing.
            await fs.mkdir(path.join(projectDir, 'target'), { recursive: true });
            await fs.writeFile(path.join(projectDir, 'target', 'app.war'), 'war');
          },
        }),
      (error: Error) => {
        assert.match(error.message, /still missing required files/);
        assert.match(error.message, /target\/lib\/jetty-runner\.jar/);
        return true;
      },
      'a guaranteed-to-fail docker build must never be attempted',
    );

    assert.equal(
      await exists(path.join(projectDir, 'target')),
      false,
      'the incomplete generated target/ is cleaned up',
    );
    assert.deepEqual(await stagingDirs(root), []);
  });
});

test('TEST 5: non-Maven Docker projects keep the previous behavior', async () => {
  // (a) Complete non-Maven context: nothing to do.
  await withProject(
    {
      Dockerfile: 'FROM node:20-alpine\nCOPY app.js /app/app.js\nCOPY . /app\nCMD ["node", "/app/app.js"]\n',
      'app.js': 'console.log(1)\n',
    },
    async (projectDir) => {
      const rec = recorder();
      await prepareDockerBuildContext(projectDir, rec.log, { runBuild: trackBuild(rec) });
      assert.equal(rec.builds.length, 0);
    },
  );

  // (b) Missing non-build file without any manifest: deferred to docker build.
  await withProject(
    { Dockerfile: 'FROM alpine\nCOPY config/missing.yml /app/\n', 'README.md': 'x\n' },
    async (projectDir) => {
      const rec = recorder();
      await prepareDockerBuildContext(projectDir, rec.log, { runBuild: trackBuild(rec) });
      assert.equal(rec.builds.length, 0, 'no build system -> previous behavior is preserved');
      assert.ok(rec.logs.some((line) => /deferring to docker build/.test(line)));
    },
  );

  // (c) Missing non-build file WITH a pom.xml: still not treated as a Maven output.
  await withProject(
    { Dockerfile: 'FROM alpine\nCOPY config/missing.yml /app/\n', 'pom.xml': POM },
    async (projectDir) => {
      const rec = recorder();
      await prepareDockerBuildContext(projectDir, rec.log, { runBuild: trackBuild(rec) });
      assert.equal(rec.builds.length, 0);
    },
  );
});

test('TEST 6: traversal/absolute COPY sources never resolve outside the workspace', async () => {
  const dockerfile = [
    'FROM alpine',
    'COPY ../../outside.txt /app/outside.txt',
    'COPY C:/Windows/win.ini /app/win.ini',
    'COPY /etc/passwd /app/passwd',
    'COPY app.js /app/app.js',
    '',
  ].join('\n');

  await withProject({ Dockerfile: dockerfile, 'app.js': 'x\n' }, async (projectDir, root) => {
    // Escaping references are never checked against (or resolved to) host paths.
    assert.deepEqual(
      missingDockerfileSources(projectDir, [
        '../../outside.txt',
        'C:/Windows/win.ini',
        '/etc/passwd',
      ]),
      [],
    );
    assert.deepEqual(planProjectBuilds(projectDir, ['../../outside.txt']), []);

    const sentinel = path.join(root, 'outside.txt');
    await fs.writeFile(sentinel, 'sentinel');
    const rec = recorder();
    await prepareDockerBuildContext(projectDir, rec.log, { runBuild: trackBuild(rec) });

    assert.equal(rec.builds.length, 0, 'escaping paths can never trigger a build');
    assert.equal(await fs.readFile(sentinel, 'utf-8'), 'sentinel');
    assert.deepEqual(await stagingDirs(root), []);
  });
});
import assert from 'node:assert/strict';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { confirmServedBasePath, detectUpstream, extractOperations } from '../modules/api-build/api-build.detect';

let server: Server;
let origin: string;
const petstore = {
  swagger: '2.0',
  info: { title: 'Swagger Petstore', version: '1.0.0' },
  host: 'petstore.swagger.io',
  basePath: '/v2',
  schemes: ['https', 'http'],
  paths: {
    '/pet/findByStatus': { get: { parameters: [{ name: 'status', in: 'query', required: true, type: 'array', collectionFormat: 'multi', items: { type: 'string', enum: ['available', 'pending', 'sold'], default: 'available' } }], responses: { '200': { description: 'ok' } } } },
    '/pet/{petId}': { get: { parameters: [{ name: 'petId', in: 'path', required: true, type: 'integer', format: 'int64' }], responses: { '200': { description: 'ok' } } } },
  },
};
const anotherApi = {
  openapi: '3.0.3',
  info: { title: 'Path and query API', version: '1.0.0' },
  servers: [{ url: '/api/v{version}', variables: { version: { default: '2' } } }],
  components: { parameters: { itemId: { name: 'itemId', in: 'path', required: true, schema: { type: 'string', example: 'abc-123' } } } },
  paths: {
    '/items/{itemId}': {
      parameters: [{ $ref: '#/components/parameters/itemId' }],
      get: { parameters: [{ name: 'include', in: 'query', required: false, schema: { type: 'boolean', default: true } }], responses: { '200': { description: 'ok' } } },
    },
  },
};

before(async () => {
  server = createServer((req, res) => {
    const body = req.url?.startsWith('/swagger.json') ? petstore : anotherApi;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

test('imports Swagger Petstore paths, basePath, and query/path metadata exactly', async () => {
  const detected = await detectUpstream(origin, `${origin}/swagger.json`);
  assert.equal(detected.basePath, '/v2');
  const endpoints = extractOperations(detected.foundAt || '', detected.endpoints);
  const find = endpoints.find((endpoint) => endpoint.path === '/pet/findByStatus');
  assert.equal(find?.method, 'GET');
  assert.equal(find?.path, '/pet/findByStatus');
  assert.equal(find?.basePath, '/v2');
  assert.deepEqual(find?.parameters[0], {
    name: 'status', in: 'query', type: 'array', required: true, description: '', example: 'available',
    enum: ['available', 'pending', 'sold'], default: 'available', collectionFormat: 'multi',
  });
  const byId = endpoints.find((endpoint) => endpoint.path === '/pet/{petId}');
  assert.equal(byId?.parameters.find((parameter) => parameter.in === 'path')?.format, 'int64');
});

test('imports OpenAPI 3 path-item references and server variables', async () => {
  const detected = await detectUpstream(origin, `${origin}/openapi.json`);
  assert.equal(detected.basePath, '/api/v2');
  const endpoints = extractOperations(detected.foundAt || '', detected.endpoints);
  const item = endpoints.find((endpoint) => endpoint.path === '/items/{itemId}');
  assert.equal(item?.path, '/items/{itemId}');
  assert.equal(item?.basePath, '/api/v2');
  assert.equal(item?.parameters.find((parameter) => parameter.in === 'path')?.example, 'abc-123');
  assert.equal(item?.parameters.find((parameter) => parameter.name === 'include')?.example, 'true');
});

/* ---------------------------------------------------------------------------
 * Served base path confirmation.
 *
 * The deployed-API shape Klyra actually meets: the specification declares the
 * vendor's public host (`servers: https://petstore3.swagger.io/api/v3`) while
 * the container answers on its own origin under the same path. Ignoring the path
 * makes every Playground request 404, so detection confirms it with a real
 * request instead of guessing.
 * ------------------------------------------------------------------------- */

const mountedSpec = {
  openapi: '3.0.3',
  info: { title: 'Mounted petstore', version: '1.0.0' },
  servers: [{ url: 'https://petstore3.swagger.io/api/v3' }],
  paths: { '/pet/findByStatus': { get: { responses: { '200': { description: 'ok' } } } } },
};

let mounted: Server;
let mountedOrigin: string;
/** An API mounted at the origin root: everything else answers 404. */
let rootOnly: Server;
let rootOnlyOrigin: string;

/** Behaviour of the deployed petstore container: mounted under /api/v3 only. */
const mountedHandler = (req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/api/v3/openapi.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(mountedSpec));
    return;
  }
  if (req.url?.startsWith('/api/v3/pet/')) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end('{"message":"required parameter missing"}');
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end('{"message":"not found"}');
};

before(async () => {
  mounted = createServer(mountedHandler);
  await new Promise<void>((resolve) => mounted.listen(0, '127.0.0.1', resolve));
  mountedOrigin = `http://127.0.0.1:${(mounted.address() as AddressInfo).port}`;

  rootOnly = createServer((req, res) => {
    if (req.url === '/pet/findByStatus') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"status":"available"}');
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"message":"not found"}');
  });
  await new Promise<void>((resolve) => rootOnly.listen(0, '127.0.0.1', resolve));
  rootOnlyOrigin = `http://127.0.0.1:${(rootOnly.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => mounted.close((error) => error ? reject(error) : resolve()));
  await new Promise<void>((resolve, reject) => rootOnly.close((error) => error ? reject(error) : resolve()));
});

test('confirms the declared base path against the origin that actually serves it', async () => {
  const detected = await detectUpstream(mountedOrigin, `${mountedOrigin}/api/v3/openapi.json`);
  assert.equal(detected.basePath, '/api/v3');
  // Internal evidence never leaks into the payload clients receive.
  assert.equal('declaredBasePath' in detected, false);
  const endpoints = extractOperations(detected.foundAt || '', detected.endpoints);
  assert.equal(endpoints[0].basePath, '/api/v3');
});

test('keeps the origin root when only the root serves the operations', async () => {
  // A specification declaring a foreign host + prefix that this origin does not
  // serve: the root wins, because the root answers and the prefix does not.
  const served = await confirmServedBasePath(rootOnlyOrigin, '/v1', [{ id: 'ep-1', method: 'GET', path: '/pet/findByStatus' }]);
  assert.equal(served, '');
  // Nothing conclusive (both candidates 404) keeps the document's declaration.
  const inconclusive = await confirmServedBasePath(mountedOrigin, '/nope', [{ id: 'ep-1', method: 'GET', path: '/missing' }]);
  assert.equal(inconclusive, '/nope');
  // A path parameter cannot be probed, so the declaration is kept untouched.
  const unprobeable = await confirmServedBasePath(rootOnlyOrigin, '/v1', [{ id: 'ep-1', method: 'GET', path: '/pet/{petId}' }]);
  assert.equal(unprobeable, '/v1');
});


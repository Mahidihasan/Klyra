import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isKlyraGatewayUrl,
  projectBaseUpstream,
  resolveDeploymentKind,
  resolveDeploymentUpstream,
} from '../modules/api-build/api-build.deployment';

/**
 * Regression tests for the upstream resolution used by the gateway that serves
 * "Test in Playground". A project record can hold the Klyra gateway URL as its
 * own baseUrl (the Configure step used to prefill it from the deployment
 * record); forwarding to that URL made the gateway call itself and every
 * playground request hung until the 30s timeout.
 */

test('a gateway URL stored as baseUrl is never used as the forwarding target', () => {
  const project = {
    id: 'proj-balance-xa2d5r',
    slug: 'balance',
    baseUrl: 'http://localhost:4000/api/gateway/balance',
    gatewayUrl: 'http://localhost:4000/api/gateway/balance',
    sourceKind: 'existing',
  };
  assert.equal(isKlyraGatewayUrl(project.baseUrl), true);
  assert.equal(projectBaseUpstream(project), '');
  assert.equal(resolveDeploymentUpstream(project), '');
  // ...and it no longer classifies the project as an externally connected API.
  assert.equal(resolveDeploymentKind(project), 'docker');
});

test('a real upstream is passed through untouched', () => {
  const project = {
    baseUrl: 'https://origin.example.com/api/v1',
    gatewayUrl: 'https://api.klyra.dev/api/gateway/atlas',
    sourceKind: 'existing',
  };
  assert.equal(isKlyraGatewayUrl(project.baseUrl), false);
  assert.equal(projectBaseUpstream(project), 'https://origin.example.com/api/v1');
  assert.equal(resolveDeploymentUpstream(project), 'https://origin.example.com/api/v1');
  assert.equal(resolveDeploymentKind(project), 'external');
});

test('a live container runtime still wins over the stored upstream', () => {
  const previous = process.env.KLYRA_DOCKER_RUNTIME;
  process.env.KLYRA_DOCKER_RUNTIME = 'host';
  try {
    const project = {
      baseUrl: 'https://origin.example.com',
      deployment: {
        kind: 'docker',
        status: 'healthy',
        runtime: {
          kind: 'docker',
          hostUrl: 'http://127.0.0.1:41000',
          internalUrl: 'http://klyra-api-atlas-v1.0.0:8080',
          upstream: 'http://127.0.0.1:41000',
        },
      },
    };
    assert.equal(resolveDeploymentUpstream(project), 'http://127.0.0.1:41000');
  } finally {
    if (previous === undefined) delete process.env.KLYRA_DOCKER_RUNTIME;
    else process.env.KLYRA_DOCKER_RUNTIME = previous;
  }
});

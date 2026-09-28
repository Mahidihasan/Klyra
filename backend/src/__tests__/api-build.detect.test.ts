import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { detectUpstream, extractOperations } from '../modules/api-build/api-build.detect';

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

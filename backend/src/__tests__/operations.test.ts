/* eslint-disable @typescript-eslint/no-var-requires */
// Node's built-in test runner. These tests cover the pure operation state
// machine (no DB). The database pool module is constructed on import, so a
// placeholder URL is provided before requiring it — no DB is actually used.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/klyra_test';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canTransition, isTerminal, isCancellable, isRetryable,
} = require('../modules/api-build/api-build.operations');

// ---------------------------------------------------------------------------
// Terminal states
// ---------------------------------------------------------------------------
test('succeeded, failed and cancelled are terminal', () => {
  assert.equal(isTerminal('succeeded'), true);
  assert.equal(isTerminal('failed'), true);
  assert.equal(isTerminal('cancelled'), true);
  assert.equal(isTerminal('queued'), false);
  assert.equal(isTerminal('running'), false);
  assert.equal(isTerminal('validating'), false);
});

// ---------------------------------------------------------------------------
// Happy-path lifecycle  queued → validating → running → succeeded
// ---------------------------------------------------------------------------
test('normal lifecycle transitions are allowed', () => {
  assert.equal(canTransition('queued', 'validating'), true);
  assert.equal(canTransition('queued', 'running'), true);
  assert.equal(canTransition('validating', 'running'), true);
  assert.equal(canTransition('running', 'succeeded'), true);
  assert.equal(canTransition('validating', 'succeeded'), true);
});

test('failures are reachable from validating and running only', () => {
  assert.equal(canTransition('running', 'failed'), true);
  assert.equal(canTransition('validating', 'failed'), true);
  assert.equal(canTransition('queued', 'failed'), false);
  assert.equal(canTransition('succeeded', 'failed'), false);
});

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------
test('cancellation allowed while queued/validating/running, never after terminal', () => {
  assert.equal(isCancellable('queued'), true);
  assert.equal(isCancellable('validating'), true);
  assert.equal(isCancellable('running'), true);
  assert.equal(isCancellable('succeeded'), false);
  assert.equal(isCancellable('failed'), false);
  assert.equal(isCancellable('cancelled'), false);

  assert.equal(canTransition('queued', 'cancelled'), true);
  assert.equal(canTransition('running', 'cancelled'), true);
  assert.equal(canTransition('succeeded', 'cancelled'), false);
  assert.equal(canTransition('failed', 'cancelled'), false);
});

// ---------------------------------------------------------------------------
// Retry — only failed/cancelled rows may be re-queued; success is immutable
// ---------------------------------------------------------------------------
test('retry re-queues failed and cancelled operations only', () => {
  assert.equal(isRetryable('failed'), true);
  assert.equal(isRetryable('cancelled'), true);
  assert.equal(isRetryable('succeeded'), false);
  assert.equal(isRetryable('running'), false);
  assert.equal(isRetryable('queued'), false);

  assert.equal(canTransition('failed', 'queued'), true);
  assert.equal(canTransition('cancelled', 'queued'), true);
  assert.equal(canTransition('succeeded', 'queued'), false);
});

// ---------------------------------------------------------------------------
// Illegal transitions
// ---------------------------------------------------------------------------
test('illegal jumps are rejected', () => {
  assert.equal(canTransition('queued', 'succeeded'), false);
  assert.equal(canTransition('queued', 'cancelled') === true, isCancellable('queued'));
  assert.equal(canTransition('running', 'queued'), false);
  assert.equal(canTransition('validating', 'cancelled'), true); // still cancellable
  assert.equal(canTransition('succeeded', 'running'), false);
  assert.equal(canTransition('cancelled', 'running'), false);
  assert.equal(canTransition('running', 'running'), false);
});

// ---------------------------------------------------------------------------
// Retryable lifecycle simulation (mirrors executor behaviour)
// ---------------------------------------------------------------------------
test('a full lifecycle: queued → running → failed → queued → running → succeeded', () => {
  let state = 'queued';
  const to = (next) => {
    assert.ok(canTransition(state, next), `${state} → ${next} must be allowed`);
    state = next;
  };
  to('validating');
  to('running');
  to('failed');
  assert.equal(isRetryable(state), true);
  to('queued'); // retry
  to('running');
  to('succeeded');
  assert.equal(isTerminal(state), true);
  assert.equal(isRetryable(state), false);
  assert.equal(isCancellable(state), false);
});

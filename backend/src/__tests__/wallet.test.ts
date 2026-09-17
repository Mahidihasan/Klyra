/* eslint-disable @typescript-eslint/no-var-requires */
export {};
// Wallet — the seven cases from WALLET_ARCHITECTURE.md section 7.
//
// Unlike otp.test.ts these tests need a real database: every case is about
// what Postgres does under a transaction, and a stubbed pool would be testing
// the stub. DATABASE_URL is read from .env.development, so these run against
// whichever database the backend is pointed at.
//
// They are written against the signed-in seed account and assert *deltas*, not
// absolute balances. Nothing is deleted and no wallet is reset: an earlier
// version of the Phase 3 script asserted absolutes and failed for the wrong
// reason as soon as the account had any history of its own.
//
// Run from backend/:
//   node --require ts-node/register/transpile-only --test src/__tests__/wallet.test.ts
//
// It is not in package.json's `test` script because that is a shared file this
// module is not allowed to edit — see the PR description.

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../../.env.development'),
});

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');

const { pool } = require('../services/database.service');
const {
  applyTransaction,
  getLedgerBalance,
  getOrCreateWallet,
  InsufficientFundsError,
  InvalidAmountError,
  WalletLockedError,
} = require('../modules/wallet/wallet.service');
const walletWebhookRouter = require('../modules/wallet/wallet.webhook').default;

const USER_ID = '6241905a-f51f-4ab2-81d7-e554836c7090';

async function balance(): Promise<number> {
  const r = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [USER_ID]);
  return r.rows[0] ? Number(r.rows[0].balance) : 0;
}

async function ledgerCount(): Promise<number> {
  const r = await pool.query(
    'SELECT COUNT(*)::int AS n FROM wallet_transactions WHERE user_id = $1',
    [USER_ID],
  );
  return r.rows[0].n;
}

/** Puts known funds in place so a test never depends on what came before it. */
async function fund(amount: number): Promise<void> {
  await applyTransaction({
    userId: USER_ID,
    type: 'BONUS',
    direction: 'CREDIT',
    amount,
    description: 'wallet.test — funding',
  });
}

// ---------------------------------------------------------------------------
// 1. Credit then debit leaves the expected balance
// ---------------------------------------------------------------------------
test('a credit then a debit leaves the expected balance', async () => {
  const start = await balance();

  const credit = await applyTransaction({
    userId: USER_ID, type: 'TOPUP', direction: 'CREDIT', amount: 50,
    description: 'wallet.test — credit',
  });
  assert.equal(credit.balanceAfter, start + 50);
  assert.equal(credit.status, 'COMPLETED');

  const debit = await applyTransaction({
    userId: USER_ID, type: 'SPEND', direction: 'DEBIT', amount: 12.25,
    description: 'wallet.test — debit',
  });
  assert.equal(debit.balanceAfter, start + 37.75);

  // The ledger row and the cached balance must be the same number, not two
  // numbers that happen to agree.
  assert.equal(await balance(), debit.balanceAfter);
});

// ---------------------------------------------------------------------------
// 2. A debit larger than the balance is rejected and writes nothing
// ---------------------------------------------------------------------------
test('an over-large debit is rejected and writes nothing', async () => {
  const before = await balance();
  const rowsBefore = await ledgerCount();

  await assert.rejects(
    applyTransaction({
      userId: USER_ID, type: 'SPEND', direction: 'DEBIT', amount: before + 1000,
      description: 'wallet.test — must never be written',
    }),
    InsufficientFundsError,
  );

  // Rejecting is not the same as rejecting cleanly; both are checked.
  assert.equal(await balance(), before);
  assert.equal(await ledgerCount(), rowsBefore);
});

test('malformed amounts are rejected before the database', async () => {
  for (const amount of [0, -5, 1.005, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      applyTransaction({ userId: USER_ID, type: 'SPEND', direction: 'DEBIT', amount }),
      InvalidAmountError,
      `amount ${amount} should have been refused`,
    );
  }
});

// ---------------------------------------------------------------------------
// 3. Two concurrent debits cannot both succeed past the balance
// ---------------------------------------------------------------------------
test('two concurrent debits cannot both succeed', async () => {
  await fund(40);

  const before = await balance();
  const rowsBefore = await ledgerCount();

  // Two of these overdraw by a penny, so exactly one must win. Without the
  // SELECT … FOR UPDATE both would read the same balance and both would pass.
  const each = Number((Math.floor((before * 100) / 2) / 100 + 0.01).toFixed(2));

  const results = await Promise.allSettled([
    applyTransaction({
      userId: USER_ID, type: 'SPEND', direction: 'DEBIT', amount: each,
      description: 'wallet.test — race A',
    }),
    applyTransaction({
      userId: USER_ID, type: 'SPEND', direction: 'DEBIT', amount: each,
      description: 'wallet.test — race B',
    }),
  ]);

  const won = results.filter((r) => r.status === 'fulfilled');
  const lost = results.filter((r) => r.status === 'rejected');

  assert.equal(won.length, 1, 'exactly one debit should succeed');
  assert.equal(lost.length, 1);
  assert.ok(
    (lost[0] as PromiseRejectedResult).reason instanceof InsufficientFundsError,
    'the loser should be refused for funds, not crash',
  );
  assert.equal(await ledgerCount(), rowsBefore + 1);
  assert.ok((await balance()) >= 0);
});

// ---------------------------------------------------------------------------
// 4. The same externalReference credits once
// ---------------------------------------------------------------------------
test('a repeated externalReference credits exactly once', async () => {
  const reference = `cs_test_unit_${Date.now()}`;
  const before = await balance();
  const rowsBefore = await ledgerCount();

  const first = await applyTransaction({
    userId: USER_ID, type: 'TOPUP', direction: 'CREDIT', amount: 25,
    externalReference: reference, description: 'wallet.test — first delivery',
  });
  const second = await applyTransaction({
    userId: USER_ID, type: 'TOPUP', direction: 'CREDIT', amount: 25,
    externalReference: reference, description: 'wallet.test — replayed delivery',
  });

  assert.equal(second.id, first.id, 'the replay should return the original row');
  assert.equal(await balance(), before + 25);
  assert.equal(await ledgerCount(), rowsBefore + 1);
});

test('simultaneous deliveries of one event still credit once', async () => {
  const reference = `cs_test_race_${Date.now()}`;
  const before = await balance();
  const rowsBefore = await ledgerCount();

  // Both calls pass the existence check before either inserts; the unique
  // index on external_reference is what actually stops the second credit.
  const [a, b] = await Promise.all([
    applyTransaction({
      userId: USER_ID, type: 'TOPUP', direction: 'CREDIT', amount: 10,
      externalReference: reference,
    }),
    applyTransaction({
      userId: USER_ID, type: 'TOPUP', direction: 'CREDIT', amount: 10,
      externalReference: reference,
    }),
  ]);

  assert.equal(a.id, b.id);
  assert.equal(await balance(), before + 10);
  assert.equal(await ledgerCount(), rowsBefore + 1);
});

// ---------------------------------------------------------------------------
// 5. SUM(ledger) equals wallets.balance after a mixed sequence
// ---------------------------------------------------------------------------
test('the ledger and the cached balance agree after a mixed sequence', async () => {
  await fund(60);
  await applyTransaction({
    userId: USER_ID, type: 'SPEND', direction: 'DEBIT', amount: 13.37,
    description: 'wallet.test — mixed spend',
  });
  await applyTransaction({
    userId: USER_ID, type: 'REFUND', direction: 'CREDIT', amount: 3.37,
    description: 'wallet.test — mixed refund',
  });
  await applyTransaction({
    userId: USER_ID, type: 'ADJUSTMENT', direction: 'DEBIT', amount: 0.01,
    description: 'wallet.test — mixed adjustment',
  });

  const ledger = await getLedgerBalance(USER_ID);
  const cached = await balance();

  assert.ok(
    Math.abs(ledger - cached) < 0.005,
    `ledger ${ledger.toFixed(2)} should equal balance ${cached.toFixed(2)}`,
  );
});

// ---------------------------------------------------------------------------
// 6. A locked wallet rejects debits but still accepts credits
// ---------------------------------------------------------------------------
test('a locked wallet refuses debits and accepts credits', async () => {
  await fund(20);
  await pool.query('UPDATE wallets SET is_locked = TRUE WHERE user_id = $1', [USER_ID]);

  try {
    await assert.rejects(
      applyTransaction({
        userId: USER_ID, type: 'SPEND', direction: 'DEBIT', amount: 1,
        description: 'wallet.test — debit on a locked wallet',
      }),
      WalletLockedError,
    );

    // A freeze stops spending, not funding: there is no reason to refuse money.
    const credit = await applyTransaction({
      userId: USER_ID, type: 'TOPUP', direction: 'CREDIT', amount: 5,
      description: 'wallet.test — credit to a locked wallet',
    });
    assert.equal(credit.direction, 'CREDIT');
  } finally {
    await pool.query('UPDATE wallets SET is_locked = FALSE WHERE user_id = $1', [USER_ID]);
  }
});

// ---------------------------------------------------------------------------
// 7. A webhook with a bad signature is rejected and credits nothing
// ---------------------------------------------------------------------------
test('the webhook rejects a tampered signature and credits nothing', async (t: any) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    t.skip('STRIPE_WEBHOOK_SECRET not configured');
    return;
  }

  // Only the webhook router, mounted the way app.ts mounts it: raw body above
  // any JSON parser, because Stripe signs the unparsed bytes.
  const app = express();
  app.use('/api/wallet/webhook', express.raw({ type: 'application/json' }), walletWebhookRouter);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_test_unit_${Date.now()}`,
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: 999999,
        currency: 'usd',
        metadata: { klyraUserId: USER_ID, klyraPurpose: 'wallet_topup' },
      },
    },
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const good = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  const tampered = `t=${timestamp},v1=${good.replace(/^./, (c: string) => (c === '0' ? '1' : '0'))}`;

  const before = await balance();
  const rowsBefore = await ledgerCount();

  try {
    const bad = await fetch(`http://127.0.0.1:${port}/api/wallet/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': tampered },
      body: payload,
    });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error.code, 'INVALID_SIGNATURE');

    const missing = await fetch(`http://127.0.0.1:${port}/api/wallet/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    assert.equal(missing.status, 400);

    // The point of the test: an unverified webhook is free money for anyone
    // who finds the URL, so nothing at all may have moved.
    assert.equal(await balance(), before);
    assert.equal(await ledgerCount(), rowsBefore);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test.after(async () => {
  await pool.end();
});

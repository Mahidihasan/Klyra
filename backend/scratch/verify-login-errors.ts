/**
 * Verifies the POST /api/auth/login error mapping after the LoginError
 * refactor: only intended rejections may answer 4xx; anything else must be 500.
 *
 * Runs the real router in-process against a patched AuthService.login, so no
 * database write or real credential is involved.
 *
 * Usage (from backend/):
 *   node --require ts-node/register/transpile-only scratch/verify-login-errors.ts
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env.development') });

import express from 'express';
import { AuthService, LoginError } from '../src/modules/auth/auth.service';
import authRouter from '../src/modules/auth/auth.routes';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

const cases: Array<{ name: string; thrown: any; expectStatus: number; expectCode: string }> = [
  {
    name: 'internal fault (e.g. missing table / pool timeout)',
    thrown: Object.assign(new Error('Invalid `prisma.session.create()` invocation in auth.service.ts'), { code: 'P2021' }),
    expectStatus: 500,
    expectCode: 'LOGIN_FAILED',
  },
  {
    name: 'unknown error whose message mentions "locked" (old sniffing bug)',
    thrown: new Error('Something is locked somewhere'),
    expectStatus: 500,
    expectCode: 'LOGIN_FAILED',
  },
  {
    name: 'wrong credentials',
    thrown: new LoginError('Invalid email or password.', 'INVALID_CREDENTIALS', 401),
    expectStatus: 401,
    expectCode: 'INVALID_CREDENTIALS',
  },
  {
    name: 'account locked',
    thrown: new LoginError('Account locked for 20 minutes due to 3 failed login attempts.', 'ACCOUNT_LOCKED', 423),
    expectStatus: 423,
    expectCode: 'ACCOUNT_LOCKED',
  },
  {
    name: 'inactive (reactivation) account',
    thrown: new LoginError('Account is inactive or suspended.', 'ACCOUNT_INACTIVE', 403),
    expectStatus: 403,
    expectCode: 'ACCOUNT_INACTIVE',
  },
  {
    name: 'suspended account',
    thrown: new LoginError('Account is inactive or suspended.', 'ACCOUNT_SUSPENDED', 403),
    expectStatus: 403,
    expectCode: 'ACCOUNT_SUSPENDED',
  },
  {
    name: 'unverified email',
    thrown: new LoginError('Please verify your email address before logging in.', 'EMAIL_NOT_VERIFIED', 403),
    expectStatus: 403,
    expectCode: 'EMAIL_NOT_VERIFIED',
  },
];

async function main() {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}/api/auth/login`;

  let failures = 0;
  for (const testCase of cases) {
    (AuthService as any).login = async () => {
      throw testCase.thrown;
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'someone@example.com', password: 'pw' }),
    });
    const body: any = await res.json().catch(() => null);
    const ok = res.status === testCase.expectStatus && body?.code === testCase.expectCode;
    if (!ok) failures += 1;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${testCase.name} -> ${res.status} ${JSON.stringify(body?.code)}` +
        (ok ? '' : ` (expected ${testCase.expectStatus} ${testCase.expectCode})`),
    );
  }

  server.close();
  console.log(failures === 0 ? '\nAll login error mappings behave as specified.' : `\n${failures} case(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

void main();

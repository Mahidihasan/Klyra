import path from 'path';

import dotenv from 'dotenv';

// Load environment variables before anything imports the database pool —
// database.service.ts builds its Pool at module load, so process.env must
// already be populated. Keep the './app' import below this call.
const shellGeminiEnv = Object.fromEntries(
  ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_INSPECTOR_MODEL'].map((key) => [key, process.env[key]]),
);
const envFile = process.env.ENV_FILE || '.env.development';
dotenv.config({ path: path.resolve(__dirname, '../../', envFile) });
dotenv.config();
// The backend has its own local .env as well as the workspace-level
// .env.development. Prefer backend-specific Gemini credentials/model settings
// when present, without changing precedence for database or other services.
const backendEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') }).parsed || {};
for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_INSPECTOR_MODEL']) {
  const value = backendEnv[key]?.trim();
  if (value) process.env[key] = value;
  if (shellGeminiEnv[key]) process.env[key] = shellGeminiEnv[key];
}

// eslint-disable-next-line import/first
import app from './app';
import { connectListener } from './modules/billing/realtime.service';
import { connectRepoListener } from './modules/repos/realtime.service';
import { startApiBuildQueue } from './modules/api-build/api-build.queue';
import { startApiBuildTelemetry } from './modules/api-build/api-build.telemetry';
import { startOperationReaper } from './modules/api-build/api-build.operations';

const PORT = process.env.PORT || 4000;

// Validate email provider configuration (Brevo/demo). Logs a clear,
// secret-free report and keeps the server up so the problem is visible
// without crashing the whole backend.
import { reportEmailConfig } from './modules/auth/email.config';
reportEmailConfig();

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server running on http://localhost:${PORT}`);
});

// Open the Postgres LISTEN/NOTIFY connection for billing realtime. It retries
// in the background if it can't connect, so this is fire-and-forget.
void connectListener();

// Open the Postgres LISTEN/NOTIFY connection for repository realtime (CI,
// deployments, activity). Also retries in the background.
void connectRepoListener();
startApiBuildQueue();
startApiBuildTelemetry();
startOperationReaper();

process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('HTTP server closed');
  });
});

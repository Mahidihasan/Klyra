import path from 'path';

import dotenv from 'dotenv';

// Load environment variables before anything imports the database pool —
// database.service.ts builds its Pool at module load, so process.env must
// already be populated. Keep the './app' import below this call.
const envFile = process.env.ENV_FILE || '.env.development';
dotenv.config({ path: path.resolve(__dirname, '../../', envFile) });
dotenv.config();

// eslint-disable-next-line import/first
import app from './app';
import { connectListener } from './modules/billing/realtime.service';

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server running on http://localhost:${PORT}`);
});

// Open the Postgres LISTEN/NOTIFY connection for billing realtime. It retries
// in the background if it can't connect, so this is fire-and-forget.
void connectListener();

process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('HTTP server closed');
  });
});

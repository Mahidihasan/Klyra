import path from 'path';

import dotenv from 'dotenv';

import app from './app';

// Load environment variables - prefer .env.development in dev mode
const envFile = process.env.ENV_FILE || '.env.development';
dotenv.config({ path: path.resolve(__dirname, '../../', envFile) });

// Also try the default .env for fallback
dotenv.config();

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('HTTP server closed');
  });
});

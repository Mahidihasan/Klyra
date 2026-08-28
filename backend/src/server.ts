import dotenv from 'dotenv';
import path from 'path';

// Load environment variables - prefer .env.development in dev mode
const envFile = process.env.ENV_FILE || '.env.development';
dotenv.config({ path: path.resolve(__dirname, '../../', envFile) });

// Also try the default .env for fallback
dotenv.config();

import app from './app';

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

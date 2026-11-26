import { createApp } from './app.js';
import { config } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { pool } from './db/pool.js';
import { ensurePresentationSeed } from './services/bootstrapService.js';
import { ensureStorageReady } from './services/storageService.js';

async function start() {
  await runMigrations();
  await ensureStorageReady();
  await ensurePresentationSeed({
    email: config.platformAdmin.email,
    password: config.platformAdmin.password,
    firstName: config.platformAdmin.firstName,
    lastName: config.platformAdmin.lastName
  });
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Auth service listening on ${config.port}`);
  });

  async function shutdown(signal) {
    console.log(`Received ${signal}, shutting down auth service`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('Failed to start auth service', error);
  process.exit(1);
});

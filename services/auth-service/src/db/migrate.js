import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(currentDir, 'schema.sql');

export async function runMigrations() {
  const schema = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schema);
}

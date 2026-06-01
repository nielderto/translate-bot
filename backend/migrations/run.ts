import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL not set');

const client = new pg.Client({ connectionString: url });
await client.connect();

const files = readdirSync(__dirname).filter(f => f.endsWith('.sql')).sort();
for (const file of files) {
  console.log(`Applying ${file}`);
  const sql = readFileSync(join(__dirname, file), 'utf8');
  await client.query(sql);
}
await client.end();
console.log('Done.');

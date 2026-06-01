import { describe, it, expect, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { getPool, getDb } from '../src/db';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

describe('db', () => {
  afterAll(async () => {
    await getPool().end();
  });

  it('pg pool connects and runs a trivial query', async () => {
    const { rows } = await getPool().query<{ n: number }>('SELECT 1 as n');
    expect(rows[0]?.n).toBe(1);
  });

  it('drizzle client runs a trivial query', async () => {
    const result = await getDb().execute<{ n: number }>(sql`SELECT 1 as n`);
    expect(result.rows[0]?.n).toBe(1);
  });
});

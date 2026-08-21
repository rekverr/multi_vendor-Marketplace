import { Pool } from 'pg';

export default async function globalTeardown(): Promise<void> {
  const schema = process.env.E2E_DATABASE_SCHEMA;
  const databaseUrl = process.env.DATABASE_URL;
  if (!schema || !databaseUrl || !/^e2e_[a-z0-9_]+$/.test(schema)) return;

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await pool.end();
  }
}

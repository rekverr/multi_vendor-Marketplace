import { Pool } from 'pg';
import {
  readE2eDatabaseState,
  removeE2eDatabaseState,
} from './e2e-database-state.ts';

export default async function globalTeardown(): Promise<void> {
  const state = readE2eDatabaseState();
  const schema = state?.schema;
  const databaseUrl = state?.databaseUrl;
  if (!schema || !databaseUrl || !/^e2e_[a-z0-9_]+$/.test(schema)) return;

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await pool.end();
    removeE2eDatabaseState();
  }
}

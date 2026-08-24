import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { writeE2eDatabaseState } from './e2e-database-state.ts';

export default function globalSetup(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for E2E tests');

  const schema = `e2e_${process.pid}_${randomBytes(6).toString('hex')}`;
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', schema);

  process.env.NODE_ENV = 'test';
  process.env.E2E_DATABASE_SCHEMA = schema;
  process.env.DATABASE_URL = url.toString();
  writeE2eDatabaseState({ databaseUrl: url.toString(), schema });

  execFileSync(
    process.execPath,
    [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    {
      cwd: resolve('.'),
      env: process.env,
      stdio: 'inherit',
    },
  );
}

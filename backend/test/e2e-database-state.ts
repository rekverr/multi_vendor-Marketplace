import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface E2eDatabaseState {
  databaseUrl: string;
  schema: string;
}

const statePath = resolve('.e2e-database-state.json');

export function writeE2eDatabaseState(state: E2eDatabaseState): void {
  writeFileSync(statePath, JSON.stringify(state), { encoding: 'utf8' });
}

export function readE2eDatabaseState(): E2eDatabaseState | null {
  if (!existsSync(statePath)) return null;
  const value: unknown = JSON.parse(readFileSync(statePath, 'utf8'));
  if (
    typeof value !== 'object' ||
    value === null ||
    !('databaseUrl' in value) ||
    typeof value.databaseUrl !== 'string' ||
    !('schema' in value) ||
    typeof value.schema !== 'string'
  ) {
    throw new Error('Invalid E2E database state');
  }
  return { databaseUrl: value.databaseUrl, schema: value.schema };
}

export function removeE2eDatabaseState(): void {
  if (existsSync(statePath)) unlinkSync(statePath);
}

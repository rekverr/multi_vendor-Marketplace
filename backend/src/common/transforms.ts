import type { TransformFnParams } from 'class-transformer';

export function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export function parseBooleanString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  if (input === 'true') return true;
  if (input === 'false') return false;
  return input;
}

export function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvRow(values: unknown[]): string {
  return `${values.map(escapeCsv).join(',')}\r\n`;
}

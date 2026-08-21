export type CsvValue = string | number | bigint | boolean | null | undefined;

export function escapeCsv(value: CsvValue): string {
  const text = value === null || value === undefined ? '' : `${value}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvRow(values: CsvValue[]): string {
  return `${values.map(escapeCsv).join(',')}\r\n`;
}

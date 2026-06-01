export function csvCell(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function jsonLine(dataset: string, data: unknown) {
  return JSON.stringify({ dataset, data });
}

export function csvRow(dataset: string, data: Record<string, unknown>) {
  return [
    csvCell(dataset),
    csvCell(data.id),
    csvCell(JSON.stringify(data)),
  ].join(",");
}

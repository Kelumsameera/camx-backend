// Utility for safe CSV generation protecting against CSV formula injection and formatting errors

export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) {
    return '""';
  }

  let stringValue = String(value);

  // CSV Formula Injection Prevention:
  // Prepend single quote if cell starts with dangerous formula triggers
  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r"];
  if (dangerousPrefixes.some((prefix) => stringValue.startsWith(prefix))) {
    stringValue = `'${stringValue}`;
  }

  // Escape inner double quotes by doubling them
  const escapedValue = stringValue.replace(/"/g, '""');

  return `"${escapedValue}"`;
}

export function generateCsv(headers, rows) {
  const headerLine = headers.map(sanitizeCsvCell).join(",");
  const rowLines = rows.map((row) => row.map(sanitizeCsvCell).join(","));
  return [headerLine, ...rowLines].join("\r\n");
}

export default { sanitizeCsvCell, generateCsv };

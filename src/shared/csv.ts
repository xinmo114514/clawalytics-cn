function escapeCsvCell(value: unknown): string {
  let text = String(value ?? '')
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) {
    text = `'${text}`
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(headers: unknown[], rows: unknown[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n')
}

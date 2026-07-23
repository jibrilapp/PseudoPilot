/** Escape a string for Python double-quoted literals. */
export function escapePythonString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/** Escape a character for Python/Cambridge single-quoted CHAR literals. */
export function escapePythonChar(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

/** Escape a string for Cambridge double-quoted literals. */
export function escapeCambridgeString(value: string): string {
  return escapePythonString(value);
}

export function escapeCambridgeChar(value: string): string {
  return escapePythonChar(value);
}

export function formatRealLiteral(value: number): string {
  if (Number.isInteger(value)) {
    return value.toFixed(1);
  }
  const text = String(value);
  if (!text.includes('.')) {
    return `${text}.0`;
  }
  return text;
}

export function formatBooleanCambridge(value: boolean): string {
  return value ? 'TRUE' : 'FALSE';
}

export function formatBooleanPython(value: boolean): string {
  return value ? 'True' : 'False';
}

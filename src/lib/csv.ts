export function csvEscape(value: string | number | null | undefined): string {
  const stringValue = value === null || value === undefined ? "" : String(value);

  if (!/[",\r\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function spreadsheetSafeCsvText(value: string): string {
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}\r\n`;
}

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new Error("Unexpected quote in CSV field.");
      }
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (character === "\r" || character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";

      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    throw new Error("CSV contains an unclosed quoted field.");
  }

  row.push(field);
  rows.push(row);

  return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

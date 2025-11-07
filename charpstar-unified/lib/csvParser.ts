export interface ParsedCSV {
  headers: string[];
  rows: string[][];
  delimiter: string;
  encoding: string;
  rowCount: number;
  columnCount: number;
}

export interface CSVParseOptions {
  delimiter?: string;
  skipEmptyLines?: boolean;
  skipHeader?: boolean;
}

/**
 * Detect CSV delimiter
 */
export function detectDelimiter(text: string): string {
  const delimiters = [',', ';', '\t', '|'];
  const delimiterCounts: Record<string, number> = {};

  // Count occurrences of each delimiter in first few lines
  const sample = text.substring(0, Math.min(5000, text.length));
  const lines = sample.split('\n').slice(0, 10);

  for (const line of lines) {
    for (const delimiter of delimiters) {
      const count = (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (count > 0) {
        delimiterCounts[delimiter] = (delimiterCounts[delimiter] || 0) + count;
      }
    }
  }

  // Return delimiter with highest count, default to comma
  const detected = Object.entries(delimiterCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0];
  
  return detected || ',';
}

/**
 * Parse CSV text
 */
export function parseCSV(
  text: string,
  options: CSVParseOptions = {}
): ParsedCSV {
  const { delimiter, skipEmptyLines = true, skipHeader = false } = options;
  
  // Detect delimiter if not provided
  const detectedDelimiter = delimiter || detectDelimiter(text);
  
  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split into lines
  let lines = normalizedText.split('\n');
  
  // Remove empty lines
  if (skipEmptyLines) {
    lines = lines.filter(line => line.trim().length > 0);
  }
  
  // Skip header if needed
  const headerLine = skipHeader ? null : lines[0];
  const dataLines = skipHeader ? lines : lines.slice(1);
  
  // Parse headers
  const headers = headerLine
    ? parseCSVLine(headerLine, detectedDelimiter)
    : [];
  
  // Parse data rows
  const rows = dataLines.map(line => parseCSVLine(line, detectedDelimiter));
  
  // Filter out rows with different column counts (likely errors)
  const expectedColumnCount = headers.length;
  const validRows = expectedColumnCount > 0
    ? rows.filter(row => row.length === expectedColumnCount)
    : rows;
  
  return {
    headers,
    rows: validRows,
    delimiter: detectedDelimiter,
    encoding: 'UTF-8', // Default, could be enhanced with encoding detection
    rowCount: validRows.length,
    columnCount: headers.length || (validRows[0]?.length || 0)
  };
}

/**
 * Parse a single CSV line
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  
  return result;
}

/**
 * Validate CSV structure
 */
export function validateCSV(parsed: ParsedCSV): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (parsed.headers.length === 0) {
    errors.push('No headers found in CSV');
  }
  
  if (parsed.rows.length === 0) {
    errors.push('No data rows found in CSV');
  }
  
  // Check for inconsistent column counts
  const columnCounts = new Set(parsed.rows.map(row => row.length));
  if (columnCounts.size > 1) {
    warnings.push(`Inconsistent column counts detected. Expected ${parsed.headers.length} columns.`);
  }
  
  // Check for empty headers
  const emptyHeaders = parsed.headers.filter(h => !h || h.trim() === '');
  if (emptyHeaders.length > 0) {
    warnings.push(`${emptyHeaders.length} empty header(s) detected`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sample rows from CSV for analysis
 */
export function sampleRows(parsed: ParsedCSV, count: number = 10): string[][] {
  if (parsed.rows.length <= count) {
    return parsed.rows;
  }
  
  // Get first few and some random ones
  const firstFew = parsed.rows.slice(0, Math.floor(count / 2));
  const remaining = parsed.rows.slice(Math.floor(count / 2));
  
  // Random sample from remaining
  const randomSample: string[][] = [];
  const sampleSize = count - firstFew.length;
  
  for (let i = 0; i < sampleSize && remaining.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * remaining.length);
    randomSample.push(remaining[randomIndex]);
    remaining.splice(randomIndex, 1);
  }
  
  return [...firstFew, ...randomSample];
}



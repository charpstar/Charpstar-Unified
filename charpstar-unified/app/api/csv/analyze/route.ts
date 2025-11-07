import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, validateCSV, sampleRows } from '@/lib/csvParser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    const parsed = parseCSV(text);

    // Validate
    const validation = validateCSV(parsed);

    // Sample rows for preview
    const samples = sampleRows(parsed, 10);

    return NextResponse.json({
      success: true,
      csv: {
        headers: parsed.headers,
        rowCount: parsed.rowCount,
        columnCount: parsed.columnCount,
        delimiter: parsed.delimiter,
        encoding: parsed.encoding,
        validation,
        samples: samples.slice(0, 10).map((row, index) => ({
          rowNumber: index + 1,
          data: parsed.headers.reduce((acc, header, i) => {
            acc[header] = row[i] || '';
            return acc;
          }, {} as Record<string, string>)
        }))
      }
    });
  } catch (error) {
    console.error('Error analyzing CSV:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze CSV',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



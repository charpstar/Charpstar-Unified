import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, sampleRows } from '@/lib/csvParser';
import { CSVProcessor } from '@/lib/csvProcessor';

export async function POST(request: NextRequest) {
  try {
    const { csvText, clientName, previewRowCount = 10 } = await request.json();

    if (!csvText) {
      return NextResponse.json(
        { error: 'CSV text is required' },
        { status: 400 }
      );
    }

    // Parse CSV
    const parsed = parseCSV(csvText);

    // Process CSV
    const processor = new CSVProcessor();
    
    const result = await processor.processCSV(parsed, clientName, (progress) => {
      // Progress callback can be used for real-time updates if needed
      console.log(`Processing: ${progress.current}/${progress.total} - ${progress.phase}`);
    });

    // Return preview or all rows if previewRowCount is very high
    const shouldReturnAll = previewRowCount >= result.processedRows.length;
    const rowsToReturn = shouldReturnAll 
      ? result.processedRows 
      : result.processedRows.slice(0, previewRowCount);

    return NextResponse.json({
      success: true,
      preview: {
        rows: rowsToReturn,
        totalRows: result.processedRows.length,
        sampleCount: rowsToReturn.length,
        allRows: shouldReturnAll
      },
      statistics: result.statistics,
      errors: result.errors.slice(0, 10), // First 10 errors
      mapping: processor.getMapping(),
      patterns: processor.getPatterns()
    });
  } catch (error) {
    console.error('Error previewing CSV conversion:', error);
    return NextResponse.json(
      {
        error: 'Failed to preview CSV conversion',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


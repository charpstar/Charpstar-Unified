import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, sampleRows } from '@/lib/csvParser';
import { geminiCSVService } from '@/lib/geminiCSVService';

export async function POST(request: NextRequest) {
  try {
    const { csvText, headers, sampleRowCount = 5 } = await request.json();

    if (!csvText || !headers || headers.length === 0) {
      return NextResponse.json(
        { error: 'CSV text and headers are required' },
        { status: 400 }
      );
    }

    // Parse CSV to get rows
    const parsed = parseCSV(csvText);
    
    // Get sample rows for mapping
    const sampleRowsForMapping = parsed.rows.slice(0, sampleRowCount);

    // Use AI to map columns
    const mappingResult = await geminiCSVService.mapColumns(
      headers,
      sampleRowsForMapping
    );

    return NextResponse.json({
      success: true,
      mapping: mappingResult,
      sampleRows: sampleRowsForMapping.slice(0, 5)
    });
  } catch (error) {
    console.error('Error mapping CSV columns:', error);
    return NextResponse.json(
      {
        error: 'Failed to map CSV columns',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



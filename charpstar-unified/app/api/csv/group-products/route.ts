import { NextRequest, NextResponse } from 'next/server';
import { performGrouping } from '@/lib/productGroupingApi';

export async function POST(request: NextRequest) {
  try {
    const { products } = await request.json();

    const result = await performGrouping(products);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to group products' },
        { status: result.error?.includes('required') ? 500 : 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in product grouping:', error);
    return NextResponse.json(
      {
        error: 'Failed to group products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

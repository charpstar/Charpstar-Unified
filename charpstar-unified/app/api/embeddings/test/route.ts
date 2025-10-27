import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    // Test database connection
    const { data, error } = await supabase
      .from('product_embeddings')
      .select('count')
      .limit(1);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database connection successful' 
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
}



import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    // Get all embeddings with their image URLs
    const { data, error } = await supabase
      .from('product_embeddings')
      .select('id, asset_id, image_url, image_type, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      embeddings: data,
      total: data?.length || 0
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch embeddings' }, { status: 500 });
  }
}

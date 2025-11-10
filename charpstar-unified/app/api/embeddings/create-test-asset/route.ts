import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST() {
  try {
    // Create a test asset
    const { data, error } = await supabase
      .from('onboarding_assets')
      .insert({
        client: 'Test Client',
        article_id: 'TEST-001',
        product_name: 'Test Product',
        product_link: 'https://example.com/test-product',
        category: 'Test Category',
        subcategory: 'Test Subcategory',
        status: 'not_started',
        batch: 1,
        priority: 1
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      assetId: data.id,
      message: 'Test asset created successfully' 
    });
    
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to create test asset' }, { status: 500 });
  }
}



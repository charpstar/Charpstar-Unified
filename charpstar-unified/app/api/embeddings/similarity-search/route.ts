import { NextRequest, NextResponse } from 'next/server';
import { FAISSService } from '@/lib/faissService';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const { assetId, imageUrl, k = 5 } = await request.json();
    
    // Get the embedding for the query asset
    const { data: embeddingData, error: embeddingError } = await supabase
      .from('product_embeddings')
      .select('embedding')
      .eq('asset_id', assetId)
      .single();
    
    if (embeddingError || !embeddingData) {
      return NextResponse.json({ 
        error: 'Embedding not found for this asset' 
      }, { status: 404 });
    }
    
    // Initialize FAISS service and search
    const faissService = new FAISSService();
    const results = await faissService.searchSimilar(
      embeddingData.embedding as number[], 
      k
    );
    
    // Get asset details for similar items
    const { data: similarAssets, error: assetsError } = await supabase
      .from('onboarding_assets')
      .select('id, product_name, client, category, subcategory, price')
      .in('id', results.assetIds);
    
    if (assetsError) {
      return NextResponse.json({ error: assetsError.message }, { status: 500 });
    }
    
    // Combine results
    const combinedResults = results.assetIds.map((assetId, index) => {
      const asset = similarAssets?.find(a => a.id === assetId);
      return {
        assetId,
        similarity: results.similarities[index],
        asset: asset || null
      };
    });
    
    return NextResponse.json({
      success: true,
      similarProducts: combinedResults,
      totalFound: combinedResults.length
    });
    
  } catch (error) {
    console.error('Error in similarity search:', error);
    return NextResponse.json({ 
      error: 'Failed to perform similarity search' 
    }, { status: 500 });
  }
}



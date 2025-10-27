import { supabase } from '@/lib/supabaseClient';

export class FAISSService {
  private embeddings: number[][] = [];
  private assetIds: string[] = [];
  
  async buildIndex() {
    try {
      // Fetch all embeddings from database
      const { data, error } = await supabase
        .from('product_embeddings')
        .select('id, asset_id, embedding')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.log('No embeddings found in database');
        return;
      }
      
      // Store embeddings and asset IDs
      this.embeddings = data.map(item => item.embedding as number[]);
      this.assetIds = data.map(item => item.asset_id);
      
      console.log(`Built FAISS index with ${this.embeddings.length} embeddings`);
    } catch (error) {
      console.error('Error building FAISS index:', error);
      throw error;
    }
  }
  
  async searchSimilar(queryEmbedding: number[], k: number = 5): Promise<{
    assetIds: string[];
    similarities: number[];
  }> {
    if (this.embeddings.length === 0) {
      await this.buildIndex();
    }
    
    // Calculate cosine similarity
    const similarities = this.embeddings.map(embedding => 
      this.cosineSimilarity(queryEmbedding, embedding)
    );
    
    // Get top k similar items
    const indexedSimilarities = similarities.map((sim, index) => ({
      similarity: sim,
      assetId: this.assetIds[index]
    }));
    
    const sorted = indexedSimilarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
    
    return {
      assetIds: sorted.map(item => item.assetId),
      similarities: sorted.map(item => item.similarity)
    };
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}



/**
 * Similarity Search using CLIP Embeddings
 * Find similar products based on vector similarity
 */

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SimilarProduct {
    asset_id: string;
    product_name: string;
    client: string;
    preview_url: string;
    similarity: number;
}

interface SearchOptions {
    limit?: number;
    sameClientOnly?: boolean;
    sameCategory?: boolean;
    minSimilarity?: number;
}

/**
 * Find similar products using direct SQL via pg client (Optimized)
 * This avoids the need for a database migration by running the query directly
 */
export async function findSimilarProductsPg(
    embedding: number[],
    options: SearchOptions = {}
): Promise<SimilarProduct[]> {
    const {
        limit = 10,
        minSimilarity = 0.0,
    } = options;

    if (!process.env.SUPABASE_POOLED_DB_URL) {
        throw new Error('SUPABASE_POOLED_DB_URL not found in environment variables');
    }

    const client = new Client({
        connectionString: process.env.SUPABASE_POOLED_DB_URL,
    });

    try {
        await client.connect();

        // Format embedding for pgvector
        const vectorStr = `[${embedding.join(',')}]`;

        const query = `
            SELECT 
                ae.asset_id,
                1 - (ae.embedding <=> $1) as similarity,
                a.product_name,
                a.client,
                a.preview_images
            FROM asset_embeddings ae
            JOIN assets a ON ae.asset_id = a.id
            WHERE 1 - (ae.embedding <=> $1) > $2
            ORDER BY ae.embedding <=> $1
            LIMIT $3;
        `;

        console.log('🚀 Executing vector search on PostgreSQL database...');
        const result = await client.query(query, [vectorStr, minSimilarity, limit]);

        return result.rows.map(row => ({
            asset_id: row.asset_id,
            product_name: row.product_name || '',
            client: row.client || '',
            preview_url: row.preview_images?.[0] || '',
            similarity: row.similarity,
        }));

    } catch (error) {
        console.error('Error in pg similarity search:', error);
        throw error;
    } finally {
        await client.end();
    }
}

/**
 * Parse PostgreSQL vector format to number array
 * pgvector returns embeddings as strings like "[1.0,2.0,3.0]"
 */
function parseEmbedding(embedding: any): number[] {
    if (Array.isArray(embedding)) {
        return embedding;
    }

    if (typeof embedding === 'string') {
        // Remove brackets and split by comma
        const cleaned = embedding.replace(/[\[\]]/g, '');
        return cleaned.split(',').map(v => parseFloat(v.trim()));
    }

    throw new Error(`Unexpected embedding format: ${typeof embedding}`);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
}

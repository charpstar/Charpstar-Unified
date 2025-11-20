/**
 * Simple Express server for image similarity search
 * Upload an image and find similar products
 */

import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateCLIPEmbedding } from './embeddings.js';
import { findSimilarProductsPg } from './similarity-search.js';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { formatEmbeddingForDB } from './embeddings.js';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * Upload image and find similar products
 */
app.post('/api/search-similar', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        console.log(`📤 Received image: ${req.file.originalname} (${req.file.size} bytes)`);

        // Generate CLIP embedding from uploaded image
        console.log('⚙️  Generating CLIP embedding...');
        const startTime = Date.now();
        const embedding = await generateCLIPEmbedding(req.file.buffer);
        const embeddingTime = Date.now() - startTime;
        console.log(`✅ Embedding generated in ${embeddingTime}ms`);

        // Search for similar products using optimized pgvector query
        console.log('🔍 Searching for similar products...');
        const searchStart = Date.now();

        const results = await findSimilarProductsPg(embedding, {
            limit: 10,
            minSimilarity: 0.6
        });

        const searchTime = Date.now() - searchStart;
        console.log(`✅ Found ${results.length} similar products in ${searchTime}ms`);

        res.json({
            success: true,
            results,
            meta: {
                embeddingTime,
                searchTime,
                totalTime: Date.now() - startTime,
            },
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            error: 'Failed to process image',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Helper functions
 */
function parseEmbedding(embedding: any): number[] {
    if (Array.isArray(embedding)) {
        return embedding;
    }

    if (typeof embedding === 'string') {
        const cleaned = embedding.replace(/[\[\]]/g, '');
        return cleaned.split(',').map(v => parseFloat(v.trim()));
    }

    throw new Error(`Unexpected embedding format: ${typeof embedding}`);
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
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

app.listen(port, () => {
    console.log('='.repeat(60));
    console.log('🚀 Image Similarity Search Server');
    console.log('='.repeat(60));
    console.log(`📍 Server running at: http://localhost:${port}`);
    console.log(`🌐 Open in browser to upload images and find similar products`);
    console.log('='.repeat(60));
});

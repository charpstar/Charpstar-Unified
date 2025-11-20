/**
 * Image Embeddings Library using CLIP
 * Standalone version for batch processing
 */

import { pipeline, env, RawImage } from '@xenova/transformers';

// Configure transformers.js to use local cache
env.localModelPath = './.cache/transformers';
env.allowRemoteModels = true;

// Global pipeline instance (lazy loaded)
let clipPipeline: any = null;

/**
 * Initialize the CLIP model pipeline
 * Uses Xenova/clip-vit-base-patch32 - a good balance of speed and accuracy
 */
async function initializeCLIPModel() {
    if (!clipPipeline) {
        console.log('📥 Loading CLIP model (this may take a minute on first run)...');
        clipPipeline = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
        console.log('✅ CLIP model loaded successfully');
    }
    return clipPipeline;
}

/**
 * Normalize a vector (for cosine similarity)
 */
function normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
}

/**
 * Generate CLIP embedding for an image
 * @param imageUrlOrBuffer - URL or Buffer of the image
 * @returns 512-dimensional embedding vector
 */
export async function generateCLIPEmbedding(
    imageUrlOrBuffer: string | Buffer
): Promise<number[]> {
    try {
        const model = await initializeCLIPModel();

        // Process input using RawImage
        let image;
        if (Buffer.isBuffer(imageUrlOrBuffer)) {
            // Convert Buffer to Blob for RawImage
            const blob = new Blob([imageUrlOrBuffer]);
            image = await RawImage.fromBlob(blob);
        } else {
            // Handle string (URL or Data URL)
            image = await RawImage.read(imageUrlOrBuffer);
        }

        // Generate embedding
        const output = await model(image);

        // Extract the embedding tensor and convert to array
        const embedding = Array.from(output.data) as number[];

        // Normalize the embedding (important for cosine similarity)
        const normalized = normalizeVector(embedding);

        return normalized;
    } catch (error) {
        console.error('Error generating CLIP embedding:', error);
        throw new Error(`Failed to generate CLIP embedding: ${error}`);
    }
}

/**
 * Format embedding for database storage
 * Converts number array to PostgreSQL vector format
 */
export function formatEmbeddingForDB(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
}

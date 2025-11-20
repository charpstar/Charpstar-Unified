/**
 * CLIP Embedding Generation Script
 * Standalone worker for generating embeddings for product images
 * 
 * Usage:
 *   npm run generate              # Process all assets
 *   npm run generate:limit 10     # Process first 10 assets
 *   tsx generate-embeddings.ts --limit 50 --client "ClientName"
 */

import { createClient } from '@supabase/supabase-js';
import { generateCLIPEmbedding, formatEmbeddingForDB } from './embeddings';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase client with service role
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ProcessingStats {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
    startTime: Date;
}

async function main() {
    const args = process.argv.slice(2);
    const limitIndex = args.indexOf('--limit');
    const clientIndex = args.indexOf('--client');

    const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : null;
    const clientFilter = clientIndex >= 0 ? args[clientIndex + 1] : null;

    console.log('🚀 Starting CLIP embedding generation...');
    console.log('⏳ This will download ~500MB model on first run...');
    console.log(`Configuration: ${limit ? `limit=${limit}` : 'no limit'}${clientFilter ? `, client="${clientFilter}"` : ''}`);

    const stats: ProcessingStats = {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        startTime: new Date(),
    };

    // Fetch assets that need embeddings
    let query = supabase
        .from('assets')
        .select('id, product_name, client, preview_images')
        .not('preview_images', 'is', null);

    if (clientFilter) {
        query = query.eq('client', clientFilter);
    }

    if (limit) {
        query = query.limit(limit);
    }

    const { data: assets, error } = await query;

    if (error) {
        console.error('❌ Error fetching assets:', error);
        process.exit(1);
    }

    if (!assets || assets.length === 0) {
        console.log('✅ No assets to process!');
        process.exit(0);
    }

    // Filter out assets that already have embeddings
    const assetIds = assets.map(a => a.id);
    const { data: existingEmbeddings } = await supabase
        .from('asset_embeddings')
        .select('asset_id')
        .in('asset_id', assetIds);

    const existingIds = new Set(existingEmbeddings?.map(e => e.asset_id) || []);
    const assetsToProcess = assets.filter(a => !existingIds.has(a.id));

    stats.total = assetsToProcess.length;
    console.log(`📊 Found ${stats.total} assets to process (${existingIds.size} already have embeddings)\n`);

    if (stats.total === 0) {
        console.log('✅ All assets already processed!');
        process.exit(0);
    }

    // Process assets one at a time (CLIP is memory intensive)
    for (const asset of assetsToProcess) {
        try {
            stats.processed++;

            if (!asset.preview_images || asset.preview_images.length === 0) {
                console.log(`⏭️  [${stats.processed}/${stats.total}] Skipping ${asset.product_name} - No preview images`);
                stats.skipped++;
                continue;
            }

            // Use the first preview image
            const imageUrl = asset.preview_images[0];
            console.log(`⚙️  [${stats.processed}/${stats.total}] Processing: ${asset.product_name}`);

            // Generate CLIP embedding
            const startTime = Date.now();
            const embedding = await generateCLIPEmbedding(imageUrl);
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            // Save to database
            const { error: insertError } = await supabase
                .from('asset_embeddings')
                .insert({
                    asset_id: asset.id,
                    embedding: formatEmbeddingForDB(embedding),
                    model_version: 'clip-vit-base-patch32',
                });

            if (insertError) {
                throw insertError;
            }

            console.log(`✅ [${stats.processed}/${stats.total}] Success: ${asset.product_name} (${duration}s)`);
            stats.successful++;

            // Memory cleanup every 10 items
            if (stats.processed % 10 === 0) {
                if (global.gc) {
                    global.gc();
                }
            }
        } catch (error) {
            console.error(`❌ [${stats.processed}/${stats.total}] Failed: ${asset.product_name}`, error);
            stats.failed++;
        }

        // Progress update every 10 items
        if (stats.processed % 10 === 0) {
            const progress = ((stats.processed / stats.total) * 100).toFixed(1);
            const elapsed = (Date.now() - stats.startTime.getTime()) / 1000;
            const rate = stats.successful / elapsed;
            const remaining = (stats.total - stats.processed) / rate;

            console.log(`\n📈 Progress: ${progress}% (${stats.processed}/${stats.total})`);
            console.log(`⏱️  Estimated time remaining: ${(remaining / 60).toFixed(1)} minutes\n`);
        }
    }

    // Final report
    const endTime = new Date();
    const duration = (endTime.getTime() - stats.startTime.getTime()) / 1000;

    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL REPORT');
    console.log('='.repeat(60));
    console.log(`Total Assets:     ${stats.total}`);
    console.log(`Processed:        ${stats.processed}`);
    console.log(`✅ Successful:    ${stats.successful}`);
    console.log(`❌ Failed:        ${stats.failed}`);
    console.log(`⏭️  Skipped:       ${stats.skipped}`);
    console.log(`⏱️  Duration:      ${(duration / 60).toFixed(1)} minutes`);
    console.log(`⚡ Rate:          ${(stats.successful / duration).toFixed(2)} assets/second`);
    console.log('='.repeat(60) + '\n');

    process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

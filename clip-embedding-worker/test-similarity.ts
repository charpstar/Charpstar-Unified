/**
 * Test Similarity Search
 * Find and display similar products for testing
 */

import { findSimilarProductsDirect } from './similarity-search';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const args = process.argv.slice(2);
    const assetIdIndex = args.indexOf('--asset');
    const limitIndex = args.indexOf('--limit');

    let targetAssetId: string;
    const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : 5;

    // If no asset ID provided, get one from Soffadirekt
    if (assetIdIndex < 0 || !args[assetIdIndex + 1]) {
        console.log('No asset ID provided, selecting a random Soffadirekt product...\n');

        const { data: assets, error } = await supabase
            .from('assets')
            .select('id, product_name, client')
            .eq('client', 'Soffadirekt')
            .limit(1);

        if (error || !assets || assets.length === 0) {
            console.error('Could not find a Soffadirekt product');
            process.exit(1);
        }

        targetAssetId = assets[0].id;
        console.log(`Selected: ${assets[0].product_name} (${targetAssetId})\n`);
    } else {
        targetAssetId = args[assetIdIndex + 1];
    }

    // Get target product details
    const { data: targetAsset, error: targetError } = await supabase
        .from('assets')
        .select('id, product_name, client, preview_images')
        .eq('id', targetAssetId)
        .single();

    if (targetError || !targetAsset) {
        console.error('❌ Target asset not found:', targetAssetId);
        process.exit(1);
    }

    console.log('🔍 FINDING SIMILAR PRODUCTS');
    console.log('='.repeat(60));
    console.log(`Target Product: ${targetAsset.product_name}`);
    console.log(`Client: ${targetAsset.client}`);
    console.log(`Asset ID: ${targetAsset.id}`);
    console.log(`Preview: ${targetAsset.preview_images?.[0] || 'N/A'}`);
    console.log('='.repeat(60));
    console.log();

    try {
        console.log(`⚙️  Searching for ${limit} similar products...\n`);

        const startTime = Date.now();
        const similarProducts = await findSimilarProductsDirect(targetAssetId, {
            limit,
            minSimilarity: 0.6, // Only show products with >60% similarity
        });
        const duration = Date.now() - startTime;

        if (similarProducts.length === 0) {
            console.log('No similar products found (similarity threshold: 60%)');
            process.exit(0);
        }

        console.log(`✅ Found ${similarProducts.length} similar products (${duration}ms)\n`);
        console.log('RESULTS:');
        console.log('='.repeat(60));

        similarProducts.forEach((product, index) => {
            const similarityPercent = (product.similarity * 100).toFixed(1);
            console.log(`\n${index + 1}. ${product.product_name}`);
            console.log(`   Similarity: ${similarityPercent}%`);
            console.log(`   Client: ${product.client}`);
            console.log(`   Asset ID: ${product.asset_id}`);
            console.log(`   Preview: ${product.preview_url || 'N/A'}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log(`\n⏱️  Search completed in ${duration}ms`);

    } catch (error) {
        console.error('❌ Error during search:', error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

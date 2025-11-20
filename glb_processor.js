#!/usr/bin/env node

import { glbProcessor8Views } from "./index.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || "https://tpamckewerybqzhhhqqp.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwYW1ja2V3ZXJ5YnF6aGhocXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzY0NTAzOCwiZXhwIjoyMDYzMjIxMDM4fQ.WKPdpbK9X4tac-_fWN1rF7qJgd_kq39ZjDOD9Djnz0A"
);

// Fetch GLB files from Supabase
async function fetchGLBFiles(clientName, isDryRun = false, processAll = false, blankOnly = false) {
  console.log(`🔍 Fetching GLB files for client: ${clientName}`);
  
  try {
    // First, check what exists for this client (for debugging)
    const { data: allData, error: allError } = await supabase
      .from("assets")
      .select("article_id, glb_link, product_name, client, preview_images")
      .eq("client", clientName);

    if (allError) {
      console.error(`❌ Database error (checking all):`, allError);
    } else {
      const withGLB = allData.filter(row => row.glb_link !== null);

      console.log(`📊 Debug info for client "${clientName}":`);
      console.log(`   - Total records: ${allData.length}`);
      console.log(`   - Records with GLB link: ${withGLB.length}`);

    }

    // Build query based on processAll flag
    let query = supabase
      .from("assets")
      .select("article_id, glb_link, product_name, client, preview_images")
      .eq("client", clientName)
      .not("glb_link", "is", null);

    if (!processAll) {
      // Only process new uploads
      query = query.eq("new_upload", true);
      console.log(`🔍 Filtering for new_upload=true only`);
    } else {
      console.log(`🔍 Processing ALL files with GLB links`);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Database error:`, error);
      throw new Error(`Failed to fetch GLB files: ${error.message}`);
    }

    // Filter for blank preview_images if blankOnly flag is set
    let filteredData = data;
    if (blankOnly) {
      filteredData = data.filter(row => {
        const previewImages = row.preview_images;
        return !previewImages || previewImages.length === 0 || (Array.isArray(previewImages) && previewImages.every(img => !img || img.trim() === ''));
      });
      console.log(`🔍 Filtering for blank preview_images only`);
      console.log(`   - Before filter: ${data.length} records`);
      console.log(`   - After filter: ${filteredData.length} records`);
    }

    console.log(`✅ Found ${filteredData.length} GLB files to process`);
    return filteredData;
  } catch (err) {
    console.error(`❌ Error fetching GLB files:`, err);
    throw err;
  }
}

// Update processed GLB in Supabase with preview_images array
async function updateProcessedGLB(articleId, previewImages) {
  console.log(`📝 Updating GLB for article: ${articleId} with ${previewImages.length} preview images`);
  
  const { error } = await supabase
    .from("assets")
    .update({
      preview_images: previewImages  // This should be a text[] array in PostgreSQL
    })
    .eq("article_id", articleId);

  if (error) {
    console.error(`❌ Failed to update GLB status: ${error.message}`);
    throw error;
  }

  console.log(`✅ Updated GLB status for article: ${articleId}`);
}

// Process a single GLB file
async function processGLBFile(row, outputDir, isDryRun = false, overwrite = false) {
  const { article_id, glb_link, product_name } = row;
  
  try {
    // Check if files already exist
    const skuDir = path.join(outputDir, article_id);
    if (fs.existsSync(skuDir)) {
      const files = fs.readdirSync(skuDir);
      const imageFiles = files.filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
      
      if (imageFiles.length > 0 && !overwrite) {
        console.log(`⏭️  Skipping ${article_id}: Files already exist (use --overwrite to reprocess)`);
        return {
          status: "skipped",
          sku: article_id,
          glb_url: glb_link,
          saved_count: 0,
          saved_images: [],
          notes: `Skipped: Files already exist (${imageFiles.length} files found)`
        };
      } else if (imageFiles.length > 0 && overwrite) {
        console.log(`🔄 Overwriting existing files for ${article_id}`);
      }
    }
    
    if (isDryRun) {
      console.log(`🔍 DRY RUN: Processing GLB ${article_id}: ${glb_link}`);
    } else {
      console.log(`🚀 Processing GLB ${article_id}: ${glb_link}`);
    }
    
    // Create output directory for this SKU
    if (!fs.existsSync(skuDir)) {
      fs.mkdirSync(skuDir, { recursive: true });
    }

    // Process the GLB file (8 screenshots)
    const result = await glbProcessor8Views.processGLB(glb_link, article_id, skuDir, null, isDryRun);
    
    console.log(`✅ ${article_id}: ${result.screenshots.length} images captured`);
    
    return {
      status: "completed",
      sku: article_id,
      glb_url: glb_link,
      saved_count: result.screenshots.length,
      saved_images: result.screenshots,
      image_urls: result.imageUrls || [],
      notes: `Successfully processed with 8 views`
    };

  } catch (error) {
    console.error(`❌ Failed to process GLB ${article_id}: ${error.message}`);
    
    return {
      status: "error",
      sku: article_id,
      glb_url: glb_link,
      saved_count: 0,
      saved_images: [],
      notes: `Error: ${error.message}`
    };
  }
}

// Main processing function
async function main() {
  const args = process.argv.slice(2);
  const clientName = args[0];
  const isDryRun = args.includes('--dry-run') || args.includes('--dry');
  const newOnly = args.includes('--new-only') || args.includes('--new');
  const blankOnly = args.includes('--blank-only') || args.includes('--blank');
  const overwrite = args.includes('--overwrite') || args.includes('--force');
  // By default, process all files with GLB links
  const processAll = !newOnly;
  
  if (!clientName) {
    console.error("❌ Please provide client name as argument");
    console.log("Usage: node glb_processor.js <client_name> [options]");
    console.log("Options:");
    console.log("  --dry-run, --dry: Generate screenshots but don't upload or update database");
    console.log("  --new-only, --new: Process only files with new_upload=true (default: process all files with GLB links)");
    console.log("  --blank-only, --blank: Process only files where preview_images is blank/null/empty");
    console.log("  --overwrite, --force: Overwrite existing files (default: skip if files already exist)");
    process.exit(1);
  }

  const outputDir = "output";
  
  try {
    if (isDryRun) {
      console.log(`🔍 DRY RUN: Starting GLB processing for client: ${clientName}`);
    } else {
      console.log(`🚀 Starting GLB processing (8 views) for client: ${clientName}`);
    }
    
    // Fetch GLB files
    const rows = await fetchGLBFiles(clientName, isDryRun, processAll, blankOnly);
    
    if (rows.length === 0) {
      console.log("ℹ️ No GLB files to process");
      return;
    }

    console.log(`📦 Processing ${rows.length} GLB files (8 views each)...`);
    if (isDryRun) {
      console.log(`🔍 DRY RUN MODE: Screenshots will be generated but NOT uploaded or saved to database`);
    }
    if (overwrite) {
      console.log(`🔄 OVERWRITE MODE: Existing files will be overwritten`);
    } else {
      console.log(`⏭️  SKIP MODE: Files that already exist will be skipped (use --overwrite to force reprocessing)`);
    }
    
    const results = [];
    
    // Process each GLB file
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (isDryRun) {
        console.log(`\n🔍 DRY RUN: Processing GLB ${i + 1}/${rows.length} for ${row.article_id}`);
      } else {
        console.log(`\n📦 Processing GLB ${i + 1}/${rows.length} for ${row.article_id}`);
      }
      
      try {
        const result = await processGLBFile(row, outputDir, isDryRun, overwrite);
        results.push(result);
        
        if (!isDryRun) {
          // Update database with preview_images array (skip in dry-run)
          await updateProcessedGLB(
            row.article_id,
            result.image_urls || []
          );
        } else {
          console.log(`🔍 DRY RUN: Skipping database update for ${row.article_id}`);
        }
        
        if (result.status === 'skipped') {
          console.log(`⏭️  Skipped ${row.article_id}`);
        } else if (isDryRun) {
          console.log(`✅ DRY RUN completed ${row.article_id} - screenshots saved to: ${path.join(outputDir, row.article_id)}`);
        } else {
          console.log(`✅ Completed ${row.article_id}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to process ${row.article_id}: ${error.message}`);
        results.push({
          status: "failed",
          sku: row.article_id,
          glb_url: row.glb_link,
          saved_count: 0,
          saved_images: [],
          notes: `Error: ${error.message}`
        });
      }
    }

    // Save results
    const resultsFile = path.join(outputDir, "results.jsonl");
    const resultsContent = results.map(result => JSON.stringify(result)).join('\n');
    fs.writeFileSync(resultsFile, resultsContent);
    
    if (isDryRun) {
      console.log(`\n🔍 DRY RUN completed!`);
      console.log(`📁 Screenshots saved to: ${outputDir}`);
      console.log(`📊 Results saved to: ${resultsFile}`);
      console.log(`✅ Successful: ${results.filter(r => r.status === 'completed').length}`);
      console.log(`⏭️  Skipped: ${results.filter(r => r.status === 'skipped').length}`);
      console.log(`❌ Failed: ${results.filter(r => r.status === 'failed' || r.status === 'error').length}`);
      console.log(`\n💡 Note: No files were uploaded to storage and no database updates were made`);
    } else {
      console.log(`\n🎉 Processing completed!`);
      console.log(`📊 Results saved to: ${resultsFile}`);
      console.log(`✅ Successful: ${results.filter(r => r.status === 'completed').length}`);
      console.log(`⏭️  Skipped: ${results.filter(r => r.status === 'skipped').length}`);
      console.log(`❌ Failed: ${results.filter(r => r.status === 'failed' || r.status === 'error').length}`);
    }

  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  } finally {
    // Close browser
    await glbProcessor8Views.closeBrowser();
  }
}

// Run if called directly
main().catch(console.error);


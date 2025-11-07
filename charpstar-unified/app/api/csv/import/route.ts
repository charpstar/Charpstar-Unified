// Suppress Supabase cookie warnings
import '@/lib/consoleFilter';

import { NextRequest, NextResponse } from 'next/server';
import { parseCSV } from '@/lib/csvParser';
import { CSVProcessor } from '@/lib/csvProcessor';
import { supabase } from '@/lib/supabaseClient';
import { performGrouping } from '@/lib/productGroupingApi';

// Log immediately when module loads
console.log('[ROUTE LOADED] /api/csv/import route.ts');

export async function POST(request: NextRequest) {
  console.log('========================================');
  console.log('📥 CSV IMPORT REQUEST RECEIVED');
  console.log('Timestamp:', new Date().toISOString());
  console.log('========================================');
  
  try {
    console.log('[IMPORT] Parsing request body...');
    const { csvText, clientName, dryRun = false, batch = 1 } = await request.json();
    console.log('[IMPORT] Request body parsed successfully');
    
    console.log(`[IMPORT] Client: ${clientName}`);
    console.log(`[IMPORT] CSV Text Length: ${csvText?.length || 0} chars`);
    console.log(`[IMPORT] Dry Run: ${dryRun}`);
    console.log(`[IMPORT] Batch: ${batch}`);

    if (!csvText || !clientName) {
      console.error('[IMPORT] ❌ Missing required fields');
      return NextResponse.json(
        { error: 'CSV text and client name are required' },
        { status: 400 }
      );
    }

    if (dryRun) {
      // Just validate without importing
      const parsed = parseCSV(csvText);
      const processor = new CSVProcessor();
      const result = await processor.processCSV(parsed, clientName);

      return NextResponse.json({
        success: true,
        dryRun: true,
        statistics: result.statistics,
        errors: result.errors.slice(0, 20),
        message: `Would import ${result.statistics.successCount} rows for client ${clientName}`
      });
    }

    // Parse and process CSV
    console.log('[IMPORT] Parsing CSV...');
    const parsed = parseCSV(csvText);
    console.log(`[IMPORT] Parsed ${parsed.rowCount} rows`);
    
    console.log('[IMPORT] Processing CSV...');
    const processor = new CSVProcessor();
    
    const result = await processor.processCSV(parsed, clientName, (progress) => {
      console.log(`[IMPORT] Progress: ${progress.current}/${progress.total} - ${progress.phase}`);
    });
    
    console.log(`[IMPORT] Processing complete. Success: ${result.statistics.successCount}, Errors: ${result.statistics.errorCount}`);

    // Filter out rows with errors for import
    const validRows = result.processedRows.filter(
      row => !row._errors || row._errors.length === 0
    );

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid rows to import',
          errors: result.errors
        },
        { status: 400 }
      );
    }

    // Prepare data for insertion
    const assetsToInsert = validRows.map((row, idx) => ({
      article_id: row['Article ID'],
      product_name: row['Product Name'],
      product_link: row['Product Link'] || null,
      cad_file_link: row['CAD/File Link'] || null,
      glb_link: row['GLB Link'] || null,
      category: row['Category'] || null,
      subcategory: row['Subcategory'] || null,
      active: row['Active'] === 'TRUE',
      client: clientName,
      batch: batch,
      upload_order: idx + 1, // Preserve order from CSV
      status: 'not_started',
      priority: 2, // Default priority
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Import to database in batches
    const batchSize = 100;
    const batches: typeof assetsToInsert[] = [];
    
    for (let i = 0; i < assetsToInsert.length; i += batchSize) {
      batches.push(assetsToInsert.slice(i, i + batchSize));
    }

    const importResults = {
      successCount: 0,
      errorCount: 0,
      errors: [] as Array<{ articleId: string; error: string }>,
      insertedArticleIds: [] as string[] // Store successfully inserted article_ids
    };

    for (const batch of batches) {
      // Use insert instead of upsert since there's no unique constraint
      // We allow duplicates - same article_id+client can exist multiple times (different batches)
      const { data, error } = await supabase
        .from('onboarding_assets')
        .insert(batch)
        .select();

      if (error) {
        console.error('Error importing batch:', error);
        importResults.errorCount += batch.length;
        batch.forEach(item => {
          importResults.errors.push({
            articleId: item.article_id,
            error: error.message
          });
        });
      } else {
        importResults.successCount += data?.length || 0;
        // Store the actual article_ids that were inserted
        if (data) {
          data.forEach(item => {
            if (item.article_id) {
              importResults.insertedArticleIds.push(item.article_id);
            }
          });
        }
      }
    }

    // After successful import, perform grouping and update database (async, don't block response)
    let groupingStats = null;
    if (importResults.successCount > 0) {
      console.log('========================================');
      console.log('🚀 GROUPING START - Client:', clientName);
      console.log(`📦 Products to group: ${importResults.successCount}`);
      console.log('========================================');
      
      // Run grouping in background - don't await to avoid timeouts
      // Fire and forget - grouping will complete in the background
      console.log('[GROUPING] Starting async grouping function...');
      (async () => {
        console.log('[GROUPING] ✅ Async function entered!');
        try {
          // Create a map from rowIndex to article_id for reverse lookup
          // rowIndex from AI is 1-indexed (includes header), so we need to convert back
          const rowIndexToArticleId = new Map<number, string>();
          validRows.forEach((row, idx) => {
            const articleId = row['Article ID'];
            if (articleId) {
              // rowIndex sent to AI is idx + 2 (1-indexed + header)
              rowIndexToArticleId.set(idx + 2, articleId.trim());
            }
          });

          // Also create a map from article_id to the original row index for later lookup
          const articleIdToRowIndex = new Map<string, number>();
          validRows.forEach((row, idx) => {
            const articleId = row['Article ID'];
            if (articleId) {
              articleIdToRowIndex.set(articleId.trim(), idx);
            }
          });

          // Prepare products for grouping - use validRows which matches what was inserted
          const productsForGrouping = validRows.map((row, idx) => ({
            rowIndex: idx + 2, // Display row index (1-indexed + header)
            articleId: row['Article ID'],
            productName: row['Product Name'],
            category: row['Category'] || undefined,
            subcategory: row['Subcategory'] || undefined,
            originalIndex: idx
          }));
          
          // Store the inserted article_ids for matching
          const insertedArticleIdsSet = new Set(importResults.insertedArticleIds.map(id => id.trim()));
          
          // Debug: Log article IDs being used
          console.log('[GROUPING] Article IDs to update:', productsForGrouping.slice(0, 5).map(p => p.articleId));

          console.log(`[GROUPING] Starting for ${productsForGrouping.length} products for client: ${clientName}`);
          console.log(`[GROUPING] First 3 products:`, productsForGrouping.slice(0, 3).map(p => ({ articleId: p.articleId, name: p.productName })));
          
          const groupingResult = await performGrouping(productsForGrouping);
          
          console.log(`[GROUPING] Result received. Success: ${groupingResult.success}, Groups: ${groupingResult.groups?.length || 0}`);
          
          if (!groupingResult) {
            console.error('[GROUPING] No result returned from performGrouping');
            return;
          }
          
          if (!groupingResult.success) {
            console.error('[GROUPING] Grouping failed:', groupingResult.error);
            return;
          }
          
          if (!groupingResult.groups || groupingResult.groups.length === 0) {
            console.warn('[GROUPING] No groups found in result');
            return;
          }
          
          console.log(`[GROUPING] Processing ${groupingResult.groups.length} groups...`);
          
          if (groupingResult.groups.length > 0) {
          // Create a map of articleId to groupId, groupOrder, and variation attributes
          const articleToGroupMap = new Map<string, { 
            groupId: string; 
            order: number;
            variationSize?: string;
            variationColor?: string;
            variationOrientation?: string;
            suggestedPricingOptionId?: string;
            suggestedPrice?: number;
          }>();
          const usedGroupIds = new Set<string>();
          
          // Helper function to create a descriptive group ID from base product name
          const createGroupId = (baseProductName: string): string => {
            // Sanitize the base product name: remove special chars, replace spaces with underscores, limit length
            let sanitized = baseProductName
              .trim()
              .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
              .replace(/\s+/g, '_') // Replace spaces with underscores
              .substring(0, 50) // Limit length to 50 chars
              .replace(/_+/g, '_') // Replace multiple underscores with single
              .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
            
            // If empty after sanitization, use a fallback
            if (!sanitized) {
              sanitized = 'Product_Group';
            }
            
            // Handle duplicates by appending a number
            let finalGroupId = sanitized;
            let counter = 1;
            while (usedGroupIds.has(finalGroupId)) {
              finalGroupId = `${sanitized}_${counter}`;
              counter++;
            }
            
            usedGroupIds.add(finalGroupId);
            return finalGroupId;
          };

          // Helper function to extract base name from product name
          const extractBaseNameFromProduct = (productName: string): string => {
            const trimmed = productName.trim();
            
            // Check if product name has variation indicators (numbers, colors, orientations)
            const hasSize = /\b(\d+cm|\d+\s*cm|\d+)\b/i.test(trimmed);
            const hasColor = /\b(white|black|red|blue|green|yellow|brown|gray|grey|graphite|beige|ivory|cream|navy|pink|orange|purple)\b/i.test(trimmed);
            const hasOrientation = /\b(left|right|l|r|corner left|corner right)\b/i.test(trimmed);
            
            // If no variation indicators, use full product name as base (e.g., "Veronica", "Kayzar")
            if (!hasSize && !hasColor && !hasOrientation) {
              return trimmed.toLowerCase();
            }
            
            // If has variations, extract base by removing them
            let base = trimmed
              .replace(/\b(white|black|red|blue|green|yellow|brown|gray|grey|graphite|beige|ivory|cream|navy|pink|orange|purple)\b/gi, '')
              .replace(/\b(\d+cm|\d+\s*cm|\d+)\b/gi, '')
              .replace(/\b(left|right|l|r|corner left|corner right)\b/gi, '')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
            
            // If base becomes empty after removing variations, use original name
            if (!base || base.length === 0) {
              return trimmed.toLowerCase();
            }
            
            return base;
          };

          // Helper function to extract variation attributes from product name (STRONG DETECTION)
          const extractVariationsFromProductName = (productName: string): Array<{type: 'size' | 'color' | 'orientation' | 'material' | 'finish' | 'other', value: string}> => {
            const variations: Array<{type: 'size' | 'color' | 'orientation' | 'material' | 'finish' | 'other', value: string}> = [];
            const normalized = productName.toLowerCase().replace(/_/g, ' '); // Normalize underscores to spaces
            
            // Extract size - comprehensive patterns
            // Match numbers: 120, 150, 160, 180, 203, 208, 210, 250, 255, 256, etc.
            // Match with units: 120cm, 150cm, 120w, 150w, etc.
            // Match size keywords: small, medium, large, xl, xxl, xs, s, m, l
            const sizePatterns = [
              /\b(\d+)\s*(cm|w|width|w\b)/i,  // 120cm, 150w, 200width
              /\b(\d{3,4})\b/,                  // 120, 150, 160, 180, 203, 208, 210, 250, 255, 256
              /\b(\d+)\s*cm\b/i,               // 120 cm (with space)
              /\b(small|medium|large|xl|xxl|xs|s|m|l|extra\s*small|extra\s*large)\b/i
            ];
            
            for (const pattern of sizePatterns) {
              const match = normalized.match(pattern);
              if (match) {
                const sizeValue = match[1] || match[0];
                // Avoid matching years or other 4-digit numbers that aren't sizes
                if (sizeValue.length <= 4 && !variations.some(v => v.type === 'size')) {
                  variations.push({ type: 'size', value: sizeValue.toString() });
                  break; // Only extract first size found
                }
              }
            }
            
            // Extract color - comprehensive list
            const colorPattern = /\b(white|black|red|blue|green|yellow|brown|gray|grey|beige|ivory|cream|navy|pink|orange|purple|graphite|silver|gold|bronze|copper|maroon|burgundy|teal|turquoise|mint|lavender|violet|indigo|tan|khaki|olive|charcoal|slate)\b/i;
            const colorMatch = normalized.match(colorPattern);
            if (colorMatch) {
              variations.push({ type: 'color', value: colorMatch[1] });
            }
            
            // Extract orientation - STRONG detection for Left/Right
            // Match: Left, Right, L, R, _Left, _Right, Corner Left, Corner Right
            // Case-insensitive, handle underscores and spaces
            const orientationPatterns = [
              /\b(left|right)\b/i,                    // Left, Right
              /\b_?(left|right)\b/i,                   // _Left, _Right
              /\b(corner\s*)?(left|right)\b/i,        // Corner Left, Corner Right
              /\b(l|r)\b/i,                            // L, R (but only if standalone, not part of other words)
            ];
            
            for (const pattern of orientationPatterns) {
              const match = normalized.match(pattern);
              if (match && match.index !== undefined) {
                let orientation = match[1] || match[2] || match[0];
                // Normalize L/R to left/right
                if (orientation.toLowerCase() === 'l') orientation = 'left';
                if (orientation.toLowerCase() === 'r') orientation = 'right';
                
                // Make sure it's not part of another word (e.g., "ALICO" shouldn't match "L")
                const fullMatch = match[0];
                const matchIndex = match.index;
                const beforeChar = matchIndex > 0 ? normalized[matchIndex - 1] : '';
                const afterChar = matchIndex + fullMatch.length < normalized.length 
                  ? normalized[matchIndex + fullMatch.length] 
                  : '';
                const isStandalone = (!beforeChar || /[\s_\-]/.test(beforeChar)) && 
                                     (!afterChar || /[\s_\-]/.test(afterChar));
                
                if (isStandalone && !variations.some(v => v.type === 'orientation')) {
                  variations.push({ type: 'orientation', value: orientation.toLowerCase() });
                  break; // Only extract first orientation found
                }
              }
            }
            
            // Extract material
            const materialPattern = /\b(oak|pine|metal|fabric|leather|plastic|wood|steel|aluminum|aluminium|glass|marble|granite|ceramic|tile|mirror)\b/i;
            const materialMatch = normalized.match(materialPattern);
            if (materialMatch) {
              variations.push({ type: 'material', value: materialMatch[1] });
            }
            
            return variations;
          };

          // Process groups and split any that contain products with different base names
          const validGroups: typeof groupingResult.groups = [];
          
          for (const group of groupingResult.groups) {
            // Extract base names for all products in the group
            const productBaseNames = group.products.map(p => extractBaseNameFromProduct(p.productName));
            
            // Group products by their base name
            const baseNameGroups = new Map<string, typeof group.products>();
            group.products.forEach((product, idx) => {
              const baseName = productBaseNames[idx];
              if (!baseNameGroups.has(baseName)) {
                baseNameGroups.set(baseName, []);
              }
              baseNameGroups.get(baseName)!.push(product);
            });
            
            // Process each unique base name as a separate group
            for (const [baseName, products] of baseNameGroups.entries()) {
              // Only create groups with 2+ products (single products are ungrouped)
              if (products.length > 1) {
                validGroups.push({
                  ...group,
                  baseProductName: baseName,
                  products: products
                });
              } else {
                // Single product - could be added to ungrouped, but we'll skip for now
                console.log(`[GROUPING] Skipping single product "${products[0].productName}" - not enough products for a group`);
              }
            }
          }

          // Process all valid groups
          for (const group of validGroups) {
            // Create descriptive group ID from base product name
            const descriptiveGroupId = createGroupId(group.baseProductName);

            // Sort products within group by variation type priority: size, color, orientation, material, finish, other
            const sortedProducts = [...group.products].sort((a, b) => {
              const typePriority: Record<string, number> = {
                size: 1, color: 2, orientation: 3, material: 4, finish: 5, other: 6
              };
              
              // Sort by size first (if present), then color, then orientation
              const aSize = a.variationAttributes.find(v => v.type === 'size')?.value || '';
              const bSize = b.variationAttributes.find(v => v.type === 'size')?.value || '';
              if (aSize && bSize) {
                // Numeric comparison for sizes
                const aNum = parseInt(aSize);
                const bNum = parseInt(bSize);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                  if (aNum !== bNum) return aNum - bNum;
                } else {
                  if (aSize !== bSize) return aSize.localeCompare(bSize);
                }
              } else if (aSize || bSize) {
                return aSize ? -1 : 1;
              }
              
              // Then by color
              const aColor = a.variationAttributes.find(v => v.type === 'color')?.value || '';
              const bColor = b.variationAttributes.find(v => v.type === 'color')?.value || '';
              if (aColor !== bColor) return aColor.localeCompare(bColor);
              
              // Then by orientation
              const aOrientation = a.variationAttributes.find(v => v.type === 'orientation')?.value || '';
              const bOrientation = b.variationAttributes.find(v => v.type === 'orientation')?.value || '';
              if (aOrientation !== bOrientation) return aOrientation.localeCompare(bOrientation);
              
              // Finally by other attributes
              const aType = a.variationAttributes[0]?.type || 'other';
              const bType = b.variationAttributes[0]?.type || 'other';
              if (typePriority[aType] !== typePriority[bType]) {
                return typePriority[aType] - typePriority[bType];
              }
              return (a.variationAttributes[0]?.value || '').localeCompare(b.variationAttributes[0]?.value || '');
            });

            // Assign group ID and order to each product in the group
            // The AI might return shortened article IDs, so we use rowIndex to map back to the original article ID
            sortedProducts.forEach((product, order) => {
              // First, try to get the actual article ID using rowIndex (most reliable)
              let actualArticleId: string | undefined;
              
              if (product.rowIndex && rowIndexToArticleId.has(product.rowIndex)) {
                actualArticleId = rowIndexToArticleId.get(product.rowIndex);
              } else {
                // Fallback: try the article ID from AI result
                const normalizedArticleId = product.articleId.trim();
                
                // Check if this article_id was actually inserted
                if (insertedArticleIdsSet.has(normalizedArticleId)) {
                  actualArticleId = normalizedArticleId;
                } else {
                  // Try to find a match by checking if the article_id exists in our validRows
                  const matchingRowIndex = articleIdToRowIndex.get(normalizedArticleId);
                  if (matchingRowIndex !== undefined) {
                    actualArticleId = validRows[matchingRowIndex]['Article ID']?.trim();
                  }
                }
              }
              
              if (actualArticleId && insertedArticleIdsSet.has(actualArticleId)) {
                // Extract variation attributes from AI result, with fallback extraction if missing
                let variationAttributes = product.variationAttributes || [];
                
                // If AI didn't provide variationAttributes, extract them from product name
                if (!variationAttributes || variationAttributes.length === 0) {
                  const productName = product.productName || '';
                  // Use the same extraction logic as fallback grouping
                  variationAttributes = extractVariationsFromProductName(productName);
                }
                
                const variationSize = variationAttributes.find(v => v.type === 'size')?.value;
                const variationColor = variationAttributes.find(v => v.type === 'color')?.value;
                const variationOrientation = variationAttributes.find(v => v.type === 'orientation')?.value;
                
                // Calculate pricing if AI didn't provide it, based on order and variations
                let suggestedPricingOptionId = product.suggestedPricingOptionId;
                let suggestedPrice = product.suggestedPrice;
                
                if (!suggestedPricingOptionId || suggestedPrice === undefined || suggestedPrice === null) {
                  // First product in group (order = 0 after forEach) - always base price
                  if (order === 0) {
                    suggestedPricingOptionId = 'pbr_3d_model_after_second';
                    suggestedPrice = 30;
                  } else {
                    // Subsequent products - determine pricing based on variation type
                    if (variationOrientation) {
                      // Left/Right orientation variations are free (0 euros)
                      suggestedPricingOptionId = null; // No additional pricing option for orientation
                      suggestedPrice = 0;
                    } else if (variationColor) {
                      suggestedPricingOptionId = 'additional_colors_after_second';
                      suggestedPrice = 1.5;
                    } else if (variationSize) {
                      suggestedPricingOptionId = 'additional_sizes_after_second';
                      suggestedPrice = 5;
                    } else {
                      // Default for other variations (material, finish, etc.)
                      suggestedPricingOptionId = 'additional_textures_after_second';
                      suggestedPrice = 7;
                    }
                  }
                }
                
                articleToGroupMap.set(actualArticleId, {
                  groupId: descriptiveGroupId,
                  order: order + 1,
                  variationSize: variationSize,
                  variationColor: variationColor,
                  variationOrientation: variationOrientation,
                  suggestedPricingOptionId: suggestedPricingOptionId,
                  suggestedPrice: suggestedPrice
                });
              } else {
                console.warn(`[GROUPING] ⚠️ Cannot map AI result to actual article ID. RowIndex: ${product.rowIndex}, AI articleId: ${product.articleId}, skipping`);
              }
            });
            
            console.log(`Group ${descriptiveGroupId} (${group.baseProductName}): ${sortedProducts.length} products`);
          }

          // Process ungrouped products with suggested pricing
          if (groupingResult.ungrouped && groupingResult.ungrouped.length > 0) {
            console.log(`[GROUPING] Processing ${groupingResult.ungrouped.length} ungrouped products with suggested pricing...`);
            
            for (const ungroupedProduct of groupingResult.ungrouped) {
              // Try to get the actual article ID using rowIndex
              let actualArticleId: string | undefined;
              
              if (ungroupedProduct.rowIndex && rowIndexToArticleId.has(ungroupedProduct.rowIndex)) {
                actualArticleId = rowIndexToArticleId.get(ungroupedProduct.rowIndex);
              } else {
                const normalizedArticleId = ungroupedProduct.articleId.trim();
                if (insertedArticleIdsSet.has(normalizedArticleId)) {
                  actualArticleId = normalizedArticleId;
                } else {
                  const matchingRowIndex = articleIdToRowIndex.get(normalizedArticleId);
                  if (matchingRowIndex !== undefined) {
                    actualArticleId = validRows[matchingRowIndex]['Article ID']?.trim();
                  }
                }
              }
              
              if (actualArticleId && insertedArticleIdsSet.has(actualArticleId)) {
                // Extract variations from product name if not provided by AI
                const productName = ungroupedProduct.productName || '';
                const variationAttributes = extractVariationsFromProductName(productName);
                
                const variationSize = variationAttributes.find(v => v.type === 'size')?.value;
                const variationColor = variationAttributes.find(v => v.type === 'color')?.value;
                const variationOrientation = variationAttributes.find(v => v.type === 'orientation')?.value;
                
                // Calculate pricing if AI didn't provide it (ungrouped products are always base price)
                let suggestedPricingOptionId = ungroupedProduct.suggestedPricingOptionId || 'pbr_3d_model_after_second';
                let suggestedPrice = ungroupedProduct.suggestedPrice;
                
                if (suggestedPrice === undefined || suggestedPrice === null) {
                  suggestedPrice = 30; // Base price for standalone products
                }
                
                // Add to articleToGroupMap with null group info but with suggested pricing and variations
                articleToGroupMap.set(actualArticleId, {
                  groupId: null as any, // Will be handled as ungrouped
                  order: null as any,
                  variationSize: variationSize,
                  variationColor: variationColor,
                  variationOrientation: variationOrientation,
                  suggestedPricingOptionId: suggestedPricingOptionId,
                  suggestedPrice: suggestedPrice
                });
              }
            }
          }

          // Update database with grouping information
          try {
            const updateBatchSize = 50;
            const updateEntries = Array.from(articleToGroupMap.entries());
            
            // First, fetch the actual article_ids from the database for the current client and batch
            // This ensures we're using the exact values stored in the database
            const articleIdsToUpdate = Array.from(articleToGroupMap.keys());
            console.log(`[GROUPING] Fetching ${articleIdsToUpdate.length} products from database for client: ${clientName}, batch: ${batch}...`);
            
            const { data: existingProducts, error: fetchError } = await supabase
              .from('onboarding_assets')
              .select('id, article_id, product_name')
              .eq('client', clientName)
              .eq('batch', batch)
              .in('article_id', articleIdsToUpdate);
            
            if (fetchError) {
              console.error('[GROUPING] ❌ Error fetching products:', fetchError);
              throw fetchError;
            }
            
            if (!existingProducts || existingProducts.length === 0) {
              console.warn(`[GROUPING] ⚠️ No products found in database for client: ${clientName}, batch: ${batch}`);
              console.warn(`[GROUPING] ⚠️ Searched for article_ids: ${articleIdsToUpdate.slice(0, 5).join(', ')}...`);
              console.warn(`[GROUPING] ⚠️ Total article_ids to search: ${articleIdsToUpdate.length}`);
              console.warn(`[GROUPING] ⚠️ Inserted article_ids count: ${importResults.insertedArticleIds.length}`);
              console.warn(`[GROUPING] ⚠️ First 5 inserted article_ids: ${importResults.insertedArticleIds.slice(0, 5).join(', ')}`);
              
              // Try fetching all products for this client and batch to see what's actually there
              const { data: allProducts } = await supabase
                .from('onboarding_assets')
                .select('article_id, product_name')
                .eq('client', clientName)
                .eq('batch', batch)
                .limit(10);
              
              if (allProducts && allProducts.length > 0) {
                console.warn(`[GROUPING] ⚠️ Found ${allProducts.length} products in DB, but article_ids don't match:`);
                console.warn(`[GROUPING] ⚠️ DB article_ids: ${allProducts.map(p => p.article_id).join(', ')}`);
              } else {
                console.warn(`[GROUPING] ⚠️ No products found in database at all for client: ${clientName}, batch: ${batch}`);
              }
              
              // Continue without throwing - might be a timing issue or batch mismatch
            } else {
              console.log(`[GROUPING] Found ${existingProducts.length} products in database to update`);
              
              // Create a map of article_id to database ID for efficient updates
              const articleIdToDbId = new Map<string, string>();
              existingProducts.forEach(p => {
                articleIdToDbId.set(p.article_id, p.id);
              });
              
              // Track statistics
              let totalUpdated = 0;
              let totalFailed = 0;
              let pricingColumnsDetected = true; // Assume columns exist until proven otherwise
              
            for (let i = 0; i < updateEntries.length; i += updateBatchSize) {
              const batch = updateEntries.slice(i, i + updateBatchSize);
              console.log(`[GROUPING] Processing batch ${Math.floor(i/updateBatchSize) + 1}: ${batch.length} products`);
              
                // Filter out entries that don't have a database ID
                const validBatch = batch.filter(([articleId]) => {
                  const dbId = articleIdToDbId.get(articleId);
                  if (!dbId) {
                    console.warn(`[GROUPING] ⚠️ No database ID found for article_id: ${articleId} - skipping`);
                    totalFailed++;
                    return false;
                  }
                  return true;
                });
                
                if (validBatch.length === 0) {
                  console.warn(`[GROUPING] ⚠️ No valid entries in batch ${Math.floor(i/updateBatchSize) + 1} - all were skipped`);
                  continue;
                }
                
                const batchUpdates = validBatch.map(([articleId, groupInfo]) => {
                  const dbId = articleIdToDbId.get(articleId)!; // Safe to use ! since we filtered above
                  
                  // Build update object - only include fields that are not null/undefined
                  const updateData: any = {
                    updated_at: new Date().toISOString()
                  };
                  
                  // Only update grouping fields if they exist (ungrouped products won't have these)
                  if (groupInfo.groupId) {
                    updateData.product_group_id = groupInfo.groupId;
                    updateData.group_order = groupInfo.order;
                    updateData.variation_size = groupInfo.variationSize || null;
                    updateData.variation_color = groupInfo.variationColor || null;
                    updateData.variation_orientation = groupInfo.variationOrientation || null;
                  }
                  
                  // Only update suggested pricing if columns exist (migration may not have been run)
                  // Skip if we've already detected that columns don't exist
                  if (pricingColumnsDetected) {
                    if (groupInfo.suggestedPricingOptionId) {
                      updateData.suggested_pricing_option_id = groupInfo.suggestedPricingOptionId;
                    }
                    if (groupInfo.suggestedPrice !== undefined && groupInfo.suggestedPrice !== null) {
                      updateData.suggested_price = groupInfo.suggestedPrice;
                    }
                  }
                  
                  console.log(`[GROUPING]   Updating ${articleId} (id: ${dbId}) -> group: ${groupInfo.groupId || 'N/A'}, order: ${groupInfo.order || 'N/A'}, size: ${groupInfo.variationSize || 'N/A'}, color: ${groupInfo.variationColor || 'N/A'}, orientation: ${groupInfo.variationOrientation || 'N/A'}, suggestedPrice: ${groupInfo.suggestedPrice || 'N/A'}`);
                  
                return supabase
                  .from('onboarding_assets')
                  .update(updateData)
                    .eq('id', dbId) // Use ID instead of article_id for exact match
                    .select('id, article_id, product_name, product_group_id, group_order, variation_size, variation_color, variation_orientation, suggested_pricing_option_id, suggested_price');
              });
                
              const results = await Promise.all(batchUpdates);
              
              // Check for errors first (before individual logging)
              const errors = results.filter(r => r.error);
              
              // Check if it's a missing column error for suggested pricing columns
              let shouldRetryWithoutPricing = false;
              if (errors.length > 0) {
                const firstError = errors[0].error;
                shouldRetryWithoutPricing = !!(firstError?.message?.includes('suggested_price') || 
                                            firstError?.message?.includes('suggested_pricing_option_id'));
                
                if (shouldRetryWithoutPricing) {
                  // Mark that pricing columns don't exist - skip for all future batches
                  pricingColumnsDetected = false;
                  
                  // Only log once
                  if (i === 0) {
                    console.warn('[GROUPING] ⚠️ Suggested pricing columns not found - skipping suggested pricing updates');
                    console.warn('[GROUPING] ⚠️ To enable AI pricing suggestions, run: supabase/add_pricing_suggestions.sql');
                  }
                  
                  // Retry without suggested pricing columns
                  const retryBatch = validBatch.map(([articleId, groupInfo]) => {
                    const dbId = articleIdToDbId.get(articleId)!;
                    const updateData: any = {
                      updated_at: new Date().toISOString()
                    };
                    
                    if (groupInfo.groupId) {
                      updateData.product_group_id = groupInfo.groupId;
                      updateData.group_order = groupInfo.order;
                      updateData.variation_size = groupInfo.variationSize || null;
                      updateData.variation_color = groupInfo.variationColor || null;
                      updateData.variation_orientation = groupInfo.variationOrientation || null;
                    }
                    
                    // Skip suggested pricing columns
                    return supabase
                      .from('onboarding_assets')
                      .update(updateData)
                      .eq('id', dbId)
                      .select('id, article_id, product_name, product_group_id, group_order, variation_size, variation_color, variation_orientation');
                  });
                  
                  const retryResults = await Promise.all(retryBatch);
                  
                  // Log update results and track statistics from retry
                  retryResults.forEach((result, idx) => {
                    const [articleId] = validBatch[idx];
                    if (result.error) {
                      totalFailed++;
                      console.error(`[GROUPING] ❌ Failed to update ${articleId} (retry):`, result.error);
                    } else {
                      const updatedCount = result.data?.length || 0;
                      if (updatedCount === 0) {
                        totalFailed++;
                        console.warn(`[GROUPING] ⚠️ No rows updated for ${articleId} (retry) - check if id matches`);
                      } else {
                        totalUpdated++;
                        console.log(`[GROUPING] ✅ Updated ${articleId}: ${updatedCount} row(s) - group: ${result.data?.[0]?.product_group_id}, order: ${result.data?.[0]?.group_order}`);
                      }
                    }
                  });
                  
                  const retryErrors = retryResults.filter(r => r.error);
                  if (retryErrors.length > 0) {
                    console.error('[GROUPING] ❌ Retry failed:', retryErrors[0].error);
                    throw retryErrors[0].error;
                  }
                  
                  // Continue to next batch
                  continue;
                }
              }
              
              // Log update results and track statistics (only if not retried)
              if (!shouldRetryWithoutPricing) {
              results.forEach((result, idx) => {
                  const [articleId] = validBatch[idx];
                if (result.error) {
                    totalFailed++;
                  console.error(`[GROUPING] ❌ Failed to update ${articleId}:`, result.error);
                } else {
                  const updatedCount = result.data?.length || 0;
                  if (updatedCount === 0) {
                      totalFailed++;
                      console.warn(`[GROUPING] ⚠️ No rows updated for ${articleId} - check if id matches`);
                  } else {
                      totalUpdated++;
                      console.log(`[GROUPING] ✅ Updated ${articleId}: ${updatedCount} row(s) - group: ${result.data?.[0]?.product_group_id}, order: ${result.data?.[0]?.group_order}`);
                  }
                }
              });
              
                // Check for other errors (non-pricing related)
              if (errors.length > 0) {
                const firstError = errors[0].error;
                console.error('[GROUPING] ❌ Database update error:', firstError);
                console.error('[GROUPING] Error details:', JSON.stringify(firstError, null, 2));
                  
                if (firstError?.message?.includes('column') && 
                    (firstError?.message?.includes('does not exist') || 
                     firstError?.message?.includes('product_group_id'))) {
                  console.error('[GROUPING] ⚠️ MIGRATION REQUIRED - Columns do not exist!');
                  throw new Error('MIGRATION_REQUIRED: Please run the migration in supabase/add_product_grouping.sql');
                  } else {
                throw firstError;
                  }
                }
              }
              }
              
              console.log(`[GROUPING] ✅ Update summary: ${totalUpdated} succeeded, ${totalFailed} failed`);
              
              if (totalUpdated === 0 && totalFailed > 0) {
                console.warn(`[GROUPING] ⚠️ WARNING: No products were updated! This might indicate a batch mismatch or timing issue.`);
              }
            }
          } catch (updateError) {
            // If columns don't exist, log warning but don't fail the import
            if (updateError instanceof Error && updateError.message.includes('MIGRATION_REQUIRED')) {
              console.warn('⚠️ Grouping columns not found. Migration required.');
              console.warn('Run the SQL in: supabase/add_product_grouping.sql');
              groupingStats = {
                totalGroups: groupingResult.groups.length,
                groupedProducts: groupingResult.statistics?.groupedProducts || 0,
                ungroupedProducts: groupingResult.statistics?.ungroupedProducts || 0,
                warning: 'Grouping data calculated but not saved. Please run database migration: supabase/add_product_grouping.sql'
              };
              // Continue without throwing - import was successful
            } else {
              // Other errors - log but don't fail import
              console.error('Error updating grouping info:', updateError);
            }
          }
          
          // Set grouping stats if not already set (in case of error, it's set above)
          if (!groupingStats) {
            groupingStats = {
              totalGroups: groupingResult.groups.length,
              groupedProducts: groupingResult.statistics?.groupedProducts || 0,
              ungroupedProducts: groupingResult.statistics?.ungroupedProducts || 0
            };
          }

          // Ensure groupingStats has the expected structure
          const stats = {
            totalGroups: 'totalGroups' in groupingStats ? groupingStats.totalGroups : groupingResult.groups.length,
            groupedProducts: 'groupedProducts' in groupingStats ? groupingStats.groupedProducts : (groupingResult.statistics?.groupedProducts || 0),
            ungroupedProducts: 'ungroupedProducts' in groupingStats ? groupingStats.ungroupedProducts : (groupingResult.statistics?.ungroupedProducts || 0)
          };

            console.log('========================================');
            console.log(`[GROUPING] ✅ COMPLETED`);
          console.log(`   Groups: ${stats.totalGroups}`);
          console.log(`   Grouped Products: ${stats.groupedProducts}`);
          console.log(`   Ungrouped Products: ${stats.ungroupedProducts}`);
            console.log('========================================');
          } else {
            console.warn('[GROUPING] ⚠️ No groups found in result');
          }
        } catch (groupingError) {
          console.error('========================================');
          console.error('[GROUPING] ❌ ERROR DURING GROUPING');
          console.error('[GROUPING] Error:', groupingError);
          console.error('[GROUPING] Stack:', groupingError instanceof Error ? groupingError.stack : 'No stack');
          console.error('========================================');
          // Don't fail the import if grouping fails - it's running in background
        }
      })();
      
      // Return immediately with message that grouping is in progress
      groupingStats = {
        status: 'processing',
        message: 'Grouping is running in the background. Products will be grouped automatically.'
      };
    }

    return NextResponse.json({
      success: true,
      import: {
        totalRows: result.processedRows.length,
        importedCount: importResults.successCount,
        errorCount: importResults.errorCount,
        skippedCount: result.errors.length
      },
      grouping: groupingStats,
      statistics: result.statistics,
      errors: [
        ...importResults.errors.slice(0, 20),
        ...result.errors.slice(0, 20)
      ],
      message: `Successfully imported ${importResults.successCount} rows for client ${clientName}${groupingStats && 'status' in groupingStats && groupingStats.status === 'processing' ? ' (grouping in progress)' : groupingStats && 'totalGroups' in groupingStats ? ` (${groupingStats.totalGroups} groups created)` : ''}`
    });
  } catch (error) {
    console.error('========================================');
    console.error('❌ ERROR IN CSV IMPORT ROUTE');
    console.error('Error:', error);
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    console.error('========================================');
    return NextResponse.json(
      {
        error: 'Failed to import CSV',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



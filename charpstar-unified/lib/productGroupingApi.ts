import { GoogleGenAI } from '@google/genai';

interface ProductInput {
  rowIndex: number;
  articleId: string;
  productName: string;
  category?: string;
  subcategory?: string;
}

interface VariationAttribute {
  type: 'color' | 'size' | 'material' | 'finish' | 'orientation' | 'other';
  value: string;
}

interface GroupedProduct {
  rowIndex: number;
  articleId: string;
  productName: string;
  variationAttributes: VariationAttribute[];
  confidence: number;
  suggestedPricingOptionId?: string;
  suggestedPrice?: number;
}

interface ProductGroup {
  groupId: string;
  baseProductName: string;
  products: GroupedProduct[];
  variationTypes: string[];
}

interface UngroupedProduct {
  rowIndex: number;
  articleId: string;
  productName: string;
  suggestedPricingOptionId?: string;
  suggestedPrice?: number;
}

export interface GroupingResult {
  success: boolean;
  groups: ProductGroup[];
  ungrouped: UngroupedProduct[];
  statistics?: {
    totalProducts: number;
    groupedProducts: number;
    ungroupedProducts: number;
    totalGroups: number;
  };
  error?: string;
}

/**
 * Perform AI-powered product grouping
 */
export async function performGrouping(products: ProductInput[]): Promise<GroupingResult> {
  console.log('[performGrouping] Called with', products.length, 'products');
  
  if (!products || !Array.isArray(products) || products.length === 0) {
    console.error('[performGrouping] ❌ Empty products array');
    return {
      success: false,
      groups: [],
      ungrouped: [],
      error: 'Products array is required and must not be empty'
    };
  }

  // Initialize Gemini
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[performGrouping] ❌ No API key found');
    return {
      success: false,
      groups: [],
      ungrouped: [],
      error: 'GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable is required'
    };
  }

  console.log('[performGrouping] ✅ API key found, initializing Gemini...');
  const gemini = new GoogleGenAI({ apiKey });

  // Prepare product list for AI
  const productList = products.map((p, idx) => 
    `Row ${p.rowIndex}: "${p.articleId}" | "${p.productName}"${p.category ? ` | Category: ${p.category}` : ''}${p.subcategory ? ` | Subcategory: ${p.subcategory}` : ''}`
  ).join('\n');

  const prompt = `Analyze these products and group them by BASE MODEL NAME, treating size, color, and orientation as variations:

Products:
${productList}

Task:
1. Extract the BASE MODEL NAME:
   - If product name contains NO variation indicators (no numbers, colors, orientations) → Base name = full product name
     - Example: "Veronica" → Base: "Veronica" (no variations to remove)
     - Example: "Kayzar" → Base: "Kayzar" (no variations to remove)
   - If product name contains variation indicators → Remove variation attributes to get base name:
     - Remove sizes: "Wardrobe PARIS" from "Wardrobe PARIS 120" or "Wardrobe PARIS 150"
     - Remove colors: "Wardrobe PARIS" from "Wardrobe PARIS White" or "Wardrobe PARIS 120 Black"
     - Remove orientations: "Corner Sofa" from "Corner Sofa Left" or "Corner Sofa Right"
     - Example: "Wardrobe PARIS 120 White" → Base: "Wardrobe PARIS"
     - Example: "Veronica 120" → Base: "Veronica" (remove size)

2. Group products that share the SAME BASE MODEL NAME:
   - Products with identical base names → ONE group
   - Products with different base names → SEPARATE groups

3. Extract variation attributes for each product (MANDATORY - you MUST include variationAttributes for every product):
   - **Type: "size"** - STRONG DETECTION REQUIRED:
     * Look for numeric sizes: 120, 150, 160, 180, 203, 208, 210, 250, 255, 256, etc. (3-4 digit numbers)
     * Look for sizes with units: 120cm, 150cm, 120w, 150w, 200width, etc.
     * Look for size keywords: Small, Medium, Large, XL, XXL, XS, S, M, L, Extra Small, Extra Large
     * Examples: "Wardrobe PARIS 120" → size: "120", "Wardrobe 150w" → size: "150", "Sofa Large" → size: "large"
   - **Type: "color"** - Extract ALL color names:
     * Common: White, Black, Red, Blue, Green, Yellow, Brown, Gray, Grey, Graphite
     * Extended: Beige, Ivory, Cream, Navy, Pink, Orange, Purple, Silver, Gold, Bronze, Copper, Maroon, Burgundy, Teal, Turquoise, Mint, Lavender, Violet, Indigo, Tan, Khaki, Olive, Charcoal, Slate
     * Examples: "Wardrobe White" → color: "White", "Sofa Graphite" → color: "Graphite"
   - **Type: "orientation"** - STRONG DETECTION REQUIRED (CRITICAL):
     * Look for: Left, Right, L, R, _Left, _Right, Corner Left, Corner Right
     * Case-insensitive: "left", "Left", "LEFT" all mean orientation
     * Handle underscores: "ALICO_Left" or "ALICO Left" both contain orientation
     * Handle abbreviations: "L" or "R" at the end of names (but NOT if part of another word like "ALICO")
     * Examples: "Corner Sofa ALICO Left" → orientation: "left", "Sofa Right" → orientation: "right", "Bed_L" → orientation: "left"
     * CRITICAL: If product name ends with "Left" or "Right" (or "L"/"R"), it MUST be detected as orientation
   - **Type: "material"** - Extract material types:
     * Oak, Pine, Metal, Fabric, Leather, Plastic, Wood, Steel, Aluminum, Glass, Marble, Granite, Ceramic, Tile, Mirror
   - **Type: "finish"** - Extract finish types:
     * Matte, Glossy, Satin, etc.
   - **Type: "other"** - Any other variation type not covered above
   - **Value**: the specific variation value (use lowercase for consistency)
   - **CRITICAL DETECTION RULES**:
     * If a product has NO variations, return an empty array: "variationAttributes": []
     * If a product has variations, extract ALL of them. For example:
       - "Wardrobe PARIS 120 White" → [{"type": "size", "value": "120"}, {"type": "color", "value": "white"}]
       - "Corner Sofa ALICO Left" → [{"type": "orientation", "value": "left"}]
       - "Wardrobe PARIS 150 Black" → [{"type": "size", "value": "150"}, {"type": "color", "value": "black"}]
     * ALWAYS check for size numbers (120, 150, 160, etc.) - they are common variations
     * ALWAYS check for Left/Right at the end of product names - they indicate orientation
     * If unsure whether something is a variation, extract it - better to over-detect than under-detect

4. IMPORTANT GROUPING RULES:
   - "Wardrobe PARIS 120 White", "Wardrobe PARIS 120 Black", "Wardrobe PARIS 150 White" → ALL in ONE group "Wardrobe PARIS"
     (with size and color as separate variation attributes)
   - "Corner Sofa Left", "Corner Sofa Right" → ONE group "Corner Sofa" (with orientation as variation)
   - "Sofa MANAMO 200cm White", "Sofa MANAMO 250cm White" → ONE group "Sofa MANAMO" (size is a variation)

5. Calculate confidence score (0-1) for each grouping

6. Suggest pricing for each product based on these rules (CRITICAL: Base model is ALWAYS 30 euros, no random suggestions):
   - **First product in a group (group_order = 1) OR standalone product (not in any group)**: 
     - suggestedPricingOptionId: "pbr_3d_model_after_second"
     - suggestedPrice: 30
     - Reason: Base PBR 3D Model Creation (ALWAYS 30 euros for base model)
   - **Subsequent products in a group (group_order > 1)**:
     - If has "orientation" variation attribute (Left/Right):
       - suggestedPricingOptionId: null (or omit this field)
       - suggestedPrice: 0
       - Reason: Left/Right orientation variations are FREE (0 euros)
     - Else if has "color" variation attribute:
       - suggestedPricingOptionId: "additional_colors_after_second"
       - suggestedPrice: 1.5
       - Reason: Additional Colors variation
     - Else if has "size" variation attribute:
       - suggestedPricingOptionId: "additional_sizes_after_second"
       - suggestedPrice: 5
       - Reason: Additional Sizes variation
     - Else (has other variation types like material, finish):
       - suggestedPricingOptionId: "additional_textures_after_second"
       - suggestedPrice: 7
       - Reason: Additional Textures/Materials (other variations)

7. Products that don't fit any group should be in "ungrouped" (with pricing suggestion as standalone)

CRITICAL RULES:
- **Products with IDENTICAL names (case-insensitive) should ALWAYS be grouped together**
  - Example: 8 products all named "Veronica" → ONE group "Veronica"
  - Example: 3 products all named "Kayzar" → ONE group "Kayzar"
  - Example: Products named "Nain 6la" → ONE group "Nain 6la"
- **Products with DIFFERENT names should be in DIFFERENT groups**
  - "Veronica" and "Kayzar" are DIFFERENT → Separate groups
  - "Nain 6la" and "Arezu" are DIFFERENT → Separate groups
  - "Wardrobe PARIS" and "Wardrobe PARIS LUX" are DIFFERENT → Separate groups
- For products with variations in the name:
  - "Wardrobe PARIS 120" and "Wardrobe PARIS 160" → SAME group "Wardrobe PARIS" (size is a variation)
  - "Wardrobe PARIS 120 White" and "Wardrobe PARIS 120 Black" → SAME group "Wardrobe PARIS" (color is a variation)
  - "Corner Sofa Left" and "Corner Sofa Right" → SAME group "Corner Sofa" (orientation is a variation)
- **Base model extraction:**
  - If product name has no size/color/orientation indicators → Base name = full product name
  - If product name has variations → Remove variation attributes to get base name
  - Example: "Veronica" (no variations) → Base: "Veronica"
  - Example: "Veronica 120" (has size) → Base: "Veronica"
  - Example: "Wardrobe PARIS 120 White" → Base: "Wardrobe PARIS"

CRITICAL: You MUST return the EXACT articleId and rowIndex values that were provided in the input. Do NOT modify, shorten, or infer article IDs.

Return JSON only (no markdown, no code blocks):
{
  "groups": [
    {
      "groupId": "group_1",
      "baseProductName": "Wardrobe PARIS",
      "products": [
        {
          "rowIndex": 2,
          "articleId": "001_WardrobePARIS120White",
          "productName": "Wardrobe PARIS 120 White",
          "variationAttributes": [
            {"type": "size", "value": "120"},
            {"type": "color", "value": "White"}
          ],
          "confidence": 0.95,
          "suggestedPricingOptionId": "pbr_3d_model_after_second",
          "suggestedPrice": 30
        },
        {
          "rowIndex": 3,
          "articleId": "002_WardrobePARIS120Black",
          "productName": "Wardrobe PARIS 120 Black",
          "variationAttributes": [
            {"type": "size", "value": "120"},
            {"type": "color", "value": "Black"}
          ],
          "confidence": 0.95,
          "suggestedPricingOptionId": "additional_colors_after_second",
          "suggestedPrice": 1.5
        },
        {
          "rowIndex": 4,
          "articleId": "003_WardrobePARIS150White",
          "productName": "Wardrobe PARIS 150 White",
          "variationAttributes": [
            {"type": "size", "value": "150"},
            {"type": "color", "value": "White"}
          ],
          "confidence": 0.95,
          "suggestedPricingOptionId": "additional_sizes_after_second",
          "suggestedPrice": 5
        }
      ],
      "variationTypes": ["size", "color"]
    },
    {
      "groupId": "group_2",
      "baseProductName": "Corner Sofa Bed ALICO",
      "products": [
        {
          "rowIndex": 18,
          "articleId": "018_Corner_Sofa_Bed_ALICO_Left",
          "productName": "Corner Sofa Bed ALICO Left",
          "variationAttributes": [
            {"type": "orientation", "value": "left"}
          ],
          "confidence": 0.95,
          "suggestedPricingOptionId": "pbr_3d_model_after_second",
          "suggestedPrice": 30
        },
        {
          "rowIndex": 19,
          "articleId": "019_Corner_Sofa_Bed_ALICO_Right",
          "productName": "Corner Sofa Bed ALICO Right",
          "variationAttributes": [
            {"type": "orientation", "value": "right"}
          ],
          "confidence": 0.95,
          "suggestedPrice": 0
        }
      ],
      "variationTypes": ["orientation"]
    }
  ],
  "ungrouped": [
    {
      "rowIndex": 10,
      "articleId": "010_Chair",
      "productName": "Office Chair Ergonomic",
      "suggestedPricingOptionId": "pbr_3d_model_after_second",
      "suggestedPrice": 30
    }
  ]
}`;

  try {
    console.log('[performGrouping] Calling Gemini API with', products.length, 'products...');
    console.log('[performGrouping] Prompt length:', prompt.length, 'chars');
    
    const result = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [{ text: prompt }]
      }
    });

    console.log('[performGrouping] ✅ Gemini API responded');
    console.log('[performGrouping] Response has candidates:', result.candidates?.length || 0);

    if (!result.candidates || result.candidates.length === 0) {
      console.error('[performGrouping] ❌ No candidates in response');
      throw new Error('No response from AI');
    }

    const candidate = result.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      throw new Error('Invalid response structure from AI');
    }

    // Extract text from response
    let text = '';
    for (const part of candidate.content.parts) {
      if (part.text) {
        text += part.text;
      }
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

    console.log('[performGrouping] Extracted JSON, parsing...');
    const parsed = JSON.parse(jsonText);
    console.log('[performGrouping] Parsed JSON. Groups:', parsed.groups?.length || 0, 'Ungrouped:', parsed.ungrouped?.length || 0);

    // Validate response structure
    if (!parsed.groups || !Array.isArray(parsed.groups)) {
      console.error('[performGrouping] ❌ Invalid response: missing groups array');
      throw new Error('Invalid response: missing groups array');
    }
    if (!parsed.ungrouped || !Array.isArray(parsed.ungrouped)) {
      parsed.ungrouped = [];
    }

    return {
      success: true,
      groups: parsed.groups,
      ungrouped: parsed.ungrouped,
      statistics: {
        totalProducts: products.length,
        groupedProducts: parsed.groups.reduce((sum: number, g: ProductGroup) => sum + g.products.length, 0),
        ungroupedProducts: parsed.ungrouped.length,
        totalGroups: parsed.groups.length
      }
    };
  } catch (aiError) {
    console.error('[performGrouping] ❌ AI grouping error:', aiError);
    console.error('[performGrouping] Error type:', aiError instanceof Error ? aiError.constructor.name : typeof aiError);
    console.error('[performGrouping] Error message:', aiError instanceof Error ? aiError.message : String(aiError));
    if (aiError instanceof Error && aiError.stack) {
      console.error('[performGrouping] Stack trace:', aiError.stack);
    }
    
    // Fallback to simple pattern-based grouping
    const fallbackGroups = performFallbackGrouping(products);
    return {
      success: true,
      ...fallbackGroups,
      statistics: {
        totalProducts: products.length,
        groupedProducts: fallbackGroups.groups.reduce((sum, g) => sum + g.products.length, 0),
        ungroupedProducts: fallbackGroups.ungrouped.length,
        totalGroups: fallbackGroups.groups.length
      }
    };
  }
}

/**
 * Fallback pattern-based grouping when AI fails
 */
function performFallbackGrouping(products: ProductInput[]): { groups: ProductGroup[]; ungrouped: UngroupedProduct[] } {
  const groups: ProductGroup[] = [];
  const groupedRowIndices = new Set<number>();
  const ungrouped: UngroupedProduct[] = [];

  for (let i = 0; i < products.length; i++) {
    if (groupedRowIndices.has(products[i].rowIndex)) continue;

    const product = products[i];
    const baseName = extractBaseName(product.productName);
    
    const similarProducts: GroupedProduct[] = [product].map(p => ({
      rowIndex: p.rowIndex,
      articleId: p.articleId,
      productName: p.productName,
      variationAttributes: extractVariations(p.productName),
      confidence: 0.7
    }));

    for (let j = i + 1; j < products.length; j++) {
      if (groupedRowIndices.has(products[j].rowIndex)) continue;

      const otherBaseName = extractBaseName(products[j].productName);
      
      // Only group if base names are exactly the same (case-insensitive)
      // Be strict - don't use Levenshtein distance for fallback to avoid grouping unrelated products
      if (baseName.toLowerCase().trim() === otherBaseName.toLowerCase().trim() && 
          baseName.trim().length > 0) {
        similarProducts.push({
          rowIndex: products[j].rowIndex,
          articleId: products[j].articleId,
          productName: products[j].productName,
          variationAttributes: extractVariations(products[j].productName),
          confidence: 0.7
        });
        groupedRowIndices.add(products[j].rowIndex);
      }
    }

    if (similarProducts.length > 1) {
      const variationTypes = new Set<string>();
      similarProducts.forEach(p => {
        p.variationAttributes.forEach(v => variationTypes.add(v.type));
      });

      groups.push({
        groupId: `group_${groups.length + 1}`,
        baseProductName: baseName,
        products: similarProducts,
        variationTypes: Array.from(variationTypes)
      });
      groupedRowIndices.add(product.rowIndex);
    } else {
      ungrouped.push({
        rowIndex: product.rowIndex,
        articleId: product.articleId,
        productName: product.productName
      });
    }
  }

  return { groups, ungrouped };
}

function extractBaseName(productName: string): string {
  let base = productName;
  // Remove colors
  base = base.replace(/\b(white|black|red|blue|green|yellow|brown|gray|grey|beige|ivory|cream|navy|pink|orange|purple|graphite)\b/gi, '');
  // Remove sizes (numbers, cm, size keywords)
  base = base.replace(/\b(\d+cm|\d+\s*cm|\d+)\b/gi, '');
  base = base.replace(/\b(small|medium|large|xl|xxl|xs|s|m|l)\b/gi, '');
  // Remove orientations
  base = base.replace(/\b(left|right|l|r|corner left|corner right)\b/gi, '');
  // Remove materials
  base = base.replace(/\b(oak|pine|metal|fabric|leather|plastic|wood|steel|aluminum|glass)\b/gi, '');
  // Clean up multiple spaces
  base = base.replace(/\s+/g, ' ').trim();
  return base || productName;
}

function extractVariations(productName: string): VariationAttribute[] {
  const variations: VariationAttribute[] = [];
  const normalized = productName.toLowerCase().replace(/_/g, ' '); // Normalize underscores to spaces
  
  // Extract size - comprehensive patterns
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
  const orientationPatterns = [
    /\b(left|right)\b/i,                    // Left, Right
    /\b_?(left|right)\b/i,                   // _Left, _Right
    /\b(corner\s*)?(left|right)\b/i,        // Corner Left, Corner Right
    /\b(l|r)\b/i,                            // L, R (but only if standalone)
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
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}



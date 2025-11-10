import { GoogleGenAI } from '@google/genai';

const _TARGET_COLUMNS = [
  'Article ID',
  'Product Name',
  'Product Link',
  'CAD/File Link',
  'Category',
  'Subcategory',
  'GLB Link',
  'Active'
];

export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
  confidence: number;
  extractionPattern?: string;
  exampleValues?: string[];
}

export interface MappingResult {
  mappings: ColumnMapping[];
  confidence: number;
  patterns?: {
    articleId?: string;
    productName?: string;
    urls?: string;
    boolean?: string;
  };
}

export interface ExtractionPatterns {
  articleId: string;
  productName: string;
  urls: string;
  boolean: string;
  category?: string;
  subcategory?: string;
}

export class GeminiCSVService {
  private gemini: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable is required');
    }
    this.gemini = new GoogleGenAI({ apiKey });
  }

  /**
   * Map CSV columns to target format using AI
   * Token-efficient: Only uses header + 5 sample rows
   */
  async mapColumns(
    headers: string[],
    sampleRows: string[][]
  ): Promise<MappingResult> {
    const prompt = `
You are a CSV column mapper. Map the client CSV columns to the standard platform format by ANALYZING THE CONTENT, not just column names.

CLIENT CSV COLUMNS:
${headers.map((h, i) => `${i + 1}. "${h}"`).join('\n')}

SAMPLE ROWS (first 5 rows to see actual content):
${sampleRows.slice(0, 5).map((row, i) => {
  const rowData = headers.map((h, j) => `"${h}": "${row[j] || ''}"`).join(', ');
  return `Row ${i + 1}: { ${rowData} }`;
}).join('\n')}

TARGET FORMAT (what we need):
1. Article ID (REQUIRED) - Identifiers like "001_Product", "ABC123", numeric IDs, SKUs
2. Product Name (REQUIRED) - Product descriptions, names, titles
3. Product Link (optional) - URLs to product pages (http/https)
4. CAD/File Link (optional) - URLs to CAD files or downloads
5. Category (optional) - Product categories
6. Subcategory (optional) - Product subcategories
7. GLB Link (optional) - URLs ending in .glb (3D model files)
8. Active (optional) - Boolean values (TRUE/FALSE, Yes/No, Active/Inactive)

CRITICAL INSTRUCTIONS:
1. ANALYZE THE ACTUAL DATA CONTENT, not just column names
   - Column named "ID" with values like "001", "ABC123" → Article ID
   - Column named "Name of the product" or "Product" with text → Product Name
   - Column with URLs ending in .glb → GLB Link (even if column name is "Glbsfdg" or misspelled)
   - Column with http/https URLs → appropriate Link field

2. BE VERY FLEXIBLE with column name matching:
   - "ID", "Article ID", "SKU", "Product ID" → Article ID
   - "Name", "Product Name", "Name of the product", "Title" → Product Name
   - Any column containing "glb" or with .glb URLs → GLB Link
   - Any column with URLs → appropriate Link field

3. MAP BASED ON CONTENT EXAMPLES:
   - If column "ID" has values like "001_Wardrobe", "002_Sofa" → Article ID
   - If column has descriptive text like "Wardrobe PARIS 120 White" → Product Name
   - If column has URLs like "https://dako.b-cdn.net/.../001.glb" → GLB Link

4. REQUIRED FIELDS: Must map Article ID and Product Name if possible (confidence > 0.3)

RETURN JSON:
{
  "mappings": [
    {
      "sourceColumn": "exact column name from CSV",
      "targetColumn": "Article ID",
      "confidence": 0.9,
      "extractionPattern": "description of pattern if applicable",
      "exampleValues": ["actual examples from sample rows"]
    }
  ],
  "confidence": 0.9,
  "patterns": {
    "articleId": "pattern description based on actual data",
    "productName": "pattern description based on actual data",
    "urls": "pattern description based on actual data",
    "boolean": "pattern description based on actual data"
  }
}

IMPORTANT: You MUST try to map Article ID and Product Name. Look at the data content, not just column names!
`;

    try {
      console.log('[GeminiCSVService] Calling Gemini API for column mapping...');
      console.log('[GeminiCSVService] Prompt length:', prompt.length, 'characters');
      
      const result = await this.gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [{ text: prompt }]
        }
      });
      
      if (!result.candidates || result.candidates.length === 0) {
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
      
      const parsed = JSON.parse(jsonText);
      return parsed as MappingResult;
    } catch (error) {
      console.error('[GeminiCSVService] Error in AI column mapping:', error);
      
      // Provide more specific error messages for common issues
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Network/connectivity errors
        if (errorMessage.includes('fetch failed') || 
            errorMessage.includes('network') || 
            errorMessage.includes('econnrefused') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('enotfound')) {
          throw new Error(
            `Network error connecting to Gemini API: ${error.message}. ` +
            `Please check your internet connection and try again. ` +
            `If the problem persists, check if the Gemini API is accessible from your network.`
          );
        }
        
        // API key errors
        if (errorMessage.includes('api key') || 
            errorMessage.includes('authentication') || 
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('401') ||
            errorMessage.includes('403')) {
          throw new Error(
            `Gemini API authentication error: ${error.message}. ` +
            `Please verify that GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable is set correctly.`
          );
        }
        
        // Rate limiting
        if (errorMessage.includes('rate limit') || 
            errorMessage.includes('429') ||
            errorMessage.includes('quota')) {
          throw new Error(
            `Gemini API rate limit exceeded: ${error.message}. ` +
            `Please wait a moment and try again.`
          );
        }
        
        // Generic error
        throw new Error(`Failed to map columns: ${error.message}`);
      }
      
      throw new Error(`Failed to map columns: ${String(error)}`);
    }
  }

  /**
   * Extract patterns from sample rows for batch processing
   * Token-efficient: Uses first 50 rows to learn patterns
   */
  async extractPatterns(
    sampleRows: string[][],
    headers: string[],
    mapping: MappingResult
  ): Promise<ExtractionPatterns> {
    // Limit to first 50 rows for token efficiency
    const limitedRows = sampleRows.slice(0, 50);

    const prompt = `
Analyze these CSV rows and extract reusable patterns for data extraction.

HEADERS:
${headers.map((h, i) => `${i + 1}. ${h}`).join('\n')}

COLUMN MAPPING:
${mapping.mappings.map(m => `- ${m.sourceColumn} → ${m.targetColumn} (confidence: ${m.confidence})`).join('\n')}

SAMPLE ROWS (${limitedRows.length}):
${limitedRows.map((row, i) => 
  `Row ${i + 1}: ${headers.map((h, j) => `${h}: "${row[j] || ''}"`).join(' | ')}`
).join('\n')}

TASK:
Extract patterns that can be used to process ALL rows efficiently:

1. Article ID pattern: Usually format like "001_ProductName" or "ABC123"
2. Product Name pattern: Descriptive text, human-readable
3. URL pattern: URLs starting with http/https, may include GLB links (.glb)
4. Boolean pattern: TRUE/FALSE, Yes/No, Active/Inactive, etc.
5. Category/Subcategory: If detectable, provide patterns

RETURN JSON:
{
  "articleId": "regex pattern or description: e.g., ^\\d{3}_[A-Za-z]+ or description",
  "productName": "description: usually starts with capital, contains spaces",
  "urls": "regex pattern or description: e.g., ^https?:// or ^http",
  "boolean": "keywords: TRUE/FALSE/Yes/No/Active/Inactive",
  "category": "if detectable: keywords or patterns",
  "subcategory": "if detectable: keywords or patterns"
}

Focus on patterns that will work for 90%+ of rows.
`;

    try {
      const result = await this.gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [{ text: prompt }]
        }
      });
      
      if (!result.candidates || result.candidates.length === 0) {
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
      
      // Extract JSON from response
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      
      const parsed = JSON.parse(jsonText);
      return parsed as ExtractionPatterns;
       } catch (error: any) {
      // Handle network errors and API failures gracefully
      if (error?.message?.includes('fetch failed') || error?.message?.includes('network') || error?.code === 'ECONNREFUSED') {
        console.warn('⚠️ Gemini API network error - using default patterns:', error.message);
      } else {
        console.error('Error in pattern extraction:', error);
      }
      // Return default patterns if AI fails - this allows the import to continue
      return {
        articleId: '^\\d{3}_[A-Za-z]+',
        productName: '^[A-Z][A-Za-z\\s]+',
        urls: '^https?://',
        boolean: 'TRUE|FALSE|Yes|No|Active|Inactive'
      };
    }
  }

  /**
   * Validate/correct a problematic row using AI
   * Only used for rows that pattern matching fails
   */
  async validateRow(
    row: string[],
    headers: string[],
    mapping: MappingResult,
    expectedValues: Record<string, any>
  ): Promise<Record<string, string>> {
    const prompt = `
Correct this CSV row that failed pattern matching:

ROW DATA:
${headers.map((h, i) => `${h}: "${row[i] || ''}"`).join('\n')}

COLUMN MAPPING:
${mapping.mappings.map(m => `- ${m.sourceColumn} → ${m.targetColumn}`).join('\n')}

EXPECTED VALUES (what pattern matching tried to extract):
${Object.entries(expectedValues).map(([key, val]) => `${key}: ${val}`).join('\n')}

TASK:
Extract the correct values for:
- Article ID
- Product Name
- Product Link (if available)
- GLB Link (if available - must end with .glb)
- Active (if available - convert to TRUE/FALSE)

RETURN JSON:
{
  "Article ID": "corrected value",
  "Product Name": "corrected value",
  "Product Link": "url or empty",
  "GLB Link": "url ending in .glb or empty",
  "Active": "TRUE or FALSE"
}

Only include fields that can be reasonably extracted.
`;

    try {
      const result = await this.gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [{ text: prompt }]
        }
      });
      
      if (!result.candidates || result.candidates.length === 0) {
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
      
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      
      const parsed = JSON.parse(jsonText);
      return parsed;
    } catch (error) {
      console.error('Error in row validation:', error);
      return expectedValues; // Return original if AI fails
    }
  }
}

export const geminiCSVService = new GeminiCSVService();


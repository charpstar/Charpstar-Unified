import { ParsedCSV } from './csvParser';
import { MappingResult, ExtractionPatterns } from './geminiCSVService';
import { geminiCSVService } from './geminiCSVService';

export interface ProcessedRow {
  'Article ID': string;
  'Product Name': string;
  'Product Link': string;
  'CAD/File Link': string;
  'Category': string;
  'Subcategory': string;
  'GLB Link': string;
  'Active': string;
  _originalRow?: string[];
  _confidence?: number;
  _errors?: string[];
}

export interface ProcessingConfig {
  sampleSize: number;
  batchSize: number;
  maxAIBatches: number;
  patternThreshold: number;
  aiFallbackThreshold: number;
}

export const DEFAULT_CONFIG: ProcessingConfig = {
  sampleSize: 50,
  batchSize: 100,
  maxAIBatches: 5,
  patternThreshold: 0.9,
  aiFallbackThreshold: 0.1
};

export class CSVProcessor {
  private config: ProcessingConfig;
  private mapping?: MappingResult;
  private patterns?: ExtractionPatterns;

  constructor(config: Partial<ProcessingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process CSV using token-efficient batch processing
   */
  async processCSV(
    parsed: ParsedCSV,
    clientName?: string,
    onProgress?: (progress: { current: number; total: number; phase: string }) => void
  ): Promise<{
    processedRows: ProcessedRow[];
    statistics: {
      totalRows: number;
      successCount: number;
      errorCount: number;
      aiBatchesUsed: number;
      tokensUsed: number;
    };
    errors: Array<{ row: number; errors: string[] }>;
  }> {
    const processedRows: ProcessedRow[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];
    let aiBatchesUsed = 0;
    let tokensUsed = 0;

    onProgress?.({ current: 0, total: parsed.rowCount, phase: 'Analyzing CSV structure...' });

    // Phase 1: Column Mapping (AI - one-time, low tokens)
    onProgress?.({ current: 0, total: parsed.rowCount, phase: 'Mapping columns with AI...' });
    const sampleForMapping = parsed.rows.slice(0, 5);
    this.mapping = await geminiCSVService.mapColumns(parsed.headers, sampleForMapping);
    
    // CRITICAL: Ensure basic required mappings exist (even if AI missed them)
    this.ensureRequiredMappings(parsed.headers);
    
    tokensUsed += 1000; // Estimate
    onProgress?.({ current: 5, total: parsed.rowCount, phase: 'Column mapping complete' });

    // Phase 2: Pattern Learning (AI - first batch)
    onProgress?.({ current: 5, total: parsed.rowCount, phase: 'Learning extraction patterns...' });
    const sampleForPatterns = parsed.rows.slice(0, this.config.sampleSize);
    this.patterns = await geminiCSVService.extractPatterns(
      sampleForPatterns,
      parsed.headers,
      this.mapping
    );
    tokensUsed += 3000; // Estimate
    onProgress?.({ current: this.config.sampleSize, total: parsed.rowCount, phase: 'Pattern learning complete' });

    // Phase 3: Batch Processing
    const remainingRows = parsed.rows.slice(this.config.sampleSize);
    const batches = this.chunkArray(remainingRows, this.config.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchStart = this.config.sampleSize + (i * this.config.batchSize);

      onProgress?.({
        current: batchStart,
        total: parsed.rowCount,
        phase: `Processing batch ${i + 1}/${batches.length}...`
      });

      // Try pattern matching first (no tokens)
      const patternResults = await this.processBatchWithPatterns(
        batch,
        parsed.headers,
        i + this.config.sampleSize
      );

      const successRate = patternResults.successCount / batch.length;

      if (successRate >= this.config.patternThreshold) {
        // Pattern matching worked well - no AI needed
        processedRows.push(...patternResults.rows);
      } else if (
        successRate < this.config.aiFallbackThreshold &&
        aiBatchesUsed < this.config.maxAIBatches
      ) {
        // Use AI for this batch (high failure rate)
        const aiResults = await this.processBatchWithAI(
          batch,
          parsed.headers,
          i + this.config.sampleSize
        );
        processedRows.push(...aiResults.rows);
        errors.push(...aiResults.errors);
        aiBatchesUsed++;
        tokensUsed += 500; // Estimate per batch

        // Update patterns with new learning
        if (aiResults.newPatterns) {
          this.patterns = { ...this.patterns, ...aiResults.newPatterns };
        }
      } else {
        // Use pattern results but flag failures
        processedRows.push(...patternResults.rows);
        errors.push(...patternResults.errors);
      }
    }

    // Also process the sample rows that were used for pattern learning
    const sampleProcessed = await this.processBatchWithPatterns(
      sampleForPatterns,
      parsed.headers,
      0
    );
    processedRows.unshift(...sampleProcessed.rows);
    errors.push(...sampleProcessed.errors);

    // Calculate statistics
    const successCount = processedRows.filter(r => !r._errors || r._errors.length === 0).length;
    const errorCount = processedRows.filter(r => r._errors && r._errors.length > 0).length;

    return {
      processedRows,
      statistics: {
        totalRows: parsed.rowCount,
        successCount,
        errorCount,
        aiBatchesUsed,
        tokensUsed
      },
      errors
    };
  }

  /**
   * Process batch using learned patterns (no AI, no tokens)
   */
  private async processBatchWithPatterns(
    batch: string[][],
    headers: string[],
    startIndex: number
  ): Promise<{
    rows: ProcessedRow[];
    successCount: number;
    errors: Array<{ row: number; errors: string[] }>;
  }> {
    const rows: ProcessedRow[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];
    let successCount = 0;

    if (!this.mapping || !this.patterns) {
      throw new Error('Mapping and patterns must be set before processing');
    }

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const rowIndex = startIndex + i;
      const rowErrors: string[] = [];
      const processed: ProcessedRow = {
        'Article ID': '',
        'Product Name': '',
        'Product Link': '',
        'CAD/File Link': '',
        'Category': '',
        'Subcategory': '',
        'GLB Link': '',
        'Active': 'FALSE',
        _originalRow: row,
        _confidence: 0.5
      };

      // Extract values based on mapping and patterns
      for (const mapping of this.mapping.mappings) {
        const sourceIndex = headers.indexOf(mapping.sourceColumn);
        if (sourceIndex === -1 || sourceIndex >= row.length) continue;

        const rawValue = (row[sourceIndex] || '').trim();
        
        // For required fields, always try to extract even if empty
        const isRequired = mapping.targetColumn === 'Article ID' || mapping.targetColumn === 'Product Name';
        
        // Always extract required fields, skip empty optional fields
        if (!rawValue && !isRequired) {
          continue;
        }

        // If we have a value, try pattern matching
        if (rawValue) {
          const extracted = this.extractValue(rawValue, mapping.targetColumn, mapping.confidence);

          if (extracted && extracted.matched) {
            // Pattern matched - use extracted value
            (processed as any)[mapping.targetColumn] = extracted.value as string;
            processed._confidence = Math.min(
              (processed._confidence || 0) + mapping.confidence,
              1
            );
          } else if (extracted) {
            // Pattern didn't match - use raw value as fallback (AI mapped it, so trust it)
            (processed as any)[mapping.targetColumn] = extracted.value as string;
            processed._confidence = Math.min(
              (processed._confidence || 0) + (mapping.confidence * 0.8),
              1
            );
          } else {
            // Extraction failed but have value - use raw value anyway
            (processed as any)[mapping.targetColumn] = rawValue;
          }
        } else if (isRequired) {
          // Required field but empty - will be caught by validation below
          // Don't set it here, let validation handle it
        }
      }

      // CRITICAL: Always try fallback for required fields (Article ID and Product Name only)
      // This ensures we find them even if AI mapping failed or column names are different
      if (!processed['Article ID'] || processed['Article ID'].trim() === '') {
        const articleIdValue = this.findByCommonColumnNames(
          row,
          headers,
          ['ID', 'Article ID', 'ArticleID', 'article_id', 'Article_ID', 'SKU', 'Product ID', 'ProductID', 'ArticleId', 'articleId', 'Id', 'id']
        );
        if (articleIdValue && articleIdValue.trim()) {
          processed['Article ID'] = articleIdValue.trim();
        } else {
          rowErrors.push('Missing required field: Article ID');
        }
      }

      if (!processed['Product Name'] || processed['Product Name'].trim() === '') {
        const productNameValue = this.findByCommonColumnNames(
          row,
          headers,
          ['Name', 'Product Name', 'ProductName', 'product_name', 'Product_Name', 'Name of the product', 'Title', 'Product Title', 'ProductName', 'name', 'Product', 'product']
        );
        if (productNameValue && productNameValue.trim()) {
          processed['Product Name'] = productNameValue.trim();
        } else {
          rowErrors.push('Missing required field: Product Name');
        }
      }
      
      // Note: Product Link is OPTIONAL - don't validate it as required

      // Fallback: Try to find GLB Link by checking columns with "glb" or URLs ending in .glb
      if (!processed['GLB Link'] || processed['GLB Link'].trim() === '') {
        const glbColumnIndex = headers.findIndex(h => 
          h.toLowerCase().includes('glb') || h.toLowerCase().includes('3d')
        );
        if (glbColumnIndex !== -1 && glbColumnIndex < row.length) {
          const glbValue = (row[glbColumnIndex] || '').trim();
          if (glbValue && (/\.glb$/i.test(glbValue) || /^https?:\/\//.test(glbValue))) {
            processed['GLB Link'] = glbValue;
          }
        }
      }

      if (rowErrors.length > 0) {
        processed._errors = rowErrors;
        errors.push({ row: rowIndex, errors: rowErrors });
      } else {
        successCount++;
      }

      rows.push(processed);
    }

    return { rows, successCount, errors };
  }

  /**
   * Process batch using AI (fallback for problematic batches)
   */
  private async processBatchWithAI(
    batch: string[][],
    headers: string[],
    startIndex: number
  ): Promise<{
    rows: ProcessedRow[];
    errors: Array<{ row: number; errors: string[] }>;
    newPatterns?: Partial<ExtractionPatterns>;
  }> {
    const rows: ProcessedRow[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const rowIndex = startIndex + i;

      try {
        // First try pattern matching
        const patternResult = await this.processBatchWithPatterns([row], headers, rowIndex);
        
        if (patternResult.successCount > 0) {
          rows.push(...patternResult.rows);
        } else {
          // Use AI for this row
          const expectedValues: Record<string, any> = {};
          for (const mapping of this.mapping!.mappings) {
            const sourceIndex = headers.indexOf(mapping.sourceColumn);
            if (sourceIndex !== -1) {
              expectedValues[mapping.targetColumn] = row[sourceIndex] || '';
            }
          }

          const aiResult = await geminiCSVService.validateRow(
            row,
            headers,
            this.mapping!,
            expectedValues
          );

          const processed: ProcessedRow = {
            'Article ID': aiResult['Article ID'] || '',
            'Product Name': aiResult['Product Name'] || '',
            'Product Link': aiResult['Product Link'] || '',
            'CAD/File Link': aiResult['CAD/File Link'] || '',
            'Category': aiResult['Category'] || '',
            'Subcategory': aiResult['Subcategory'] || '',
            'GLB Link': aiResult['GLB Link'] || '',
            'Active': aiResult['Active'] || 'FALSE',
            _originalRow: row,
            _confidence: 0.8
          };

          // Validate
          const rowErrors: string[] = [];
          if (!processed['Article ID']) {
            rowErrors.push('Missing required field: Article ID');
          }
          if (!processed['Product Name']) {
            rowErrors.push('Missing required field: Product Name');
          }

          if (rowErrors.length > 0) {
            processed._errors = rowErrors;
            errors.push({ row: rowIndex, errors: rowErrors });
          }

          rows.push(processed);
        }
      } catch (_error) {
        errors.push({
          row: rowIndex,
          errors: [_error instanceof Error ? _error.message : 'Unknown error']
        });
      }
    }

    return { rows, errors };
  }

  /**
   * Ensure required column mappings exist (add if AI missed them)
   */
  private ensureRequiredMappings(headers: string[]): void {
    if (!this.mapping) {
      this.mapping = { mappings: [], confidence: 0 };
    }

    const existingTargets = new Set(this.mapping.mappings.map(m => m.targetColumn));

    // Ensure Article ID mapping exists
    if (!existingTargets.has('Article ID')) {
      const idColumns = [
        'ID', 'Article ID', 'ArticleID', 'article_id', 'Article_ID', 
        'SKU', 'Product ID', 'ProductID', 'ArticleId', 'articleId', 'Id', 'id'
      ];
      const idColumn = headers.find(h => 
        idColumns.some(idCol => h.toLowerCase() === idCol.toLowerCase())
      );
      if (idColumn) {
        this.mapping.mappings.push({
          sourceColumn: idColumn,
          targetColumn: 'Article ID',
          confidence: 0.95,
          extractionPattern: 'Alphanumeric identifier'
        });
      }
    }

    // Ensure Product Name mapping exists
    if (!existingTargets.has('Product Name')) {
      const nameColumns = [
        'Name', 'Product Name', 'ProductName', 'product_name', 'Product_Name',
        'Name of the product', 'Title', 'Product Title', 'ProductName', 'name', 'Product', 'product'
      ];
      const nameColumn = headers.find(h => {
        const lowerH = h.toLowerCase();
        return nameColumns.some(nameCol => 
          lowerH === nameCol.toLowerCase() || 
          lowerH.includes('name') || 
          lowerH.includes('product')
        );
      });
      if (nameColumn) {
        this.mapping.mappings.push({
          sourceColumn: nameColumn,
          targetColumn: 'Product Name',
          confidence: 0.95,
          extractionPattern: 'Product description text'
        });
      }
    }

    // Ensure GLB Link mapping exists (optional but helpful)
    if (!existingTargets.has('GLB Link')) {
      const glbColumn = headers.find(h => 
        h.toLowerCase().includes('glb') || h.toLowerCase().includes('3d')
      );
      if (glbColumn) {
        this.mapping.mappings.push({
          sourceColumn: glbColumn,
          targetColumn: 'GLB Link',
          confidence: 0.9,
          extractionPattern: 'URL ending in .glb'
        });
      }
    }
  }

  /**
   * Find value by common column name patterns (fallback)
   */
  private findByCommonColumnNames(
    row: string[],
    headers: string[],
    commonNames: string[]
  ): string | null {
    // First, try exact matches (case-insensitive)
    for (const name of commonNames) {
      const index = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
      if (index !== -1 && index < row.length) {
        const value = (row[index] || '').trim();
        if (value) {
          return value;
        }
      }
    }
    
    // Then try partial matches for ID and Name
    for (const name of commonNames) {
      const lowerName = name.toLowerCase();
      
      if (lowerName.includes('id') && !lowerName.includes('active')) {
        // Look for columns containing "id" but not "active"
        const index = headers.findIndex(h => {
          const lowerH = h.toLowerCase();
          return lowerH.includes('id') && lowerH !== 'active' && !lowerH.includes('active');
        });
        if (index !== -1 && index < row.length) {
          const value = (row[index] || '').trim();
          if (value) {
            return value;
          }
        }
      }
      
      if (lowerName.includes('name') || lowerName.includes('product') || lowerName.includes('title')) {
        // Look for columns containing "name", "product", or "title"
        const index = headers.findIndex(h => {
          const lowerH = h.toLowerCase();
          return lowerH.includes('name') || lowerH.includes('product') || lowerH.includes('title');
        });
        if (index !== -1 && index < row.length) {
          const value = (row[index] || '').trim();
          if (value) {
            return value;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Extract value using pattern matching
   * Always returns a value (even if pattern doesn't match) - the caller can use raw value
   */
  private extractValue(
    rawValue: string,
    targetColumn: string,
    _confidence: number
  ): { value: string; matched: boolean } | null {
    if (!rawValue) return null;

    const value = rawValue.trim();
    if (!value) return null;

    // If no patterns available, return value anyway (will be handled by caller)
    if (!this.patterns) {
      return { value, matched: false };
    }

    try {
      switch (targetColumn) {
        case 'Article ID':
          if (this.patterns.articleId) {
            try {
              const regex = this.patterns.articleId.startsWith('^')
                ? new RegExp(this.patterns.articleId)
                : new RegExp(`.*${this.patterns.articleId}.*`);
              if (regex.test(value)) {
                return { value, matched: true };
              }
            } catch (_e) {
              // Invalid regex, continue to fallbacks
            }
          }
          // Fallback: Check if it looks like an article ID (alphanumeric with possible underscores/dashes)
          if (/^[\dA-Za-z_\-]+$/.test(value)) {
            return { value, matched: true };
          }
          // Even if pattern doesn't match, return the value (will use raw value)
          return { value, matched: false };

        case 'Product Name':
          if (this.patterns.productName) {
            try {
              const regex = new RegExp(this.patterns.productName);
              if (regex.test(value)) {
                return { value, matched: true };
              }
            } catch (_e) {
              // Invalid regex, continue to fallbacks
            }
          }
          // Fallback: Any non-empty text is likely a product name
          if (value.length > 0) {
            return { value, matched: true };
          }
          return { value, matched: false };

        case 'Product Link':
        case 'CAD/File Link':
          if (this.patterns.urls) {
            try {
              const urlRegex = new RegExp(this.patterns.urls);
              if (urlRegex.test(value)) {
                return { value, matched: true };
              }
            } catch (_e) {
              // Invalid regex, continue to fallbacks
            }
          }
          // Fallback: Check if it's a URL
          if (/^https?:\/\//.test(value)) {
            return { value, matched: true };
          }
          // Return value anyway (might be a URL)
          return { value, matched: false };

        case 'GLB Link':
          // Check if it's a GLB URL
          if (/\.glb$/i.test(value) && /^https?:\/\//.test(value)) {
            return { value, matched: true };
          }
          // Return value anyway (might be a GLB link)
          return { value, matched: false };

        case 'Active':
          if (this.patterns.boolean) {
            try {
              const boolRegex = new RegExp(this.patterns.boolean, 'i');
              if (boolRegex.test(value)) {
                // Normalize to TRUE/FALSE
                const normalized = /true|yes|active/i.test(value) ? 'TRUE' : 'FALSE';
                return { value: normalized, matched: true };
              }
            } catch (_e) {
              // Invalid regex, continue to fallbacks
            }
          }
          // Fallback: Check common boolean values
          if (/^(true|false|yes|no|active|inactive)$/i.test(value)) {
            const normalized = /true|yes|active/i.test(value) ? 'TRUE' : 'FALSE';
            return { value: normalized, matched: true };
          }
          // Default to FALSE if unclear
          return { value: 'FALSE', matched: false };

        default:
          // For any other field, return the value
          return { value, matched: false };
      }
    } catch (_error) {
      // Pattern regex failed, return value anyway
      return { value, matched: false };
    }
  }

  /**
   * Helper to chunk array
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get current mapping
   */
  getMapping(): MappingResult | undefined {
    return this.mapping;
  }

  /**
   * Get current patterns
   */
  getPatterns(): ExtractionPatterns | undefined {
    return this.patterns;
  }
}


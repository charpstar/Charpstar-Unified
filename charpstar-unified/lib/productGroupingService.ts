import { CellBase, Matrix } from 'react-spreadsheet';

export interface VariationAttribute {
  type: 'color' | 'size' | 'material' | 'finish' | 'other';
  value: string;
}

export interface GroupedProduct {
  rowIndex: number;
  articleId: string;
  productName: string;
  variationAttributes: VariationAttribute[];
  confidence: number;
  originalRowIndex: number; // Original position before grouping
}

export interface ProductGroup {
  groupId: string;
  baseProductName: string;
  products: GroupedProduct[];
  variationTypes: string[];
}

export interface UngroupedProduct {
  rowIndex: number;
  articleId: string;
  productName: string;
  originalRowIndex: number;
}

export interface GroupingResult {
  groups: ProductGroup[];
  ungrouped: UngroupedProduct[];
}

export interface SpreadsheetRowMetadata {
  isGroupHeader?: boolean;
  groupId?: string;
  originalRowIndex?: number;
  isGrouped?: boolean;
}

/**
 * Service for organizing and grouping products in spreadsheet
 */
export class ProductGroupingService {
  /**
   * Reorganize spreadsheet data based on grouping results
   */
  reorganizeSpreadsheet(
    spreadsheetData: Matrix<CellBase>,
    groupingResult: GroupingResult,
    showGroupHeaders: boolean = true
  ): {
    reorganizedData: Matrix<CellBase>;
    rowMetadata: Map<number, SpreadsheetRowMetadata>;
  } {
    const headerRow = spreadsheetData[0];
    const dataRows = spreadsheetData.slice(1);
    const reorganizedData: Matrix<CellBase> = [headerRow];
    const rowMetadata = new Map<number, SpreadsheetRowMetadata>();
    
    let currentRowIndex = 1; // Start after header

    // Process groups
    for (const group of groupingResult.groups) {
      if (showGroupHeaders) {
        // Add group header row
        const groupHeaderRow = this.createGroupHeaderRow(headerRow, group);
        reorganizedData.push(groupHeaderRow);
        rowMetadata.set(currentRowIndex, {
          isGroupHeader: true,
          groupId: group.groupId
        });
        currentRowIndex++;
      }

      // Sort products within group by variation type
      const sortedProducts = this.sortProductsInGroup(group.products);

      // Add product rows for this group
      for (const product of sortedProducts) {
        const originalRowIndex = product.originalRowIndex;
        if (originalRowIndex >= 0 && originalRowIndex < dataRows.length) {
          reorganizedData.push(dataRows[originalRowIndex]);
          rowMetadata.set(currentRowIndex, {
            isGrouped: true,
            groupId: group.groupId,
            originalRowIndex: originalRowIndex + 1 // +1 because we exclude header
          });
          currentRowIndex++;
        }
      }

      // Add subtle separator (optional - just an empty row)
      // Uncomment if you want separators between groups
      // reorganizedData.push(this.createEmptyRow(headerRow.length));
      // currentRowIndex++;
    }

    // Add ungrouped products at the end
    for (const ungrouped of groupingResult.ungrouped) {
      const originalRowIndex = ungrouped.originalRowIndex;
      if (originalRowIndex >= 0 && originalRowIndex < dataRows.length) {
        reorganizedData.push(dataRows[originalRowIndex]);
        rowMetadata.set(currentRowIndex, {
          isGrouped: false,
          originalRowIndex: originalRowIndex + 1
        });
        currentRowIndex++;
      }
    }

    return { reorganizedData, rowMetadata };
  }

  /**
   * Create a group header row
   */
  private createGroupHeaderRow(headerRow: CellBase[], group: ProductGroup): CellBase[] {
    const variationEmojis: Record<string, string> = {
      color: '🎨',
      size: '📏',
      material: '🪵',
      finish: '✨',
      other: '📌'
    };

    const variationTypesStr = group.variationTypes
      .map(type => `${variationEmojis[type] || '📌'} ${type.charAt(0).toUpperCase() + type.slice(1)}`)
      .join(' | ');

    const headerText = `${group.baseProductName} (${group.products.length} variation${group.products.length > 1 ? 's' : ''}) ${variationTypesStr ? `| ${variationTypesStr}` : ''}`;

    // Create header row - use first column for group info, rest empty or with metadata
    const groupHeaderRow: CellBase[] = [
      { value: `[GROUP] ${headerText}` },
      ...Array.from({ length: headerRow.length - 1 }, () => ({ value: '' }))
    ];

    return groupHeaderRow;
  }

  /**
   * Create an empty row
   */
  private createEmptyRow(columnCount: number): CellBase[] {
    return Array.from({ length: columnCount }, () => ({ value: '' }));
  }

  /**
   * Sort products within a group by variation attributes
   */
  private sortProductsInGroup(products: GroupedProduct[]): GroupedProduct[] {
    return [...products].sort((a, b) => {
      // Sort by variation type priority: color > size > material > finish > other
      const typePriority: Record<string, number> = {
        color: 1,
        size: 2,
        material: 3,
        finish: 4,
        other: 5
      };

      const aPrimaryType = a.variationAttributes[0]?.type || 'other';
      const bPrimaryType = b.variationAttributes[0]?.type || 'other';

      if (typePriority[aPrimaryType] !== typePriority[bPrimaryType]) {
        return typePriority[aPrimaryType] - typePriority[bPrimaryType];
      }

      // If same type, sort by value alphabetically
      const aValue = a.variationAttributes[0]?.value || '';
      const bValue = b.variationAttributes[0]?.value || '';
      return aValue.localeCompare(bValue);
    });
  }

  /**
   * Extract products from spreadsheet data for grouping analysis
   */
  extractProductsForGrouping(spreadsheetData: Matrix<CellBase>): Array<{
    rowIndex: number;
    articleId: string;
    productName: string;
    category?: string;
    subcategory?: string;
    originalRowIndex: number;
  }> {
    if (spreadsheetData.length < 2) return [];

    const headers = spreadsheetData[0].map(cell => cell?.value?.toString() || '').map(h => h.toLowerCase());
    const rows = spreadsheetData.slice(1);
    const products: Array<{
      rowIndex: number;
      articleId: string;
      productName: string;
      category?: string;
      subcategory?: string;
      originalRowIndex: number;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowValues = row.map(cell => cell?.value?.toString() || '');

      const getValue = (columnName: string): string => {
        const index = headers.findIndex(h =>
          h.toLowerCase() === columnName.toLowerCase() ||
          h.toLowerCase().includes(columnName.toLowerCase())
        );
        return index >= 0 && index < rowValues.length ? rowValues[index] : '';
      };

      const articleId = getValue('article id') || getValue('id');
      const productName = getValue('product name') || getValue('name');
      const category = getValue('category') || undefined;
      const subcategory = getValue('subcategory') || undefined;

      // Only include rows with at least article ID or product name
      if (articleId || productName) {
        products.push({
          rowIndex: i + 2, // +2 because: +1 for header, +1 for 1-indexed display
          articleId,
          productName,
          category,
          subcategory,
          originalRowIndex: i
        });
      }
    }

    return products;
  }

  /**
   * Add original row indices to grouping result
   */
  addOriginalRowIndices(
    groupingResult: GroupingResult,
    productMapping: Map<number, number> // Maps display rowIndex to originalRowIndex
  ): GroupingResult {
    const updatedGroups = groupingResult.groups.map(group => ({
      ...group,
      products: group.products.map(product => ({
        ...product,
        originalRowIndex: productMapping.get(product.rowIndex) ?? product.rowIndex - 2
      }))
    }));

    const updatedUngrouped = groupingResult.ungrouped.map(product => ({
      ...product,
      originalRowIndex: productMapping.get(product.rowIndex) ?? product.rowIndex - 2
    }));

    return {
      groups: updatedGroups,
      ungrouped: updatedUngrouped
    };
  }
}





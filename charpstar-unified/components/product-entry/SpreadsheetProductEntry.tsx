"use client";

import { useState, useEffect, useCallback } from 'react';
import Spreadsheet, { CellBase, Matrix } from 'react-spreadsheet';
import { Button } from '@/components/ui/display/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/containers/card';
import { useToast } from '@/components/ui/utilities';
import { Loader2, Sparkles, Copy, CheckCircle2, Package, Plus } from 'lucide-react';

// Professional spreadsheet styling
const spreadsheetStyles = `
  .Spreadsheet {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  
  .Spreadsheet__table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    font-size: 13px;
  }
  
  .Spreadsheet__header {
    background: linear-gradient(to bottom, #f8f9fa, #f1f3f5);
    border-bottom: 2px solid #dee2e6;
    font-weight: 600;
    color: #495057;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
    padding: 10px 12px;
    user-select: none;
  }
  
  .Spreadsheet__header:hover {
    background: linear-gradient(to bottom, #f1f3f5, #e9ecef);
  }
  
  .Spreadsheet__cell {
    border: 1px solid #e9ecef;
    padding: 8px 12px;
    min-height: 36px;
    transition: all 0.15s ease;
    background: #ffffff;
  }
  
  .Spreadsheet__cell:hover {
    background: #f8f9fa;
    border-color: #ced4da;
  }
  
  .Spreadsheet__cell--selected {
    background: #e7f5ff;
    border: 2px solid #339af0;
    box-shadow: 0 0 0 3px rgba(51, 154, 240, 0.1);
    z-index: 10;
  }
  
  .Spreadsheet__cell input {
    border: none;
    background: transparent;
    width: 100%;
    font-size: 13px;
    color: #212529;
    padding: 0;
    outline: none;
    font-family: inherit;
  }
  
  .Spreadsheet__row:hover .Spreadsheet__cell {
    background: #f8f9fa;
  }
  
  .Spreadsheet__row:hover .Spreadsheet__cell--selected {
    background: #e7f5ff;
  }
  
  /* Dark mode support */
  .dark .Spreadsheet__header {
    background: linear-gradient(to bottom, #1a1d23, #16191f);
    border-bottom-color: #2d3239;
    color: #adb5bd;
  }
  
  .dark .Spreadsheet__header:hover {
    background: linear-gradient(to bottom, #16191f, #13161a);
  }
  
  .dark .Spreadsheet__cell {
    border-color: #2d3239;
    background: #1a1d23;
    color: #e9ecef;
  }
  
  .dark .Spreadsheet__cell:hover {
    background: #212529;
    border-color: #3d4249;
  }
  
  .dark .Spreadsheet__cell--selected {
    background: #1e3a5f;
    border-color: #4dabf7;
    box-shadow: 0 0 0 3px rgba(77, 171, 247, 0.15);
  }
  
  .dark .Spreadsheet__cell input {
    color: #e9ecef;
  }
  
  .dark .Spreadsheet__row:hover .Spreadsheet__cell {
    background: #212529;
  }
  
  .dark .Spreadsheet__row:hover .Spreadsheet__cell--selected {
    background: #1e3a5f;
  }
  
  /* Group header row styling */
  .Spreadsheet__row--group-header {
    background: linear-gradient(to right, #e0e7ff, #f3f4f6) !important;
    font-weight: 600;
  }
  
  .dark .Spreadsheet__row--group-header {
    background: linear-gradient(to right, #1e293b, #0f172a) !important;
  }
  
  .Spreadsheet__row--group-header .Spreadsheet__cell {
    background: transparent !important;
    border-bottom: 2px solid #c7d2fe;
  }
  
  .dark .Spreadsheet__row--group-header .Spreadsheet__cell {
    border-bottom-color: #334155;
  }
  
  /* Grouped row styling */
  .Spreadsheet__row--grouped {
    background: #f8fafc !important;
  }
  
  .dark .Spreadsheet__row--grouped {
    background: #1e293b !important;
  }
  
  .Spreadsheet__row--grouped .Spreadsheet__cell:first-child {
    border-left: 3px solid #6366f1;
    padding-left: 9px;
  }
  
  .dark .Spreadsheet__row--grouped .Spreadsheet__cell:first-child {
    border-left-color: #818cf8;
  }
`;

interface ProductForm {
  article_id: string;
  product_name: string;
  product_link: string;
  cad_file_link: string;
  category: string;
  subcategory: string;
  references: { type: "url" | "file"; value: string; file?: File }[];
  measurements?: { height: string; width: string; depth: string };
}

interface SpreadsheetProductEntryProps {
  products: ProductForm[];
  onProductsChange: (products: ProductForm[]) => void;
  clientName: string;
}

const TARGET_COLUMNS = [
  'Article ID',
  'Product Name',
  'Product Link',
  'CAD/File Link',
  'Category',
  'Subcategory',
  'GLB Link',
  'Active'
];

export function SpreadsheetProductEntry({
  products: _products,
  onProductsChange,
  clientName
}: SpreadsheetProductEntryProps) {
  // Initialize with header row and 10 empty rows for better visibility
  const createEmptyRow = (columnCount: number): CellBase[] => 
    Array.from({ length: columnCount }, () => ({ value: '' }));
  
  const initialColumns = [
    'Article ID',
    'Product Name',
    'Product Link',
    'CAD/File Link',
    'Category',
    'Subcategory',
    'GLB Link',
    'Active'
  ];

  const [spreadsheetData, setSpreadsheetData] = useState<Matrix<CellBase>>(() => {
    const headerRow = initialColumns.map(col => ({ value: col }));
    const emptyRows = Array.from({ length: 10 }, () => createEmptyRow(initialColumns.length));
    return [headerRow, ...emptyRows];
  });
  const [mapping, setMapping] = useState<any>(null);
  const [isMapping, setIsMapping] = useState(false);
  const [_mappedData, setMappedData] = useState<Matrix<CellBase> | null>(null);
  const [hasAutoMapped, setHasAutoMapped] = useState(false);
  const { toast } = useToast();

  // Convert spreadsheet data to CSV text for processing
  const spreadsheetToCSV = useCallback((data: Matrix<CellBase>): string => {
    return data
      .map(row => 
        row.map(cell => {
          const value = cell?.value?.toString() || '';
          // Escape quotes and wrap in quotes if contains comma or quote
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
      .join('\n');
  }, []);

  // Convert CSV text to spreadsheet data
  const _csvToSpreadsheet = useCallback((csvText: string): Matrix<CellBase> => {
    const lines = csvText.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim()); // Add last cell
      
      return cells.map(value => ({ value }));
    });
  }, []);

  // Auto-map columns using AI
  const handleAutoMap = useCallback(async (data?: Matrix<CellBase>) => {
    setIsMapping(true);
    try {
      const dataToProcess = data || spreadsheetData;
      const csvText = spreadsheetToCSV(dataToProcess);
      
      if (!csvText.trim() || dataToProcess.length < 2) {
        toast({
          title: 'No data',
          description: 'Please paste or enter data in the spreadsheet first',
          variant: 'destructive'
        });
        setIsMapping(false);
        return;
      }

      // Call API to process CSV with AI mapping
      // Use a very large number to ensure we get all rows
      const response = await fetch('/api/csv/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText,
          clientName,
          previewRowCount: 10000 // Request all rows (adjust if needed for very large datasets)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to map columns');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to map columns');
      }

      // Set the mapping result for display
      setMapping(result.mapping);

      // Convert processed rows back to spreadsheet format
      const mappedSpreadsheet: Matrix<CellBase> = [];
      
      // Header row - use target columns
      mappedSpreadsheet.push(
        TARGET_COLUMNS.map(col => ({ value: col }))
      );

      // Data rows - map to target format
      // Use all rows from preview (if allRows is true) or just preview rows
      const rowsToUse = result.preview.rows;
      
      rowsToUse.forEach((row: any) => {
        mappedSpreadsheet.push([
          { value: row['Article ID'] || '' },
          { value: row['Product Name'] || '' },
          { value: row['Product Link'] || '' },
          { value: row['CAD/File Link'] || '' },
          { value: row['Category'] || '' },
          { value: row['Subcategory'] || '' },
          { value: row['GLB Link'] || '' },
          { value: row['Active'] || 'FALSE' }
        ]);
      });

      setMappedData(mappedSpreadsheet);
      setSpreadsheetData(mappedSpreadsheet);
      
      const rowCount = result.preview.totalRows || rowsToUse.length;
      toast({
        title: 'Mapping complete',
        description: `Mapped ${rowCount} rows. ${result.statistics.successCount} rows processed successfully.`
      });
    } catch (error) {
      console.error('Error mapping spreadsheet:', error);
      toast({
        title: 'Mapping failed',
        description: error instanceof Error ? error.message : 'Failed to map columns',
        variant: 'destructive'
      });
    } finally {
      setIsMapping(false);
    }
  }, [spreadsheetData, clientName, spreadsheetToCSV, toast]);

  // Handle spreadsheet data changes (including paste)
  const handleSpreadsheetChange = useCallback((data: Matrix<CellBase>) => {
    setSpreadsheetData(data);
    
    // Auto-trigger mapping if:
    // 1. We have at least 2 rows (header + data)
    // 2. Haven't auto-mapped yet
    // 3. First row looks like headers (has text values)
    // 4. Not currently mapping
    if (
      !hasAutoMapped &&
      !isMapping &&
      data.length >= 2 &&
      data[0]?.some(cell => cell?.value?.toString().trim())
    ) {
      // Check if first row has header-like text (not all empty)
      const firstRowHasText = data[0]?.some(cell => {
        const value = cell?.value?.toString().trim();
        return value && value.length > 0 && !/^\d+$/.test(value); // Has text, not just numbers
      });

      // Check if second row has data
      const secondRowHasData = data[1]?.some(cell => cell?.value?.toString().trim());

      if (firstRowHasText && secondRowHasData) {
        // Small delay to let user see the pasted data
        setTimeout(() => {
          setHasAutoMapped(true);
          handleAutoMap(data);
        }, 800);
      }
    }
  }, [hasAutoMapped, isMapping, handleAutoMap]);

  // Convert spreadsheet data to ProductForm format
  const convertToProducts = useCallback((): ProductForm[] => {
    if (spreadsheetData.length < 2) return [];

    const headers = spreadsheetData[0].map(cell => cell?.value?.toString() || '').map(h => h.toLowerCase());
    const rows = spreadsheetData.slice(1);

    const productForms: ProductForm[] = rows.map(row => {
      const rowValues = row.map(cell => cell?.value?.toString() || '');
      
      // Map columns to product fields
      const getValue = (columnName: string): string => {
        const index = headers.findIndex(h => 
          h.toLowerCase() === columnName.toLowerCase() || 
          h.toLowerCase().includes(columnName.toLowerCase())
        );
        return index >= 0 && index < rowValues.length ? rowValues[index] : '';
      };

      return {
        article_id: getValue('article id') || getValue('id'),
        product_name: getValue('product name') || getValue('name'),
        product_link: getValue('product link') || getValue('link'),
        cad_file_link: getValue('cad') || getValue('file link'),
        category: getValue('category'),
        subcategory: getValue('subcategory'),
        references: [],
        measurements: undefined
      };
    }).filter(p => p.article_id || p.product_name); // Filter out completely empty rows

    return productForms;
  }, [spreadsheetData]);

  // Add a new row
  const addRow = useCallback(() => {
    setSpreadsheetData(prev => {
      const columnCount = prev[0]?.length || 8;
      const newRow: CellBase[] = Array.from({ length: columnCount }, () => ({ value: '' }));
      return [...prev, newRow];
    });
    toast({
      title: 'Row added',
      description: 'A new row has been added to the spreadsheet.'
    });
  }, [toast]);

  // Add a new column
  const addColumn = useCallback(() => {
    setSpreadsheetData(prev => {
      const _columnLetter = String.fromCharCode(65 + (prev[0]?.length || 0));
      return prev.map(row => [...row, { value: '' }]);
    });
    toast({
      title: 'Column added',
      description: 'A new column has been added to the spreadsheet.'
    });
  }, [toast]);

  // Remove the last row (if it's empty and not the header)
  const _removeLastRow = useCallback(() => {
    setSpreadsheetData(prev => {
      if (prev.length <= 2) {
        toast({
          title: 'Cannot remove',
          description: 'You must keep at least one data row.',
          variant: 'destructive'
        });
        return prev;
      }
      return prev.slice(0, -1);
    });
  }, [toast]);

  // Remove the last column (if there's more than 1)
  const _removeLastColumn = useCallback(() => {
    setSpreadsheetData(prev => {
      if (prev[0]?.length <= 1) {
        toast({
          title: 'Cannot remove',
          description: 'You must keep at least one column.',
          variant: 'destructive'
        });
        return prev;
      }
      return prev.map(row => row.slice(0, -1));
    });
  }, [toast]);


  // Update products when spreadsheet changes
  useEffect(() => {
    const newProducts = convertToProducts();
    if (newProducts.length > 0) {
      onProductsChange(newProducts);
    }
  }, [spreadsheetData, convertToProducts, onProductsChange]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: spreadsheetStyles }} />
      <Card className="group relative overflow-hidden 
        bg-gradient-to-br from-card via-card to-card/95
        border border-border/60
        shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)]
        hover:shadow-[0_8px_24px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.08)]
        transition-all duration-300">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <CardHeader className="relative z-10 pb-4 border-b border-border/40 bg-gradient-to-r from-transparent via-muted/20 to-transparent">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                Product Details
              </CardTitle>
            </div>
            <p className="text-sm text-muted-foreground ml-11 leading-relaxed">
              Paste data from Excel or Google Sheets directly into the spreadsheet below. 
              Our AI will automatically detect and map your columns to the correct format.
            </p>
          </div>
          <Button
            onClick={() => handleAutoMap()}
            disabled={isMapping || spreadsheetData.length < 2}
            className="shrink-0 h-10 px-4 font-medium
              bg-gradient-to-r from-primary to-primary/90 
              hover:from-primary/90 hover:to-primary/80
              text-primary-foreground 
              shadow-md hover:shadow-lg
              border-0
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              disabled:hover:shadow-md"
            size="sm"
          >
            {isMapping ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span>Mapping...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                <span>Auto-Map Columns</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="relative z-10 pt-6 pb-6 space-y-6">
        {mapping && (
          <div className="relative overflow-hidden rounded-xl 
            bg-gradient-to-br from-blue-50 via-blue-50/50 to-indigo-50 
            dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-blue-900/30
            border border-blue-200/60 dark:border-blue-800/40
            shadow-sm
            p-4
            backdrop-blur-sm">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 dark:bg-blue-800/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-300/30 dark:border-blue-700/30 shrink-0 mt-0.5">
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Columns Successfully Mapped
                  </span>
                </div>
                <div className="space-y-2">
                  {mapping.mappings?.slice(0, 5).map((m: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-white/60 dark:bg-blue-950/30 rounded-md px-3 py-2 border border-blue-100 dark:border-blue-900/40">
                      <span className="font-medium text-blue-900 dark:text-blue-100 truncate max-w-[200px]">
                        {m.sourceColumn}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400">→</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-200">
                        {m.targetColumn}
                      </span>
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-medium">
                        {(m.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                  {mapping.mappings?.length > 5 && (
                    <div className="text-xs text-blue-700 dark:text-blue-300 font-medium pt-1">
                      + {mapping.mappings.length - 5} more column mappings
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="relative space-y-4">
          {/* Spreadsheet controls toolbar */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl
            bg-gradient-to-r from-muted/40 via-muted/30 to-muted/40
            border border-border/50
            backdrop-blur-sm
            shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-px bg-border/60" />
            <span className="text-sm font-semibold text-foreground">Table Structure</span>
            <div className="h-8 w-px bg-border/60" />
            <Button
              onClick={addRow}
              variant="outline"
              size="sm"
              className="h-9 px-4 text-sm font-medium 
                hover:bg-primary/10 hover:border-primary/40 hover:text-primary
                transition-all duration-200
                border-border/60"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
            <Button
              onClick={addColumn}
              variant="outline"
              size="sm"
              className="h-9 px-4 text-sm font-medium
                hover:bg-primary/10 hover:border-primary/40 hover:text-primary
                transition-all duration-200
                border-border/60"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Column
            </Button>
          </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/60 border border-border/40">
              <span className="text-xs font-medium text-muted-foreground">
                {spreadsheetData.length - 1} rows
              </span>
              <span className="text-xs text-muted-foreground/60">×</span>
              <span className="text-xs font-medium text-muted-foreground">
                {spreadsheetData[0]?.length || 0} columns
              </span>
            </div>
          </div>

          {/* Spreadsheet container - no max-height, scrolls with page */}
          <div className="rounded-xl border-2 border-border/60 
            bg-background
            shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)]
            hover:border-primary/30
            transition-all duration-200
            focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20
            overflow-hidden">
            {/* Horizontal scroll wrapper for wide tables */}
            <div className="overflow-x-auto">
              {/* Spreadsheet - no vertical scroll, flows naturally */}
              <div className="min-w-full">
                <Spreadsheet
                  data={spreadsheetData}
                  onChange={handleSpreadsheetChange}
                  columnLabels={Array.from({ length: Math.max(spreadsheetData[0]?.length || 8, 8) }, (_, i) => String.fromCharCode(65 + i))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Professional tip section */}
        <div className="flex items-start gap-3 p-4 rounded-lg 
          bg-gradient-to-r from-muted/40 via-muted/30 to-muted/40
          border border-border/40
          backdrop-blur-sm">
          <div className="p-1.5 rounded-md bg-primary/10 border border-primary/20 shrink-0">
            <Copy className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 pt-0.5">
            <p className="text-sm font-medium text-foreground mb-1">
              Quick Tip
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Quick Start:</strong> Copy your entire spreadsheet from Excel or Google Sheets (including headers), 
              then paste directly into the grid above. The AI will automatically detect and map your columns.
              <br />
              <strong className="text-foreground">Manual Entry:</strong> Use the &quot;Add Row&quot; and &quot;Add Column&quot; buttons above to manually expand the spreadsheet, 
              or simply click in any cell and start typing.
              <br />
              <strong className="text-foreground">Note:</strong> Products will be automatically grouped and sorted after submission to help the production team with allocation.
            </p>
          </div>
        </div>
      </CardContent>
      </Card>
    </>
  );
}


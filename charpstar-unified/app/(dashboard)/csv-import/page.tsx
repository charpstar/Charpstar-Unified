"use client";

import { useState } from 'react';
import { Button, Label } from '@/components/ui/display';
import { Input } from '@/components/ui/inputs';
import { Card } from '@/components/ui/containers';
import { useToast } from '@/components/ui/utilities';
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface CSVAnalysis {
  headers: string[];
  rowCount: number;
  columnCount: number;
  delimiter: string;
  encoding: string;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  samples: Array<{
    rowNumber: number;
    data: Record<string, string>;
  }>;
}

interface MappingResult {
  mappings: Array<{
    sourceColumn: string;
    targetColumn: string;
    confidence: number;
    extractionPattern?: string;
  }>;
  confidence: number;
  patterns?: Record<string, string>;
}

interface PreviewResult {
  rows: Array<Record<string, string>>;
  totalRows: number;
  statistics: {
    totalRows: number;
    successCount: number;
    errorCount: number;
    aiBatchesUsed: number;
    tokensUsed: number;
  };
  errors: Array<{ row: number; errors: string[] }>;
}

export default function CSVImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [clientName, setClientName] = useState('');
  const [csvText, setCsvText] = useState<string>('');
  const [analysis, setAnalysis] = useState<CSVAnalysis | null>(null);
  const [mapping, setMapping] = useState<MappingResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file',
        description: 'Please select a CSV file',
        variant: 'destructive'
      });
      return;
    }

    setFile(selectedFile);
    
    // Read file content
    const text = await selectedFile.text();
    setCsvText(text);

    // Auto-analyze
    await analyzeCSV(text);
  };

  const analyzeCSV = async (text: string) => {
    setLoading(true);
    setLoadingPhase('Analyzing CSV structure...');

    try {
      const formData = new FormData();
      const blob = new Blob([text], { type: 'text/csv' });
      formData.append('file', blob, 'temp.csv');

      const response = await fetch('/api/csv/analyze', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to analyze CSV');
      }

      const data = await response.json();
      setAnalysis(data.csv);
      
      // Auto-map columns
      if (data.csv.headers.length > 0) {
        await mapColumns(text, data.csv.headers);
      }
    } catch (error) {
      console.error('Error analyzing CSV:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to analyze CSV',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  };

  const mapColumns = async (text: string, headers: string[]) => {
    setLoading(true);
    setLoadingPhase('Mapping columns with AI...');

    try {
      const response = await fetch('/api/csv/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: text,
          headers: headers,
          sampleRowCount: 5
        })
      });

      if (!response.ok) {
        throw new Error('Failed to map columns');
      }

      const data = await response.json();
      setMapping(data.mapping);

      // Auto-preview
      if (data.mapping) {
        await previewConversion(text);
      }
    } catch (error) {
      console.error('Error mapping columns:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to map columns',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  };

  const previewConversion = async (text: string) => {
    if (!clientName) {
      toast({
        title: 'Client name required',
        description: 'Please enter client name before previewing',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setLoadingPhase('Converting CSV with AI...');

    try {
      const response = await fetch('/api/csv/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: text,
          clientName: clientName,
          previewRowCount: 20
        })
      });

      if (!response.ok) {
        throw new Error('Failed to preview conversion');
      }

      const data = await response.json();
      setPreview(data.preview);
    } catch (error) {
      console.error('Error previewing conversion:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to preview conversion',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  };

  const handleImport = async (dryRun: boolean = false) => {
    if (!csvText || !clientName) {
      toast({
        title: 'Missing information',
        description: 'Please provide CSV file and client name',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setLoadingPhase(dryRun ? 'Validating import...' : 'Importing to database...');

    try {
      console.log('[FRONTEND] Calling /api/csv/import with:', {
        csvTextLength: csvText?.length,
        clientName,
        dryRun
      });
      
      const response = await fetch('/api/csv/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: csvText,
          clientName: clientName,
          dryRun: dryRun
        })
      });

      console.log('[FRONTEND] Response status:', response.status);
      console.log('[FRONTEND] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FRONTEND] Error response:', errorText);
        throw new Error(`Failed to import CSV: ${errorText}`);
      }

      const data = await response.json();
      setImportResult(data);

      if (dryRun) {
        toast({
          title: 'Dry run complete',
          description: data.message || `Would import ${data.statistics?.successCount || 0} rows`
        });
      } else {
        toast({
          title: 'Import successful',
          description: data.message || `Successfully imported ${data.import?.importedCount || 0} rows`
        });
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to import CSV',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  };

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

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">CSV Import</h1>
        <p className="text-muted-foreground">
          Upload any CSV format and let AI convert it to the platform format
        </p>
      </div>

      {/* Upload Section */}
      <Card className="p-6 mb-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="file">CSV File</Label>
            <Input
              id="file"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={loading}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="client">Client Name</Label>
            <Input
              id="client"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client name"
              disabled={loading}
              className="mt-2"
            />
          </div>

          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{file.name} ({analysis?.rowCount || 0} rows)</span>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{loadingPhase || 'Processing...'}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">CSV Analysis</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Rows</div>
              <div className="text-2xl font-bold">{analysis.rowCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Columns</div>
              <div className="text-2xl font-bold">{analysis.columnCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Delimiter</div>
              <div className="text-2xl font-bold">{analysis.delimiter}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="text-2xl font-bold">
                {analysis.validation.valid ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
          </div>

          {analysis.validation.warnings.length > 0 && (
            <div className="mb-4">
              {analysis.validation.warnings.map((warning, i) => (
                <div key={i} className="flex items-center gap-2 text-amber-600 text-sm mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Mapping Results */}
      {mapping && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Column Mapping</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Source Column</th>
                  <th className="text-left p-2">Target Column</th>
                  <th className="text-left p-2">Confidence</th>
                  <th className="text-left p-2">Pattern</th>
                </tr>
              </thead>
              <tbody>
                {mapping.mappings.map((m, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{m.sourceColumn}</td>
                    <td className="p-2">{m.targetColumn}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              m.confidence > 0.8
                                ? 'bg-green-600'
                                : m.confidence > 0.5
                                ? 'bg-yellow-600'
                                : 'bg-red-600'
                            }`}
                            style={{ width: `${m.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs">{(m.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {m.extractionPattern || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Preview Results */}
      {preview && (
        <Card className="p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Conversion Preview</h2>
            <div className="flex gap-2">
              <Button
                onClick={() => handleImport(true)}
                disabled={loading}
                variant="outline"
              >
                Dry Run
              </Button>
              <Button
                onClick={() => handleImport(false)}
                disabled={loading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Rows</div>
              <div className="text-xl font-bold">{preview.statistics.totalRows}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Success</div>
              <div className="text-xl font-bold text-green-600">
                {preview.statistics.successCount}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Errors</div>
              <div className="text-xl font-bold text-red-600">
                {preview.statistics.errorCount}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Tokens Used</div>
              <div className="text-xl font-bold">{preview.statistics.tokensUsed}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead className="bg-gray-50">
                <tr>
                  {TARGET_COLUMNS.map((col) => (
                    <th key={col} className="p-2 text-left border">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 20).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {TARGET_COLUMNS.map((col) => (
                      <td key={col} className="p-2 border max-w-xs truncate" title={row[col]}>
                        {row[col] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.errors.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Errors ({preview.errors.length})</h3>
              <div className="max-h-40 overflow-y-auto">
                {preview.errors.slice(0, 10).map((error, i) => (
                  <div key={i} className="text-sm text-red-600 mb-1">
                    Row {error.row}: {error.errors.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Import Results */}
      {importResult && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Import Results</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Total Rows:</span>
              <span className="font-bold">{importResult.import?.totalRows || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Imported:</span>
              <span className="font-bold text-green-600">
                {importResult.import?.importedCount || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Errors:</span>
              <span className="font-bold text-red-600">
                {importResult.import?.errorCount || 0}
              </span>
            </div>
            
            {/* Grouping Status */}
            {importResult.grouping && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">Product Grouping:</h3>
                  {importResult.grouping.status === 'processing' ? (
                    <span className="text-sm text-amber-600 flex items-center gap-1">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      In Progress...
                    </span>
                  ) : importResult.grouping.totalGroups ? (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Completed
                    </span>
                  ) : (
                    <span className="text-sm text-gray-600">Not Started</span>
                  )}
                </div>
                {importResult.grouping.totalGroups !== undefined && (
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div>
                      <div className="text-sm text-muted-foreground">Groups Created</div>
                      <div className="text-xl font-bold text-purple-600">
                        {importResult.grouping.totalGroups}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Grouped Products</div>
                      <div className="text-xl font-bold text-purple-600">
                        {importResult.grouping.groupedProducts || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Ungrouped Products</div>
                      <div className="text-xl font-bold text-gray-600">
                        {importResult.grouping.ungroupedProducts || 0}
                      </div>
                    </div>
                  </div>
                )}
                {importResult.grouping.warning && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                    ⚠️ {importResult.grouping.warning}
                  </div>
                )}
                {importResult.grouping.status === 'processing' && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                    ℹ️ Grouping is running in the background. Products will be automatically sorted on the production page.
                  </div>
                )}
              </div>
            )}
            
            {importResult.message && (
              <div className="mt-4 p-3 bg-green-50 rounded text-green-800">
                {importResult.message}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}



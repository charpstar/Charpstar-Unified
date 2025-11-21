'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/display';
import { Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

type Item = { url: string; variant?: string; view?: string; resolution?: number; background?: string; timestamp?: string; filename: string; format?: string };
type GroupedRender = { timestamp: string; variant?: string; resolution?: number; background?: string; format?: string; images: Item[] };

const RenderHistoryPanel: React.FC<{ clientName: string; modelName: string }>= ({ clientName, modelName }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLimited, setIsLimited] = useState(false);
  const pageSize = 20;
  const abortControllerRef = React.useRef<AbortController | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Item | null>(null);
  const [selectedImageGroup, setSelectedImageGroup] = useState<Item[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Format view names for display
  const formatViewName = (view?: string): string => {
    if (!view) return 'Render';
    const viewMap: Record<string, string> = {
      'default': 'AR',
      'angledright': 'AR',
      'angledleft': 'AL',
      'front': 'F',
      'back': 'B',
      'side': 'S',
      'top': 'T',
      'table': 'Table',
      'angledtopright': 'ATR',
      'angledtopleft': 'ATL',
      'angledtoprightback': 'ATRB',
      'angledtopleftback': 'ATLB',
    };
    return viewMap[view.toLowerCase()] || view;
  };

  const fetchHistory = React.useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);
      // Fetch 200 items (enough for 10 pages of 20 items each)
      const res = await fetch(`/api/render/history?client=${encodeURIComponent(clientName)}&model=${encodeURIComponent(modelName)}&limit=200`, { 
        cache: 'no-store',
        signal 
      });
      
      // If request was aborted, don't process
      if (signal?.aborted) return;
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load history');
      const list = Array.isArray(json?.items) ? (json.items as Item[]) : [];
      const total = typeof json?.total === 'number' ? json.total : list.length;
      const limited = json?.limited === true;
      
      // Double check we're still on the same model
      if (!signal?.aborted) {
        setItems(list);
        setTotalCount(total);
        setIsLimited(limited);
        setPage(1);
      }
    } catch (e: any) {
      // Don't set error if request was aborted
      if (e.name === 'AbortError') return;
      if (!signal?.aborted) {
        setError(String(e?.message || e));
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [clientName, modelName]);

  useEffect(() => { 
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clear items immediately when model changes
    setItems([]);
    setPage(1);
    setError(null);
    setLoading(true);
    
    // Create new abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    fetchHistory(controller.signal);
    
    // Cleanup: abort on unmount or model change
    return () => {
      controller.abort();
    };
  }, [clientName, modelName, fetchHistory]);

  // Handle keyboard navigation in modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isModalOpen) return;
      
      if (event.key === 'Escape') {
        setIsModalOpen(false);
      } else if (event.key === 'ArrowLeft') {
        // Navigate to previous image
        setSelectedImageIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : selectedImageGroup.length - 1;
          setSelectedImage(selectedImageGroup[newIndex] || null);
          return newIndex;
        });
      } else if (event.key === 'ArrowRight') {
        // Navigate to next image
        setSelectedImageIndex(prev => {
          const newIndex = prev < selectedImageGroup.length - 1 ? prev + 1 : 0;
          setSelectedImage(selectedImageGroup[newIndex] || null);
          return newIndex;
        });
      }
    };
    
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, selectedImageGroup]);

  // Handle image download
  const handleDownloadImage = async () => {
    if (!selectedImage) return;
    
    try {
      const response = await fetch(selectedImage.url);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = selectedImage.filename || `render-${Date.now()}.${selectedImage.format || 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);

      toast.success('Image downloaded successfully!');
    } catch (error) {
      console.error('Error downloading image:', error);
      toast.error('Failed to download image');
    }
  };

  // Navigate to previous image
  const handlePrevImage = () => {
    setSelectedImageIndex(prev => {
      const newIndex = prev > 0 ? prev - 1 : selectedImageGroup.length - 1;
      setSelectedImage(selectedImageGroup[newIndex] || null);
      return newIndex;
    });
  };

  // Navigate to next image
  const handleNextImage = () => {
    setSelectedImageIndex(prev => {
      const newIndex = prev < selectedImageGroup.length - 1 ? prev + 1 : 0;
      setSelectedImage(selectedImageGroup[newIndex] || null);
      return newIndex;
    });
  };

  // Auto-refresh when render completes
  useEffect(() => {
    const onRenderComplete = () => {
      // Wait a bit for the history to be saved before fetching
      setTimeout(() => {
        // Create new controller for refresh
        const controller = new AbortController();
        abortControllerRef.current = controller;
        fetchHistory(controller.signal);
      }, 1000);
    };
    
    try { 
      window.addEventListener('charpstar:renderCompleted', onRenderComplete as EventListener);
    } catch {}
    
    return () => {
      try { 
        window.removeEventListener('charpstar:renderCompleted', onRenderComplete as EventListener);
      } catch {}
    };
  }, [fetchHistory]);

  // Group renders by timestamp (multi-view renders go together)
  const groupedRenders = useMemo(() => {
    const groups = new Map<string, GroupedRender>();
    
    items.forEach(item => {
      const key = item.timestamp || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, {
          timestamp: item.timestamp || '',
          variant: item.variant,
          resolution: item.resolution,
          background: item.background,
          format: item.format,
          images: []
        });
      }
      groups.get(key)!.images.push(item);
    });
    
    return Array.from(groups.values()).sort((a, b) => 
      String(b.timestamp).localeCompare(String(a.timestamp))
    );
  }, [items]);

  const pageCount = Math.max(1, Math.ceil(groupedRenders.length / pageSize));
  const current = Math.min(page, pageCount);
  const startIdx = (current - 1) * pageSize;
  const endIdx = Math.min(groupedRenders.length, startIdx + pageSize);
  const pageItems = groupedRenders.slice(startIdx, endIdx);

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '';
    try {
      if (/^\d{8}T\d{6}$/.test(ts)) {
        const y = Number(ts.slice(0, 4));
        const m = Number(ts.slice(4, 6)) - 1;
        const d = Number(ts.slice(6, 8));
        const hh = Number(ts.slice(9, 11));
        const mm = Number(ts.slice(11, 13));
        const date = new Date(y, m, d, hh, mm, 0);
        return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
      const date = new Date(ts);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    } catch {}
    return ts;
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto mb-2" />
          <div className="text-sm text-gray-500">Loading history...</div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <div className="text-sm text-red-600 mb-2">{error}</div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const controller = new AbortController();
              abortControllerRef.current = controller;
              fetchHistory(controller.signal);
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-sm text-gray-500">No renders yet for this model</div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
        {/* History List - 4 Column Layout */}
        <div className="flex-1 overflow-auto p-3">
          <div className="grid grid-cols-4 gap-2">
            {pageItems.map((group, idx) => {
              const bg = group.background === 'transparent' ? 'Transparent' : `#${group.background}`;
              const fmt = group.format?.toUpperCase() || 'PNG';
              
              return (
                <div key={group.timestamp + idx} className="bg-gray-50 rounded p-2 border border-gray-200">
                  {/* Thumbnails - Fixed size for consistency (sized for 6) */}
                  <div className="mb-2">
                    <div className="flex gap-1">
                      {group.images.map((img, i) => {
                        const thumbnailUrl = img.url.includes('?') 
                          ? `${img.url}&width=128&height=128` 
                          : `${img.url}?width=128&height=128`;
                        return (
                          <div key={img.url + i} className="relative flex-shrink-0 w-[calc(100%/6-0.2rem)]">
                  <button
                    onClick={() => {
                      const imageIndex = group.images.findIndex(i => i.url === img.url);
                      setSelectedImageGroup(group.images);
                      setSelectedImageIndex(imageIndex);
                      setSelectedImage(img);
                      setIsModalOpen(true);
                    }}
                    className="block w-full cursor-zoom-in"
                    title="Click to view fullscreen"
                  >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={thumbnailUrl}
                                alt={`${img.view || 'render'} thumbnail`}
                                className="w-full aspect-square object-cover rounded border border-gray-300 hover:border-black transition-colors"
                                loading="lazy"
                              />
                            </button>
                            {img.view && (
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 px-1 py-0.5 bg-black/90 text-white text-[7px] font-medium rounded-sm whitespace-nowrap leading-none">
                                {formatViewName(img.view)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Metadata - 2 Lines: Variant+Date, Settings */}
                  <div className="text-[11px] leading-tight">
                    <div className="font-bold text-gray-900 truncate mb-1">
                      {group.variant || 'Default'} • <span className="font-normal text-gray-500">{formatTimestamp(group.timestamp)}</span>
                    </div>
                    <div className="text-gray-600 truncate">
                      {bg} • <span className="font-semibold">{group.resolution}px</span> • {fmt}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Footer */}
        {(pageCount > 1 || isLimited) && (
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between p-2">
                <div className="text-[10px] text-gray-600">Page {current} of {pageCount}</div>
                <div className="flex gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-6 px-2 text-[10px]" 
                    disabled={current <= 1} 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-6 px-2 text-[10px]" 
                    disabled={current >= pageCount} 
                    onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
            {/* Limited items notice */}
            {isLimited && (
              <div className="px-2 pb-2 pt-1 text-center text-[10px] text-gray-500">
                Showing latest {items.length} of {totalCount}+ renders (recent history only)
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Image Modal */}
      {isModalOpen && selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 transition-colors z-10"
            aria-label="Close fullscreen view"
          >
            &times;
          </button>
          
          {/* Navigation arrows - only show if there are multiple images */}
          {selectedImageGroup.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 sm:p-3 rounded-full transition-all z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 sm:p-3 rounded-full transition-all z-10"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
              </button>
            </>
          )}
          
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={selectedImage.url}
              alt={`${formatViewName(selectedImage.view)} - ${selectedImage.variant || 'Default'}`}
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              width={selectedImage.resolution || 2048}
              height={selectedImage.resolution || 2048}
              unoptimized
            />
            
            {/* Image counter - show current position */}
            {selectedImageGroup.length > 1 && (
              <div className="absolute top-2 sm:top-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-xs sm:text-sm">
                {selectedImageIndex + 1} / {selectedImageGroup.length}
              </div>
            )}
            
            <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1 sm:gap-2">
              <Button
                onClick={handleDownloadImage}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg text-xs sm:text-sm"
                size="sm"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RenderHistoryPanel;


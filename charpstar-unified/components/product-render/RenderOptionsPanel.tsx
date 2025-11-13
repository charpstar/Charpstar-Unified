'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/display';
import { Loader2, Camera } from 'lucide-react';
import RenderHistoryPanel from '@/components/product-render/RenderHistoryPanel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/display/tooltip';
import AlwaysOpenColorPicker from '@/components/product-render/AlwaysOpenColorPicker';
import { useUser } from '@/contexts/useUser';

interface RenderOptionsPanelProps {
  modelViewerRef: React.RefObject<any>;
  modelFilename: string | null;
  selectedVariants: string[];
  isModularMode?: boolean;
  modularViewerRef?: React.RefObject<any>;
  modularConfig?: string | null;
  sourceGlbUrl?: string | null;
  selectedAssets?: any[]; // from asset library multiple selection
  onPreviewOrbitChange?: (orbit: string | null) => void;
}

type BackgroundMode = 'transparent' | 'color';
type OutputFormat = 'png' | 'jpg' | 'webp';
type AspectRatio = 'square' | 'rectangle';

const RenderOptionsPanel: React.FC<RenderOptionsPanelProps> = ({ 
  modelViewerRef, 
  modelFilename, 
  selectedVariants,
  isModularMode = false,
  modularViewerRef,
  modularConfig,
  sourceGlbUrl,
  selectedAssets = [],
  onPreviewOrbitChange
}) => {
  const user = useUser();
  const rawClient = Array.isArray(user?.metadata?.client) 
    ? user.metadata.client[0] 
    : user?.metadata?.client || '';
  const clientName = rawClient && String(rawClient).trim().length > 0 ? String(rawClient) : 'Shared';

  const cameraPresets = useMemo(() => ([
    { name: 'default', label: 'Angled (35°)', orbit: '35deg 90deg 100%' },
    { name: 'front', label: 'Front', orbit: '0deg 88deg 100%' },
    { name: 'back', label: 'Back', orbit: '180deg 90deg 100%' },
    { name: 'side', label: 'Side', orbit: '90deg 91deg 100%' },
    { name: 'top', label: 'Top', orbit: '0deg -200deg 100%' },
  ]), []);

  const quickColors = [
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Light Grey', hex: '#D3D3D3' },
    { name: 'Beige', hex: '#EDE8D0' },
    { name: 'Soft Blue', hex: '#E3F2FD' },
    { name: 'Soft Green', hex: '#E8F5E9' },
    { name: 'Soft Pink', hex: '#FCE4EC' },
    { name: 'Soft Purple', hex: '#F3E5F5' },
    { name: 'Dark Grey', hex: '#505050' },
  ];

  const [selectedViews, setSelectedViews] = useState<string[]>(['front']);
  const [resolution, setResolution] = useState<string>('1024');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('square');
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('color');
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isRenderingSelected, setIsRenderingSelected] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<Array<{ jobId: string; modelName: string }>>([]);
  const currentModelName = useMemo(() => {
    return isModularMode && modularConfig
      ? `modular-${modularConfig}`
      : (modelFilename ? modelFilename.replace(/\.(gltf|glb)$/i, '') : '');
  }, [isModularMode, modularConfig, modelFilename]);
  const isBusyForCurrentModel = isSubmitting || isRenderingSelected || pendingJobs.some(p => p.modelName === currentModelName && currentModelName);

  // Load from localStorage after hydration
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const savedViews = localStorage.getItem('charpstar:renderSettings:views');
      const savedResolution = localStorage.getItem('charpstar:renderSettings:resolution');
      const savedAspectRatio = localStorage.getItem('charpstar:renderSettings:aspectRatio');
      const savedBackgroundMode = localStorage.getItem('charpstar:renderSettings:backgroundMode');
      const savedBackgroundColor = localStorage.getItem('charpstar:renderSettings:backgroundColor');
      const savedFormat = localStorage.getItem('charpstar:renderSettings:format');
      
      if (savedViews) setSelectedViews(JSON.parse(savedViews));
      if (savedResolution) setResolution(savedResolution);
      if (savedAspectRatio) setAspectRatio(savedAspectRatio as AspectRatio);
      if (savedBackgroundMode) setBackgroundMode(savedBackgroundMode as BackgroundMode);
      if (savedBackgroundColor) setBackgroundColor(savedBackgroundColor);
      if (savedFormat) setOutputFormat(savedFormat as OutputFormat);
    } catch (e) {
      console.error('Failed to sync from localStorage:', e);
    }
  }, []);

  // Handle camera angle hover preview with 250ms delay
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const handleCameraHover = (orbit: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      if (onPreviewOrbitChange) onPreviewOrbitChange(orbit);
    }, 250);
  };
  
  const handleCameraHoverEnd = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (onPreviewOrbitChange) onPreviewOrbitChange(null);
  };

  // Save settings to localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('charpstar:renderSettings:views', JSON.stringify(selectedViews));
    } catch {}
  }, [selectedViews]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('charpstar:renderSettings:resolution', resolution);
    } catch {}
  }, [resolution]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('charpstar:renderSettings:aspectRatio', aspectRatio);
    } catch {}
  }, [aspectRatio]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('charpstar:renderSettings:backgroundMode', backgroundMode);
    } catch {}
  }, [backgroundMode]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('charpstar:renderSettings:backgroundColor', backgroundColor);
    } catch {}
  }, [backgroundColor]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('charpstar:renderSettings:format', outputFormat);
    } catch {}
  }, [outputFormat]);

  // When JPG is selected, switch to color mode if transparent
  React.useEffect(() => {
    if (outputFormat === 'jpg' && backgroundMode === 'transparent') {
      setBackgroundMode('color');
    }
  }, [outputFormat, backgroundMode]);

  const computeBlocked = async () => {
    try {
      const modelName = isModularMode 
        ? `modular-${modularConfig}` 
        : (modelFilename ? modelFilename.replace(/\.(gltf|glb)$/i, '') : '');
      
      const currentVariant = isModularMode ? null : ((modelViewerRef.current as any)?.variantName || null);
      
      const res = await fetch(`/api/render/jobs/list?client=${encodeURIComponent(clientName)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({} as any));
      const items = Array.isArray(json?.items) ? json.items : [];
      const active = items.some((it: any) => {
        if (!it) return false;
        const sameModel = String(it.modelName || '') === modelName;
        const sameVariant = (it.variantName || null) === (currentVariant || null);
        const st = String(it.status || 'unknown');
        return sameModel && sameVariant && st !== 'completed' && st !== 'failed';
      });
      return active;
    } catch {
      return false;
    }
  };

  React.useEffect(() => {
    const update = async () => setIsBlocked(await computeBlocked());
    update();
    const onStarted = () => update();
    try { window.addEventListener('charpstar:renderJobStarted', onStarted as any); } catch {}
    const onFinished = (e: Event) => {
      const jobId = (e as CustomEvent).detail?.jobId as string | undefined;
      if (!jobId) return;
      let removedModelName: string | null = null;
      setPendingJobs(prev => {
        const found = prev.find(p => p.jobId === jobId);
        if (found) removedModelName = found.modelName;
        return prev.filter(p => p.jobId !== jobId);
      });
      if (removedModelName) {
        try {
          setTimeout(() => {
            try {
              window.dispatchEvent(new CustomEvent('charpstar:renderPendingRemove', { detail: { modelName: removedModelName, jobId } }));
            } catch {}
          }, 0);
        } catch {}
      }
    };
    try { window.addEventListener('charpstar:renderFinished', onFinished as any); } catch {}
    try { window.addEventListener('charpstar:renderCompleted', onFinished as any); } catch {}
    const t = setInterval(update, 5000);
    return () => {
      try { window.removeEventListener('charpstar:renderJobStarted', onStarted as any); } catch {}
      try { window.removeEventListener('charpstar:renderFinished', onFinished as any); } catch {}
      try { window.removeEventListener('charpstar:renderCompleted', onFinished as any); } catch {}
      clearInterval(t);
    };
  }, [clientName, modelFilename]);

  const toggleView = (viewName: string) => {
    setSelectedViews(prev => {
      if (prev.includes(viewName)) {
        return prev.length > 1 ? prev.filter(v => v !== viewName) : prev;
      }
      return [...prev, viewName];
    });
  };

  const handleStartRender = async () => {
    if (!clientName || selectedViews.length === 0) return;
    
    // Check if we have either a regular model or modular config
    if (!isModularMode && !modelFilename) return;
    if (isModularMode && !modularConfig) return;
    
    const views = selectedViews.map(viewName => {
      const preset = cameraPresets.find(p => p.name === viewName) || cameraPresets[0];
      return { name: preset.name, orbit: preset.orbit };
    });

    const backgroundValue = backgroundMode === 'transparent' ? 'transparent' : backgroundColor.replace('#', '');

    try {
      setIsSubmitting(true);
      
      const mv = modelViewerRef.current as any | null;
      const variantName: string | null = mv?.variantName || null;
      
      const payload = {
        client: clientName,
        modelFilename,
        modelName: modelFilename!.replace(/\.(gltf|glb)$/i, ''),
        variantName,
        views,
        background: backgroundValue,
        resolution: Number(resolution),
        aspectRatio,
        format: outputFormat,
        sourceGlbUrl: sourceGlbUrl || null // Pass the actual GLB URL from props
      };
      
      console.log('[RENDER] Sending render request:', payload);
      
      const res = await fetch('/api/render/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to start render');
      const jobId = json?.jobId as string | undefined;
      if (jobId) {
        try { 
          window.dispatchEvent(new CustomEvent('charpstar:renderJobStarted', { detail: { clientName, jobId } })); 
          window.dispatchEvent(new CustomEvent('charpstar:renderPendingAdd', { detail: { modelName: payload.modelName, jobId } }));
        } catch {}
        setPendingJobs(prev => [...prev, { jobId, modelName: payload.modelName }]);
      }
    } catch (e) {
      console.error('Failed to start render:', e);
      alert('Failed to start render: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      // keep disabled until renderFinished events clear pendingJobIds
      setIsSubmitting(false);
    }
  };

  const handleStartRenderSelected = async () => {
    if (!clientName || selectedAssets.length === 0 || selectedViews.length === 0) return;
    try {
      setIsRenderingSelected(true);
      const views = selectedViews.map(viewName => {
        const preset = cameraPresets.find(p => p.name === viewName) || cameraPresets[0];
        return { name: preset.name, orbit: preset.orbit };
      });
      const backgroundValue = backgroundMode === 'transparent' ? 'transparent' : backgroundColor.replace('#', '');
      // Render each selected asset
      for (const asset of selectedAssets) {
        const glbUrl = asset?.glb_link as string;
        if (!glbUrl) continue;
        const filename = (glbUrl.split('/').pop() || '').trim();
        if (!filename) continue;
        const payload = {
          client: clientName,
          modelFilename: filename,
          modelName: filename.replace(/\.(gltf|glb)$/i, ''),
          variantName: null as string | null,
          views,
          background: backgroundValue,
          resolution: Number(resolution),
          aspectRatio,
          format: outputFormat,
          sourceGlbUrl: glbUrl
        };
        const res = await fetch('/api/render/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.jobId) {
          try { window.dispatchEvent(new CustomEvent('charpstar:renderJobStarted', { detail: { clientName, jobId: json.jobId } })); } catch {}
          setPendingJobs(prev => [...prev, { jobId: json.jobId, modelName: payload.modelName }]);
        } else {
          console.warn('Failed to queue render for asset:', asset?.product_name || filename, json?.error);
        }
      }
    } catch (e) {
      console.error('Failed to queue selected renders:', e);
      alert('Failed to queue selected renders: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      // keep disabled until all pending jobs finish
      setIsRenderingSelected(false);
    }
  };

  const canUseTransparent = outputFormat !== 'jpg';
  const isColorPickerDisabled = backgroundMode === 'transparent';

  return (
    <div className="h-full flex flex-col lg:flex-row bg-gray-50">
      {/* Left Section - Render Settings */}
      <div className="w-full lg:w-1/2 bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col">
        {/* Settings Header */}
        <div className="px-3 sm:px-4 lg:px-6 py-3 lg:py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">Render Settings</h3>
        </div>
        
        {/* Settings Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
          <div className="space-y-4 lg:space-y-6">
            {/* Settings Grid - Responsive: 2 cols on mobile, 3 on tablet, 5 on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
              {/* Camera Angles */}
              <div className="sm:col-span-1">
                <label className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 sm:mb-3 block">
                  Camera Angles (<span suppressHydrationWarning>{selectedViews.length}</span>)
                </label>
                <div className="space-y-1.5 sm:space-y-2">
                  {cameraPresets.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => toggleView(preset.name)}
                      onMouseEnter={() => handleCameraHover(preset.orbit)}
                      onMouseLeave={handleCameraHoverEnd}
                      className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded font-medium text-left transition-colors ${
                        selectedViews.includes(preset.name)
                          ? 'bg-black text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution & Aspect Ratio Combined */}
              <div className="sm:col-span-1">
                <label className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 sm:mb-3 block">
                  Resolution
                </label>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {[
                    { value: '512', label: '512', sublabel: 'Square', ratio: 'square' },
                    { value: '512', label: '512', sublabel: 'Wide', ratio: 'rectangle' },
                    { value: '1024', label: '1K', sublabel: 'Square', ratio: 'square' },
                    { value: '1024', label: '1K', sublabel: 'Wide', ratio: 'rectangle' },
                    { value: '2048', label: '2K', sublabel: 'Square', ratio: 'square' },
                    { value: '2048', label: '2K', sublabel: 'Wide', ratio: 'rectangle' },
                    { value: '4096', label: '4K', sublabel: 'Square', ratio: 'square' },
                    { value: '4096', label: '4K', sublabel: 'Wide', ratio: 'rectangle' }
                  ].map(({ value, label, sublabel, ratio }) => {
                    const isSelected = resolution === value && aspectRatio === ratio;
                    return (
                      <button
                        key={`${value}-${ratio}`}
                        onClick={() => {
                          setResolution(value);
                          setAspectRatio(ratio as AspectRatio);
                        }}
                        className={`px-1.5 sm:px-2 py-1.5 sm:py-2 text-[10px] sm:text-xs rounded font-medium transition-colors flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span className="font-bold">{label}</span>
                        <span className={`text-[8px] sm:text-[9px] ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>{sublabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Format */}
              <div className="sm:col-span-1">
                <label className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 sm:mb-3 block">Format</label>
                <div className="space-y-1.5 sm:space-y-2">
                  {(['png', 'jpg', 'webp'] as OutputFormat[]).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setOutputFormat(fmt)}
                      className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded font-medium transition-colors ${
                        outputFormat === fmt
                          ? 'bg-black text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Mode */}
              <div className="sm:col-span-1">
                <label className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 sm:mb-3 block">Background</label>
                <div className="space-y-1.5 sm:space-y-2">
                  <button
                    onClick={() => canUseTransparent && setBackgroundMode('transparent')}
                    disabled={!canUseTransparent}
                    className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded font-medium transition-colors ${
                      backgroundMode === 'transparent'
                        ? 'bg-black text-white'
                        : canUseTransparent
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Transparent
                  </button>
                  <button
                    onClick={() => setBackgroundMode('color')}
                    className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded font-medium transition-colors ${
                      backgroundMode === 'color'
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Custom Color
                  </button>
                </div>
              </div>

              {/* Color Picker with Quick Colors - Spans 2 cols on mobile for better visibility */}
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 sm:mb-3 block">Background Color</label>
                <div>
                  <div className={`mb-2 sm:mb-3 ${isColorPickerDisabled ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="[&_input]:text-black [&_input]:placeholder-gray-500 [&_input]:bg-white [&_input]:border-gray-300">
                      <AlwaysOpenColorPicker
                        value={backgroundColor}
                        onChange={setBackgroundColor}
                        debounceTime={100}
                      />
                    </div>
                  </div>
                  <div className={isColorPickerDisabled ? 'opacity-40 pointer-events-none' : ''}>
                    <div className="text-[9px] sm:text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5 sm:mb-2">Quick</div>
                    <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                      {quickColors.map(color => (
                        <TooltipProvider key={color.hex}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setBackgroundColor(color.hex)}
                                className="w-full aspect-square rounded border border-gray-300 hover:border-black hover:scale-105 transition-all shadow-sm"
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">{color.name}</div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="border-t border-gray-200 p-3 sm:p-4 lg:p-6 bg-white flex-shrink-0">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="lg"
                    onClick={handleStartRender}
                    disabled={(isModularMode ? !modularConfig : !modelFilename) || isBlocked || isBusyForCurrentModel}
                    className="flex-1 h-10 sm:h-12 text-sm sm:text-base font-semibold bg-black hover:bg-gray-800 text-white dark:text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 mr-2 animate-spin" />
                        <span className="hidden sm:inline">Rendering...</span>
                        <span className="sm:hidden">Rendering...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 sm:w-5 h-4 sm:h-5 mr-2" />
                        <span className="hidden sm:inline">
                          {`Render (${modelFilename ? modelFilename.replace(/\.(gltf|glb)$/i, '') : 'Model'})`}
                        </span>
                        <span className="sm:hidden">Render</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                {isBlocked ? (
                  <TooltipContent>
                    <div className="text-sm">Render already in progress for this model</div>
                  </TooltipContent>
                ) : (
                  <TooltipContent>
                    <div className="text-sm">Render the current variant with selected settings</div>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="lg"
                    onClick={handleStartRenderSelected}
                    disabled={isBusyForCurrentModel || isBlocked || selectedAssets.length === 0}
                    className="flex-1 h-10 sm:h-12 text-sm sm:text-base font-semibold bg-black hover:bg-gray-800 text-white dark:text-white"
                  >
                    {isRenderingSelected ? (
                      <>
                        <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 mr-2 animate-spin" />
                        <span className="hidden sm:inline">Queueing...</span>
                        <span className="sm:hidden">Queue...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 sm:w-5 h-4 sm:h-5 mr-2" />
                        <span className="hidden md:inline">Render Selected ({selectedAssets.length})</span>
                        <span className="md:hidden">Selected ({selectedAssets.length})</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    {selectedAssets.length === 0
                      ? 'Select assets from the library to render' 
                      : `Queue renders for ${selectedAssets.length} selected asset${selectedAssets.length !== 1 ? 's' : ''}`
                    }
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

          </div>
        </div>
      </div>

      {/* Right Section - History */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col">
        <div className="px-3 sm:px-4 lg:px-6 py-3 lg:py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
            Render History - {
              isModularMode && modularConfig 
                ? `modular-${modularConfig}` 
                : modelFilename 
                ? modelFilename.replace(/\.(gltf|glb)$/i, '') 
                : 'Select Model'
            }
          </h3>
        </div>
        
        <div className="flex-1 overflow-auto">
          {(modelFilename || (isModularMode && modularConfig)) ? (
            <div className="h-full">
              <RenderHistoryPanel 
                clientName={clientName} 
                modelName={
                  isModularMode && modularConfig 
                    ? `modular-${modularConfig}` 
                    : modelFilename!.replace(/\.(gltf|glb)$/i, '')
                } 
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-4 sm:p-6 text-center">
              <div>
                <div className="text-xs sm:text-sm text-gray-500">Select a model to view render history</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RenderOptionsPanel;

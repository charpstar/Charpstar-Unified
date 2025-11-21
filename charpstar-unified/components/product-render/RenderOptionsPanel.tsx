'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/display';
import { Loader2, Camera } from 'lucide-react';
import RenderHistoryPanel from '@/components/product-render/RenderHistoryPanel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/display/tooltip';
import AlwaysOpenColorPicker from '@/components/product-render/AlwaysOpenColorPicker';
import { useUser } from '@/contexts/useUser';
import { toast } from 'sonner';

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
  onBackgroundColorChange?: (color: string, isTransparent: boolean) => void;
  onZoomLevelChange?: (zoomLevel: number) => void;
}

type BackgroundMode = 'transparent' | 'color';
type OutputFormat = 'png' | 'jpg' | 'webp';
type AspectRatio = 'square' | 'rectangle';

const RenderOptionsPanel: React.FC<RenderOptionsPanelProps> = ({ 
  modelViewerRef, 
  modelFilename, 
  isModularMode = false,
  modularConfig,
  sourceGlbUrl,
  selectedAssets = [],
  onPreviewOrbitChange,
  onBackgroundColorChange,
  onZoomLevelChange
}) => {
  const user = useUser();
  const rawClient = Array.isArray(user?.metadata?.client) 
    ? user.metadata.client[0] 
    : user?.metadata?.client || '';
  const clientName = rawClient && String(rawClient).trim().length > 0 ? String(rawClient) : 'Shared';

  const cameraPresets = useMemo(() => ([
    { name: 'front', label: 'Front', orbit: '0deg 88deg 100%' },
    { name: 'back', label: 'Back', orbit: '180deg 90deg 100%' },
    { name: 'side', label: 'Side', orbit: '90deg 91deg 100%' },
    { name: 'top', label: 'Top', orbit: '0deg -200deg 100%' },
    { name: 'default', label: 'Angled Right', orbit: '35deg 90deg 100%' },
    { name: 'angledleft', label: 'Angled Left', orbit: '-35deg 90deg 100%' },
    { name: 'angledtopright', label: 'Angled Top Right', orbit: '35deg 60deg 100%' },
    { name: 'angledtopleft', label: 'Angled Top Left', orbit: '-35deg 60deg 100%' },
    { name: 'angledtoprightback', label: 'Angled Top Right Back', orbit: '145deg 60deg 100%' },
    { name: 'angledtopleftback', label: 'Angled Top Left Back', orbit: '-145deg 60deg 100%' },
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
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [shadows, setShadows] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(0); // -50 to 50, default 0
  
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

  // Helper function to get render time estimate
  const getRenderTime = (resolution: string) => {
    switch(resolution) {
      case '512': return '~15 seconds per image';
      case '1024': return '~45 seconds per image';
      case '2048': return '~2 minutes per image';
      case '4096': return '~5 minutes per image';
      default: return '';
    }
  };

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
      const savedShadows = localStorage.getItem('charpstar:renderSettings:shadows');
      const savedZoomLevel = localStorage.getItem('charpstar:renderSettings:zoomLevel');
      
      if (savedViews) setSelectedViews(JSON.parse(savedViews));
      if (savedResolution) setResolution(savedResolution);
      if (savedAspectRatio) setAspectRatio(savedAspectRatio as AspectRatio);
      if (savedBackgroundMode) setBackgroundMode(savedBackgroundMode as BackgroundMode);
      if (savedBackgroundColor) setBackgroundColor(savedBackgroundColor);
      if (savedFormat) setOutputFormat(savedFormat as OutputFormat);
      if (savedShadows !== null) setShadows(savedShadows === 'true');
      if (savedZoomLevel !== null) setZoomLevel(Number(savedZoomLevel));
      
      // Load recent colors
      const savedRecentColors = localStorage.getItem('charpstar:renderSettings:recentColors');
      if (savedRecentColors) {
        setRecentColors(JSON.parse(savedRecentColors));
      }
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

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('charpstar:renderSettings:shadows', String(shadows));
    } catch {}
  }, [shadows]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('charpstar:renderSettings:zoomLevel', String(zoomLevel));
    } catch {}
  }, [zoomLevel]);

  // Notify parent of zoom level changes for live preview
  React.useEffect(() => {
    if (onZoomLevelChange) {
      onZoomLevelChange(zoomLevel);
    }
  }, [zoomLevel, onZoomLevelChange]);

  // Notify parent of background color changes for live preview
  React.useEffect(() => {
    if (onBackgroundColorChange) {
      onBackgroundColorChange(backgroundColor, backgroundMode === 'transparent');
    }
  }, [backgroundColor, backgroundMode, onBackgroundColorChange]);

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
    // Check if we're trying to add a 6th view BEFORE calling setState
    // This prevents duplicate toasts in React Strict Mode
    if (!selectedViews.includes(viewName) && selectedViews.length >= 5) {
      toast.warning('Maximum 5 camera angles allowed', {
        description: 'You can select up to 5 angles per render job. Deselect an angle to choose a different one.',
      });
      return;
    }
    
    setSelectedViews(prev => {
      if (prev.includes(viewName)) {
        // Allow deselection only if more than 1 view is selected
        return prev.length > 1 ? prev.filter(v => v !== viewName) : prev;
      }
      // Add the view (we already checked the limit above)
      return [...prev, viewName];
    });
  };

  // Update recent colors in localStorage
  const addToRecentColors = (color: string) => {
    if (backgroundMode === 'transparent') return; // Don't add transparent to recent colors
    
    setRecentColors(prev => {
      // Remove if already exists and add to front, keep only last 8 unique colors
      const filtered = prev.filter(c => c.toLowerCase() !== color.toLowerCase());
      const updated = [color, ...filtered].slice(0, 8);
      
      try {
        localStorage.setItem('charpstar:renderSettings:recentColors', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save recent colors:', e);
      }
      
      return updated;
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
      
      // Save color to recent colors
      addToRecentColors(backgroundColor);
      
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
        shadows,
        zoomLevel, // -50 to 50, where 0 is default
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
      toast.error('Failed to start render', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      // keep disabled until renderFinished events clear pendingJobIds
      setIsSubmitting(false);
    }
  };

  const handleStartRenderSelected = async () => {
    if (!clientName || selectedAssets.length === 0 || selectedViews.length === 0) return;
    try {
      setIsRenderingSelected(true);
      
      // Save color to recent colors
      addToRecentColors(backgroundColor);
      
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
          shadows,
          zoomLevel, // -50 to 50, where 0 is default
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
      toast.error('Failed to queue selected renders', {
        description: e instanceof Error ? e.message : String(e),
      });
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
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 sm:p-4 lg:p-6 scrollbar-always-visible">
          <div className="min-w-max">
            {/* Settings Row - Horizontal layout with flex */}
            <div className="flex gap-3 sm:gap-4 lg:gap-5">
              {/* Camera Angles - Two Column Layout */}
              <div className="flex-shrink-0 w-56 sm:w-64">
                <label className="text-[9px] sm:text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2 block">
                  Camera Angles (<span suppressHydrationWarning>{selectedViews.length}</span>/5 max)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {cameraPresets.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => toggleView(preset.name)}
                      onMouseEnter={() => handleCameraHover(preset.orbit)}
                      onMouseLeave={handleCameraHoverEnd}
                      className={`w-full px-2 py-1.5 text-[10px] sm:text-xs rounded font-medium text-left transition-colors ${
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
              <div className="flex-shrink-0 w-28 sm:w-32">
                <label className="text-[9px] sm:text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2 block">
                  Resolution
                </label>
                <div className="grid grid-cols-2 gap-1.5">
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
                      <TooltipProvider key={`${value}-${ratio}`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                setResolution(value);
                                setAspectRatio(ratio as AspectRatio);
                              }}
                              className={`px-1.5 py-1.5 text-[9px] sm:text-[10px] rounded font-medium transition-colors flex flex-col items-center justify-center ${
                                isSelected
                                  ? 'bg-black text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <span className="font-bold">{label}</span>
                              <span className={`text-[7px] sm:text-[8px] ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>{sublabel}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">{getRenderTime(value)}</div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </div>

              {/* Zoom Level Slider - Moved to 3rd position */}
              <div className="flex-shrink-0 w-36 sm:w-40">
                <label className="text-[9px] sm:text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2 block">
                  Zoom ({zoomLevel > 0 ? '+' : ''}{zoomLevel}%)
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="5"
                    value={zoomLevel}
                    onChange={(e) => setZoomLevel(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                  />
                  <div className="flex justify-between text-[8px] sm:text-[9px] text-gray-500">
                    <span>Closer</span>
                    <span>Default</span>
                    <span>Farther</span>
                  </div>
                  {zoomLevel !== 0 && (
                    <button
                      onClick={() => setZoomLevel(0)}
                      className="w-full px-2 py-1 text-[9px] sm:text-[10px] rounded font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Format */}
              <div className="flex-shrink-0 w-20 sm:w-24">
                <label className="text-[9px] sm:text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2 block">Format</label>
                <div className="space-y-1.5">
                  {(['png', 'jpg', 'webp'] as OutputFormat[]).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setOutputFormat(fmt)}
                      className={`w-full px-2 py-1.5 text-[10px] sm:text-xs rounded font-medium transition-colors ${
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
              <div className="flex-shrink-0 w-28 sm:w-32">
                <label className="text-[9px] sm:text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2 block">Background</label>
                <div className="space-y-1.5">
                  <button
                    onClick={() => canUseTransparent && setBackgroundMode('transparent')}
                    disabled={!canUseTransparent}
                    className={`w-full px-2 py-1.5 text-[10px] sm:text-xs rounded font-medium transition-colors ${
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
                    className={`w-full px-2 py-1.5 text-[10px] sm:text-xs rounded font-medium transition-colors ${
                      backgroundMode === 'color'
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Custom Color
                  </button>
                </div>
              </div>

              {/* Color Picker with Quick Colors */}
              <div className="flex-shrink-0 w-44 sm:w-48">
                <label className="text-[9px] sm:text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2 block">Background Color</label>
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
                    <div className="text-[9px] sm:text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5 sm:mb-2">Alternative BG Colors</div>
                    <div className="grid grid-cols-8 gap-1">
                      {quickColors.map(color => (
                        <TooltipProvider key={color.hex}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setBackgroundColor(color.hex)}
                                className={`w-full aspect-square rounded transition-all shadow-sm ${
                                  backgroundColor.toLowerCase() === color.hex.toLowerCase()
                                    ? 'border-[3px] border-black scale-105'
                                    : 'border-2 border-gray-300 hover:border-gray-400 hover:scale-105'
                                }`}
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
                  
                  {/* Recent Background Colors */}
                  {recentColors.length > 0 && (
                    <div className={isColorPickerDisabled ? 'opacity-40 pointer-events-none' : ''}>
                      <div className="text-[9px] sm:text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5 sm:mb-2 mt-3">Recent BG Colors</div>
                      <div className="grid grid-cols-8 gap-1">
                        {recentColors.map((color, idx) => (
                          <TooltipProvider key={`${color}-${idx}`}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setBackgroundColor(color)}
                                  className={`w-full aspect-square rounded transition-all shadow-sm ${
                                    backgroundColor.toLowerCase() === color.toLowerCase()
                                      ? 'border-[3px] border-black scale-105'
                                      : 'border-2 border-gray-300 hover:border-gray-400 hover:scale-105'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">{color}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Shadows Toggle */}
              <div className="flex-shrink-0 w-20 sm:w-24">
                <label className="text-[9px] sm:text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2 block">Shadows</label>
                <div className="space-y-1.5">
                  <button
                    onClick={() => setShadows(true)}
                    className={`w-full px-2 py-1.5 text-[10px] sm:text-xs rounded font-medium transition-colors ${
                      shadows
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    On
                  </button>
                  <button
                    onClick={() => setShadows(false)}
                    className={`w-full px-2 py-1.5 text-[10px] sm:text-xs rounded font-medium transition-colors ${
                      !shadows
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Off
                  </button>
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
                        Render
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

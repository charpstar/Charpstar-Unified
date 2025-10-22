"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { Button } from "@/components/ui/display";
import { ChevronLeft, Download, Settings, Play, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

type AppState = "select" | "configure" | "generating" | "results" | "error";

interface SelectedProduct {
  id: string;
  product_name: string;
  glb_link: string;
  category?: string;
}

interface RenderSettings {
  resolution: string;
  imageFormat: string;
  bgColor: string;
  transparentBg: boolean;
  quality: string;
  renderMargin: number;
  cameraViews: string[];
}

interface RenderJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  downloadUrl?: string;
  settings: RenderSettings;
  products: SelectedProduct[];
  createdAt: string;
}

export default function ProductRenderPage() {
  const user = useUser();
  const router = useRouter();
  const { startLoading, stopLoading } = useLoadingState();
  
  const [appState, setAppState] = useState<AppState>("select");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [renderSettings, setRenderSettings] = useState<RenderSettings>({
    resolution: "2048x2048",
    imageFormat: "JPEG",
    bgColor: "#ffffff",
    transparentBg: false,
    quality: "medium",
    renderMargin: 20,
    cameraViews: ["front", "angled_side1", "side", "top"]
  });
  const [currentJob, setCurrentJob] = useState<RenderJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing jobs and products on mount
  useEffect(() => {
    loadJobs();
    
    // Check for active job in localStorage on mount
    const savedJobId = localStorage.getItem('activeRenderJobId');
    if (savedJobId) {
      console.log("[Product Render] Restoring active job:", savedJobId);
      // Restore the job and start polling
      setAppState("generating");
      startLoading();
      
      // Fetch the job details
      fetch(`/api/product-render/jobs/${savedJobId}/status`)
        .then(res => res.json())
        .then(data => {
          console.log("[Product Render] Restored job status:", data);
          if (data.status === "completed") {
            setCurrentJob({ ...data, id: savedJobId });
            setAppState("results");
            stopLoading();
            localStorage.removeItem('activeRenderJobId');
          } else if (data.status === "failed") {
            setError("Job failed");
            setAppState("error");
            stopLoading();
            localStorage.removeItem('activeRenderJobId');
          } else {
            // Job is still processing
            setCurrentJob({ ...data, id: savedJobId });
            pollJobStatus(savedJobId);
          }
        })
        .catch(error => {
          console.error("Error restoring job:", error);
          localStorage.removeItem('activeRenderJobId');
          stopLoading();
        });
    }
  }, []);

  // Load user profile when user becomes available
  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
    }
  }, [user?.id]);

  // Load products when user profile is available
  useEffect(() => {
    if (userProfile) {
      loadProducts();
    }
  }, [userProfile]);

  const loadJobs = async () => {
    try {
      const response = await fetch("/api/product-render/jobs");
      if (response.ok) {
        const data = await response.json();
        console.log("Jobs loaded:", data.jobs || []);
      }
    } catch (error) {
      console.error("Error loading jobs:", error);
    }
  };

  const loadUserProfile = async () => {
    // Don't load profile if user is not authenticated yet
    if (!user?.id) {
      console.log("User not loaded yet, skipping profile load");
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('role, client')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error("Error loading user profile:", error);
        return;
      }

      setUserProfile(data);
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const loadProducts = async (page: number = 1) => {
    try {
      const supabase = createClient();
      const itemsPerPage = 8; // Show 8 products per page
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('assets')
        .select('id, product_name, preview_image, category, glb_link, client', { count: 'exact' })
        .eq('active', true)
        .range(from, to);

      // Apply client filter if user is not admin
      if (
        userProfile?.role !== "admin" &&
        userProfile?.client &&
        userProfile.client.length > 0
      ) {
        query = query.in("client", userProfile.client);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("Error loading products:", error);
        return;
      }

      setProducts(data || []);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
      setCurrentPage(page);
    } catch (error) {
      console.error("Error loading products:", error);
    }
  };

  const handleProductSelect = (product: any) => {
    // Check if product has GLB link
    if (!product.glb_link) {
      setError(`Product "${product.product_name}" does not have a 3D model file (GLB)`);
      setAppState("error");
      return;
    }

    const isAlreadySelected = selectedProducts.some(p => p.id === product.id);
    
    if (isAlreadySelected) {
      // Remove from selection
      setSelectedProducts([]);
    } else {
      // Replace selection with only this product
      setSelectedProducts([{
        id: product.id,
        product_name: product.product_name,
        glb_link: product.glb_link,
        category: product.category
      }]);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadProducts(newPage);
    }
  };

  const handleSubmitJob = async () => {
    if (selectedProducts.length === 0) {
      setError("Please select a product");
      return;
    }

    try {
      setAppState("generating");
      startLoading();
      setError(null);

      const response = await fetch("/api/product-render/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          products: selectedProducts,
          settings: renderSettings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit render job");
      }

      const data = await response.json();
      setCurrentJob(data.job);
      
      // Save job ID to localStorage so it persists across page refreshes
      localStorage.setItem('activeRenderJobId', data.job.id);
      
      // Stay in "generating" state while job is being processed
      // pollJobStatus will update to "results" when complete
      
      // Start polling for job status
      pollJobStatus(data.job.id);
    } catch (error) {
      console.error("Error submitting job:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred."
      );
      setAppState("error");
    } finally {
      stopLoading();
    }
  };

  const pollJobStatus = async (jobId: string) => {
    let pollCount = 0;
    const maxPollsBeforeWarning = 30; // 30 polls * 2 seconds = 60 seconds
    
    const checkStatus = async () => {
      try {
        pollCount++;
        const response = await fetch(`/api/product-render/jobs/${jobId}/status`);
        if (!response.ok) {
          throw new Error("Failed to check job status");
        }

        const data = await response.json();
        console.log("[Product Render] Job status:", data);
        
        if (data.status === "completed") {
          setCurrentJob(prev => prev ? { ...prev, status: "completed", downloadUrl: data.downloadUrl } : null);
          setAppState("results"); // Show results screen when complete
          localStorage.removeItem('activeRenderJobId'); // Clear saved job
          stopLoading();
        } else if (data.status === "failed") {
          setError("Job failed");
          setAppState("error");
          localStorage.removeItem('activeRenderJobId'); // Clear saved job
          stopLoading();
        } else {
          // Still processing, update progress and check again in 2 seconds
          setCurrentJob(prev => prev ? { ...prev, status: data.status, progress: data.progress } : null);
          
          // Warn if job has been queued for too long
          if (data.status === "queued" && pollCount >= maxPollsBeforeWarning) {
            setError("Job has been queued for over 60 seconds. Make sure the render client is running.");
            setAppState("error");
            localStorage.removeItem('activeRenderJobId'); // Clear saved job
            stopLoading();
            return;
          }
          
          setTimeout(checkStatus, 2000);
        }
      } catch (error) {
        console.error("Error checking job status:", error);
        setError("Failed to check job status");
        setAppState("error");
        localStorage.removeItem('activeRenderJobId'); // Clear saved job
        stopLoading();
      }
    };

    checkStatus();
  };

  const handleReset = () => {
    setSelectedProducts([]);
    setCurrentJob(null);
    setError(null);
    setAppState("select");
  };

  // Show loading state while user context is initializing
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Product Render</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select products and configure rendering settings
          </p>
        </div>
      </div>

          {appState === "select" && (
            <div className="space-y-6">
              {/* Selected Products */}
              {selectedProducts.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Selected Products
                    </h3>
                    <span className="text-sm font-medium text-muted-foreground">
                      {selectedProducts.length} {selectedProducts.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className="space-y-2 mb-6">
                    {selectedProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-3 rounded-md border border-border hover:border-primary transition-colors group">
                        <span className="text-sm font-medium flex-1">{product.product_name}</span>
                        <button
                          onClick={() => handleProductSelect({ id: product.id })}
                          className="ml-3 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={() => setAppState("configure")}
                    className="w-full"
                    size="lg"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure Render Settings
                  </Button>
                </div>
              )}

              {/* Asset Library */}
              <div className="bg-card rounded-lg border border-border shadow-sm">
                <div className="p-6 border-b border-border">
                  <h3 className="text-base font-semibold mb-1">Asset Library</h3>
                  <p className="text-sm text-muted-foreground">Select products to render</p>
                </div>
                
                <div className="p-6">
                  <div className="mb-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search by name, article ID, category..."
                        className="w-full pl-10 pr-4 py-3 border border-input rounded-lg focus:ring-2 focus:ring-ring bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.707.293H3a1 1 0 01-1-1V4z" />
                        </svg>
                        Filters
                      </Button>
                      
                      <Button variant="ghost" size="sm">
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        Sort
                      </Button>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      Showing {products.length} products
                    </div>
                  </div>

                  {/* Products Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {products.map((product) => {
                      const isSelected = selectedProducts.some(p => p.id === product.id);
                      return (
                        <div
                          key={product.id}
                          className={`relative bg-card border rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                            isSelected 
                              ? 'ring-2 ring-primary shadow-md border-primary' 
                              : 'border-border hover:border-muted-foreground'
                          }`}
                          onClick={() => handleProductSelect({
                            id: product.id,
                            product_name: product.product_name,
                            glb_link: product.glb_link,
                            category: product.category
                          })}
                        >
                          {/* Selection Indicator */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 z-10 shadow-sm">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}

                          {/* Product Image */}
                          <div className="w-full aspect-square bg-muted rounded-md mb-3 flex items-center justify-center overflow-hidden">
                            {product.preview_image ? (
                              <Image 
                                src={Array.isArray(product.preview_image) ? product.preview_image[0] : product.preview_image} 
                                alt={product.product_name} 
                                width={200}
                                height={200}
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <div className="text-muted-foreground">
                                <svg className="h-8 w-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="space-y-1.5">
                            <h4 className="font-medium text-sm leading-tight line-clamp-2">
                              {product.product_name}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate">
                              {product.id?.substring(0, 8)}...
                            </p>
                            {product.category && (
                              <span className="inline-block px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded">
                                {product.category}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage < 2}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronLeft className="h-4 w-4 rotate-180" />
                      </Button>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      {selectedProducts.length} selected
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {appState === "configure" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xl font-semibold">Rendering Settings</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure render options for {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''}
                  </p>
                </div>
                <Button 
                  onClick={() => setAppState("select")} 
                  variant="outline"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Resolution */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Resolution</label>
                  <select 
                    value={renderSettings.resolution}
                    onChange={(e) => setRenderSettings(prev => ({ ...prev, resolution: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="1024x1024">1024×1024</option>
                    <option value="2048x2048">2048×2048</option>
                    <option value="4096x4096">4096×4096</option>
                    <option value="1920x1080">1920×1080 (16:9)</option>
                    <option value="3840x2160">3840×2160 (4K)</option>
                  </select>
                </div>

                {/* Image Format */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Image Format</label>
                  <select 
                    value={renderSettings.imageFormat}
                    onChange={(e) => setRenderSettings(prev => ({ ...prev, imageFormat: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="JPEG">JPEG (Smaller file size)</option>
                    <option value="PNG">PNG (Supports transparency)</option>
                    <option value="WEBP">WebP (Modern format)</option>
                    <option value="TIFF">TIFF (High quality)</option>
                  </select>
                </div>

                {/* Render Margin */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">
                    Render Margin <span className="text-primary font-semibold">{renderSettings.renderMargin}%</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={renderSettings.renderMargin}
                    onChange={(e) => setRenderSettings(prev => ({ ...prev, renderMargin: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Tight crop</span>
                    <span>More space</span>
                  </div>
                </div>

                {/* Background Color */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Background Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={renderSettings.bgColor}
                      onChange={(e) => setRenderSettings(prev => ({ ...prev, bgColor: e.target.value }))}
                      className="w-16 h-12 rounded-md border border-input cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={renderSettings.transparentBg}
                    />
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          id="transparentBg"
                          checked={renderSettings.transparentBg}
                          onChange={(e) => setRenderSettings(prev => ({ ...prev, transparentBg: e.target.checked }))}
                          className="peer sr-only"
                        />
                        <div className="w-4 h-4 border-2 border-input rounded peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                        <Check className="absolute top-0 left-0 h-4 w-4 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                      </div>
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        Transparent background (PNG only)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Quality */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Render Quality</label>
                  <select 
                    value={renderSettings.quality}
                    onChange={(e) => setRenderSettings(prev => ({ ...prev, quality: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="low">Low (Faster)</option>
                    <option value="medium">Medium</option>
                    <option value="high">High (Slower)</option>
                  </select>
                </div>

                {/* Camera Views */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-sm font-medium">Camera Views</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { id: "front", label: "Front" },
                      { id: "angled_side1", label: "45° Front-Side" },
                      { id: "side", label: "Side" },
                      { id: "angled_side2", label: "45° Back-Side" },
                      { id: "back", label: "Back" },
                      { id: "top", label: "Top" }
                    ].map((view) => (
                      <label key={view.id} className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            id={view.id}
                            checked={renderSettings.cameraViews.includes(view.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRenderSettings(prev => ({
                                  ...prev,
                                  cameraViews: [...prev.cameraViews, view.id]
                                }));
                              } else {
                                setRenderSettings(prev => ({
                                  ...prev,
                                  cameraViews: prev.cameraViews.filter(v => v !== view.id)
                                }));
                              }
                            }}
                            className="peer sr-only"
                          />
                          <div className="w-5 h-5 border-2 border-input rounded peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                          <Check className="absolute top-0.5 left-0.5 h-4 w-4 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                        <span className="text-sm group-hover:text-foreground transition-colors">
                          {view.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => setAppState("select")} 
                  variant="outline"
                  className="flex-1"
                >
                  Back to Selection
                </Button>
                <Button 
                  onClick={handleSubmitJob} 
                  className="flex-1"
                  size="lg"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Rendering
                </Button>
              </div>
            </div>
          )}

          {appState === "generating" && (
            <div className="text-center py-12">
              <div className="bg-card border border-border rounded-lg p-8 max-w-md mx-auto">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6"></div>
                <h2 className="text-xl font-semibold mb-2">
                  {currentJob?.status === "queued" ? "Queued..." : "Rendering..."}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {currentJob?.status === "queued" 
                    ? "Waiting for render client to pick up the job..."
                    : "Please wait while we render your products..."}
                </p>
                {currentJob?.progress !== undefined && currentJob.progress > 0 && (
                  <div>
                    <div className="w-full bg-muted rounded-full h-2.5 mb-2">
                      <div 
                        className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${currentJob.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-muted-foreground">{currentJob.progress}% complete</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {appState === "results" && currentJob && (
            <div className="text-center py-12">
              <div className="bg-card border border-border rounded-lg p-8 max-w-md mx-auto">
                <div className="h-16 w-16 mx-auto bg-green-100 dark:bg-green-900 dark:opacity-20 rounded-full flex items-center justify-center mb-6">
                  <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">Render Complete!</h2>
                <p className="text-muted-foreground mb-6">
                  Your renders are ready to download
                </p>

                <div className="flex gap-3">
                  {currentJob.downloadUrl && (
                    <Button
                      onClick={() => window.open(currentJob.downloadUrl, '_blank')}
                      className="flex-1"
                      size="lg"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Results
                    </Button>
                  )}
                  <Button 
                    onClick={handleReset}
                    variant="outline"
                    className="flex-1"
                  >
                    Start New Render
                  </Button>
                </div>
              </div>
            </div>
          )}

          {appState === "error" && (
            <div className="text-center py-12">
              <div className="bg-card border border-destructive rounded-lg p-8 max-w-md mx-auto">
                <div className="h-16 w-16 mx-auto bg-destructive opacity-10 rounded-full flex items-center justify-center mb-6">
                  <svg className="h-8 w-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-destructive mb-2">Error</h2>
                <p className="text-muted-foreground mb-6">{error}</p>
                <Button onClick={handleReset} variant="outline" className="w-full">
                  Try Again
                </Button>
              </div>
            </div>
          )}

    </div>
  );
}
"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { Button } from "@/components/ui/display";
import { ChevronLeft, Download, Settings, Play } from "lucide-react";
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
    loadUserProfile();
    
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
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('role, client')
        .eq('id', user?.id)
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                onClick={() => router.back()}
                variant="ghost"
                size="sm"
                className="mr-4"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">Product Render</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">GLB Renderer</h1>

          {appState === "select" && (
            <div className="space-y-6">
              {/* Selected Products */}
              {selectedProducts.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Selected Products ({selectedProducts.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {selectedProducts.map((product) => (
                      <div key={product.id} className="bg-white rounded p-2 flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{product.product_name}</span>
                        <button
                          onClick={() => handleProductSelect({ id: product.id })}
                          className="text-red-500 hover:text-red-700 ml-auto"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={() => setAppState("configure")}
                    className="w-full mt-4"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure Render Settings
                  </Button>
                </div>
              )}

              {/* Asset Library */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Asset Library</h3>
                  <p className="text-sm text-gray-600">Select products to render</p>
                </div>
                
                <div className="p-6">
                  <div className="mb-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search by name, article ID, category..."
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <button className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.707.293H3a1 1 0 01-1-1V4z" />
                        </svg>
                        Filters
                        <span className="ml-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">1</span>
                      </button>
                      
                      <button className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        Sort
                      </button>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      Showing {products.length} products
                    </div>
                  </div>

                  {/* Products Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* Sample Products - Replace with actual data */}
                    {products.map((product) => {
                      const isSelected = selectedProducts.some(p => p.id === product.id);
                      return (
                        <div
                          key={product.id}
                          className={`relative bg-white border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 hover:border-gray-300'
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
                            <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}

                          {/* Product Image */}
                          <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                            {product.preview_image ? (
                              <Image 
                                src={Array.isArray(product.preview_image) ? product.preview_image[0] : product.preview_image} 
                                alt={product.product_name} 
                                width={128}
                                height={128}
                                className="w-full h-full object-cover rounded-lg" 
                              />
                            ) : (
                              <div className="text-gray-400">
                                <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="space-y-1">
                            <h4 className="font-medium text-gray-900 text-sm leading-tight">
                              {product.product_name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              ID: {product.id}
                            </p>
                            <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                              {product.category}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="text-sm text-gray-700">Page {currentPage} of {totalPages}</span>
                      <button 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      {selectedProducts.length} selected
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {appState === "configure" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Rendering Settings</h2>
                <Button 
                  onClick={() => setAppState("select")} 
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Back to Selection
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Resolution */}
                <div className="settings-item">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resolution</label>
                  <select 
                    value={renderSettings.resolution}
                    onChange={(e) => setRenderSettings(prev => ({ ...prev, resolution: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1024x1024">1024×1024</option>
                    <option value="2048x2048">2048×2048</option>
                    <option value="4096x4096">4096×4096</option>
                    <option value="1920x1080">1920×1080 (16:9)</option>
                    <option value="3840x2160">3840×2160 (4K)</option>
                  </select>
                </div>

                {/* Image Format */}
                <div className="settings-item">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Image Format</label>
                  <select 
                    value={renderSettings.imageFormat}
                    onChange={(e) => setRenderSettings(prev => ({ ...prev, imageFormat: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="JPEG">JPEG (Smaller file size)</option>
                    <option value="PNG">PNG (Supports transparency)</option>
                    <option value="WEBP">WebP (Modern format)</option>
                    <option value="TIFF">TIFF (High quality)</option>
                  </select>
                </div>

                {/* Render Margin */}
                <div className="settings-item">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Render Margin <span className="text-blue-600">{renderSettings.renderMargin}%</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={renderSettings.renderMargin}
                    onChange={(e) => setRenderSettings(prev => ({ ...prev, renderMargin: parseInt(e.target.value) }))}
                    className="w-full slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Smaller (tight crop)</span>
                    <span>Larger (more space)</span>
                  </div>
                </div>

                {/* Background Color */}
                <div className="settings-item">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Background Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={renderSettings.bgColor}
                      onChange={(e) => setRenderSettings(prev => ({ ...prev, bgColor: e.target.value }))}
                      className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="transparentBg"
                        checked={renderSettings.transparentBg}
                        onChange={(e) => setRenderSettings(prev => ({ ...prev, transparentBg: e.target.checked }))}
                        className="mr-2"
                      />
                      <label htmlFor="transparentBg" className="text-sm text-gray-700">
                        Transparent background (PNG only)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Quality */}
                <div className="settings-item">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Render Quality</label>
                  <select 
                    value={renderSettings.quality}
                    onChange={(e) => setRenderSettings(prev => ({ ...prev, quality: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low (Faster)</option>
                    <option value="medium">Medium</option>
                    <option value="high">High (Slower)</option>
                  </select>
                </div>

                {/* Camera Views */}
                <div className="settings-item md:col-span-2">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Camera Views</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "front", label: "Front" },
                      { id: "angled_side1", label: "45° Front-Side" },
                      { id: "side", label: "Side" },
                      { id: "angled_side2", label: "45° Back-Side" },
                      { id: "back", label: "Back" },
                      { id: "top", label: "Top" }
                    ].map((view) => (
                      <div key={view.id} className="flex items-center">
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
                          className="mr-2"
                        />
                        <label htmlFor={view.id} className="text-sm text-gray-700">
                          {view.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button 
                  onClick={() => setAppState("select")} 
                  variant="outline"
                  className="flex-1 h-12 text-gray-700 border-gray-300 hover:bg-gray-50"
                >
                  Back to Selection
                </Button>
                <Button 
                  onClick={handleSubmitJob} 
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Rendering
                </Button>
              </div>
            </div>
          )}

          {appState === "generating" && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold mb-2">
                {currentJob?.status === "queued" ? "Queued..." : "Rendering..."}
              </h2>
              <p className="text-gray-600 mb-4">
                {currentJob?.status === "queued" 
                  ? "Waiting for render client to pick up the job..."
                  : "Please wait while we render your product..."}
              </p>
              {currentJob?.progress !== undefined && currentJob.progress > 0 && (
                <div className="max-w-md mx-auto">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${currentJob.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{currentJob.progress}% complete</p>
                </div>
              )}
            </div>
          )}

          {appState === "results" && currentJob && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Render Complete!</h2>
                <p className="text-gray-600">
                  Your render job has been completed successfully.
                </p>
              </div>

              {currentJob.downloadUrl && (
                <div className="text-center">
                  <a
                    href={currentJob.downloadUrl}
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Download Renders
                  </a>
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  onClick={handleReset}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Start New Render
                </Button>
              </div>
            </div>
          )}

          {appState === "error" && (
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">
                <Settings className="h-12 w-12 mx-auto" />
              </div>
              <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={handleReset} className="bg-blue-600 hover:bg-blue-700 text-white">
                Try Again
              </Button>
            </div>
          )}

        </div>
      </div>

      <style jsx>{`
        .slider {
          -webkit-appearance: none;
          appearance: none;
          background: #e5e7eb;
          outline: none;
          border-radius: 8px;
          height: 8px;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .slider::-webkit-slider-thumb:hover {
          background: #2563eb;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .slider::-moz-range-thumb:hover {
          background: #2563eb;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .settings-item {
          flex: 1;
          min-width: 200px;
        }

        .settings-item label {
          font-weight: 600;
          font-size: 0.9rem;
          color: #4c5a75;
          margin-bottom: 5px;
          display: block;
        }

        .form-select, .form-control {
          background-color: #f8f9fa;
          border: 1px solid #ced4da;
        }
      `}</style>
    </div>
  );
}
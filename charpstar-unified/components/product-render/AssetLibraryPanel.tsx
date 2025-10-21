import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/containers/card";
import { Button } from "@/components/ui/display/button";
import { Input } from "@/components/ui/forms/input";
import { Badge } from "@/components/ui/display/badge";
import { 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  Download,
  Eye,
  Loader2
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface AssetLibraryPanelProps {
  onAssetSelect?: (asset: any) => void;
}

export default function AssetLibraryPanel({
  onAssetSelect,
}: AssetLibraryPanelProps) {
  const [assets, setAssets] = useState<any[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchAssets();
  }, []);

  useEffect(() => {
    filterAssets();
  }, [assets, searchTerm, selectedCategory]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching assets:", error);
        toast.error("Failed to load assets");
        return;
      }

      setAssets(data || []);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(data?.map(asset => asset.category).filter(Boolean))];
      setCategories(["all", ...uniqueCategories]);
    } catch (error) {
      console.error("Error fetching assets:", error);
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  const filterAssets = () => {
    let filtered = assets;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(asset =>
        asset.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(asset => asset.category === selectedCategory);
    }

    setFilteredAssets(filtered);
  };

  const handleAssetSelect = (asset: any) => {
    if (onAssetSelect) {
      onAssetSelect(asset);
    }
  };

  const handleDownload = async (asset: any) => {
    try {
      if (asset.glb_link) {
        const link = document.createElement("a");
        link.href = asset.glb_link;
        link.download = asset.name || "asset.glb";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Download started");
      } else {
        toast.error("No download link available");
      }
    } catch (error) {
      console.error("Error downloading asset:", error);
      toast.error("Failed to download asset");
    }
  };

  const handlePreview = (asset: any) => {
    if (asset.preview_image) {
      window.open(asset.preview_image, "_blank");
    } else {
      toast.error("No preview available");
    }
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Asset Library</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading assets...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Asset Library</CardTitle>
        
        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === "all" ? "All Categories" : category}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-sm text-muted-foreground mb-2">No assets found</p>
            <p className="text-xs text-muted-foreground">
              {searchTerm ? "Try adjusting your search" : "No assets available"}
            </p>
          </div>
        ) : (
          <div className={`overflow-y-auto h-full ${
            viewMode === "grid" 
              ? "grid grid-cols-1 gap-3" 
              : "space-y-2"
          }`}>
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className={`group border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                  viewMode === "grid" ? "flex flex-col" : "flex items-center gap-3"
                }`}
                onClick={() => handleAssetSelect(asset)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/json", JSON.stringify(asset));
                }}
              >
                {viewMode === "grid" ? (
                  <>
                    {/* Grid View */}
                    <div className="aspect-square bg-muted rounded-md mb-2 overflow-hidden">
                      {asset.preview_image ? (
                        <Image
                          src={asset.preview_image}
                          alt={asset.name}
                          width={200}
                          height={200}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <div className="text-2xl mb-1">📦</div>
                            <div className="text-xs">No Preview</div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm truncate">{asset.name}</h3>
                      {asset.category && (
                        <Badge variant="secondary" className="text-xs">
                          {asset.category}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {asset.description}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreview(asset);
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(asset);
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* List View */}
                    <div className="w-12 h-12 bg-muted rounded-md overflow-hidden flex-shrink-0">
                      {asset.preview_image ? (
                        <Image
                          src={asset.preview_image}
                          alt={asset.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          📦
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{asset.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {asset.category && (
                          <Badge variant="secondary" className="text-xs">
                            {asset.category}
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground truncate">
                          {asset.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreview(asset);
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(asset);
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


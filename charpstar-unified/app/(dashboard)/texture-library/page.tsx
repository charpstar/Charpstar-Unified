"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/containers/card";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Select } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import { Search, Upload } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Texture {
  id: string;
  name: string;
  category: string;
  basecolor_url: string;
  roughness_url?: string;
  metallic_url?: string;
  normal_url?: string;
  preview_url: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export default function TextureLibraryPage() {
  const router = useRouter();
  const [textures, setTextures] = useState<Texture[]>([]);
  const [filteredTextures, setFilteredTextures] = useState<Texture[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);

  // Fetch textures
  useEffect(() => {
    fetchTextures();
  }, []);

  // Filter textures when search or category changes
  useEffect(() => {
    filterTextures();
  }, [searchTerm, selectedCategory, textures]);

  const fetchTextures = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/textures");
      const data = await response.json();

      if (data.textures) {
        setTextures(data.textures);

        // Extract unique categories
        const uniqueCategories = Array.from(
          new Set(data.textures.map((t: Texture) => t.category))
        ) as string[];
        setCategories(uniqueCategories.sort());
      }
    } catch (error) {
      console.error("Error fetching textures:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterTextures = () => {
    let filtered = textures;

    // Apply category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.category.toLowerCase().includes(searchLower)
      );
    }

    setFilteredTextures(filtered);
  };

  return (
    <div className=" container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Texture Library</h1>
          <p className="text-muted-foreground mt-1">
            Browse and preview high-quality PBR textures
          </p>
        </div>
        <Button onClick={() => router.push("/texture-library/upload")}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Texture
        </Button>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search textures..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <div className="w-full md:w-64">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredTextures.length} of {textures.length} textures
          </div>
        </CardContent>
      </Card>

      {/* Texture Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-0">
                <div className="aspect-square bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTextures.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              No textures found. Try adjusting your search or filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTextures.map((texture) => (
            <Link
              key={texture.id}
              href={`/texture-library/${texture.id}`}
              className="group"
            >
              <Card className="overflow-hidden transition-all hover:shadow-lg hover:scale-[1.02]">
                <CardContent className="p-0">
                  {/* Preview Image */}
                  <div className="relative aspect-square bg-muted overflow-hidden">
                    <Image
                      src={texture.preview_url}
                      alt={texture.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-110"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                  </div>

                  {/* Texture Info */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm line-clamp-1">
                        {texture.name}
                      </h3>
                      {!texture.is_public && (
                        <Badge variant="secondary" className="text-xs">
                          Private
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {texture.category}
                    </Badge>

                    {/* Map indicators */}
                    <div className="flex gap-1 flex-wrap pt-2">
                      <span className="text-xs px-2 py-1 bg-primary/10 rounded">
                        Base
                      </span>
                      {texture.roughness_url && (
                        <span className="text-xs px-2 py-1 bg-primary/10 rounded">
                          Rough
                        </span>
                      )}
                      {texture.metallic_url && (
                        <span className="text-xs px-2 py-1 bg-primary/10 rounded">
                          Metal
                        </span>
                      )}
                      {texture.normal_url && (
                        <span className="text-xs px-2 py-1 bg-primary/10 rounded">
                          Normal
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

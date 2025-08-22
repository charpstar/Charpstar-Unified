"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";

interface ModelStatisticsCardProps {
  modelViewerRef?: React.RefObject<any>;
  modelStructure?: any;
}

interface ModelStats {
  triangles: number;
  vertices: number;
  meshes: number;
  materials: number;
  variants: number;
  doubleSided: number;
  textureQuality: string;
  aoStatus: string;
  transformations: string;
}

const ModelStatisticsCard: React.FC<ModelStatisticsCardProps> = ({
  modelViewerRef,
  modelStructure,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [stats, setStats] = useState<ModelStats>({
    triangles: 0,
    vertices: 0,
    meshes: 0,
    materials: 0,
    variants: 0,
    doubleSided: 0,
    textureQuality: "N/A",
    aoStatus: "Missing",
    transformations: "None",
  });

  // Helper function to count nodes recursively
  const countNodes = (node: any, type: string): number => {
    if (!node) return 0;

    let count = node.type === type ? 1 : 0;

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        count += countNodes(child, type);
      }
    }

    return count;
  };

  // Enhanced function to extract geometry statistics
  const extractGeometryStats = (): {
    triangles: number;
    vertices: number;
    doubleSided: number;
  } => {
    if (!modelViewerRef?.current) {
      return { triangles: 0, vertices: 0, doubleSided: 0 };
    }

    let totalTriangles = 0;
    let totalVertices = 0;
    let doubleSidedCount = 0;

    try {
      // Use the structure-based method first (like in working code)
      const viaStructure = extractGeometryFromStructure();
      if (viaStructure.triangles > 0 || viaStructure.vertices > 0)
        return viaStructure;
      // Fallback: traverse three.js scene exposed on the element
      const viaScene = extractGeometryFromThreeScene();
      return viaScene;
    } catch (error) {
      // Fallback to structure-based extraction
      const viaStructure = extractGeometryFromStructure();
      if (viaStructure.triangles > 0 || viaStructure.vertices > 0)
        return viaStructure;
      return extractGeometryFromThreeScene();
    }
  };

  // Alternative method: use the model structure directly (like in working code)
  const extractGeometryFromStructure = (): {
    triangles: number;
    vertices: number;
    doubleSided: number;
  } => {
    if (!modelStructure) {
      return { triangles: 0, vertices: 0, doubleSided: 0 };
    }

    let totalTriangles = 0;
    let totalVertices = 0;
    let doubleSidedCount = 0;

    const traverseStructure = (node: any) => {
      if (node.type === "Mesh") {
        // Extract geometry info from the structure node
        if (node.geometry) {
          // Count vertices
          if (node.geometry.attributes && node.geometry.attributes.position) {
            const positionCount = node.geometry.attributes.position.count;
            totalVertices += positionCount;
          }

          // Count triangles
          if (node.geometry.index) {
            // Indexed geometry
            const triangleCount = node.geometry.index.count / 3;
            totalTriangles += triangleCount;
          } else if (
            node.geometry.attributes &&
            node.geometry.attributes.position
          ) {
            // Non-indexed geometry
            const triangleCount = node.geometry.attributes.position.count / 3;
            totalTriangles += triangleCount;
          }
        }

        // Check if material is double-sided
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((mat: any) => {
              if (mat && mat.side === 2) doubleSidedCount++;
            });
          } else {
            if (node.material && node.material.side === 2) doubleSidedCount++;
          }
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverseStructure(child);
        }
      }
    };

    traverseStructure(modelStructure);

    const result = {
      triangles: Math.floor(totalTriangles),
      vertices: totalVertices,
      doubleSided: doubleSidedCount,
    };

    return result;
  };

  // Fallback: traverse three.js scene graph for stats
  const extractGeometryFromThreeScene = (): {
    triangles: number;
    vertices: number;
    doubleSided: number;
  } => {
    const viewer: any = modelViewerRef?.current;
    const root: any = viewer?.scene || viewer?.model?.scene || null;
    if (!root) return { triangles: 0, vertices: 0, doubleSided: 0 };

    let totalTriangles = 0;
    let totalVertices = 0;
    let doubleSidedCount = 0;

    const traverse = (node: any) => {
      if (!node) return;
      if (node.isMesh && node.geometry) {
        const geometry = node.geometry;
        if (geometry.attributes && geometry.attributes.position) {
          const count = geometry.attributes.position.count;
          totalVertices += count;
          totalTriangles += Math.floor(count / 3);
        }
        const material = node.material;
        if (Array.isArray(material)) {
          material.forEach((m: any) => {
            if (m && m.side === 2) doubleSidedCount++;
          });
        } else if (material && material.side === 2) {
          doubleSidedCount++;
        }
      }
      if (node.children && node.children.length) {
        node.children.forEach((c: any) => traverse(c));
      }
    };

    traverse(root);
    return {
      triangles: totalTriangles,
      vertices: totalVertices,
      doubleSided: doubleSidedCount,
    };
  };

  // Extract material variants count
  const extractVariantsCount = (): number => {
    if (!modelViewerRef?.current) return 0;

    try {
      // Try to get variants from the model viewer
      const variants = modelViewerRef.current.availableVariants;
      if (variants && Array.isArray(variants)) {
        return variants.length;
      }

      // Alternative method: check if variantName property exists
      if (modelViewerRef.current.variantName !== undefined) {
        // If variantName exists, there's at least one variant
        return 1;
      }
    } catch (error) {
      // Error extracting variants count
    }

    return 0;
  };

  // Analyze texture quality across all materials
  const analyzeTextureQuality = (): string => {
    if (!modelStructure) {
      return "N/A";
    }

    const textureSizes = new Set<number>();
    let hasTextures = false;

    const traverseForTextures = (node: any) => {
      if (node.type === "Mesh") {
        if (node.material) {
          const materials = Array.isArray(node.material)
            ? node.material
            : [node.material];

          materials.forEach((material: any) => {
            // Check various texture maps
            const textureMaps = [
              "map",
              "normalMap",
              "roughnessMap",
              "metalnessMap",
              "aoMap",
              "alphaMap",
            ];

            textureMaps.forEach((mapType) => {
              const texture = material[mapType];
              if (texture && texture.image) {
                hasTextures = true;
                const maxSize = Math.max(
                  texture.image.width || 0,
                  texture.image.height || 0
                );
                textureSizes.add(maxSize);
              }
            });
          });
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverseForTextures(child);
        }
      }
    };

    traverseForTextures(modelStructure);

    if (!hasTextures) return "No Textures";

    const sizes = Array.from(textureSizes).sort((a, b) => b - a);
    const maxSize = sizes[0];

    // Determine quality based on largest texture
    if (maxSize >= 4096) return "4K+";
    if (maxSize >= 2048) return "2K";
    if (maxSize >= 1024) return "1K";
    if (maxSize >= 512) return "512px";
    return `${maxSize}px`;
  };

  // Check AO status across all materials
  const analyzeAOStatus = (): string => {
    if (!modelStructure) {
      return "Unknown";
    }

    let totalMaterials = 0;
    let materialsWithAO = 0;

    const traverseForAO = (node: any) => {
      if (node.type === "Mesh") {
        if (node.material) {
          const materials = Array.isArray(node.material)
            ? node.material
            : [node.material];

          materials.forEach((material: any) => {
            totalMaterials++;
            if (material.aoMap) {
              materialsWithAO++;
            }
          });
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverseForAO(child);
        }
      }
    };

    traverseForAO(modelStructure);

    if (totalMaterials === 0) return "Unknown";
    if (materialsWithAO === 0) return "Missing";
    if (materialsWithAO === totalMaterials) return "Present";
    return `Partial (${materialsWithAO}/${totalMaterials})`;
  };

  // Check for transformations applied to objects
  const analyzeTransformations = (): string => {
    if (!modelStructure) {
      return "Unknown";
    }

    let hasRotation = false;
    let hasScale = false;
    let hasTranslation = false;
    let objectCount = 0;

    const traverseForTransforms = (node: any) => {
      if (
        node.type === "Mesh" ||
        node.type === "Group" ||
        node.type === "Object3D"
      ) {
        objectCount++;

        // Check rotation (quaternion)
        if (
          node.quaternion &&
          (Math.abs(node.quaternion.x) > 0.001 ||
            Math.abs(node.quaternion.y) > 0.001 ||
            Math.abs(node.quaternion.z) > 0.001 ||
            Math.abs(node.quaternion.w - 1) > 0.001)
        ) {
          hasRotation = true;
        }

        // Check scale
        if (
          node.scale &&
          (Math.abs(node.scale.x - 1) > 0.001 ||
            Math.abs(node.scale.y - 1) > 0.001 ||
            Math.abs(node.scale.z - 1) > 0.001)
        ) {
          hasScale = true;
        }

        // Check translation
        if (
          node.position &&
          (Math.abs(node.position.x) > 0.001 ||
            Math.abs(node.position.y) > 0.001 ||
            Math.abs(node.position.z) > 0.001)
        ) {
          hasTranslation = true;
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverseForTransforms(child);
        }
      }
    };

    traverseForTransforms(modelStructure);

    if (objectCount === 0) return "Unknown";

    const transforms = [];
    if (hasRotation) transforms.push("Rotation");
    if (hasScale) transforms.push("Scale");
    if (hasTranslation) transforms.push("Translation");

    if (transforms.length === 0) return "None";
    return transforms.join(", ");
  };

  // Update statistics when model or ref changes, with short polling to handle late-ready scenes
  useEffect(() => {
    if (!modelStructure && !modelViewerRef?.current) {
      setStats({
        triangles: 0,
        vertices: 0,
        meshes: 0,
        materials: 0,
        variants: 0,
        doubleSided: 0,
        textureQuality: "N/A",
        aoStatus: "Missing",
        transformations: "None",
      });
      return;
    }

    let attempts = 0;
    const maxAttempts = 10; // ~10s

    const tick = () => {
      attempts++;
      try {
        const meshCount = modelStructure
          ? countNodes(modelStructure, "Mesh")
          : 0;
        const geometryStats = extractGeometryStats();
        const variantsCount = extractVariantsCount();

        const materialNames = new Set<string>();
        if (modelStructure) {
          const countMaterials = (node: any) => {
            if (node.type === "Mesh" && node.material)
              materialNames.add(node.material);
            if (node.children && Array.isArray(node.children))
              node.children.forEach(countMaterials);
          };
          countMaterials(modelStructure);
        }

        const textureQuality = analyzeTextureQuality();
        const aoStatus = analyzeAOStatus();
        const transformations = analyzeTransformations();

        const next = {
          triangles: geometryStats.triangles,
          vertices: geometryStats.vertices,
          meshes: meshCount,
          materials: materialNames.size,
          variants: variantsCount,
          doubleSided: geometryStats.doubleSided,
          textureQuality,
          aoStatus,
          transformations,
        };

        setStats(next);

        // Stop early if we have meaningful data
        if (next.triangles > 0 || next.vertices > 0 || next.meshes > 0) return;
        if (attempts < maxAttempts) setTimeout(tick, 1000);
      } catch {
        if (attempts < maxAttempts) setTimeout(tick, 1000);
      }
    };

    // kick off
    setTimeout(tick, 300);

    return () => {
      attempts = maxAttempts;
    };
  }, [modelStructure, modelViewerRef]);

  // Format numbers with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[240px]">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <BarChart3 size={16} className="mr-2 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">
            Model Statistics
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-gray-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-500" />
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
              <span className="text-gray-600">Triangles:</span>
            </div>
            <span className="font-medium">{formatNumber(stats.triangles)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
              <span className="text-gray-600">Vertices:</span>
            </div>
            <span className="font-medium">{formatNumber(stats.vertices)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
              <span className="text-gray-600">Meshes:</span>
            </div>
            <span className="font-medium">{stats.meshes}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
              <span className="text-gray-600">Materials:</span>
            </div>
            <span className="font-medium">{stats.materials}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
              <span className="text-gray-600">Variants:</span>
            </div>
            <span className="font-medium">{stats.variants}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Double Sided:</span>
            </div>
            <span className="font-medium">{stats.doubleSided}</span>
          </div>

          <div className="border-t border-gray-200 my-2"></div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Texture Quality:</span>
            </div>
            <span className="font-medium">{stats.textureQuality}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  stats.aoStatus === "Present"
                    ? "bg-green-500"
                    : stats.aoStatus === "Missing"
                    ? "bg-red-500"
                    : "bg-orange-500"
                }`}
              ></div>
              <span className="text-gray-600">AO Maps:</span>
            </div>
            <span className="font-medium">{stats.aoStatus}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  stats.transformations === "None"
                    ? "bg-gray-400"
                    : "bg-blue-500"
                }`}
              ></div>
              <span className="text-gray-600">Transforms:</span>
            </div>
            <div className="text-right">
              {stats.transformations === "None" ? (
                <span className="font-medium text-xs text-gray-500">
                  Default Position
                </span>
              ) : (
                <div className="flex flex-wrap gap-1 justify-end">
                  {stats.transformations.split(", ").map((transform, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800"
                    >
                      {transform === "Rotation" && "🔄 Rotated"}
                      {transform === "Scale" && "📏 Resized"}
                      {transform === "Translation" && "📍 Moved"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelStatisticsCard;

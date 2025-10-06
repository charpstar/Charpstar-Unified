// src/utils/modelViewerInitializer.ts

/**
 * This function initializes and exposes additional model-viewer functions
 * that provide model statistics like polygon count, mesh count, etc.
 * It should be called after the model-viewer element is loaded and available.
 *
 * @param modelViewerElement - The model-viewer DOM element
 * @returns The modelViewerElement with additional functions
 */
export const initializeModelViewer = (modelViewerElement: any): any => {
  if (!modelViewerElement) {
    console.warn("Cannot initialize model-viewer: Element not available");
    return null;
  }

  // Additional safety check to ensure element is still in DOM
  if (!document.contains(modelViewerElement)) {
    console.warn("Cannot initialize model-viewer: Element no longer in DOM");
    return null;
  }

  // Don't re-initialize if already done
  if (typeof modelViewerElement.getModelStats === "function") {
    return modelViewerElement;
  }

  /**
   * Define a helper to safely access the scene and model
   */
  const getSceneModel = () => {
    // Access the private scene property (typically stored as a Symbol)
    // This is implementation-specific and might need to be updated if the model-viewer changes
    const sceneSymbol = Object.getOwnPropertySymbols(modelViewerElement).find(
      (symbol) => symbol.toString().includes("scene")
    );

    if (
      !sceneSymbol ||
      !modelViewerElement[sceneSymbol] ||
      !modelViewerElement[sceneSymbol].model
    ) {
      return null;
    }

    return modelViewerElement[sceneSymbol].model;
  };

  /**
   * Count the total number of meshes in the scene
   */
  modelViewerElement.totalMeshCount = () => {
    const model = getSceneModel();
    if (!model) {
      console.warn("Cannot count meshes: Scene or model not available");
      return 0;
    }

    let count = 0;
    model.traverse((object: any) => {
      if (object.isMesh) {
        count++;
      }
    });

    return count;
  };

  /**
   * Count the total number of materials in the scene
   */
  modelViewerElement.totalMaterialCount = () => {
    const model = getSceneModel();
    if (!model) {
      console.warn("Cannot count materials: Scene or model not available");
      return 0;
    }

    // Use a Set to avoid counting duplicate materials
    const materials = new Set();

    model.traverse((object: any) => {
      if (object.material) {
        // Handle both single materials and material arrays
        if (Array.isArray(object.material)) {
          object.material.forEach((mat: any) => {
            if (mat) materials.add(mat);
          });
        } else {
          materials.add(object.material);
        }
      }
    });

    return materials.size;
  };

  /**
   * Get polygon statistics (vertices and triangles)
   */
  modelViewerElement.getPolyStats = () => {
    const model = getSceneModel();
    if (!model) {
      console.warn("Cannot get polygon stats: Scene or model not available");
      return { vertices: 0, triangles: 0 };
    }

    let vertexCount = 0;
    let triangleCount = 0;

    model.traverse((object: any) => {
      if (object.isMesh && object.geometry) {
        const geometry = object.geometry;

        // Count vertices
        if (geometry.attributes && geometry.attributes.position) {
          vertexCount += geometry.attributes.position.count;
        }

        // Count triangles/faces
        if (geometry.index) {
          // Indexed geometry
          triangleCount += geometry.index.count / 3;
        } else if (geometry.attributes && geometry.attributes.position) {
          // Non-indexed geometry
          triangleCount += geometry.attributes.position.count / 3;
        }
      }
    });

    return {
      vertices: Math.round(vertexCount),
      triangles: Math.round(triangleCount),
    };
  };

  /**
   * Check for double-sided materials
   */
  modelViewerElement.checkForDoubleSided = () => {
    const model = getSceneModel();
    if (!model) {
      console.warn(
        "Cannot check for double-sided materials: Scene or model not available"
      );
      return { count: 0, materials: [] };
    }

    const doubleSidedMaterials = new Set();

    model.traverse((object: any) => {
      if (object.material) {
        // Handle both single materials and material arrays
        if (Array.isArray(object.material)) {
          object.material.forEach((mat: any) => {
            if (mat && mat.side === 2) {
              // DoubleSide = 2 in THREE.js
              doubleSidedMaterials.add(mat);
            }
          });
        } else if (object.material.side === 2) {
          // DoubleSide = 2 in THREE.js
          doubleSidedMaterials.add(object.material);
        }
      }
    });

    // Create array of material names
    const materialNames = Array.from(doubleSidedMaterials).map(
      (mat: any) => mat.name || "Unnamed Material"
    );

    return {
      count: doubleSidedMaterials.size,
      materials: materialNames,
    };
  };

  /**
   * Get comprehensive model statistics in a single call
   */
  modelViewerElement.getModelStats = () => {
    const polyStats = modelViewerElement.getPolyStats();
    const doubleSidedInfo = modelViewerElement.checkForDoubleSided();

    return {
      meshCount: modelViewerElement.totalMeshCount(),
      materialCount: modelViewerElement.totalMaterialCount(),
      vertices: polyStats.vertices,
      triangles: polyStats.triangles,
      doubleSidedCount: doubleSidedInfo.count,
      doubleSidedMaterials: doubleSidedInfo.materials,
    };
  };

  return modelViewerElement;
};

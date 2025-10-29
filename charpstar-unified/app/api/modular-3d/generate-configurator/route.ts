import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// BunnyCDN Configuration
const ZONE_NAME = process.env.BUNNY_STORAGE_ZONE_NAME || "maincdn";
const STORAGE_ZONE = ZONE_NAME.split("/")[0];
const ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
const REGION = process.env.BUNNY_REGION || "se";
const CDN_HOST = process.env.BUNNY_CDN_HOST || "https://cdn.charpstar.net";

if (!ACCESS_KEY) {
  console.error("Missing BunnyCDN configuration:", {
    ACCESS_KEY: !!ACCESS_KEY,
    ZONE_NAME,
    STORAGE_ZONE,
    REGION,
    allEnvVars: Object.keys(process.env).filter(key => key.includes('BUNNY'))
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check BunnyCDN configuration
    if (!ACCESS_KEY) {
      console.error("Missing BunnyCDN configuration:", {
        ACCESS_KEY: !!ACCESS_KEY,
        ZONE_NAME,
        STORAGE_ZONE,
        REGION,
        allEnvVars: Object.keys(process.env).filter(key => key.includes('BUNNY'))
      });
      return NextResponse.json(
        { 
          error: "BunnyCDN configuration missing",
          details: {
            ACCESS_KEY: !!ACCESS_KEY,
            REGION,
            ZONE_NAME,
            STORAGE_ZONE,
            availableBunnyVars: Object.keys(process.env).filter(key => key.includes('BUNNY'))
          }
        },
        { status: 500 }
      );
    }

    const { selectedAssets } = await request.json();

    if (!selectedAssets || !Array.isArray(selectedAssets) || selectedAssets.length === 0) {
      return NextResponse.json(
        { error: "No assets selected" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const filename = `configurator-${uniqueId}.html`;

    // Read the Three.js viewer module
    const viewerModulePath = path.join(process.cwd(), "public", "js", "three-viewer-module.js");
    const viewerCode = fs.readFileSync(viewerModulePath, "utf-8");

    // Generate HTML content
    const htmlContent = generateConfiguratorHTML(selectedAssets, viewerCode);

    // Upload to BunnyCDN - place at zone root under Modular-Configurators
    const uploadPath = `Modular-Configurators/${filename}`;
    const cdnUrl = await uploadToBunnyCDN(htmlContent, uploadPath);

    // Generate embed code (iframe only; fills parent container)
    const embedCode = `<iframe src="${cdnUrl}" style="width:100%; height:100%; border:0;" allow="fullscreen; xr-spatial-tracking" allowfullscreen loading="lazy" referrerpolicy="no-referrer"></iframe>`;

    return NextResponse.json({
      cdnUrl,
      embedCode,
      filename
    });

  } catch (error) {
    console.error("Error generating configurator:", error);
    return NextResponse.json(
      { error: "Failed to generate configurator" },
      { status: 500 }
    );
  }
}

function generateConfiguratorHTML(assets: any[], viewerCode: string): string {
  const assetData = JSON.stringify(assets.map(asset => ({
    id: asset.id,
    name: asset.name,
    glbUrl: asset.glbUrl,
    previewImage: asset.previewImage
  })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>3D Configurator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            height: 100vh;
            overflow: hidden;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        .container {
            display: flex;
            height: 100vh;
            width: 100vw;
            flex-direction: column;
        }
        
        .viewer-area {
            flex: 1;
            background: white;
            position: relative;
            min-height: 0;
        }
        
        /* Ensure the viewer canvas fills its parent */
        #viewer {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
        }
        
        .asset-panel {
            width: 100%;
            max-height: 50vh;
            background: #f8f9fa;
            border-top: 1px solid #e0e0e0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .panel-header {
            padding: 16px;
            border-bottom: 1px solid #e0e0e0;
            background: rgba(255, 255, 255, 0.8);
            flex-shrink: 0;
        }
        
        .panel-title {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 4px;
        }
        
        .panel-subtitle {
            font-size: 13px;
            color: #666;
            line-height: 1.4;
        }
        
        .assets-grid {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 12px;
        }
        
        .asset-card {
            aspect-ratio: 1;
            border: 2px solid #e0e0e0;
            background: white;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            touch-action: manipulation;
        }
        
        .asset-card:active {
            transform: scale(0.98);
        }
        
        .asset-card:hover {
            border-color: #007bff;
            box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
        }
        
        .asset-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
            transition: transform 0.2s ease;
        }
        
        .asset-card:hover .asset-image {
            transform: scale(1.05);
        }
        
        .asset-label {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 8px;
            background: linear-gradient(to top, rgba(255, 255, 255, 0.95), transparent);
            text-align: center;
        }
        
        .asset-name {
            font-size: 12px;
            font-weight: 600;
            color: #333;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            font-size: 16px;
            color: #666;
        }
        
        .error {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            font-size: 16px;
            color: #dc3545;
        }
        
        /* Tablet and larger (768px+) */
        @media (min-width: 768px) {
            .container {
                flex-direction: row;
            }
            
            .viewer-area {
                flex: 1;
                min-height: auto;
            }
            
            .asset-panel {
                width: 380px;
                max-height: none;
                height: 100vh;
                border-top: none;
                border-left: 1px solid #e0e0e0;
            }
            
            .panel-header {
                padding: 20px;
            }
            
            .panel-title {
                font-size: 20px;
                margin-bottom: 8px;
            }
            
            .panel-subtitle {
                font-size: 14px;
            }
            
            .assets-grid {
                padding: 20px;
            }
            
            .grid {
                grid-template-columns: 1fr 1fr;
                gap: 16px;
            }
            
            .asset-card {
                padding: 28px;
            }
            
            .asset-label {
                padding: 12px;
            }
            
            .asset-name {
                font-size: 14px;
            }
        }
        
        /* Desktop (1024px+) */
        @media (min-width: 1024px) {
            .asset-panel {
                width: 420px;
            }
            
            .asset-card {
                padding: 32px;
            }
        }
        
        /* Extra small mobile adjustments */
        @media (max-width: 480px) {
            .panel-header {
                padding: 12px;
            }
            
            .panel-title {
                font-size: 16px;
            }
            
            .panel-subtitle {
                font-size: 12px;
            }
            
            .assets-grid {
                padding: 12px;
            }
            
            .grid {
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 10px;
            }
            
            .asset-card {
                padding: 16px;
            }
            
            .asset-name {
                font-size: 11px;
            }
        }
        
        /* Landscape mobile */
        @media (max-height: 500px) and (orientation: landscape) {
            .asset-panel {
                max-height: 60vh;
            }
            
            .panel-header {
                padding: 10px 16px;
            }
            
            .assets-grid {
                padding: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="viewer-area">
            <div id="viewer"></div>
        </div>
        
        <div class="asset-panel">
            <div class="panel-header">
                <div class="panel-title">Place in Scene</div>
                <div class="panel-subtitle">Click on any asset below to place it in the 3D scene</div>
            </div>
            
            <div class="assets-grid">
                <div class="grid" id="assets-grid">
                    <!-- Assets will be populated by JavaScript -->
                </div>
            </div>
        </div>
    </div>

    <script type="module">
        // Asset data
        const assets = ${assetData};
        
        // Initialize viewer
        let viewerInitialized = false;
        
        // Initialize Three.js viewer
        ${viewerCode}
        
        // Wait for viewer to be ready
        function waitForViewer() {
            if (window.__charpstAR_threeInit) {
                window.__charpstAR_threeInit({
                    mountId: 'viewer',
                    allowEmpty: true
                });
                viewerInitialized = true;
                populateAssets();
            } else {
                setTimeout(waitForViewer, 100);
            }
        }
        
        // Populate asset grid
        function populateAssets() {
            const grid = document.getElementById('assets-grid');
            if (!grid) return;
            
            grid.innerHTML = '';
            
            assets.forEach((asset, index) => {
                const card = document.createElement('div');
                card.className = 'asset-card';
                card.onclick = () => placeAsset(asset);
                
                const imageContainer = document.createElement('div');
                imageContainer.style.width = '100%';
                imageContainer.style.height = '100%';
                imageContainer.style.display = 'flex';
                imageContainer.style.alignItems = 'center';
                imageContainer.style.justifyContent = 'center';
                
                if (asset.previewImage) {
                    const img = document.createElement('img');
                    img.src = Array.isArray(asset.previewImage) ? asset.previewImage[0] : asset.previewImage;
                    img.className = 'asset-image';
                    img.alt = asset.name;
                    img.onerror = () => {
                        // Fallback to text if image fails
                        imageContainer.innerHTML = ${"`"}<div style="font-size: 24px; color: #999; font-weight: bold;">${'${asset.name.substring(0, 2).toUpperCase()}'}<\/div>${"`"};
                    };
                    imageContainer.appendChild(img);
                } else {
                    imageContainer.innerHTML = ${"`"}<div style="font-size: 24px; color: #999; font-weight: bold;">${'${asset.name.substring(0, 2).toUpperCase()}'}<\/div>${"`"};
                }
                
                const label = document.createElement('div');
                label.className = 'asset-label';
                label.innerHTML = ${"`"}<div class="asset-name">${'${asset.name}'}<\/div>${"`"};
                
                card.appendChild(imageContainer);
                card.appendChild(label);
                grid.appendChild(card);
            });
        }
        
        // Place asset in scene
        function placeAsset(asset) {
            if (!viewerInitialized || !window.__charpstAR_threeAddGltf) {
                console.error('Viewer not ready');
                return;
            }
            
            try {
                window.__charpstAR_threeAddGltf('viewer', asset.glbUrl);
            } catch (error) {
                console.error('Failed to place asset:', error);
            }
        }
        
        // Start initialization
        waitForViewer();
    </script>
</body>
</html>`;
}

async function uploadToBunnyCDN(content: string, filePath: string): Promise<string> {
  if (!ACCESS_KEY) {
    throw new Error("BunnyCDN access key not configured");
  }
  
  const buffer = Buffer.from(content, 'utf-8');
  const storageUrl = `https://${REGION}.storage.bunnycdn.com/${STORAGE_ZONE}/${filePath}`;
  
  try {
    const response = await fetch(storageUrl, {
      method: "PUT",
      headers: {
        AccessKey: ACCESS_KEY,
        "Content-Type": "text/html",
        "Content-Length": buffer.length.toString(),
      },
      body: buffer,
    });

    if (response.ok) {
      const cdnUrl = `${CDN_HOST}/${filePath}`;
      return cdnUrl;
    } else {
      const errorText = await response.text();
      throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
    }
  } catch (error) {
    throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
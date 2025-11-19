import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || "https://tpamckewerybqzhhhqqp.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwYW1ja2V3ZXJ5YnF6aGhocXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzY0NTAzOCwiZXhwIjoyMDYzMjIxMDM4fQ.WKPdpbK9X4tac-_fWN1rF7qJgd_kq39ZjDOD9Djnz0A"
);

export class GLBProcessor8Views {
  constructor() {
    this.browser = null;
    this.httpServer = null;
    this.serverPort = null;
  }

  // Download GLB file from URL
  async downloadGLB(glbUrl) {
    console.log(`📥 Downloading GLB from: ${glbUrl}`);

    const maxRetries = 3;
    const retryDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 GLB download attempt ${attempt}/${maxRetries}`);

        const response = await fetch(glbUrl);
        
        if (!response.ok) {
          throw new Error(
            `Failed to download GLB: ${response.status} ${response.statusText}`
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length === 0) {
          throw new Error("Downloaded GLB file is empty");
        }

        // Basic GLB header validation
        if (buffer.length < 4 || buffer.toString("ascii", 0, 4) !== "glTF") {
          throw new Error("Downloaded file is not a valid GLB (missing glTF header)");
        }

        console.log(`✅ GLB downloaded and verified: ${buffer.length} bytes`);
        return buffer;
      } catch (error) {
        console.error(`❌ GLB download attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          throw error;
        }
      }
    }
  }

  // Start HTTP server to serve GLB files
  startHttpServer(serveDir) {
    return new Promise((resolve, reject) => {
      try {
        const server = createServer((req, res) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          
          if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
          }
          
          const filePath = path.join(serveDir, req.url);
          
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = ext === '.glb' ? 'model/gltf-binary' : 'application/octet-stream';
            
            res.setHeader('Content-Type', contentType);
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
          } else {
            res.writeHead(404);
            res.end('File not found');
          }
        });
        
        for (let port = 9000; port < 9100; port++) {
          try {
            server.listen(port, () => {
              this.httpServer = server;
              this.serverPort = port;
              console.log(`✅ HTTP server started on port ${port} serving ${serveDir}`);
              resolve(`http://localhost:${port}`);
            });
            break;
          } catch (err) {
            if (port === 9099) {
              reject(new Error('No available port found'));
            }
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // Stop HTTP server
  stopHttpServer() {
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
      this.serverPort = null;
      console.log("🔒 HTTP server stopped");
    }
  }

  // Upload image to BunnyCDN Storage
  async uploadImage(imagePath, sku, viewIndex, viewName, clientName = null) {
    try {
      console.log(`📤 Uploading ${viewName} (view ${viewIndex + 1}) for ${sku} to BunnyCDN...`);
      
      const storageZoneName = process.env.BUNNY_STORAGE_ZONE || 'maincdn';
      const apiKey = process.env.BUNNY_API_KEY;
      const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
      const cdnHostname = process.env.BUNNY_CDN_HOSTNAME || `${storageZoneName}.bunnycdn.com`;
      
      if (!apiKey) {
        throw new Error('BUNNY_API_KEY environment variable is required');
      }
      
      const imageBuffer = fs.readFileSync(imagePath);
      const filePath = clientName 
        ? `Platform/glb-images/${clientName}/${sku}/${sku}_view_${viewIndex + 1}_${viewName}.jpg`
        : `Platform/glb-images/${sku}/${sku}_view_${viewIndex + 1}_${viewName}.jpg`;
      
      // BunnyCDN Storage API endpoint
      const uploadUrl = `https://${storageHostname}/${storageZoneName}/${filePath}`;
      
      console.log(`🔍 Debug: Uploading to ${uploadUrl}`);
      console.log(`🔍 Debug: Storage Zone: ${storageZoneName}, API Key length: ${apiKey.length}`);
      
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'AccessKey': apiKey,
          'Content-Type': 'image/jpeg'
        },
        body: imageBuffer
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BunnyCDN upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      // Construct public URL
      const publicUrl = `https://${cdnHostname}/${filePath}`;
      
      console.log(`✅ ${viewName} uploaded: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error(`❌ Failed to upload ${viewName}:`, error);
      throw error;
    }
  }

  // Upload all images for a GLB
  async uploadAllImages(sku, outputDir, clientName = null) {
    try {
      console.log(`📤 Uploading all 8 images for ${sku}...`);
      
      const imageUrls = [];
      const viewNames = ['front', 'back', 'left', 'right', 'top', 'bottom', 'isometric_front_right', 'isometric_front_left'];
      
      for (let i = 0; i < 8; i++) {
        const viewName = viewNames[i];
        const imagePath = path.join(outputDir, `view_${i + 1}_${viewName}.jpg`);
        if (fs.existsSync(imagePath)) {
          const url = await this.uploadImage(imagePath, sku, i, viewName, clientName);
          imageUrls.push(url);
        }
      }
      
      console.log(`✅ All images uploaded for ${sku}: ${imageUrls.length} images`);
      return imageUrls;
    } catch (error) {
      console.error(`❌ Failed to upload images for ${sku}:`, error);
      throw error;
    }
  }

  // Clean up local files
  async cleanupFiles(sku, outputDir) {
    try {
      console.log(`🧹 Cleaning up files for ${sku}...`);
      
      const viewNames = ['front', 'back', 'left', 'right', 'top', 'bottom', 'isometric_front_right', 'isometric_front_left'];
      
      // Delete all image files
      for (let i = 0; i < 8; i++) {
        const viewName = viewNames[i];
        const imagePath = path.join(outputDir, `view_${i + 1}_${viewName}.jpg`);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      // Delete GLB file
      const glbPath = path.join(outputDir, `${sku}.glb`);
      if (fs.existsSync(glbPath)) {
        fs.unlinkSync(glbPath);
      }
      
      // Delete the directory if empty
      try {
        fs.rmdirSync(outputDir);
      } catch (err) {
        // Directory not empty, that's fine
      }
      
      console.log(`✅ Cleaned up files for ${sku}`);
    } catch (error) {
      console.error(`❌ Failed to cleanup files for ${sku}:`, error);
      throw error;
    }
  }

  // Save GLB locally and return HTTP URL
  async saveGLBLocally(glbBuffer, sku, outputDir) {
    try {
      console.log(`💾 Saving GLB locally...`);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `${sku}.glb`;
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, glbBuffer);
      
      if (!this.httpServer) {
        const parentDir = path.dirname(outputDir);
        const baseUrl = await this.startHttpServer(parentDir);
        console.log(`✅ HTTP server started: ${baseUrl}`);
      }
      
      const subdir = path.basename(outputDir);
      const httpUrl = `http://localhost:${this.serverPort}/${subdir}/${filename}`;
      console.log(`✅ GLB accessible via HTTP: ${httpUrl}`);
      return httpUrl;
    } catch (error) {
      console.error("❌ Failed to save GLB locally:", error);
      throw new Error(`Failed to save GLB locally: ${error.message}`);
    }
  }

  // Generate HTML for model-viewer with specific camera angle
  generateModelViewerHTML(glbUrl, cameraOrbit, width = 1920, height = 1080) {
    return `
      <html>
        <head>
          <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
          <style>
            body { 
              margin: 0; 
              background: transparent;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
            }
            model-viewer {
              width: ${width}px;
              height: ${height}px;
              min-height: 400px;
              background-color: transparent;
            }
          </style>
        </head>
        <body>
          <model-viewer
            src="${glbUrl}"
            camera-orbit="${cameraOrbit}"
            auto-rotate="false"
            auto-rotate-delay="0"
            camera-controls="false"
            disable-zoom="true"
            disable-pan="true"
            disable-tap="true"
            orbit-sensitivity="0"
            touch-action="pan-y"
            exposure="1.3"
            shadow-intensity="1"
            shadow-softness="0.75"
            environment-image="https://cdn.charpstar.net/Demos/HDR_Furniture.hdr"
            tone-mapping="aces"
            max-camera-orbit="auto 90deg auto"
            field-of-view="auto"
            interaction-prompt="none"
            ar-status="not-presenting"
            alt="3D model screenshot"
            loading="eager"
            style="width: 100%; height: 100%; background-color: transparent; pointer-events: none;"
          ></model-viewer>
          
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const modelViewer = document.querySelector('model-viewer');
              if (modelViewer) {
                modelViewer.addEventListener('load', function() {
                  modelViewer.autoRotate = false;
                  modelViewer.cameraControls = false;
                  modelViewer.disableZoom = true;
                  modelViewer.disablePan = true;
                  modelViewer.disableTap = true;
                  modelViewer.orbitSensitivity = 0;
                  modelViewer.cameraOrbit = "${cameraOrbit}";
                  modelViewer.cameraTarget = '0 0 0';
                  // modelViewer.exposure = 1.3;
                  modelViewer.shadowIntensity = 1;
                  modelViewer.shadowSoftness = 0.75;
                  modelViewer.toneMapping = 'aces';
                  console.log('Model loaded and movement disabled');
                });
              }
            });
          </script>
        </body>
      </html>
    `;
  }

  // Launch browser if not already launched
  async launchBrowser() {
    if (!this.browser) {
      console.log("🚀 Launching browser...");
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
        ],
        timeout: 60000,
      });
      console.log("✅ Browser launched successfully");
    }
    return this.browser;
  }

  // Process a single GLB file - takes 8 screenshots
  async processGLB(glbUrl, sku, outputDir, clientName = null, dryRun = false) {
    const screenshots = [];
    const logs = [];

    // Define 8 camera views with their orbits
    const views = [
      { name: 'front', index: 0, orbit: '0deg 90deg 5.5m' },
      { name: 'back', index: 1, orbit: '180deg 90deg 5.5m' },
      { name: 'left', index: 2, orbit: '90deg 90deg 5.5m' },
      { name: 'right', index: 3, orbit: '270deg 90deg 5.5m' },
      { name: 'top', index: 4, orbit: '0deg 0deg 5.5m' },
      { name: 'bottom', index: 5, orbit: '0deg 180deg 5.5m' },
      { name: 'isometric_front_right', index: 6, orbit: '45deg 70deg 5.5m' },
      { name: 'isometric_front_left', index: 7, orbit: '315deg 70deg 5.5m' },
    ];

    try {
      console.log(`🚀 Processing GLB for SKU: ${sku} (8 views)`);
      logs.push(`Starting GLB processing for SKU: ${sku} with 8 views`);

      // Step 1: Download GLB file
      console.log("📥 Downloading GLB file...");
      logs.push("Downloading GLB file...");
      const glbBuffer = await this.downloadGLB(glbUrl);
      console.log(`✅ GLB downloaded: ${glbBuffer.length} bytes`);
      logs.push(`GLB file downloaded successfully: ${glbBuffer.length} bytes`);

      // Step 2: Save GLB locally
      console.log("💾 Saving GLB locally...");
      const localGlbUrl = await this.saveGLBLocally(glbBuffer, sku, outputDir);
      console.log("✅ GLB saved locally");
      logs.push("GLB saved locally for model-viewer");

      // Step 3: Launch browser
      let browser, page;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Browser connection attempt ${attempt}/${maxRetries}`);
          browser = await this.launchBrowser();
          page = await browser.newPage();
          
          await page.evaluate(() => true);
          console.log("✅ Browser connection established");
          break;
        } catch (error) {
          console.error(`❌ Browser connection attempt ${attempt} failed:`, error.message);
          if (attempt < maxRetries) {
            console.log("⏳ Waiting 2s before retry...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (browser) {
              try { await browser.close(); } catch (e) {}
              this.browser = null;
            }
          } else {
            throw new Error(`Browser connection failed after ${maxRetries} attempts: ${error.message}`);
          }
        }
      }

      try {
        page.on("console", (msg) => {
          const text = msg.text();
          if (!text.includes("GPU stall due to ReadPixels") && 
              !text.includes("WebGL context creation blocked") &&
              !text.includes("Error creating WebGL context") &&
              !text.includes("Cannot read properties of undefined")) {
            console.log("PAGE LOG:", text);
          }
        });

        page.on("pageerror", (error) => {
          console.error("❌ PAGE ERROR:", error.message);
        });

        page.on("disconnected", () => {
          console.error("❌ Page disconnected unexpectedly");
        });

        page.setDefaultTimeout(120000);
        page.setDefaultNavigationTimeout(120000);

        // Set viewport for high-quality screenshots
        const screenshotWidth = 1920;
        const screenshotHeight = 1080;

        console.log(`🖼️ Setting viewport to ${screenshotWidth}x${screenshotHeight}...`);
        await page.setViewport({
          width: screenshotWidth,
          height: screenshotHeight,
          deviceScaleFactor: 1,
        });

        // Disable WebGL and GPU features to prevent errors
        await page.evaluateOnNewDocument(() => {
          const originalGetContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
              console.log('WebGL context creation blocked, using 2d fallback');
              return this.getContext('2d', ...args);
            }
            return originalGetContext.call(this, type, ...args);
          };

          if (navigator.xr) {
            navigator.xr = undefined;
          }
        });

        // Hide cursor
        await page.evaluate(() => {
          document.body.style.cursor = 'none';
        });

        // Step 4: Take 8 screenshots from different angles
        console.log("📸 Starting screenshot capture (8 views)...");
        
        for (const view of views) {
          console.log(`📷 Taking ${view.name} screenshot (view ${view.index + 1}/8)...`);
          logs.push(`Taking screenshot from ${view.name} angle (view ${view.index + 1}/8)...`);
          
          try {
            // Generate HTML for this view
            const htmlContent = this.generateModelViewerHTML(
              localGlbUrl,
              view.orbit,
              screenshotWidth,
              screenshotHeight
            );

            // Load the HTML
            console.log(`📄 Loading HTML content for ${view.name}...`);
            await page.setContent(htmlContent, {
              waitUntil: "domcontentloaded",
              timeout: 120000,
            });
            console.log(`✅ HTML content loaded for ${view.name}`);

            // Wait for model-viewer to load
            console.log(`🔍 Waiting for model-viewer element (${view.name})...`);
            await page.waitForSelector("model-viewer", { timeout: 120000 });
            console.log(`✅ Model-viewer element found for ${view.name}`);

            // Wait for model to load
            console.log(`🎯 Waiting for model to become visible and loaded (${view.name})...`);
            await page.evaluate(() => {
              return new Promise((resolve) => {
                const viewer = document.querySelector("model-viewer");

                const checkModelLoaded = () => {
                  if (viewer?.modelIsVisible && viewer?.loaded) {
                    console.log("Model is visible and loaded");
                    resolve(true);
                    return true;
                  }
                  if (viewer?.loaded && viewer?.model) {
                    console.log("Model loaded and available");
                    resolve(true);
                    return true;
                  }
                  return false;
                };

                if (checkModelLoaded()) return;

                console.log("Waiting for model to load...");

                const events = ["load", "model-visibility", "progress"];
                events.forEach((event) => {
                  viewer?.addEventListener(event, () => {
                    console.log(`Model event fired: ${event}`);
                    checkModelLoaded();
                  });
                });

                setTimeout(() => {
                  console.log("Model load timeout, proceeding anyway...");
                  resolve(true);
                }, 30000);
              });
            });

            // Wait for rendering to complete
            await new Promise((resolve) => setTimeout(resolve, 3000));
            
            await page.evaluate(() => {
              document.body.style.cursor = 'none';
            });
            
            console.log("⏳ Waiting for software rendering to settle...");
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Take screenshot
            console.log(`📸 Capturing screenshot (${view.name})...`);
            const screenshotBuffer = await page.screenshot({
              type: "jpeg",
              quality: 90,
              fullPage: false,
            });

            // Save screenshot locally
            const screenshotPath = path.join(outputDir, `view_${view.index + 1}_${view.name}.jpg`);
            fs.writeFileSync(screenshotPath, screenshotBuffer);
            screenshots.push(screenshotPath);

            console.log(`✅ ${view.name} screenshot saved: ${screenshotPath}`);
            logs.push(`✅ ${view.name} screenshot completed: ${screenshotPath}`);

          } catch (error) {
            const errorMsg = `Failed to capture ${view.name} screenshot: ${error.message}`;
            console.error(`❌ ${errorMsg}`);
            console.error(`❌ Full error:`, error);
            logs.push(`❌ ${errorMsg}`);
          }
        }

        console.log(`📊 Screenshot generation summary:`);
        console.log(`   - Attempted: ${views.length} views`);
        console.log(`   - Successful: ${screenshots.length} screenshots`);
        console.log(`   - Failed: ${views.length - screenshots.length} screenshots`);

      } finally {
        await page.close();
      }

      if (screenshots.length === 0) {
        throw new Error("No screenshots were successfully captured");
      }

      console.log(`🎉 GLB processing completed: ${screenshots.length} images generated`);
      logs.push(`GLB processing completed: ${screenshots.length} images generated`);

      let imageUrls = [];
      
      if (dryRun) {
        console.log("🔍 DRY RUN: Skipping upload to storage (screenshots saved locally)");
        logs.push("DRY RUN: Skipping upload to storage");
        console.log(`📁 Screenshots saved to: ${outputDir}`);
        console.log(`   - Total screenshots: ${screenshots.length}`);
        screenshots.forEach((screenshot, idx) => {
          console.log(`   ${idx + 1}. ${screenshot}`);
        });
      } else {
        // Step 5: Upload images to storage
        console.log("📤 Uploading images to storage...");
        logs.push("Uploading images to storage...");
        imageUrls = await this.uploadAllImages(sku, outputDir, clientName);
        logs.push(`Images uploaded: ${imageUrls.length} URLs generated`);

        // Step 6: Clean up local files
        console.log("🧹 Cleaning up local files...");
        logs.push("Cleaning up local files...");
        await this.cleanupFiles(sku, outputDir);
        logs.push("Local files cleaned up");
      }

      return {
        screenshots,
        imageUrls,
        processingLogs: logs,
      };

    } catch (error) {
      const errorMsg = `GLB processing failed: ${error.message}`;
      console.error("❌ FATAL ERROR:", errorMsg);
      logs.push(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  // Close browser and HTTP server
  async closeBrowser() {
    if (this.browser) {
      console.log("🔒 Closing browser...");
      await this.browser.close();
      this.browser = null;
    }
    this.stopHttpServer();
  }
}

// Export singleton instance
export const glbProcessor8Views = new GLBProcessor8Views();


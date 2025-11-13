import puppeteer from "puppeteer-core";

export async function generatePreviewImage(glbUrl: string): Promise<Buffer> {
  // Create a temporary HTML file for rendering
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; }
          canvas { width: 800px; height: 600px; }
        </style>
      </head>
      <body>
        <div id="container"></div>
        <script type="module">
          import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
          import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
          import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

          // Set up scene
          const scene = new THREE.Scene();
          scene.background = new THREE.Color(0xf5f5f5);

          // Set up camera
          const camera = new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 1000);
          camera.position.set(5, 5, 5);

          // Set up renderer
          const renderer = new THREE.WebGLRenderer({ antialias: true });
          renderer.setSize(800, 600);
          renderer.setPixelRatio(window.devicePixelRatio);
          renderer.shadowMap.enabled = true;
          document.getElementById('container').appendChild(renderer.domElement);

          // Add lights
          const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
          scene.add(ambientLight);

          const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
          directionalLight.position.set(5, 5, 5);
          directionalLight.castShadow = true;
          scene.add(directionalLight);

          // Add controls
          const controls = new OrbitControls(camera, renderer.domElement);
          controls.enableDamping = true;
          controls.dampingFactor = 0.05;

          // Load the model
          const loader = new GLTFLoader();
          loader.load('${glbUrl}', (gltf) => {
            const model = gltf.scene;
            
            // Center the model
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
            
            // Scale the model to fit
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 5 / maxDim;
            model.scale.multiplyScalar(scale);
            
            scene.add(model);
            
            // Position camera to view the model
            const distance = 5;
            camera.position.set(distance, distance, distance);
            controls.target.set(0, 0, 0);
            controls.update();
            
            // Render the scene
            renderer.render(scene, camera);
          }, 
          // Progress callback
          (xhr) => {
          },
          // Error callback
          (error) => {
            console.error('Error loading model:', error);
            throw error;
          });

          // Animation loop
          function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
          }
          animate();
        </script>
      </body>
    </html>
  `;

  // Launch headless browser
  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });

    // Enable console logging from the page
    page.on("console", () => {
      // Page console messages are handled silently
    });
    page.on("pageerror", (err) => console.error("Page error:", err));

    await page.setContent(html);

    // Wait for the model to load and render

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Take screenshot

    const screenshot = await page.screenshot({
      type: "png",
      encoding: "binary",
    });

    return screenshot as Buffer;
  } catch (error) {
    console.error("Error in preview generation:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

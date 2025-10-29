import * as THREE from 'https://esm.sh/three@0.180.0';
import CameraControls from 'https://esm.sh/camera-controls@2.8.3?deps=three@0.180.0';
import { GLTFLoader } from 'https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://esm.sh/three@0.180.0/examples/jsm/loaders/DRACOLoader.js';
import { HDRLoader } from 'https://esm.sh/three@0.180.0/examples/jsm/loaders/HDRLoader.js';
import { HorizontalBlurShader } from 'https://esm.sh/three@0.180.0/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'https://esm.sh/three@0.180.0/examples/jsm/shaders/VerticalBlurShader.js';

window.__charpstAR_threeInit = function initThreeViewer(config) {
    if (!config || typeof config.mountId !== 'string' || !config.mountId) {
        console.error('three-viewer: invalid config. Expected { mountId: string, ... }');
        return;
    }
    const mount = document.getElementById(config.mountId);
    if (!mount) {
        console.error('three-viewer: mount element not found for id:', config.mountId);
        return;
    }

    const scene = new THREE.Scene();
    // Group to hold multiple modules added via configurator
    const modulesGroup = new THREE.Group();
    modulesGroup.name = 'charpstAR_modulesGroup';
    scene.add(modulesGroup);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Tolerate empty mounts by ensuring a visible minimum
    if (!mount.clientHeight) {
        if (!mount.style.minHeight) mount.style.minHeight = '320px';
    }
    renderer.setSize(Math.max(1, mount.clientWidth), Math.max(1, mount.clientHeight));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    // Ensure canvas fills parent
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    // model-viewer-like cursor UX
    renderer.domElement.style.cursor = 'grab';
    // Ensure we can position overlays inside the mount
    if (getComputedStyle(mount).position === 'static') {
        mount.style.position = 'relative';
    }

    // Cursor interaction handlers (grab/grabbing)
    const onCursorPointerEnter = () => { renderer.domElement.style.cursor = 'grab'; };
    const onCursorPointerLeave = () => { renderer.domElement.style.cursor = 'default'; };
    const onCursorPointerDown = (e) => {
        // respond for rotate (left), pan (right), middle as well
        if (e && (e.button === 0 || e.button === 1 || e.button === 2)) {
            renderer.domElement.style.cursor = 'grabbing';
        }
    };
    const onCursorPointerUp = () => { renderer.domElement.style.cursor = 'grab'; };
    const onCursorTouchStart = () => { renderer.domElement.style.cursor = 'grabbing'; };
    const onCursorTouchEnd = () => { renderer.domElement.style.cursor = 'grab'; };
    renderer.domElement.addEventListener('pointerenter', onCursorPointerEnter);
    renderer.domElement.addEventListener('pointerleave', onCursorPointerLeave);
    renderer.domElement.addEventListener('pointerdown', onCursorPointerDown);
    window.addEventListener('pointerup', onCursorPointerUp);
    renderer.domElement.addEventListener('touchstart', onCursorTouchStart, { passive: true });
    window.addEventListener('touchend', onCursorTouchEnd, { passive: true });

    // Progress bar overlay (lazy-created when loading starts)
    let progressTrack = null;
    let progressBar = null;
    // Selection state and toolbar
    let currentSelectedRoot = null;
    let toolbarEl = null;
    let btnRotateL = null;
    let btnRotateR = null;
    let btnDelete = null;
    let btnCenter = null;
    let btnDimensions = null;

    // Centralized tunables (can be overridden via config)
    let cfg = {
        defaultOrbit: { thetaDeg: 0, phiDeg: 75 },
        framePadding: 3.5,              // fallback multiplier if initialScreenFraction is not used
        initialScreenFraction: 1,     // target fraction of viewport the model should occupy on load
        boundaryExpandFactor: 3.0,      // how far panning bounds extend from model box
        shadowYOffset: -0.002,          // contact shadow plane offset below model
        shadow: { blur: 4, darkness: 0.9, opacity: 0.3, units: 'pixels', crop: 0.0 },
        minScreenFraction: 0.5,         // model covers at least half viewport width when zoomed out
        dollySpeed: 0.75,               // zoom speed
        envHdrUrl: 'https://cdn.charpstar.net/Demos/warm.hdr',
        toneMapping: 'ACESFilmic',      // None|Linear|Reinhard|Cineon|ACESFilmic
        toneMappingExposure: 1.0,
        backgroundColor: '#ffffff',
        backgroundTransparent: false,
        // Optional camera angle limits (degrees)
        minPolarDeg: null,
        maxPolarDeg: 88,
        minAzimuthDeg: null,
        maxAzimuthDeg: null,
        enablePan: true,                // right-click pan
        // Simple object-space outline overlay (no post processing)
        outline: { enabled: true, color: '#2b8cff', thickness: 0.01 },
        // Drag & collision
        drag: {
            gridSize: 0.01,
            collisionBuffer: 0.003,
            adjustmentStep: 0.01,
            maxAdjustmentSteps: 32,
            edgeSnapTolerance: 0.04
        },
        // Camera refit thresholds
        cameraRefit: {
            deltaRadiusFrac: 0.5,        // require >=50% zoom delta
            centerShiftFrac: 0.6,        // require center shift >= 60% of radius
            minCenterShift: 0.05         // at least 5cm
        },
        // Shadow tuning
        shadowPlaneFactor: 1.6,
        shadowResizeEps: 1e-3,
        // Collider
        colliderOpacity: 0.0,
        // Dimensions overlay
        dimensions: {
            enabled: true,
            color: '#aaaaaa',
            textColor: '#000000',
            lineWidth: 1,
            font: '500 12px system-ui, sans-serif',
            offset: 0.02,
            labelPx: 14,
        }
    };
    // Apply user overrides if provided directly on config
    if (config) {
        const overridable = [
            'defaultOrbit','framePadding','initialScreenFraction','boundaryExpandFactor','shadowYOffset','shadow','minScreenFraction','dollySpeed','envHdrUrl','toneMapping','toneMappingExposure','backgroundColor','backgroundTransparent','minPolarDeg','maxPolarDeg','minAzimuthDeg','maxAzimuthDeg','enablePan','outline','drag','cameraRefit','shadowPlaneFactor','shadowResizeEps','colliderOpacity'
        ];
        for (const k of overridable) {
            if (Object.prototype.hasOwnProperty.call(config, k)) cfg[k] = config[k];
        }
    }

    // Apply background and tone mapping based on cfg
    if (cfg.backgroundTransparent) {
        renderer.getContext().canvas.style.background = 'transparent';
        renderer.setClearAlpha(0);
        scene.background = null;
    } else {
    scene.background = new THREE.Color(cfg.backgroundColor);
        renderer.setClearAlpha(1);
    }
    const toneMapMap = {
        None: THREE.NoToneMapping,
        Linear: THREE.LinearToneMapping,
        Reinhard: THREE.ReinhardToneMapping,
        Cineon: THREE.CineonToneMapping,
        ACESFilmic: THREE.ACESFilmicToneMapping
    };
    renderer.toneMapping = toneMapMap[cfg.toneMapping] ?? THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cfg.toneMappingExposure;
    // Event helper
    function dispatchEvent(name, detail) {
        try { mount.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true })); } catch (_) {}
    }

    const camera = new THREE.PerspectiveCamera(30, mount.clientWidth / mount.clientHeight, 0.01, 1000);
    camera.position.set(0, 0.5, 1.5);
    const clock = new THREE.Clock();
    CameraControls.install({ THREE });
    const controls = new CameraControls(camera, renderer.domElement);
    controls.smoothTime = 0.15;         // overall smoothing
    controls.draggingSmoothTime = 0.08; // while dragging
    controls.azimuthRotateSpeed = 0.55; // rotation feel similar to drei
    controls.polarRotateSpeed = 0.45;
    controls.dollySpeed = cfg.dollySpeed; // zoom speed
    controls.dollyToCursor = false;     // zoom centered (model-viewer style)
    // Enable/disable panning (trucking) on right mouse
    controls.truckSpeed = cfg.enablePan ? 0.9 : 0.0;
    controls.mouseButtons.left = CameraControls.ACTION.ROTATE;
    controls.mouseButtons.right = cfg.enablePan ? CameraControls.ACTION.TRUCK : CameraControls.ACTION.NONE;
    controls.mouseButtons.middle = CameraControls.ACTION.DOLLY;

    // Environment HDR
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    let forceFrames = 0; // render a few extra frames when new assets load
    let shadowDirty = true; // recompute contact shadow only when scene changes
    let envLoaded = false;
    let errorOverlay = null;
    let errorRetryButton = null;
    function ensureErrorOverlay() {
        if (!errorOverlay) {
            errorOverlay = document.createElement('div');
            errorOverlay.dataset.role = 'error-overlay';
            errorOverlay.style.position = 'absolute';
            errorOverlay.style.inset = '0';
            errorOverlay.style.background = 'rgba(255,255,255,0.9)';
            errorOverlay.style.display = 'flex';
            errorOverlay.style.alignItems = 'center';
            errorOverlay.style.justifyContent = 'center';
            errorOverlay.style.flexDirection = 'column';
            errorOverlay.style.gap = '12px';
            errorOverlay.style.fontFamily = 'system-ui, sans-serif';
            errorOverlay.style.textAlign = 'center';
            const msg = document.createElement('div');
            msg.dataset.role = 'error-message';
            msg.style.color = '#111';
            errorOverlay.appendChild(msg);
            errorRetryButton = document.createElement('button');
            errorRetryButton.textContent = 'Retry';
            errorRetryButton.style.padding = '8px 14px';
            errorRetryButton.style.border = '1px solid #333';
            errorRetryButton.style.background = '#fff';
            errorRetryButton.style.cursor = 'pointer';
            errorOverlay.appendChild(errorRetryButton);
            mount.appendChild(errorOverlay);
        }
        return errorOverlay;
    }
    function showError(message, retry) {
        const overlay = ensureErrorOverlay();
        const msg = overlay.querySelector('[data-role="error-message"]');
        if (msg) msg.textContent = message || 'Failed to load resources';
        if (errorRetryButton) {
            const handler = () => { hideError(); retry && retry(); };
            errorRetryButton.onclick = handler;
        }
        overlay.style.display = 'flex';
    }
    function hideError() {
        if (errorOverlay) errorOverlay.style.display = 'none';
    }
    // Ready overlay helpers
    function showReadyOverlay() {
        let ready = mount.querySelector('[data-role="ready-overlay"]');
        if (ready) return ready;
        ready = document.createElement('div');
        ready.dataset.role = 'ready-overlay';
        ready.textContent = 'Ready to configure';
        ready.style.position = 'absolute';
        ready.style.left = '50%';
        ready.style.top = '50%';
        ready.style.transform = 'translate(-50%, -50%)';
        ready.style.color = '#111';
        ready.style.font = '500 14px system-ui, sans-serif';
        ready.style.padding = '8px 10px';
        ready.style.background = 'rgba(255,255,255,0.8)';
        ready.style.border = '1px solid #e0e0e0';
        ready.style.borderRadius = '6px';
        ready.style.pointerEvents = 'none';
        mount.appendChild(ready);
        return ready;
    }
    function hideReadyOverlay() {
        const ro = mount.querySelector('[data-role="ready-overlay"]');
        if (ro) ro.remove();
    }
    function loadEnvironment() {
    new HDRLoader()
        .setCrossOrigin('anonymous')
        .load(cfg.envHdrUrl, (hdrTexture) => {
            const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
            scene.environment = envMap;
            hdrTexture.dispose();
            pmremGenerator.dispose();
                envLoaded = true;
                forceFrames += 2;
                hideError();
                dispatchEvent('environment-loaded', { url: cfg.envHdrUrl });
            }, undefined, (e) => {
                console.error('HDR load failed', e);
                showError('Failed to load lighting environment.', () => loadEnvironment());
            });
    }
    loadEnvironment();
    // Fire viewer-ready after initial wiring (canvas present and controls attached)
    try { mount.__charpstAR_ready = true; } catch (_) {}
    try { dispatchEvent('viewer-ready', { mountId: config.mountId }); } catch (_) {}

    const state = {
        shadow: { ...cfg.shadow },
        plane: { color: '#ffffff', opacity: 0.0 },
        outline: { enabled: !!(cfg.outline && cfg.outline.enabled), color: (cfg.outline && cfg.outline.color) || '#2b8cff', thickness: (cfg.outline && cfg.outline.thickness) || 0.03 }
    };
    let shadowGroup, renderTarget, renderTargetBlur, shadowCamera, depthMaterial, horizontalBlurMaterial, verticalBlurMaterial, plane, blurPlane, fillPlane;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    // Colliders for reliable picking (invisible boxes per module)
    const moduleColliders = new Map(); // root -> collider mesh
    const colliderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: cfg.colliderOpacity, depthWrite: false, depthTest: false, toneMapped: false });
    // Dimensions
    const dimensionsGroup = new THREE.Group();
    dimensionsGroup.name = 'charpstAR_dimensionsGroup';
    scene.add(dimensionsGroup);
    const outlineMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(state.outline.color), side: THREE.BackSide });
    outlineMaterial.depthTest = true; // keep depth-tested silhouette
    outlineMaterial.depthWrite = false;
    let outlined = new Set();
    function getModuleRoot(obj) {
        let curr = obj;
        while (curr && curr.parent && curr.parent !== modulesGroup) curr = curr.parent;
        return curr;
    }
    function addOutlineForModule(root) {
        if (!root) return;
        root.traverse((child) => { if (child.isMesh) addOutlineForMesh(child); });
    }

    function updateToolbarState() {
        if (!toolbarEl) return;
        const disabled = !currentSelectedRoot;
        const hasModules = modulesGroup && modulesGroup.children && modulesGroup.children.length > 0;
        if (btnRotateL) {
            btnRotateL.disabled = disabled;
            btnRotateL.style.opacity = disabled ? '0.4' : '1.0';
            btnRotateL.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }
        if (btnRotateR) {
            btnRotateR.disabled = disabled;
            btnRotateR.style.opacity = disabled ? '0.4' : '1.0';
            btnRotateR.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }
        if (btnDelete) {
            btnDelete.disabled = disabled;
            btnDelete.style.opacity = disabled ? '0.4' : '1.0';
            btnDelete.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }
        // Center and Dimensions are always available (not dependent on hasModules)
        if (btnCenter) {
            btnCenter.disabled = false;
            btnCenter.style.opacity = '1.0';
            btnCenter.style.cursor = 'pointer';
        }
        if (btnDimensions) {
            btnDimensions.disabled = false;
            btnDimensions.style.opacity = '1.0';
            btnDimensions.style.cursor = 'pointer';
            // Update active state
            btnDimensions.dataset.active = (cfg.dimensions && cfg.dimensions.enabled) ? 'true' : 'false';
            if (cfg.dimensions && cfg.dimensions.enabled) {
                btnDimensions.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            } else {
                btnDimensions.style.backgroundColor = 'transparent';
            }
        }
    }

    function setCurrentSelection(root) {
        currentSelectedRoot = root || null;
        updateToolbarState();
    }

    function rotateSelected(deltaDeg) {
        if (!currentSelectedRoot) return;
        // update rotation around Y
        const currDeg = THREE.MathUtils.radToDeg(currentSelectedRoot.rotation.y);
        let currQ = Math.round(currDeg / 90) * 90;
        // wrap logic: if at -270 and rotating left, or at 270 and rotating right, snap to 0
        if (currQ === -270 && deltaDeg < 0) {
            currQ = 0;
        } else if (currQ === 270 && deltaDeg > 0) {
            currQ = 0;
        } else {
            currQ = currQ + deltaDeg;
            if (currQ >= 360 || currQ <= -360) currQ = 0;
        }
        currentSelectedRoot.rotation.y = THREE.MathUtils.degToRad(currQ);
        // refresh collider/shadow and frame if needed
        ensureModuleCollider(currentSelectedRoot);
        ensureShadowForObject(modulesGroup, true);
        // Rebuild dimensions to reflect new oriented bounds
        updateDimensions();
        forceFrames += 2;
    }

    function createIconButton(svgContent, title) {
        const btn = document.createElement('button');
        btn.innerHTML = svgContent;
        btn.title = title;
        btn.style.padding = '10px';
        btn.style.border = 'none';
        btn.style.background = 'transparent';
        btn.style.borderRadius = '8px';
        btn.style.cursor = 'pointer';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.transition = 'all 0.2s ease';
        btn.addEventListener('mouseenter', () => { 
            if (!btn.disabled) {
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                btn.style.transform = 'scale(1.05)';
            }
        });
        btn.addEventListener('mouseleave', () => { 
            if (!btn.disabled) {
                btn.style.backgroundColor = btn.dataset.active === 'true' ? 'rgba(255, 255, 255, 0.2)' : 'transparent';
                btn.style.transform = 'scale(1)';
            }
        });
        return btn;
    }

    function ensureToolbar() {
        if (toolbarEl) return;
        toolbarEl = document.createElement('div');
        toolbarEl.dataset.role = 'toolbar';
        toolbarEl.style.position = 'absolute';
        toolbarEl.style.left = '50%';
        toolbarEl.style.bottom = '20px';
        toolbarEl.style.transform = 'translateX(-50%)';
        toolbarEl.style.display = 'flex';
        toolbarEl.style.gap = '4px';
        toolbarEl.style.padding = '8px';
        toolbarEl.style.background = 'rgba(0, 0, 0, 0.85)';
        toolbarEl.style.backdropFilter = 'blur(8px)';
        toolbarEl.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        toolbarEl.style.borderRadius = '12px';
        toolbarEl.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
        toolbarEl.style.zIndex = '5';
        
        // Delete icon (white)
        btnDelete = createIconButton(`<svg width="20" height="20" viewBox="0 0 448 512"><path fill="#ffffff" d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg>`, 'Delete');
        
        // Rotate left icon (white)
        btnRotateL = createIconButton(`<svg width="20" height="20" viewBox="0 0 512 512"><path fill="#ffffff" d="M161.459 392c0 56.3-34.8 88.4-86.1 88.4-14.399 0-35.5-4.1-47.3-11.8l16.6-32.7c9.2 6.5 19.4 8.3 29.8 8.3 22.8 0 38.1-12.9 40.6-37.4-9 7.6-21 11.8-36.2 11.8-30.4 0-55.6-20.1-55.6-51s28.1-55.1 63.2-55.1 75 27.2 75 79.6h0v-.1h0ZM112.059 365.2c0-12-8.8-20.3-22.6-20.3s-21.9 7.8-21.9 20.6 9 20.3 22.1 20.3 22.4-8.3 22.4-20.6Z"></path><path fill="#ffffff" d="M177.059 396.4c0-53.3 30-84 71.3-84s71.1 30.7 71.1 84-30 84-71.1 84-71.3-30.7-71.3-84ZM273.459 396.4c0-33.9-10.6-46.6-25.2-46.6s-25.4 12.7-25.4 46.6 10.6 46.6 25.4 46.6 25.2-12.7 25.2-46.6Z"></path><circle fill="#ffffff" cx="331.759" cy="304.2" r="27.3"></circle><path fill="#ffffff" d="M460.759 364.4c47.3-85.5 34.8-195.1-37.8-267.7-87.4-87.5-229-87.8-316.9-1l-41.7-41.7c-6.9-6.9-17.3-8.9-26.3-5.2s-14.8 12.6-14.8 22.3v128.4c0 13.4 10.8 24.1 24.1 24.1h128.4c9.8 0 18.6-5.8 22.3-14.8 3.7-9 1.7-19.4-5.2-26.3l-41.2-41.3c62.8-61.7 163.7-61.4 226.1 1 51.6 51.5 60 129 26.9 189.9l-.3.5c-8.5 15.6-1.7 35.1 13.9 43.5 15.1 8.2 33.6 2.8 42.5-11.7Z"></path></svg>`, 'Rotate Left');
        
        // Rotate right icon (white)
        btnRotateR = createIconButton(`<svg width="20" height="20" viewBox="0 0 512 512"><path fill="#ffffff" d="M93.8 376.1c15.6-8.4 22.4-27.9 13.9-43.5l-.3-.5c-33.1-60.9-24.7-138.4 26.9-189.9 62.4-62.4 163.3-62.7 226.1-1l-41.2 41.3c-6.9 6.9-8.9 17.3-5.2 26.3 3.7 9 12.5 14.8 22.3 14.8h128.4c13.3 0 24.1-10.7 24.1-24.1V71.1c0-9.7-5.8-18.6-14.8-22.3-9-3.7-19.4-1.7-26.3 5.2l-41.7 41.7c-87.9-86.8-229.5-86.5-316.9 1C16.5 169.3 4 278.9 51.3 364.4c8.9 14.5 27.4 19.9 42.5 11.7Z"></path><path fill="#ffffff" d="M291.2 392c0 56.3-34.8 88.4-86.1 88.4s-35.5-4.1-47.3-11.8l16.6-32.7c9.2 6.5 19.4 8.3 29.8 8.3 22.8 0 38.1-12.9 40.6-37.4-9 7.6-21 11.8-36.2 11.8-30.4 0-55.6-20.1-55.6-51s28.1-55.1 63.2-55.1 75 27.2 75 79.6ZM241.8 365.2c0-12-8.8-20.3-22.6-20.3s-21.9 7.8-21.9 20.6 9 20.3 22.1 20.3 22.4-8.3 22.4-20.6Z"></path><path fill="#ffffff" d="M306.8 396.4c0-53.3 30-84 71.3-84s71.1 30.7 71.1 84-30 84-71.1 84-71.3-30.7-71.3-84ZM403.2 396.4c0-33.9-10.6-46.6-25.2-46.6s-25.4 12.7-25.4 46.6 10.6 46.6 25.4 46.6 25.2-12.7 25.2-46.6Z"></path><circle fill="#ffffff" cx="461.5" cy="304.2" r="27.3"></circle></svg>`, 'Rotate Right');
        
        // Dimensions icon (white)
        btnDimensions = createIconButton(`<svg width="20" height="20" viewBox="0 0 512 512"><path fill="#ffffff" d="M.2 468.9C2.7 493.1 23.1 512 48 512l96 0 320 0c26.5 0 48-21.5 48-48l0-96c0-26.5-21.5-48-48-48l-48 0 0 80c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-80-64 0 0 80c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-80-64 0 0 80c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-80-80 0c-8.8 0-16-7.2-16-16s7.2-16 16-16l80 0 0-64-80 0c-8.8 0-16-7.2-16-16s7.2-16 16-16l80 0 0-64-80 0c-8.8 0-16-7.2-16-16s7.2-16 16-16l80 0 0-48c0-26.5-21.5-48-48-48L48 0C21.5 0 0 21.5 0 48L0 368l0 96c0 1.7 .1 3.3 .2 4.9z"></path></svg>`, 'Toggle Dimensions');
        
        // Center icon (white)
        btnCenter = createIconButton(`<svg width="20" height="20" viewBox="0 0 512 512"><path fill="#ffffff" d="M256 0c17.7 0 32 14.3 32 32l0 34.7C368.4 80.1 431.9 143.6 445.3 224l34.7 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-34.7 0C431.9 368.4 368.4 431.9 288 445.3l0 34.7c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-34.7C143.6 431.9 80.1 368.4 66.7 288L32 288c-17.7 0-32-14.3-32-32s14.3-32 32-32l34.7 0C80.1 143.6 143.6 80.1 224 66.7L224 32c0-17.7 14.3-32 32-32zM128 256a128 128 0 1 0 256 0 128 128 0 1 0 -256 0zm128-80a80 80 0 1 1 0 160 80 80 0 1 1 0-160z"></path></svg>`, 'Center View');
        
        btnRotateL.addEventListener('click', () => rotateSelected(-90));
        btnRotateR.addEventListener('click', () => rotateSelected(90));
        btnCenter.addEventListener('click', () => frameAll());
        btnDelete.addEventListener('click', () => deleteSelected());
        btnDimensions.addEventListener('click', () => {
            cfg.dimensions.enabled = !cfg.dimensions.enabled;
            if (!cfg.dimensions.enabled) {
                clearDimensions();
            } else {
                updateDimensions();
            }
            updateToolbarState();
            forceFrames += 2;
        });
        
        toolbarEl.appendChild(btnDelete);
        toolbarEl.appendChild(btnRotateL);
        toolbarEl.appendChild(btnRotateR);
        toolbarEl.appendChild(btnDimensions);
        toolbarEl.appendChild(btnCenter);
        mount.appendChild(toolbarEl);
        updateToolbarState();
    }

    function frameAll() {
        if (!modulesGroup || !modulesGroup.children || modulesGroup.children.length === 0) return;
        const box = computeBoundsExcludingHelpers(modulesGroup);
        if (box.isEmpty()) return;
        const center = box.getCenter(new THREE.Vector3());
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
        const frac = cfg.initialScreenFraction ?? 0.5;
        const distYTarget = sphere.radius / (frac * Math.sin(vFov / 2));
        const distXTarget = sphere.radius / (frac * Math.sin(hFov / 2));
        const fitDistance = Math.max(distXTarget, distYTarget);
        const currPos = new THREE.Vector3();
        const currTgt = new THREE.Vector3();
        controls.getPosition(currPos);
        controls.getTarget(currTgt);
        const sph = new THREE.Spherical().setFromVector3(new THREE.Vector3().subVectors(currPos, currTgt));
        const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(fitDistance, sph.phi, sph.theta)).add(center);
        controls.setLookAt(pos.x, pos.y, pos.z, center.x, center.y, center.z, true);
        updateDistanceLimits();
        forceFrames += 2;
        updateDimensions();
    }

    function deleteSelected() {
        if (!currentSelectedRoot) return;
        const root = currentSelectedRoot;
        // capture reference center before removal
        const rootBox = computeBoundsExcludingHelpers(root);
        const refCenter = rootBox.getCenter(new THREE.Vector3());
        // remove colliders map entry
        const col = moduleColliders.get(root);
        if (col) { try { col.geometry.dispose(); } catch(_){} moduleColliders.delete(root); }
        // remove from scene and dispose
        modulesGroup.remove(root);
        root.traverse((o) => {
            if (o.geometry) { try { o.geometry.dispose(); } catch(_){} }
            if (o.material) {
                if (Array.isArray(o.material)) o.material.forEach(m => { try { m.dispose(); } catch(_){} });
                else { try { o.material.dispose(); } catch(_){} }
            }
        });
        // clear selection/outlines
        outlined.forEach(removeOutlineForMesh);
        outlined.clear();
        setCurrentSelection(null);

        // auto-select the closest remaining module by center distance
        let nearest = null;
        let nearestDist = Infinity;
        modulesGroup.children.forEach((other) => {
            const ob = computeBoundsExcludingHelpers(other);
            if (ob.isEmpty()) return;
            const oc = ob.getCenter(new THREE.Vector3());
            const d = oc.distanceTo(refCenter);
            if (d < nearestDist) { nearestDist = d; nearest = other; }
        });
        if (nearest) {
            addOutlineForModule(nearest);
            setCurrentSelection(nearest);
            updateOutlineThickness();
            ensureModuleCollider(nearest);
        }
        // update shadows/camera for remaining modules
        ensureShadowForObject(modulesGroup, true);
        // always rebuild dimensions after deletion regardless of camera refit thresholds
        updateDimensions();
        // If scene is empty, show Ready overlay again
        if (!modulesGroup.children || modulesGroup.children.length === 0) {
            const ro = mount.querySelector('[data-role="ready-overlay"]') || (function(){
                const r = document.createElement('div');
                r.dataset.role = 'ready-overlay';
                r.textContent = 'Ready to configure';
                r.style.position = 'absolute';
                r.style.left = '50%';
                r.style.top = '50%';
                r.style.transform = 'translate(-50%, -50%)';
                r.style.color = '#111';
                r.style.font = '500 14px system-ui, sans-serif';
                r.style.padding = '8px 10px';
                r.style.background = 'rgba(255,255,255,0.8)';
                r.style.border = '1px solid #e0e0e0';
                r.style.borderRadius = '6px';
                r.style.pointerEvents = 'none';
                mount.appendChild(r);
                return r;
            })();
        }
        forceFrames += 2;
    }
    function addOutlineForMesh(mesh) {
        if (!state.outline.enabled || !mesh || !mesh.isMesh) return;
        if (mesh.name === '__outline' || mesh.userData.__isOutline) return;
        if (mesh.name === '__collider' || mesh.userData.__isCollider) return;
        if (outlined.has(mesh)) return;
        const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
        outline.matrixAutoUpdate = true;
        outline.name = '__outline';
        outline.userData.__isOutline = true;
        outline.scale.setScalar(1 + (state.outline.thickness || 0.03));
        mesh.add(outline);
        outlined.add(mesh);
    }
    function removeOutlineForMesh(mesh) {
        if (!mesh || !mesh.isMesh) return;
        const child = mesh.getObjectByName('__outline');
        if (child) mesh.remove(child);
        outlined.delete(mesh);
    }
    function updateOutlineThickness() {
        const scale = 1 + (state.outline.thickness || 0.03);
        outlined.forEach((mesh) => {
            const outline = mesh.getObjectByName('__outline');
            if (outline) outline.scale.setScalar(scale);
        });
    }
    function computeBoundsExcludingHelpers(object) {
        const box = new THREE.Box3();
        box.makeEmpty();
        object.updateMatrixWorld(true);
        object.traverse((o) => {
            if (!o.isMesh) return;
            if (o.name === '__collider' || o.name === '__outline' || o.userData.__isOutline || o.userData.__isCollider) return;
            const geo = o.geometry;
            if (!geo) return;
            if (!geo.boundingBox) geo.computeBoundingBox();
            const bb = geo.boundingBox.clone();
            bb.applyMatrix4(o.matrixWorld);
            box.expandByPoint(bb.min);
            box.expandByPoint(bb.max);
        });
        return box;
    }

    // ===== Dimensions overlay =====
    function clearDimensions() {
        if (!dimensionsGroup) return;
        while (dimensionsGroup.children.length) {
            const ch = dimensionsGroup.children.pop();
            dimensionsGroup.remove(ch);
            if (ch.material && ch.material.map && ch.material.map.dispose) { try { ch.material.map.dispose(); } catch(_){} }
            if (ch.material && ch.material.dispose) { try { ch.material.dispose(); } catch(_){} }
            if (ch.geometry && ch.geometry.dispose) { try { ch.geometry.dispose(); } catch(_){} }
        }
    }
    function makeLine(a, b, color) {
        const g = new THREE.BufferGeometry().setFromPoints([a, b]);
        const m = new THREE.LineBasicMaterial({ color, linewidth: cfg.dimensions.lineWidth });
        const line = new THREE.Line(g, m);
        line.renderOrder = 10;
        return line;
    }
    function makeThickLine(a, b, color, thickness) {
        const direction = new THREE.Vector3().subVectors(b, a);
        const length = Math.max(1e-6, direction.length());
        const midPoint = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
        const geometry = new THREE.BoxGeometry(length, thickness, thickness);
        const material = new THREE.MeshBasicMaterial({ color, depthTest: true, depthWrite: true });
        const mesh = new THREE.Mesh(geometry, material);
        // Orient box along the line from a to b (box X-axis aligns to direction)
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
        mesh.quaternion.copy(quaternion);
        mesh.position.copy(midPoint);
        mesh.renderOrder = 9;
        return mesh;
    }
    function makeLabel(text, position, scaleWorld) {
        const padX = 6, padY = 3;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const px = (cfg.dimensions && cfg.dimensions.labelPx) || 14;
        const font = cfg.dimensions && cfg.dimensions.font ? cfg.dimensions.font : '500 12px system-ui, sans-serif';
        ctx.font = font.replace(/\d+px/, px + 'px');
        const metrics = ctx.measureText(text);
        const hPx = px + 2;
        const w = Math.ceil(metrics.width) + padX * 2;
        const h = hPx + padY * 2;
        // Render at 2x resolution for crisp quality
        const dpr = 2;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        ctx.font = font.replace(/\d+px/, px + 'px');
        // Rounded background
        ctx.clearRect(0,0,w,h);
        ctx.fillStyle = '#faf8f3';
        const radius = 4;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(w - radius, 0);
        ctx.quadraticCurveTo(w, 0, w, radius);
        ctx.lineTo(w, h - radius);
        ctx.quadraticCurveTo(w, h, w - radius, h);
        ctx.lineTo(radius, h);
        ctx.quadraticCurveTo(0, h, 0, h - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.fill();
        // Text
        ctx.fillStyle = cfg.dimensions.textColor;
        ctx.textBaseline = 'middle';
        ctx.fillText(text, padX, h / 2);
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
        const spr = new THREE.Sprite(mat);
        spr.position.copy(position);
        const s = scaleWorld;
        spr.scale.set(w * s, h * s, 1);
        spr.renderOrder = 10;
        spr.userData.__isDimLabel = true;
        return spr;
    }
    function rescaleDimensions() {
        if (!dimensionsGroup || !modulesGroup || modulesGroup.children.length === 0) return;
        const box = computeBoundsExcludingHelpers(modulesGroup);
        if (!box || box.isEmpty()) return;
        const center = box.getCenter(new THREE.Vector3());
        
        // Calculate screen-space constant scale based on camera distance
        const camDist = camera.position.distanceTo(center);
        const fov = camera.fov * (Math.PI / 180);
        const worldHeight = 2 * Math.tan(fov / 2) * camDist;
        const pixelsPerWorldUnit = mount.clientHeight / worldHeight;
        
        // Constant line thickness (1.5 pixels in screen space)
        const lineThickness = 1.5 / pixelsPerWorldUnit;
        
        // Constant label scale (50% smaller, based on 11px font)
        const labelScale = 0.5 / pixelsPerWorldUnit;
        
        // Update all dimension children
        dimensionsGroup.children.forEach(child => {
            if (child.isMesh && child.geometry.type === 'BoxGeometry') {
                // This is a thick line - update its thickness (Y and Z scale)
                const params = child.geometry.parameters;
                const length = params.width; // original length along X
                child.scale.set(1, lineThickness / params.height, lineThickness / params.depth);
            } else if (child.isSprite && child.userData.__isDimLabel) {
                // This is a label
                const map = child.material.map;
                if (map && map.image) {
                    child.scale.set(map.image.width * labelScale, map.image.height * labelScale, 1);
                }
            }
        });
    }

    function updateDimensions() {
        if (!cfg.dimensions || !cfg.dimensions.enabled) { clearDimensions(); return; }
        if (!modulesGroup || !modulesGroup.children || modulesGroup.children.length === 0) { clearDimensions(); return; }
        const box = computeBoundsExcludingHelpers(modulesGroup);
        if (!box || box.isEmpty()) { clearDimensions(); return; }
        clearDimensions();
        const color = new THREE.Color(cfg.dimensions.color);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const labelScale = Math.max(0.0015, Math.min(0.008, maxDim * 0.008));
        const pad = Math.max(0.01, (cfg.dimensions.offset || 0.02));
        const yTop = box.max.y + pad;            // width line above scene
        const yBottom = box.min.y;               // depth line at ground
        const xLeftPad = box.min.x - pad;        // left with padding
        const zFrontPad = box.max.z + pad;       // front with padding
        const zBackPad = box.min.z - pad;        // back with padding
        const lineThickness = Math.max(0.0025, maxDim * 0.0035);

        // X width line (top-left back corner), along +X at the back
        const ax = new THREE.Vector3(xLeftPad, yTop, zBackPad);
        const bx = new THREE.Vector3(box.max.x, yTop, zBackPad);
        const lx = makeThickLine(ax, bx, color, lineThickness);
        const labX = makeLabel(`${Math.round(size.x * 1000)} mm`, new THREE.Vector3((ax.x + bx.x) * 0.5, yTop + pad * 0.5, zBackPad), labelScale);
        dimensionsGroup.add(lx, labX);
        // Z depth line (bottom-left corner), along +Z
        const az = new THREE.Vector3(xLeftPad, yBottom, box.min.z);
        const bz = new THREE.Vector3(xLeftPad, yBottom, box.max.z);
        const lz = makeThickLine(az, bz, color, lineThickness);
        const labZ = makeLabel(`${Math.round(size.z * 1000)} mm`, new THREE.Vector3(xLeftPad, yBottom + pad * 0.5, (az.z + bz.z) * 0.5), labelScale);
        dimensionsGroup.add(lz, labZ);
        // Y height line (top-left back corner), along -Y from top at the back
        const ay = new THREE.Vector3(xLeftPad, yTop, zBackPad);
        const by = new THREE.Vector3(xLeftPad, box.min.y, zBackPad);
        const ly = makeThickLine(ay, by, color, lineThickness);
        const labY = makeLabel(`${Math.round(size.y * 1000)} mm`, new THREE.Vector3(xLeftPad - pad * 0.5, (ay.y + by.y) * 0.5, zBackPad), labelScale);
        dimensionsGroup.add(ly, labY);
    }
    function ensureModuleCollider(root) {
        if (!root) return;
        const box = computeBoundsExcludingHelpers(root);
        if (!isFinite(box.max.x - box.min.x)) return;
        const size = box.getSize(new THREE.Vector3());
        const centerWorld = box.getCenter(new THREE.Vector3());
        const centerLocal = root.worldToLocal(centerWorld.clone());
        let collider = moduleColliders.get(root);
        if (!collider) {
            const geom = new THREE.BoxGeometry(Math.max(1e-4, size.x), Math.max(1e-4, size.y), Math.max(1e-4, size.z));
            collider = new THREE.Mesh(geom, colliderMaterial);
            collider.name = '__collider';
            collider.userData.moduleRoot = root;
            collider.userData.__isCollider = true;
            root.add(collider);
            moduleColliders.set(root, collider);
        } else {
            try { collider.geometry.dispose(); } catch (_) {}
            collider.geometry = new THREE.BoxGeometry(Math.max(1e-4, size.x), Math.max(1e-4, size.y), Math.max(1e-4, size.z));
        }
        collider.position.copy(centerLocal);
        collider.updateMatrixWorld(true);
    }
    let modelRoot = null;
    const homePos = new THREE.Vector3();
    const homeTgt = new THREE.Vector3();
    let boundingRadius = 0;
    // Default orbit similar to model-viewer: theta=0deg (front), phi=75deg (slightly above)
    const DEFAULT_ORBIT = cfg.defaultOrbit;

    function updateDistanceLimits() {
        if (!boundingRadius) return;
        const fovy = camera.fov * Math.PI / 180;
        const fovx = 2 * Math.atan(Math.tan(fovy / 2) * camera.aspect);
        const minDistance = Math.max(0.001, boundingRadius * 1.02);
        const maxDistanceByWidth = (boundingRadius / (cfg.minScreenFraction * Math.tan(fovx / 2)));
        const maxDistance = Math.max(minDistance * 2, maxDistanceByWidth);
        controls.minDistance = minDistance;
        controls.maxDistance = maxDistance;
    }

    // Load GLB/GLTF model (optional at init)
    const loader = new GLTFLoader();
    // DRACO support
    const draco = new DRACOLoader();
    draco.setDecoderConfig({ type: 'js' });
    draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    loader.setDRACOLoader(draco);
    loader.setCrossOrigin('anonymous');
    let backgroundPointerDown = null;
    function loadModel() {
        // Ensure progress bar exists for this load
        if (!progressTrack) {
            progressTrack = document.createElement('div');
            progressTrack.dataset.role = 'progress-track';
            progressTrack.style.position = 'absolute';
            progressTrack.style.left = '50%';
            progressTrack.style.top = '50%';
            progressTrack.style.transform = 'translate(-50%, -50%)';
            progressTrack.style.width = '40%';
            progressTrack.style.maxWidth = '320px';
            progressTrack.style.height = '4px';
            progressTrack.style.background = '#e0e0e0';
            progressTrack.style.borderRadius = '2px';
            progressTrack.style.overflow = 'hidden';
            progressTrack.style.pointerEvents = 'none';
            progressBar = document.createElement('div');
            progressBar.style.height = '100%';
            progressBar.style.width = '0%';
            progressBar.style.background = '#000';
            progressBar.style.transition = 'width 0.2s ease';
            progressTrack.appendChild(progressBar);
            mount.appendChild(progressTrack);
        } else if (progressBar) {
            progressBar.style.width = '0%';
        }
    loader.load(config.modelUrl, (gltf) => {
        const model = gltf.scene || gltf.scenes[0];
        modelRoot = model;
        scene.add(model);
        if (progressBar) progressBar.style.width = '100%';
        setTimeout(() => { if (progressTrack && progressTrack.parentNode) progressTrack.remove(); progressTrack = null; progressBar = null; }, 150);
        // Compile materials and force a few initial frames to ensure textures appear
        try { renderer.compile(scene, camera); } catch (_) {}
        forceFrames += 3;

        // Fit camera to model
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        // Compute fit distance so model fills a consistent fraction of the viewport regardless of orientation
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
        const sphereForFit = new THREE.Sphere();
        box.getBoundingSphere(sphereForFit);
        const rFit = sphereForFit.radius;
        const frac = cfg.initialScreenFraction ?? 0.5; // 0-1 of viewport
        const distYTarget = rFit / (frac * Math.sin(vFov / 2));
        const distXTarget = rFit / (frac * Math.sin(hFov / 2));
        const distTarget = Math.max(distXTarget, distYTarget);
        const distFallbackH = (size.y / 2) / Math.tan(vFov / 2);
        const distFallbackW = (size.x / 2) / Math.tan(hFov / 2);
        const distFallback = Math.max(distFallbackH, distFallbackW) * cfg.framePadding;
        const fitDistance = isFinite(distTarget) && distTarget > 0 ? distTarget : distFallback;

        // place camera using orbit angles (theta, phi) and computed distance
        const theta = THREE.MathUtils.degToRad(DEFAULT_ORBIT.thetaDeg);
        const phi = THREE.MathUtils.degToRad(DEFAULT_ORBIT.phiDeg);
        const spherical = new THREE.Spherical(fitDistance, phi, theta);
        const pos = new THREE.Vector3().setFromSpherical(spherical).add(center);
        controls.setLookAt(pos.x, pos.y, pos.z, center.x, center.y, center.z, false);
        controls.getPosition(homePos);
        controls.getTarget(homeTgt);
        camera.near = Math.max(0.01, maxDim / 100);
        camera.far = Math.max(10, maxDim * 100);
        camera.updateProjectionMatrix();

        // Restrict panning/trucking to model bounds
        const boundary = box.clone().expandByScalar(maxDim * cfg.boundaryExpandFactor);
        controls.setBoundary(boundary);
        controls.boundaryEnclosesCamera = false;

        // Setup contact shadow using shared helper
        ensureShadowForObject(model, false);

        // Compute bounding sphere radius for zoom limits
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        boundingRadius = sphere.radius;
        updateDistanceLimits();
        // Apply optional camera angle limits
        if (typeof cfg.minPolarDeg === 'number') controls.minPolarAngle = THREE.MathUtils.degToRad(cfg.minPolarDeg);
        if (typeof cfg.maxPolarDeg === 'number') controls.maxPolarAngle = THREE.MathUtils.degToRad(cfg.maxPolarDeg);
        if (typeof cfg.minAzimuthDeg === 'number') controls.minAzimuthAngle = THREE.MathUtils.degToRad(cfg.minAzimuthDeg);
        if (typeof cfg.maxAzimuthDeg === 'number') controls.maxAzimuthAngle = THREE.MathUtils.degToRad(cfg.maxAzimuthDeg);

        // Background reset on left-click outside model
        backgroundPointerDown = function onPointerDown(e) {
            if (e.button !== 0) return; // only left click
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const intersects = modelRoot ? raycaster.intersectObject(modelRoot, true) : [];
            if (intersects.length === 0) {
                // Reset only pan (truck): move camera and target by the same delta to home target
                const currPos = new THREE.Vector3();
                const currTgt = new THREE.Vector3();
                controls.getPosition(currPos);
                controls.getTarget(currTgt);
                const delta = new THREE.Vector3().subVectors(homeTgt, currTgt);
                const newPos = currPos.add(delta);
                controls.setLookAt(newPos.x, newPos.y, newPos.z, homeTgt.x, homeTgt.y, homeTgt.z, true);
            }
        };
        renderer.domElement.addEventListener('pointerdown', backgroundPointerDown);
        hideError();
        dispatchEvent('model-loaded', { url: config.modelUrl });
    }, (e) => {
        if (progressBar && e && e.lengthComputable) {
            const pct = Math.max(5, Math.min(100, Math.round((e.loaded / e.total) * 100)));
            progressBar.style.width = pct + '%';
        } else if (progressBar) {
            // If we can't compute, nudge bar to indicate activity
            const current = parseFloat(progressBar.style.width) || 0;
            const next = Math.min(90, current + 5);
            progressBar.style.width = next + '%';
        }
    }, (e) => {
        console.error('GLB load failed', e);
        if (progressTrack && progressTrack.parentNode) progressTrack.remove();
        progressTrack = null;
        progressBar = null;
        showError('Failed to load 3D model.', () => { loadModel(); });
        dispatchEvent('model-error', { url: config.modelUrl, error: String(e && e.message || e) });
    });
    }
    if (typeof config.modelUrl === 'string' && config.modelUrl) {
        loadModel();
    } else if (config.allowEmpty) {
        // Ready overlay
        showReadyOverlay();
        // Create toolbar even without selection
        ensureToolbar();
        updateToolbarState();
        // Click-to-select picking on modules
        const onPickPointerDown = (ev) => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            // Prefer collider hits for reliable picking
            const colliderHits = raycaster.intersectObjects(Array.from(moduleColliders.values()), true);
            const first = colliderHits && colliderHits.length ? colliderHits[0] : null;
            if (first && first.object) {
                const root = first.object.userData && first.object.userData.moduleRoot ? first.object.userData.moduleRoot : getModuleRoot(first.object);
                if (root) {
                    // clear previous and set current
                    outlined.forEach(removeOutlineForMesh);
                    outlined.clear();
                    addOutlineForModule(root);
                    setCurrentSelection(root);
                    updateOutlineThickness();
                    forceFrames += 2;
                    dispatchEvent('pick', { hit: first });
                    if (ev.button === 0) beginDrag(root, ev);
                    ensureToolbar();
                }
            } else {
                // clear selection if clicked empty space
                outlined.forEach(removeOutlineForMesh);
                outlined.clear();
                setCurrentSelection(null);
                forceFrames += 1;
            }
        };
        const onDragPointerMove = (ev) => { if (isDragging) updateDrag(ev); };
        const onDragPointerUp = (ev) => { if (isDragging) { try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {} endDrag(); } };
        renderer.domElement.addEventListener('pointerdown', onPickPointerDown);
        renderer.domElement.addEventListener('pointermove', onDragPointerMove);
        window.addEventListener('pointerup', onDragPointerUp, true);
    }

    // Helpers for configurator: ensure shadow rig exists for an object and optionally refit camera/bounds
    function ensureShadowForObject(objectRoot, refitCamera = true) {
        const box = new THREE.Box3().setFromObject(objectRoot);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (!isFinite(maxDim) || maxDim === 0) return;

        if (!shadowGroup) {
        shadowGroup = new THREE.Group();
        shadowGroup.position.set(center.x, box.min.y + cfg.shadowYOffset, center.z);
        scene.add(shadowGroup);

        const base = 512 * Math.max(1, Math.min(2, Math.ceil(window.devicePixelRatio)));
        const rtSize = Math.min(1024, Math.max(512, base));
        renderTarget = new THREE.WebGLRenderTarget(rtSize, rtSize);
        renderTarget.texture.generateMipmaps = false;
        renderTarget.texture.minFilter = THREE.LinearFilter;
        renderTarget.texture.magFilter = THREE.LinearFilter;
        renderTargetBlur = new THREE.WebGLRenderTarget(rtSize, rtSize);
        renderTargetBlur.texture.generateMipmaps = false;
        renderTargetBlur.texture.minFilter = THREE.LinearFilter;
        renderTargetBlur.texture.magFilter = THREE.LinearFilter;

            const planeGeometry = new THREE.PlaneGeometry(Math.max(0.5, size.x * 1.6), Math.max(0.5, size.z * 1.6)).rotateX(Math.PI / 2);
        const planeMaterial = new THREE.MeshBasicMaterial({
            map: renderTarget.texture,
            opacity: state.shadow.opacity,
            transparent: true,
            depthWrite: false
        });
        plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.renderOrder = 1;
        plane.scale.y = -1;
        shadowGroup.add(plane);

        blurPlane = new THREE.Mesh(planeGeometry);
        blurPlane.visible = false;
        shadowGroup.add(blurPlane);

        const fillPlaneMaterial = new THREE.MeshBasicMaterial({
            color: state.plane.color,
            opacity: state.plane.opacity,
            transparent: true,
            depthWrite: false
        });
        fillPlane = new THREE.Mesh(planeGeometry, fillPlaneMaterial);
        fillPlane.rotateX(Math.PI);
        shadowGroup.add(fillPlane);

        shadowCamera = new THREE.OrthographicCamera(
                -planeGeometry.parameters.width / 2, planeGeometry.parameters.width / 2, planeGeometry.parameters.height / 2, -planeGeometry.parameters.height / 2, 0, Math.max(0.3, size.y * 1.2)
        );
        shadowCamera.rotation.x = Math.PI / 2;
        shadowGroup.add(shadowCamera);

            if (!depthMaterial) {
        depthMaterial = new THREE.MeshDepthMaterial();
        depthMaterial.userData.darkness = { value: state.shadow.darkness };
        depthMaterial.onBeforeCompile = function (shader) {
            shader.uniforms.darkness = depthMaterial.userData.darkness;
            shader.fragmentShader = 'uniform float darkness;\n' + shader.fragmentShader.replace(
                'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
                'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );'
            );
        };
        depthMaterial.depthTest = false;
        depthMaterial.depthWrite = false;
            }
            if (!horizontalBlurMaterial) { horizontalBlurMaterial = new THREE.ShaderMaterial(HorizontalBlurShader); horizontalBlurMaterial.depthTest = false; }
            if (!verticalBlurMaterial) { verticalBlurMaterial = new THREE.ShaderMaterial(VerticalBlurShader); verticalBlurMaterial.depthTest = false; }
        } else {
            // Move and resize existing rig to fit new bounds
            shadowGroup.position.set(center.x, box.min.y + cfg.shadowYOffset, center.z);
            const newPlaneW = Math.max(0.5, size.x * 1.6);
            const newPlaneH = Math.max(0.5, size.z * 1.6);
            const newCamH = Math.max(0.3, size.y * 1.2);

            if (plane && plane.geometry) { try { plane.geometry.dispose(); } catch (_) {} }
            if (blurPlane && blurPlane.geometry) { try { blurPlane.geometry.dispose(); } catch (_) {} }
            if (fillPlane && fillPlane.geometry) { try { fillPlane.geometry.dispose(); } catch (_) {} }

            const newGeom = new THREE.PlaneGeometry(newPlaneW, newPlaneH).rotateX(Math.PI / 2);
            if (plane) plane.geometry = newGeom.clone();
            if (blurPlane) blurPlane.geometry = newGeom.clone();
            if (fillPlane) fillPlane.geometry = newGeom.clone();

            if (shadowCamera) {
                shadowCamera.left = -newPlaneW / 2;
                shadowCamera.right = newPlaneW / 2;
                shadowCamera.top = newPlaneH / 2;
                shadowCamera.bottom = -newPlaneH / 2;
                shadowCamera.near = 0;
                shadowCamera.far = newCamH;
                shadowCamera.updateProjectionMatrix();
            }
        }

        // mark shadow as needing an update
        shadowDirty = true;

        if (refitCamera) {
            // Refit camera to encompass modules while preserving current viewing angles (theta/phi)
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        boundingRadius = sphere.radius;
            const vFov = THREE.MathUtils.degToRad(camera.fov);
            const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
            const frac = cfg.initialScreenFraction ?? 0.5;
            const distYTarget = sphere.radius / (frac * Math.sin(vFov / 2));
            const distXTarget = sphere.radius / (frac * Math.sin(hFov / 2));
            const fitDistance = Math.max(distXTarget, distYTarget);

            // Preserve current camera spherical angles relative to its target
                const currPos = new THREE.Vector3();
                const currTgt = new THREE.Vector3();
                controls.getPosition(currPos);
                controls.getTarget(currTgt);
            const offset = new THREE.Vector3().subVectors(currPos, currTgt);
            const sph = new THREE.Spherical().setFromVector3(offset);
            const theta = sph.theta;
            const phi = sph.phi;

            // Only refit when change is significant: large zoom delta or center moved noticeably
            const currRadius = Math.max(0.0001, sph.radius);
            const deltaRadiusFrac = Math.abs(fitDistance - currRadius) / currRadius;
            const centerShift = center.distanceTo(currTgt);
            const deltaThreshold = cfg.cameraRefit.deltaRadiusFrac;
            const centerShiftThreshold = Math.max(cfg.cameraRefit.minCenterShift, sphere.radius * cfg.cameraRefit.centerShiftFrac);
            if (deltaRadiusFrac < deltaThreshold && centerShift < centerShiftThreshold) {
                updateDistanceLimits();
                forceFrames += 1;
                return;
            }

            const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(fitDistance, phi, theta)).add(center);
            controls.setLookAt(pos.x, pos.y, pos.z, center.x, center.y, center.z, true);
            updateDistanceLimits();
            forceFrames += 2;
        updateDimensions();
        }
    }

    // Lighter shadow update while dragging: only recenter rig, avoid re-sizing and camera refit
    function updateShadowDuringDrag(objectRoot) {
        if (!shadowGroup) return;
        const box = new THREE.Box3().setFromObject(objectRoot);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        shadowGroup.position.set(center.x, box.min.y + cfg.shadowYOffset, center.z);

        // Resize shadow plane/camera if the oriented bounds changed meaningfully
        const newW = Math.max(0.5, size.x * cfg.shadowPlaneFactor);
        const newH = Math.max(0.5, size.z * cfg.shadowPlaneFactor);
        const newCamH = Math.max(0.3, size.y * 1.2);
        const eps = cfg.shadowResizeEps;
        const planeW = plane && plane.geometry ? plane.geometry.parameters.width : 0;
        const planeH = plane && plane.geometry ? plane.geometry.parameters.height : 0;
        const needResize = !plane || Math.abs(newW - planeW) > eps || Math.abs(newH - planeH) > eps;
        if (needResize) {
            if (plane && plane.geometry) { try { plane.geometry.dispose(); } catch (_) {} }
            if (blurPlane && blurPlane.geometry) { try { blurPlane.geometry.dispose(); } catch (_) {} }
            if (fillPlane && fillPlane.geometry) { try { fillPlane.geometry.dispose(); } catch (_) {} }
            const newGeom = new THREE.PlaneGeometry(newW, newH).rotateX(Math.PI / 2);
            if (plane) plane.geometry = newGeom.clone();
            if (blurPlane) blurPlane.geometry = newGeom.clone();
            if (fillPlane) fillPlane.geometry = newGeom.clone();
            if (shadowCamera) {
                shadowCamera.left = -newW / 2;
                shadowCamera.right = newW / 2;
                shadowCamera.top = newH / 2;
                shadowCamera.bottom = -newH / 2;
                shadowCamera.far = newCamH;
                shadowCamera.updateProjectionMatrix();
            }
        }
        // mark shadow as dirty and nudge a render
        shadowDirty = true;
        forceFrames += 1;
    }

    // Loading indicator helpers
    let loadingIndicator = null;
    function showLoadingIndicator(message = 'Loading model...') {
        if (!loadingIndicator) {
            loadingIndicator = document.createElement('div');
            loadingIndicator.dataset.role = 'loading-indicator';
            loadingIndicator.style.position = 'absolute';
            loadingIndicator.style.left = '50%';
            loadingIndicator.style.top = '50%';
            loadingIndicator.style.transform = 'translate(-50%, -50%)';
            loadingIndicator.style.display = 'flex';
            loadingIndicator.style.flexDirection = 'column';
            loadingIndicator.style.alignItems = 'center';
            loadingIndicator.style.gap = '12px';
            loadingIndicator.style.padding = '20px 24px';
            loadingIndicator.style.background = 'rgba(0, 0, 0, 0.85)';
            loadingIndicator.style.borderRadius = '8px';
            loadingIndicator.style.color = '#ffffff';
            loadingIndicator.style.fontFamily = 'system-ui, sans-serif';
            loadingIndicator.style.fontSize = '14px';
            loadingIndicator.style.fontWeight = '500';
            loadingIndicator.style.zIndex = '100';
            loadingIndicator.style.pointerEvents = 'none';
            
            // Spinner
            const spinner = document.createElement('div');
            spinner.style.width = '24px';
            spinner.style.height = '24px';
            spinner.style.border = '3px solid rgba(255, 255, 255, 0.3)';
            spinner.style.borderTop = '3px solid #ffffff';
            spinner.style.borderRadius = '50%';
            spinner.style.animation = 'spin 0.8s linear infinite';
            
            // Add keyframes for spinner animation
            if (!document.getElementById('spinner-keyframes')) {
                const style = document.createElement('style');
                style.id = 'spinner-keyframes';
                style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
                document.head.appendChild(style);
            }
            
            const text = document.createElement('div');
            text.dataset.role = 'loading-text';
            text.textContent = message;
            
            loadingIndicator.appendChild(spinner);
            loadingIndicator.appendChild(text);
            mount.appendChild(loadingIndicator);
        } else {
            const text = loadingIndicator.querySelector('[data-role="loading-text"]');
            if (text) text.textContent = message;
            loadingIndicator.style.display = 'flex';
        }
        return loadingIndicator;
    }
    
    function hideLoadingIndicator() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    // Public APIs for configurator multi-model support
    window.__charpstAR_threeAddGltf = function (mountId, url) {
        const el = mountId ? document.getElementById(mountId) : mount;
        if (!el || el !== mount) return;
        
        // Show loading indicator
        showLoadingIndicator('Loading model...');
        
        const localLoader = new GLTFLoader();
        localLoader.setDRACOLoader(draco);
        localLoader.setCrossOrigin('anonymous');
        localLoader.load(url, (gltf) => {
            // Hide loading indicator
            hideLoadingIndicator();
            const node = (gltf.scene || gltf.scenes[0]);
            // Tag root with its source for later export
            try { node.userData.modelUrl = url; } catch(_) {}
            // Place new node next to the right-most existing module using bounding boxes (no gap)
            let rightMost = null;
            let rightMostMaxX = -Infinity;
            const tempBox = new THREE.Box3();
            modulesGroup.updateMatrixWorld(true);
            modulesGroup.children.forEach((child) => {
                tempBox.setFromObject(child);
                if (tempBox.max.x > rightMostMaxX) {
                    rightMostMaxX = tempBox.max.x;
                    rightMost = { object: child, box: tempBox.clone() };
                }
            });

            // Compute new node size
            const nodeBox = new THREE.Box3().setFromObject(node);
            const nodeSize = nodeBox.getSize(new THREE.Vector3());

            if (!rightMost) {
                // First module: center on X/Z plane
                node.position.set(-nodeBox.getCenter(new THREE.Vector3()).x, 0, -nodeBox.getCenter(new THREE.Vector3()).z);
        } else {
                // Place flush to the right (no gap)
                const newMinX = rightMostMaxX;
                const nodeCenter = nodeBox.getCenter(new THREE.Vector3());
                const nodeHalfWidth = nodeSize.x / 2;
                const targetCenterX = newMinX + nodeHalfWidth;
                const deltaX = targetCenterX - nodeCenter.x;
                // Keep Z aligned with rightMost center Z
                const rightCenter = rightMost.box.getCenter(new THREE.Vector3());
                const deltaZ = rightCenter.z - nodeCenter.z;
                node.position.x += deltaX;
                node.position.z += deltaZ;
                // Y baseline to 0 so it sits on the ground (assumes pivot at base or near it)
                node.position.y += -nodeBox.min.y;
            }

            modulesGroup.add(node);
            hideReadyOverlay();
            // After adding, refit shadow and camera but preserve current viewing angles
            ensureShadowForObject(modulesGroup, true);
            ensureModuleCollider(getModuleRoot(node));
            // trigger a few frames to refresh shadow blur render
            forceFrames += 3;
            // Rebuild dimensions now that modules changed
            updateDimensions();
        }, undefined, (e) => {
            console.error('Add GLTF failed', e);
            hideLoadingIndicator();
            showError('Failed to add model.', () => window.__charpstAR_threeAddGltf(mountId, url));
        });
    };
    // Add a GLTF at an explicit transform (position, rotationYDeg). Returns a Promise
    window.__charpstAR_threeAddGltfAt = function (mountId, url, transform) {
        const el = mountId ? document.getElementById(mountId) : mount;
        if (!el || el !== mount) return Promise.reject(new Error('invalid mountId'));
        return new Promise((resolve, reject) => {
            const localLoader = new GLTFLoader();
            localLoader.setDRACOLoader(draco);
            localLoader.setCrossOrigin('anonymous');
            localLoader.load(url, (gltf) => {
                const node = (gltf.scene || gltf.scenes[0]);
                try { node.userData.modelUrl = url; } catch(_) {}
                // Apply transform
                if (transform && transform.position) {
                    const p = transform.position;
                    node.position.set(
                        typeof p.x === 'number' ? p.x : 0,
                        typeof p.y === 'number' ? p.y : 0,
                        typeof p.z === 'number' ? p.z : 0
                    );
                }
                if (transform && typeof transform.rotationYDeg === 'number') {
                    node.rotation.y = THREE.MathUtils.degToRad(transform.rotationYDeg);
                }
                modulesGroup.add(node);
                hideReadyOverlay();
                ensureModuleCollider(getModuleRoot(node));
                // Update shadow/camera and dimensions
                ensureShadowForObject(modulesGroup, true);
                updateDimensions();
                forceFrames += 2;
                resolve(node);
            }, undefined, (e) => {
                console.error('Add GLTF at failed', e);
                showError('Failed to add model.', () => window.__charpstAR_threeAddGltfAt(mountId, url, transform));
                reject(e);
            });
        });
    };
    // Finalize a multi-add layout (refit and rebuild dimensions)
    window.__charpstAR_threeFinalizeLayout = function (mountId) {
        const el = mountId ? document.getElementById(mountId) : mount;
        if (!el || el !== mount) return;
        ensureShadowForObject(modulesGroup, true);
        updateDimensions();
        forceFrames += 2;
    };
    window.__charpstAR_threeAddObject3D = function (mountId, object3d) {
        const el = mountId ? document.getElementById(mountId) : mount;
        if (!el || el !== mount || !object3d) return;
        modulesGroup.add(object3d);
        hideReadyOverlay();
        ensureShadowForObject(modulesGroup, true);
        ensureModuleCollider(getModuleRoot(object3d));
        forceFrames += 2;
        updateDimensions();
    };
    window.__charpstAR_threeRemoveAllModules = function (mountId) {
        const el = mountId ? document.getElementById(mountId) : mount;
        if (!el || el !== mount) return;
        try {
            while (modulesGroup.children.length) {
                const child = modulesGroup.children.pop();
                modulesGroup.remove(child);
                child.traverse((o)=>{ if (o.geometry) o.geometry.dispose && o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose && m.dispose()); else o.material.dispose && o.material.dispose(); } });
                const col = moduleColliders.get(child);
                if (col) { try { col.geometry.dispose(); } catch(_){} moduleColliders.delete(child); }
            }
            outlined.forEach(removeOutlineForMesh);
            outlined.clear();
            // Clear any dimension lines/labels
            clearDimensions();
        } catch (_) {}
        showReadyOverlay();
        forceFrames += 2;
    };

    // Export current scene modules (position/rotation) in world space
    window.__charpstAR_threeExportModules = function(mountId){
        const el = mountId ? document.getElementById(mountId) : mount;
        if (!el || el !== mount) return { modules: [] };
        const out = [];
        modulesGroup.updateMatrixWorld(true);
        function round2(v){ const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? 0 : r; }
        function fileIdFromUrl(u){ if (!u || typeof u !== 'string') return null; const last = u.split('/').pop() || u; const dot = last.lastIndexOf('.'); return dot > 0 ? last.substring(0, dot) : last; }
        function snapRotationDeg(deg){ let n = ((deg % 360) + 360) % 360; let s = Math.round(n / 90) * 90; if (s === 360) s = 0; return s; }
        modulesGroup.children.forEach((child)=>{
            const pos = new THREE.Vector3();
            child.getWorldPosition(pos);
            const q = child.getWorldQuaternion(new THREE.Quaternion());
            const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
            const rotYDeg = THREE.MathUtils.radToDeg(e.y);
            const snappedY = snapRotationDeg(rotYDeg);
            const url = (child.userData && child.userData.modelUrl) || null;
            const id = fileIdFromUrl(url);
            out.push({
                id: id,
                position: { x: round2(pos.x), y: round2(pos.y), z: round2(pos.z) },
                rotation: snappedY
            });
        });
        return { modules: out };
    };

    // Public outline selection API (name or uuid)
    window.__charpstAR_threeSetOutlined = function (mountId, namesOrUuids) {
        const el = mountId ? document.getElementById(mountId) : mount;
        if (!el || el !== mount) return;
        outlined.forEach(removeOutlineForMesh);
        outlined.clear();
        if (!state.outline.enabled || !namesOrUuids) { forceFrames += 1; return; }
        const set = Array.isArray(namesOrUuids) ? new Set(namesOrUuids) : new Set([namesOrUuids]);
        modulesGroup.traverse((obj) => {
            if (!obj.isMesh) return;
            if (set.has(obj.name) || set.has(obj.uuid)) addOutlineForModule(getModuleRoot(obj));
        });
        updateOutlineThickness();
        forceFrames += 2;
    };

    function onResize() {
        const width = mount.clientWidth;
        const height = mount.clientHeight;
        if (!width || !height) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(Math.max(1, width), Math.max(1, height), false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        updateDistanceLimits();
        shadowDirty = true;
        forceFrames += 1;
    }
    window.addEventListener('resize', onResize);
    // Observe parent size changes (more reliable than window resize)
    const resizeObserver = new ResizeObserver(() => { onResize(); needsRender = true; });
    resizeObserver.observe(mount);

    function blurShadow(amount) {
        if (!shadowCamera) return;
        blurPlane.visible = true;
        blurPlane.material = horizontalBlurMaterial;
        blurPlane.material.uniforms.tDiffuse.value = renderTarget.texture;
        // Support world-space-ish blur units: when units === 'world', scale against plane size
        if (cfg.shadow && cfg.shadow.units === 'world') {
            horizontalBlurMaterial.uniforms.h.value = (amount * 256) / renderTarget.width;
        } else {
        horizontalBlurMaterial.uniforms.h.value = amount / renderTarget.width;
        }
        renderer.setRenderTarget(renderTargetBlur);
        renderer.render(blurPlane, shadowCamera);
        blurPlane.material = verticalBlurMaterial;
        blurPlane.material.uniforms.tDiffuse.value = renderTargetBlur.texture;
        if (cfg.shadow && cfg.shadow.units === 'world') {
            verticalBlurMaterial.uniforms.v.value = (amount * 256) / renderTarget.height;
        } else {
        verticalBlurMaterial.uniforms.v.value = amount / renderTarget.height;
        }
        renderer.setRenderTarget(renderTarget);
        renderer.render(blurPlane, shadowCamera);
        blurPlane.visible = false;
        renderer.setRenderTarget(null);
    }

    let needsRender = true;
    let lastCameraEventTs = 0;
    function dispose() {
        try { window.removeEventListener('resize', onResize); } catch (_) {}
        try { resizeObserver.disconnect(); } catch (_) {}
        try { document.removeEventListener('visibilitychange', onVisibility); } catch (_) {}
        try { io.disconnect(); } catch (_) {}
        try { if (backgroundPointerDown) renderer.domElement.removeEventListener('pointerdown', backgroundPointerDown); } catch (_) {}
        try { renderer.domElement.removeEventListener('pointerdown', onPickPointerDown); } catch (_) {}
        try { renderer.domElement.removeEventListener('pointermove', onDragPointerMove); } catch (_) {}
        try { window.removeEventListener('pointerup', onDragPointerUp, true); } catch (_) {}
        try { renderer.domElement.removeEventListener('pointerenter', onCursorPointerEnter); } catch (_) {}
        try { renderer.domElement.removeEventListener('pointerleave', onCursorPointerLeave); } catch (_) {}
        try { renderer.domElement.removeEventListener('pointerdown', onCursorPointerDown); } catch (_) {}
        try { window.removeEventListener('pointerup', onCursorPointerUp); } catch (_) {}
        try { renderer.domElement.removeEventListener('touchstart', onCursorTouchStart); } catch (_) {}
        try { window.removeEventListener('touchend', onCursorTouchEnd); } catch (_) {}
        try { controls.dispose(); } catch (_) {}
        try { renderer.dispose(); } catch (_) {}
        try { renderTarget && renderTarget.dispose(); } catch (_) {}
        try { renderTargetBlur && renderTargetBlur.dispose(); } catch (_) {}
        try { horizontalBlurMaterial && horizontalBlurMaterial.dispose(); } catch (_) {}
        try { verticalBlurMaterial && verticalBlurMaterial.dispose(); } catch (_) {}
        try { depthMaterial && depthMaterial.dispose(); } catch (_) {}
        try { const ov = mount.querySelector('[data-role="error-overlay"]'); if (ov) ov.remove(); } catch (_) {}
        try { const ro = mount.querySelector('[data-role\u003d"ready-overlay"]'); if (ro) ro.remove(); } catch (_) {}
        try { const tb = mount.querySelector('[data-role="toolbar"]'); if (tb) tb.remove(); } catch (_) {}
        try { while (mount.firstChild) mount.removeChild(mount.firstChild); } catch (_) {}
    }
    // Expose per-mount disposer and a global helper
    mount.__charpstAR_dispose = dispose;
    window.__charpstAR_threeDispose = function (mountId) {
        const el = mountId ? document.getElementById(mountId) : mount;
        if (el && el.__charpstAR_dispose) el.__charpstAR_dispose();
    };
    // Public API: load and clear models for configurator flows
    window.__charpstAR_threeLoadModel = function (mountId, modelUrl) {
        const el = mountId ? document.getElementById(mountId) : mount;
        if (!el || el !== mount) return;
        // remove ready overlay
        const ro = mount.querySelector('[data-role="ready-overlay"]');
        if (ro) ro.remove();
        // clean previous model and shadow rig if present
        try {
            if (modelRoot) { scene.remove(modelRoot); modelRoot.traverse((o)=>{ if (o.geometry) o.geometry.dispose && o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose && m.dispose()); else o.material.dispose && o.material.dispose(); } }); modelRoot = null; }
            if (shadowGroup) { scene.remove(shadowGroup); shadowGroup = null; }
            if (renderTarget) { renderTarget.dispose(); renderTarget = null; }
            if (renderTargetBlur) { renderTargetBlur.dispose(); renderTargetBlur = null; }
        } catch (_) {}
        config.modelUrl = modelUrl;
        if (progressBar) progressBar.style.width = '0%';
        loadModel();
    };
    window.__charpstAR_threeClearModel = function (mountId) {
        const el = mountId ? document.getElementById(mountId) : mount;
        if (!el || el !== mount) return;
        try {
            if (modelRoot) { scene.remove(modelRoot); modelRoot.traverse((o)=>{ if (o.geometry) o.geometry.dispose && o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose && m.dispose()); else o.material.dispose && o.material.dispose(); } }); modelRoot = null; }
            if (shadowGroup) { scene.remove(shadowGroup); shadowGroup = null; }
            if (renderTarget) { renderTarget.dispose(); renderTarget = null; }
            if (renderTargetBlur) { renderTargetBlur.dispose(); renderTargetBlur = null; }
        } catch (_) {}
        showReadyOverlay();
        forceFrames += 2;
    };

    // Visibility and offscreen pause
    let isPageHidden = false;
    let isOffscreen = false;
    const io = new IntersectionObserver((entries) => {
        const entry = entries[0];
        isOffscreen = !(entry && entry.isIntersecting);
    }, { root: null, threshold: 0 });
    try { io.observe(mount); } catch (_) {}
    function onVisibility() { isPageHidden = document.hidden; }
    document.addEventListener('visibilitychange', onVisibility);

    // Dragging state for module move on ground plane (generic, collision-aware)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const planeIntersect = new THREE.Vector3();
    let isDragging = false;
    let dragRoot = null;
    let dragOffset = new THREE.Vector3();
    const savedMouseButtons = { left: controls.mouseButtons.left, right: controls.mouseButtons.right, middle: controls.mouseButtons.middle };
    const GRID_SIZE = (cfg.drag && typeof cfg.drag.gridSize === 'number') ? cfg.drag.gridSize : 0.01;
    let dragLastTs = 0;
    let dragShift = new THREE.Vector3();
    let dimensionWasEnabledAtDragStart = false;

    function getPointerWorldIntersect(ev) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.ray.intersectPlane(groundPlane, planeIntersect);
        return hit ? planeIntersect.clone() : null;
    }

    function beginDrag(root, ev) {
        if (!root) return;
        const hit = getPointerWorldIntersect(ev);
        if (!hit) return;
        // Hide dimensions during drag if enabled
        if (cfg.dimensions && cfg.dimensions.enabled) {
            dimensionWasEnabledAtDragStart = true;
            clearDimensions();
            forceFrames += 1;
        } else {
            dimensionWasEnabledAtDragStart = false;
        }
        dragRoot = root;
        dragShift.copy(dragRoot.position).sub(hit);
        isDragging = true;
        dragLastTs = performance.now();
        renderer.domElement.style.cursor = 'grabbing';
        controls.enabled = false;
        // Build world box caches at drag start (rotation included)
        buildDragCaches(dragRoot);
        controls.mouseButtons.left = CameraControls.ACTION.NONE;
        controls.mouseButtons.right = CameraControls.ACTION.NONE;
    }

    function computeModuleBounds(root) {
        return computeBoundsExcludingHelpers(root);
    }

    // Per-drag caches
    let dragRootBoxWorld = null;  // Box3 in world space at drag start
    let dragRootOrigin = null;    // root.position at drag start
    let dragOthersWorld = [];     // array of Box3 in world space for others
    const _tmpBox = new THREE.Box3();
    const _tmpVec = new THREE.Vector3();
    function buildDragCaches(root) {
        // Root world box at drag start
        dragRootBoxWorld = computeBoundsExcludingHelpers(root);
        dragRootOrigin = root.position.clone();
        // Other boxes in world
        dragOthersWorld = [];
        modulesGroup.children.forEach((other) => {
            if (other === root) return;
            const ob = computeBoundsExcludingHelpers(other);
            if (!ob.isEmpty()) dragOthersWorld.push(ob);
        });
    }
    function anyCollisionAtPosition(root, newPos) {
        if (!dragRootBoxWorld || !dragRootOrigin) buildDragCaches(root);
        // Translate drag-start world box by the world delta (assumes rotation/scale unchanged during drag)
        const delta = _tmpVec.set(newPos.x - dragRootOrigin.x, newPos.y - dragRootOrigin.y, newPos.z - dragRootOrigin.z);
        const worldBox = new THREE.Box3();
        worldBox.min.copy(dragRootBoxWorld.min).add(delta);
        worldBox.max.copy(dragRootBoxWorld.max).add(delta);
        // Shrink slightly by collision buffer so touching faces are allowed
        const buf = (cfg.drag && cfg.drag.collisionBuffer) || 0;
        if (buf > 0) {
            worldBox.min.addScalar(buf);
            worldBox.max.addScalar(-buf);
        }
        for (let i = 0; i < dragOthersWorld.length; i++) {
            if (worldBox.intersectsBox(dragOthersWorld[i])) return true;
        }
        return false;
    }

    // 1D continuous resolution along a single axis (x or z)
    function findLastNonCollidingAxis(root, from, to, axis) {
        // Early outs
        if (!anyCollisionAtPosition(root, to)) return to;
        if (anyCollisionAtPosition(root, from)) return from;
        let lo = 0.0, hi = 1.0;
        for (let i = 0; i < 18; i++) {
            const mid = (lo + hi) * 0.5;
            const test = new THREE.Vector3(from.x, from.y, from.z);
            if (axis === 'x') test.x = THREE.MathUtils.lerp(from.x, to.x, mid);
            else test.z = THREE.MathUtils.lerp(from.z, to.z, mid);
            if (anyCollisionAtPosition(root, test)) hi = mid; else lo = mid;
        }
        const t = lo;
        const out = new THREE.Vector3(from.x, from.y, from.z);
        if (axis === 'x') out.x = THREE.MathUtils.lerp(from.x, to.x, t);
        else out.z = THREE.MathUtils.lerp(from.z, to.z, t);
        return out;
    }


    function updateDrag(ev) {
        if (!isDragging || !dragRoot) return;
        // Build caches on first move
        if (!dragRootBoxWorld || !dragRootOrigin) buildDragCaches(dragRoot);
        const hit = getPointerWorldIntersect(ev);
        if (!hit) return;
        const candidate = hit.add(dragShift);
        const proposed = new THREE.Vector3(candidate.x, dragRoot.position.y, candidate.z);
        // Immediate follow: match pointer with fixed dragShift for no lag
        // try proposed; if collides, resolve axis-first with 1D continuous search (no velocity cap)
        if (!anyCollisionAtPosition(dragRoot, proposed)) {
            dragRoot.position.copy(proposed);
            ensureModuleCollider(dragRoot);
            updateShadowDuringDrag(modulesGroup);
            forceFrames += 1;
        } else {
            const from = dragRoot.position.clone();
            // X pass
            const xOnly = new THREE.Vector3(proposed.x, from.y, from.z);
            const xPos = anyCollisionAtPosition(dragRoot, xOnly) ? findLastNonCollidingAxis(dragRoot, from, xOnly, 'x') : xOnly;
            dragRoot.position.copy(xPos);
            // Z pass from updated X
            const zOnly = new THREE.Vector3(dragRoot.position.x, from.y, proposed.z);
            const zPos = anyCollisionAtPosition(dragRoot, zOnly) ? findLastNonCollidingAxis(dragRoot, dragRoot.position.clone(), zOnly, 'z') : zOnly;
            dragRoot.position.copy(zPos);
            ensureModuleCollider(dragRoot);
            updateShadowDuringDrag(modulesGroup);
            forceFrames += 1;
        }
    }

    function endDrag() {
        if (!isDragging) return;
        if (dragRoot) {
            ensureModuleCollider(dragRoot);
            // Edge snap to nearest neighbor if within tolerance (no grid snap)
            const tol = (cfg.drag && cfg.drag.edgeSnapTolerance) || 0.04;
            const rootBox = computeBoundsExcludingHelpers(dragRoot);
            if (!rootBox.isEmpty()) {
                let best = null;
                const rxMin = rootBox.min.x, rxMax = rootBox.max.x, rzMin = rootBox.min.z, rzMax = rootBox.max.z;
                const rCenterX = (rxMin + rxMax) * 0.5;
                const rCenterZ = (rzMin + rzMax) * 0.5;
                modulesGroup.children.forEach((other) => {
                    if (other === dragRoot) return;
                    const ob = computeBoundsExcludingHelpers(other);
                    if (ob.isEmpty()) return;
                    const alongZOverlap = !(rzMax < ob.min.z || rzMin > ob.max.z);
                    const alongXOverlap = !(rxMax < ob.min.x || rxMin > ob.max.x);
                    const oCenterX = (ob.min.x + ob.max.x) * 0.5;
                    const oCenterZ = (ob.min.z + ob.max.z) * 0.5;
                    if (alongZOverlap) {
                        const dxRight = ob.max.x - rxMin; // positive if root is slightly right of ob's right face
                        if (Math.abs(dxRight) <= tol) {
                            // also correct center Z if close
                            const dcz = oCenterZ - rCenterZ;
                            const zFix = Math.abs(dcz) <= tol ? dcz : 0;
                            const candidate = { x: dxRight, z: zFix };
                            if (!best || (Math.abs(candidate.x) + Math.abs(candidate.z)) < (Math.abs(best.x||0) + Math.abs(best.z||0))) best = candidate;
                        }
                        const dxLeft  = ob.min.x - rxMax; // positive if root is slightly left of ob's left face
                        if (Math.abs(dxLeft) <= tol) {
                            const dcz = oCenterZ - rCenterZ;
                            const zFix = Math.abs(dcz) <= tol ? dcz : 0;
                            const candidate = { x: dxLeft, z: zFix };
                            if (!best || (Math.abs(candidate.x) + Math.abs(candidate.z)) < (Math.abs(best.x||0) + Math.abs(best.z||0))) best = candidate;
                        }
                    }
                    if (alongXOverlap) {
                        const dzFront = ob.max.z - rzMin;
                        if (Math.abs(dzFront) <= tol) {
                            const dcx = oCenterX - rCenterX;
                            const xFix = Math.abs(dcx) <= tol ? dcx : 0;
                            const candidate = { x: xFix, z: dzFront };
                            if (!best || (Math.abs(candidate.x) + Math.abs(candidate.z)) < (Math.abs(best.x||0) + Math.abs(best.z||0))) best = candidate;
                        }
                        const dzBack  = ob.min.z - rzMax;
                        if (Math.abs(dzBack) <= tol) {
                            const dcx = oCenterX - rCenterX;
                            const xFix = Math.abs(dcx) <= tol ? dcx : 0;
                            const candidate = { x: xFix, z: dzBack };
                            if (!best || (Math.abs(candidate.x) + Math.abs(candidate.z)) < (Math.abs(best.x||0) + Math.abs(best.z||0))) best = candidate;
                        }
                    }
                });
                if (best) {
                    const target = new THREE.Vector3(dragRoot.position.x + (best.x||0), dragRoot.position.y, dragRoot.position.z + (best.z||0));
                    if (!anyCollisionAtPosition(dragRoot, target)) {
                        dragRoot.position.copy(target);
                        ensureModuleCollider(dragRoot);
                    }
                }
            }
        }
        // after placing, update shadow rig and camera, and rebuild dimensions
        ensureShadowForObject(modulesGroup, true);
        // Restore dimensions only if they were enabled when drag started
        if (dimensionWasEnabledAtDragStart && cfg.dimensions && cfg.dimensions.enabled) {
            updateDimensions();
        }
        forceFrames += 2;
        isDragging = false;
        dragRootBoxWorld = null;
        dragRootOrigin = null;
        dragOthersWorld = [];
        dragRoot = null;
        renderer.domElement.style.cursor = 'grab';
        // Restore controls on next tick to avoid camera-controls reacting to this pointerup
        setTimeout(() => {
            controls.enabled = true;
            controls.mouseButtons.left = savedMouseButtons.left;
            controls.mouseButtons.right = savedMouseButtons.right;
        }, 0);
    }

    function emitCameraChange() {
        const p = new THREE.Vector3();
        const t = new THREE.Vector3();
        controls.getPosition(p);
        controls.getTarget(t);
        const offset = new THREE.Vector3().subVectors(p, t);
        const sph = new THREE.Spherical().setFromVector3(offset);
        dispatchEvent('camera-change', {
            position: { x: p.x, y: p.y, z: p.z },
            target: { x: t.x, y: t.y, z: t.z },
            spherical: { radius: sph.radius, thetaDeg: THREE.MathUtils.radToDeg(sph.theta), phiDeg: THREE.MathUtils.radToDeg(sph.phi) }
        });
    }

    function animate() {
        requestAnimationFrame(animate);
        if (isPageHidden || isOffscreen) return;
        const delta = clock.getDelta();
        const changed = controls.update(delta);
        if (cfg.dimensions && cfg.dimensions.enabled) {
            // keep labels sized alongside camera distance changes
            // lightweight: only rescale sprites; skip full rebuild
            if (dimensionsGroup.children.length) {
                // Rescale dimensions every frame for constant screen-space size
                rescaleDimensions();
            }
        }
        // keep outline shells scaled to match selected meshes
        if (state.outline.enabled && outlined.size) updateOutlineThickness();
        // Update contact shadow only when necessary (scene/object changes), not on pure camera orbit
        if (shadowCamera && (shadowDirty || forceFrames > 0)) {
            const initialBackground = scene.background;
            scene.background = null;
            const initialClearAlpha = renderer.getClearAlpha();
            renderer.setClearAlpha(0);
            const prevOverride = scene.overrideMaterial;
            scene.overrideMaterial = depthMaterial;
            // Hide shadow planes during depth pass
            const prevPlaneVisible = plane.visible;
            const prevFillVisible = fillPlane.visible;
            plane.visible = false;
            fillPlane.visible = false;
            // Temporarily hide helper meshes (colliders/outlines) from depth pass
            const hiddenHelpers = [];
            modulesGroup.traverse((o) => {
                if (o && o.isMesh && (o.userData.__isOutline || o.userData.__isCollider)) {
                    if (o.visible) { o.visible = false; hiddenHelpers.push(o); }
                }
            });

            renderer.setRenderTarget(renderTarget);
            renderer.render(scene, shadowCamera);

            // Restore helper visibility
            for (let i = 0; i < hiddenHelpers.length; i++) hiddenHelpers[i].visible = true;
            plane.visible = prevPlaneVisible;
            fillPlane.visible = prevFillVisible;
            scene.overrideMaterial = prevOverride;
            scene.background = initialBackground;
            blurShadow(state.shadow.blur);
            // Second pass to reduce artifacts, per three.js example
            blurShadow(state.shadow.blur * 0.4);
            renderer.setClearAlpha(initialClearAlpha);
            renderer.setRenderTarget(null);
            shadowDirty = false;
        }
        if (changed || needsRender || forceFrames > 0) {
            renderer.render(scene, camera);
            needsRender = false;
            const now = performance.now();
            if (now - lastCameraEventTs > 100) { emitCameraChange(); lastCameraEventTs = now; }
            if (forceFrames > 0) forceFrames -= 1;
        }
    }
    animate();
}


/**
 * AR Utility Functions
 * Handles platform detection and AR viewer launching for iOS and Android
 */

export type Platform = 'ios' | 'android' | 'desktop';

/**
 * Detect the current platform
 */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'desktop';
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // Check for iOS (including iPad with MacIntel)
  if (/iPad|iPhone|iPod/.test(userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  
  // Check for Android
  if (/android/i.test(userAgent)) {
    return 'android';
  }
  
  return 'desktop';
}

/**
 * Check if device is mobile
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Generate AR links from GLB URL
 * Android uses GLB, iOS uses USDZ (derived from GLB path)
 */
export function getARLinks(glbUrl: string): { android: string; ios: string } {
  // Android uses the GLB file as-is
  const android = glbUrl;
  
  // iOS: Replace /Android/ with /iOS/ and .glb with .usdz
  const ios = glbUrl.replace('/Android/', '/iOS/').replace('.glb', '.usdz');
  
  return { android, ios };
}

/**
 * Launch iOS AR Quick Look
 */
export function openiOSQuickLook(usdzUrl: string): void {
  const anchor = document.createElement('a');
  anchor.setAttribute('rel', 'ar');
  anchor.setAttribute('href', usdzUrl + '#allowsContentScaling=0');
  
  // Add a hidden image element as required by iOS
  const img = document.createElement('img');
  img.style.display = 'none';
  anchor.appendChild(img);
  
  // Temporarily add to DOM, click, and remove
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Launch Android Scene Viewer
 */
export function openSceneViewer(glbUrl: string, title: string = 'View in AR'): void {
  const location = window.location.toString();
  const locationUrl = new URL(location);
  const modelUrl = new URL(glbUrl, location);
  const noArViewerSigil = '#model-viewer-no-ar-fallback';
  
  locationUrl.hash = noArViewerSigil;
  
  // Build intent parameters for Scene Viewer
  let intentParams = `?file=${encodeURIComponent(modelUrl.toString())}`;
  intentParams += `&mode=ar_preferred`;
  intentParams += `&link=${encodeURIComponent(location)}`;
  intentParams += `&title=${encodeURIComponent(title)}`;
  intentParams += `&resizable=false`;
  intentParams += `&disable_occlusion=true`;
  
  // Create the Android intent URL
  const intent = `intent://arvr.google.com/scene-viewer/1.0${intentParams}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(locationUrl.toString())};end;`;
  
  // Create anchor and trigger
  const anchor = document.createElement('a');
  anchor.setAttribute('href', intent);
  
  // Handle fallback for when Scene Viewer is not available
  let fallbackInvoked = false;
  const undoHashChange = () => {
    if (window.location.hash === noArViewerSigil && !fallbackInvoked) {
      fallbackInvoked = true;
      window.history.back();
    }
  };
  
  window.addEventListener('hashchange', undoHashChange, { once: true });
  
  // Temporarily add to DOM, click, and remove
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Trigger AR viewer based on platform
 */
export function triggerAR(glbUrl: string, productName: string = 'Product'): void {
  const platform = detectPlatform();
  const { android, ios } = getARLinks(glbUrl);
  
  switch (platform) {
    case 'ios':
      openiOSQuickLook(ios);
      break;
    case 'android':
      openSceneViewer(android, productName);
      break;
    default:
      console.log('AR viewing is only available on mobile devices');
      break;
  }
}


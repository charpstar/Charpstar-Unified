import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

const DEBUG = process.env.RENDER_DEBUG === '1';

interface StartBody {
  modelFilename: string;
  modelName: string;
  variantName?: string | null;
  views: Array<{ name: string; orbit?: string }>;
  background: string; // 'transparent' or hex color (without #)
  resolution: number;
  aspectRatio?: 'square' | 'rectangle'; // 'square' or 'rectangle' (16:9)
  format?: 'png' | 'jpg' | 'webp';
  shadows?: boolean; // Enable/disable shadows (default: true)
  isModularUpload?: boolean; // Flag for pre-uploaded modular GLB
  tempGLBPath?: string; // Path to pre-uploaded GLB on BunnyCDN
  sourceGlbUrl?: string; // Direct URL to source GLB file
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user and get client from profile
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get client name from user profile (fallback to shared)
    const { data: profile } = await supabase
      .from('profiles')
      .select('client')
      .eq('id', user.id)
      .single();
    
    const rawClient = Array.isArray(profile?.client) 
      ? profile.client[0] 
      : profile?.client;
    const client = rawClient && String(rawClient).trim().length > 0 ? String(rawClient) : 'Shared';
    
    if (DEBUG) {
      console.log('[RENDER API] User profile client:', profile?.client);
      console.log('[RENDER API] Extracted client:', client, '(type:', typeof client, ')');
    }
    
    const body = await request.json() as StartBody;
    const { modelFilename, modelName, variantName, views, background, resolution, aspectRatio, format, shadows, isModularUpload, tempGLBPath, sourceGlbUrl } = body || ({} as StartBody);
    if (!modelFilename || !modelName || !views || !Array.isArray(views) || views.length === 0 || !background || !resolution) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const prepWorkerBase = process.env.RENDER_PREP_WORKER_URL;
    const prepWorkerToken = process.env.RENDER_WORKER_API_TOKEN;
    const callbackToken = process.env.RENDER_CALLBACK_TOKEN;
    
    if (DEBUG) {
      console.log('[RENDER API] Prep worker URL:', prepWorkerBase);
    }
    
    if (!prepWorkerBase || !prepWorkerToken) {
      return NextResponse.json({ error: 'Server not configured: missing RENDER_PREP_WORKER_URL or RENDER_WORKER_API_TOKEN' }, { status: 500 });
    }
    if (!callbackToken) {
      return NextResponse.json({ error: 'Server not configured: missing RENDER_CALLBACK_TOKEN' }, { status: 500 });
    }

    // Get Bunny configuration based on sourceGlbUrl
    // IMPORTANT: Renders should go to the SAME storage zone as the source GLB
    let bunnyConfig = null;
    
    if (sourceGlbUrl) {
      try {
        const urlObj = new URL(sourceGlbUrl);
        const pullZoneUrl = urlObj.hostname; // e.g., wiltonbradley.b-cdn.net
        const storageZone = pullZoneUrl.replace('.b-cdn.net', ''); // e.g., wiltonbradley
        
        if (DEBUG) {
          console.log(`[RENDER API] Extracted storage zone from sourceGlbUrl: ${storageZone}`);
        }
        
        // Find which client owns this storage zone
        const { data: clientData } = await supabase
          .from("clients")
          .select("name, bunny_custom_structure, bunny_custom_url, bunny_custom_access_key")
          .eq("bunny_custom_url", storageZone)
          .eq("bunny_custom_structure", true)
          .single();

        if (clientData) {
          bunnyConfig = {
            storageZone: storageZone,
            accessKey: clientData.bunny_custom_access_key || process.env.BUNNY_STORAGE_KEY,
            pullZoneUrl: pullZoneUrl,
          };
          if (DEBUG) {
            console.log(`[RENDER API] Found storage owner: ${clientData.name}, bunnyConfig:`, bunnyConfig);
          }
        } else {
          console.warn(`[RENDER API] No client found owning storage zone: ${storageZone}, using defaults`);
        }
      } catch (e) {
        console.warn('[RENDER] Failed to extract bunnyConfig from sourceGlbUrl:', e);
      }
    }
    
    // Fallback: If sourceGlbUrl not provided or lookup failed, use logged-in client's config
    if (!bunnyConfig) {
      try {
        const { data: clientData } = await supabase
          .from("clients")
          .select("bunny_custom_structure, bunny_custom_url, bunny_custom_access_key")
          .eq("name", client)
          .single();

        if (clientData?.bunny_custom_structure && clientData?.bunny_custom_url) {
          bunnyConfig = {
            storageZone: clientData.bunny_custom_url.replace(/^\/+|\/+$/g, ""),
            accessKey: clientData.bunny_custom_access_key || process.env.BUNNY_STORAGE_KEY,
            pullZoneUrl: process.env.BUNNY_STORAGE_PUBLIC_URL?.replace(/^https?:\/\//, ''),
          };
          if (DEBUG) {
            console.log('[RENDER API] Using logged-in client bunnyConfig:', bunnyConfig);
          }
        } else {
          if (DEBUG) {
            console.log('[RENDER API] No custom bunnyConfig found, using defaults (@temp-remove compatibility)');
          }
        }
      } catch (e) {
        console.warn('[RENDER] Failed to fetch client Bunny config:', e);
      }
    }

    // Enqueue prep job and return jobId immediately (render will auto-start via combined-status)
    const prepPayload = {
      client,
      modelFilename,
      variantName: variantName || null,
      modelName,
      views,
      background,
      resolution,
      aspectRatio: aspectRatio || 'square',
      format: format || 'png',
      shadows: shadows !== undefined ? shadows : true, // Default to true if not provided
      isModularUpload: isModularUpload || false,
      tempGLBPath: tempGLBPath || null,
      bunnyConfig, // OPTIONAL: client-specific Bunny config (null for backward compatibility)
      sourceGlbUrl: sourceGlbUrl || null, // OPTIONAL: Direct URL to source GLB
    };
    
    if (DEBUG) {
      console.log('[RENDER API] Sending to prep server:', prepPayload);
    }
    
    const controller = new AbortController();
    const timeoutMs = Number(process.env.RENDER_PREP_TIMEOUT_MS || 15000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const prepRes = await fetch(`${prepWorkerBase.replace(/\/$/, '')}/jobs/render/prepare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${prepWorkerToken}`,
      },
      body: JSON.stringify(prepPayload),
      signal: controller.signal,
      cache: 'no-store',
    }).finally(() => clearTimeout(timeoutId));
    const prepJson = await prepRes.json().catch(() => ({}));
    if (!prepRes.ok) {
      console.error('[RENDER API] Prep server error:', prepRes.status, prepJson);
      return NextResponse.json({ error: prepJson?.error || 'Failed to enqueue prep' }, { status: prepRes.status });
    }

    const { jobId } = prepJson as { jobId: string };
    if (!jobId) {
      return NextResponse.json({ error: 'Prep worker returned invalid response' }, { status: 500 });
    }

    // Register job in server-side registry
    try {
      await fetch(`${new URL(request.url).origin}/api/render/jobs/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          client,
          modelName,
          variantName: variantName || null,
          views,
          background,
          resolution,
          aspectRatio: aspectRatio || 'square',
          format: format || 'png',
          createdAt: new Date().toISOString(),
        })
      }).catch(() => null);
    } catch {}
    return NextResponse.json({ jobId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to start render';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


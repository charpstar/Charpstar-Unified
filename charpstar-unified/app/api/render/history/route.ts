import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import https from 'https';

export const runtime = 'nodejs';

function getHostname() {
  const REGION = process.env.BUNNY_REGION || '';
  const BASE_HOSTNAME = 'storage.bunnycdn.com';
  return REGION ? `${REGION}.${BASE_HOSTNAME}` : BASE_HOSTNAME;
}

async function listDirectory(zone: string, dirPath: string, accessKey: string): Promise<any[]> {
  const host = getHostname();
  const options: https.RequestOptions = {
    method: 'GET',
    host,
    path: `/${zone}/${dirPath.replace(/^\/+/, '')}`.replace(/\/+$/,'/') ,
    headers: { AccessKey: accessKey },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve([]); }
        } else if (res.statusCode === 404) {
          resolve([]);
        } else {
          reject(new Error(`List failed ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
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
    
    const { searchParams } = new URL(request.url);
    const modelName = searchParams.get('model');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 200; // Default limit of 200 items (10 pages)
    
    if (!modelName) {
      return NextResponse.json({ error: 'model is required' }, { status: 400 });
    }

    // Get BunnyCDN configuration (new platform method)
    const storageKey = process.env.BUNNY_STORAGE_KEY;
    const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME || "maincdn";
    const cdnUrl = process.env.BUNNY_STORAGE_PUBLIC_URL;

    if (!storageKey || !storageZone || !cdnUrl) {
      return NextResponse.json({ error: 'Server not configured: BUNNY_* missing' }, { status: 500 });
    }

    // IMPORTANT: Renders ALWAYS go to maincdn storage zone (not custom client zones)
    // This is because the worker.py script has a hardcoded path structure for renders
    // So we should ALWAYS check maincdn for render history, regardless of client config
    const finalStorageZone = storageZone; // Always use maincdn for renders
    const finalAccessKey = storageKey; // Always use maincdn access key

    // PATH STRUCTURE: Client-Editor/<client>/Renders/<modelName>/<variant>/{view}_{resolution}_{background}_{timestamp}.{format}
    // Example: Client-Editor/Synsam/Renders/chair_model/default/back_1024_d9c6b3_20251110T180453.jpg
    const rootDir = `Client-Editor/${client}/Renders/${encodeURIComponent(modelName)}/`;

    const variants = await listDirectory(finalStorageZone, rootDir, finalAccessKey).catch(() => []);
    
    const out: Array<{ url: string; variant: string; view?: string; resolution?: number; background?: string; timestamp?: string; filename: string; format?: string; }>= [];
    
    // Fetch files directly from each variant folder (no nested timestamp folders)
    for (const v of variants || []) {
      if (!v || !v.IsDirectory) continue;
      const variant = v.ObjectName?.replace(/\/$/, '') || 'default';
      
      const files = await listDirectory(finalStorageZone, rootDir + variant + '/', finalAccessKey).catch(() => []);
      for (const f of files || []) {
        if (!f || f.IsDirectory) continue;
        const filename: string = f.ObjectName || '';
        
        // Parse {view}_{resolution}_{background}_{timestamp}.{format} from filename
        // Example: back_1024_d9c6b3_20251110T180453.jpg
        let view: string | undefined; 
        let resolution: number | undefined; 
        let background: string | undefined;
        let timestamp: string | undefined;
        let format: string | undefined;
        
        // Extract extension
        const extMatch = filename.match(/\.(png|jpg|jpeg|webp)$/i);
        if (extMatch) format = extMatch[1].toLowerCase();
        
        const base = filename.replace(/\.(png|jpg|jpeg|webp)$/i, '');
        const parts = base.split('_');
        
        // Expected format: view_resolution_background_timestamp
        // Minimum 4 parts, but background and timestamp might contain underscores
        if (parts.length >= 4) {
          view = parts[0];
          const resNum = parseInt(parts[1], 10); 
          if (!Number.isNaN(resNum)) resolution = resNum;
          
          // Last part is timestamp (format: 20251110T180453)
          timestamp = parts[parts.length - 1];
          
          // Everything between resolution and timestamp is background
          background = parts.slice(2, parts.length - 1).join('_');
        }
        
        const storagePath = `${rootDir}${variant}/${filename}`;
        const url = `${cdnUrl}/${storagePath}`;
        out.push({ url, variant, view, resolution, background, timestamp, filename, format });
      }
    }

    // Sort by timestamp DESC (newest first)
    out.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    
    // Apply limit
    const limitedItems = limit > 0 ? out.slice(0, limit) : out;
    
    return NextResponse.json({ 
      items: limitedItems, 
      total: out.length, 
      limited: out.length > limitedItems.length
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to list history';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


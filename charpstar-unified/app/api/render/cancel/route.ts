import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
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
    
    const body = await request.json();
    const jobId = body?.jobId as string;
    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }
    const prepBase = process.env.RENDER_PREP_WORKER_URL;
    const prepToken = process.env.RENDER_WORKER_API_TOKEN;
    if (!prepBase || !prepToken) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    const res = await fetch(`${prepBase.replace(/\/$/, '')}/jobs/render/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${prepToken}` },
      body: JSON.stringify({ jobId, client })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: json?.error || 'Failed to cancel job' }, { status: res.status });
    }
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to cancel job' }, { status: 500 });
  }
}


import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { logActivityServer } from "@/lib/serverActivityLogger";

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get the current user
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
      return NextResponse.json(
        { error: "Authentication error" },
        { status: 401 }
      );
    }

    if (!session) {
      console.error("No session found");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's profile to get their client
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("client")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const client = searchParams.get("client") || profile?.client || null;

    // Build the query
    let query = supabase.from("assets").select("*");

    // Add client filter if provided
    if (client) {
      query = query.eq("client", client);
    }

    // Add search filter if provided
    if (search) {
      query = query.ilike("product_name", `%${search}%`);
    }

    // Execute the query
    const { data: assets, error } = await query;

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch assets" },
        { status: 500 }
      );
    }

    if (!assets) {
      console.error("No assets found");
      return NextResponse.json({ assets: [] }, { status: 200 });
    }

    // Parse materials and colors from string arrays to actual arrays
    const parsedAssets = assets.map((asset) => ({
      ...asset,
      materials: Array.isArray(asset.materials)
        ? asset.materials
        : JSON.parse(asset.materials || "[]"),
      colors: Array.isArray(asset.colors)
        ? asset.colors
        : JSON.parse(asset.colors || "[]"),
      tags: Array.isArray(asset.tags)
        ? asset.tags
        : JSON.parse(asset.tags || "[]"),
    }));

    return NextResponse.json({ assets: parsedAssets });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  try {
    const formData = await req.formData();
    const product_name = formData.get("product_name") as string;
    const product_link = formData.get("product_link") as string;
    const glb_link = formData.get("glb_link") as string;
    const category = formData.get("category") as string;
    const subcategory = formData.get("subcategory") as string;
    const client = formData.get("client") as string;
    const materials = JSON.parse((formData.get("materials") as string) || "[]");
    const colors = JSON.parse((formData.get("colors") as string) || "[]");
    const preview_image = formData.get("preview_image");
    const created_at =
      (formData.get("created_at") as string) || new Date().toISOString();
    let preview_image_url = null;

    if (
      preview_image &&
      typeof preview_image === "object" &&
      "arrayBuffer" in preview_image
    ) {
      const buffer = Buffer.from(await preview_image.arrayBuffer());
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileName = `previews/${Date.now()}_${randomString}_${product_name.replace(/\s+/g, "_")}.png`;
      const { error } = await supabase.storage
        .from("assets")
        .upload(fileName, buffer, {
          contentType: preview_image.type || "image/png",
          upsert: true,
        });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const { data: urlData } = supabase.storage
        .from("assets")
        .getPublicUrl(fileName);
      preview_image_url = urlData.publicUrl;
    }

    const { data, error } = await supabase
      .from("assets")
      .insert([
        {
          product_name,
          product_link,
          glb_link,
          category,
          subcategory,
          client,
          materials,
          colors,
          preview_image: preview_image_url,
          created_at,
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the asset creation activity using server-side logging
    try {
      await logActivityServer({
        action: `Uploaded asset: ${product_name}`,
        type: "upload",
        resource_type: "asset",
        resource_id: data.id,
        metadata: {
          asset_name: product_name,
          category,
          subcategory,
          client,
        },
      });
    } catch (activityError) {
      console.error("Error logging activity for asset:", activityError);
    }

    return NextResponse.json({ asset: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

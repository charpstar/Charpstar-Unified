import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin, QA, or the user themselves
    const { data: profile } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const { id: userId } = await params;

    if (
      !profile ||
      (!["admin", "qa"].includes(profile.role) && user.id !== userId)
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch portfolio images for the user (without profile join for now)
    const { data: images, error } = await supabaseAdmin
      .from("user_portfolio_images")
      .select("*")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching portfolio images:", error);
      return NextResponse.json(
        { error: "Failed to fetch portfolio images" },
        { status: 500 }
      );
    }

    return NextResponse.json({ images: images || [] });
  } catch (error) {
    console.error("Error in portfolio API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id: userId } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    if (!file || !title) {
      return NextResponse.json(
        { error: "File and title are required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from("user-portfolios")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Error uploading file:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload file" },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from("user-portfolios")
        .getPublicUrl(fileName);

      // Insert portfolio image record with creator email and name
      console.log("Creating portfolio image with email:", user.email);
      const { data: portfolioImage, error: dbError } = await supabaseAdmin
        .from("user_portfolio_images")
        .insert({
          user_id: userId,
          url: urlData.publicUrl,
          title,
          description: description || null,
          uploaded_by: user.id,
          created_by_email: user.email,
          uploaded_by_name: user.user_metadata?.name || user.email || "Unknown",
        })
        .select()
        .single();

      if (dbError) {
        console.error("Error saving portfolio image:", dbError);
        // Try to clean up uploaded file
        await supabaseAdmin.storage.from("user-portfolios").remove([fileName]);

        return NextResponse.json(
          { error: "Failed to save portfolio image" },
          { status: 500 }
        );
      }

      return NextResponse.json({ image: portfolioImage });
    } catch (uploadError) {
      console.error("Error in file upload process:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in portfolio POST API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

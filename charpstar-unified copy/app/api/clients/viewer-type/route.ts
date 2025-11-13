import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const name = searchParams.get("name");

    if (!id && !name) {
      return NextResponse.json(
        { error: "Provide either id or name query parameter" },
        { status: 400 }
      );
    }

    const attempts: Array<() => Promise<{ viewer_type: string | null }[]>> = [];

    if (id) {
      const normalizedId = id.trim();
      if (!normalizedId) {
        return NextResponse.json(
          { error: "Client id cannot be empty" },
          { status: 400 }
        );
      }

      attempts.push(async () => {
        const { data, error } = await supabaseAdmin
          .from("clients")
          .select("viewer_type")
          .eq("id", normalizedId)
          .limit(1);

        if (error) throw error;
        return data ?? [];
      });
    }

    if (name) {
      const normalizedName = name.trim();
      if (!normalizedName) {
        return NextResponse.json(
          { error: "Client name cannot be empty" },
          { status: 400 }
        );
      }

      attempts.push(async () => {
        const { data, error } = await supabaseAdmin
          .from("clients")
          .select("viewer_type")
          .eq("name", normalizedName)
          .limit(1);

        if (error) throw error;
        return data ?? [];
      });

      attempts.push(async () => {
        const { data, error } = await supabaseAdmin
          .from("clients")
          .select("viewer_type")
          .ilike("name", normalizedName)
          .limit(1);

        if (error) throw error;
        return data ?? [];
      });

      if (!normalizedName.includes("%") && !normalizedName.includes("_")) {
        attempts.push(async () => {
          const { data, error } = await supabaseAdmin
            .from("clients")
            .select("viewer_type")
            .ilike("name", `%${normalizedName}%`)
            .limit(1);

          if (error) throw error;
          return data ?? [];
        });
      }
    }

    for (const attempt of attempts) {
      try {
        const result = await attempt();
        if (result.length > 0) {
          return NextResponse.json({
            viewerType: result[0]?.viewer_type ?? null,
          });
        }
      } catch (error) {
        console.error("Error fetching client viewer type:", error);
        return NextResponse.json(
          { error: "Failed to fetch client viewer type" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  } catch (error) {
    console.error("Unexpected error fetching client viewer type:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

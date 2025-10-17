import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, client")
      .eq("id", session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only allow clients to access this endpoint
    if (profile.role === "admin") {
      return NextResponse.json({ remainingChanges: null });
    }

    const { searchParams } = new URL(request.url);
    const clientName = searchParams.get("client");

    if (!clientName) {
      return NextResponse.json(
        { error: "Client parameter is required" },
        { status: 400 }
      );
    }

    // Check if user has access to this client
    const isOwner = Array.isArray(profile.client)
      ? profile.client.includes(clientName)
      : profile.client === clientName;

    if (!isOwner) {
      return NextResponse.json(
        { error: "You don't have access to this client's data" },
        { status: 403 }
      );
    }

    const currentYear = new Date().getFullYear();

    // Get client's change limit - try exact match first, then case-insensitive
    let { data: clientData } = await supabase
      .from("clients")
      .select("models_in_contract, change_percentage")
      .eq("name", clientName)
      .single();

    // If no exact match, try case-insensitive search
    if (!clientData) {
      const { data: allClients } = await supabase
        .from("clients")
        .select("name, models_in_contract, change_percentage");

      const matchingClient = allClients?.find(
        (client) => client.name.toLowerCase() === clientName.toLowerCase()
      );

      if (matchingClient) {
        clientData = {
          models_in_contract: matchingClient.models_in_contract,
          change_percentage: matchingClient.change_percentage,
        };
      }
    }

    if (!clientData) {
      return NextResponse.json({ remainingChanges: 0 });
    }

    const changeLimit =
      clientData.models_in_contract && clientData.change_percentage
        ? Math.floor(
            (clientData.models_in_contract * clientData.change_percentage) / 100
          )
        : 0;

    // Get current year's changes
    const { data: changesData } = await supabase
      .from("asset_changes")
      .select("change_count")
      .eq("client", clientName)
      .eq("year", currentYear)
      .single();

    const changesUsed = changesData?.change_count || 0;
    const remainingChanges = Math.max(0, changeLimit - changesUsed);

    return NextResponse.json({ remainingChanges });
  } catch (error) {
    console.error("Error fetching remaining changes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * POST /api/client-product-assignments/allocate
 *
 * Allocate products to client colleagues (product owners).
 * Only clients can allocate products they own.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a client and specifically a client_admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, client, client_role")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    if (profile.role !== "client") {
      return NextResponse.json(
        { error: "Only clients can allocate products" },
        { status: 403 }
      );
    }

    // Only client_admin can allocate products
    // Default to client_admin for backward compatibility if client_role is null
    const clientRole = profile.client_role || "client_admin";
    if (clientRole !== "client_admin") {
      return NextResponse.json(
        { error: "Only client admins can allocate products to colleagues" },
        { status: 403 }
      );
    }

    const { assetIds, assignedToUserId } = await request.json();

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { error: "assetIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!assignedToUserId || typeof assignedToUserId !== "string") {
      return NextResponse.json(
        { error: "assignedToUserId is required" },
        { status: 400 }
      );
    }

    // Verify assigned user is also a client
    const { data: assignedUser, error: assignedUserError } = await supabase
      .from("profiles")
      .select("id, role, client")
      .eq("id", assignedToUserId)
      .single();

    if (assignedUserError || !assignedUser) {
      return NextResponse.json(
        { error: "Assigned user not found" },
        { status: 404 }
      );
    }

    if (assignedUser.role !== "client") {
      return NextResponse.json(
        { error: "Can only assign to client users" },
        { status: 400 }
      );
    }

    // Normalize client array from profile
    const userClients = Array.isArray(profile.client)
      ? profile.client
      : profile.client
        ? [profile.client]
        : [];

    // Verify all assets belong to the user's clients
    const { data: assets, error: assetsError } = await supabase
      .from("onboarding_assets")
      .select("id, client")
      .in("id", assetIds)
      .in("client", userClients);

    if (assetsError) {
      console.error("Error fetching assets:", assetsError);
      return NextResponse.json(
        { error: "Failed to verify assets" },
        { status: 500 }
      );
    }

    if (!assets || assets.length !== assetIds.length) {
      return NextResponse.json(
        { error: "Some assets not found or don't belong to your clients" },
        { status: 400 }
      );
    }

    // Get client name from first asset (all should have same client for a single allocation)
    const clientName = assets[0]?.client;
    if (!clientName) {
      return NextResponse.json(
        { error: "Assets must have a client" },
        { status: 400 }
      );
    }

    // Check if assigned user has access to the same client
    const assignedUserClients = Array.isArray(assignedUser.client)
      ? assignedUser.client
      : assignedUser.client
        ? [assignedUser.client]
        : [];

    if (!assignedUserClients.includes(clientName)) {
      return NextResponse.json(
        { error: "Assigned user does not have access to this client" },
        { status: 400 }
      );
    }

    // Prepare assignments
    const assignments = assetIds.map((assetId: string) => ({
      asset_id: assetId,
      assigned_by_user_id: session.user.id,
      assigned_to_user_id: assignedToUserId,
      client_name: clientName,
    }));

    // Insert assignments (ignore duplicates due to UNIQUE constraint)
    const { data: insertedAssignments, error: insertError } = await supabase
      .from("client_product_assignments")
      .insert(assignments)
      .select();

    if (insertError) {
      // Check if error is due to duplicate (already assigned)
      if (insertError.code === "23505") {
        // Try to insert one by one to handle partial duplicates
        const successful: string[] = [];
        const failed: string[] = [];

        for (const assignment of assignments) {
          const { error: singleError } = await supabase
            .from("client_product_assignments")
            .insert(assignment);

          if (singleError) {
            if (singleError.code === "23505") {
              failed.push(assignment.asset_id);
            } else {
              console.error("Error inserting assignment:", singleError);
              failed.push(assignment.asset_id);
            }
          } else {
            successful.push(assignment.asset_id);
          }
        }

        if (successful.length === 0) {
          return NextResponse.json(
            { error: "All products are already assigned to this user" },
            { status: 409 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Assigned ${successful.length} product(s). ${failed.length} were already assigned.`,
          assigned: successful,
          alreadyAssigned: failed,
        });
      }

      console.error("Error creating assignments:", insertError);
      return NextResponse.json(
        { error: "Failed to create assignments" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${insertedAssignments?.length || 0} product(s)`,
      assignments: insertedAssignments,
    });
  } catch (error: any) {
    console.error("Error in allocate endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

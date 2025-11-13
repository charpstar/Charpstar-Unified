import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireQaUser() {
  const supabaseAuth = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const { data: profile, error: profileError } = await supabaseAuth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Failed to fetch QA profile:", profileError);
    return { error: "Failed to verify user role", status: 500 } as const;
  }

  if ((profile?.role || "").toLowerCase() !== "qa") {
    return { error: "QA access required", status: 403 } as const;
  }

  return { userId: user.id } as const;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const authCheck = await requireQaUser();
    if ("error" in authCheck) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const qaId = authCheck.userId;

    const [
      { data: qaAllocations, error: qaAllocationsError },
      { data: overrideAssignments, error: overrideAssignmentsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("qa_allocations")
        .select("modeler_id")
        .eq("qa_id", qaId),
      supabaseAdmin
        .from("asset_assignments")
        .select("allocation_list_id, asset_id")
        .eq("role", "qa")
        .eq("is_provisional", true)
        .eq("user_id", qaId)
        .not("allocation_list_id", "is", null),
    ]);

    if (qaAllocationsError) {
      console.error("Failed to fetch QA allocations:", qaAllocationsError);
      return NextResponse.json(
        { error: "Failed to load allocation lists" },
        { status: 500 }
      );
    }

    if (overrideAssignmentsError) {
      console.error("Failed to fetch QA overrides:", overrideAssignmentsError);
      return NextResponse.json(
        { error: "Failed to load allocation lists" },
        { status: 500 }
      );
    }

    const modelerIds = Array.from(
      new Set(
        (qaAllocations ?? [])
          .map((row) => row.modeler_id as string | null)
          .filter(
            (modelerId): modelerId is string =>
              typeof modelerId === "string" && modelerId.length > 0
          )
      )
    );

    const listSourceMap = new Map<
      string,
      {
        list: {
          id: string;
          name: string | null;
          number: number | null;
          status: string | null;
          deadline: string | null;
          created_at: string | null;
          bonus: number | null;
          user_id: string | null;
        };
        source: "default" | "override";
      }
    >();

    if (modelerIds.length > 0) {
      const { data: modelerLists, error: modelerListsError } =
        await supabaseAdmin
          .from("allocation_lists")
          .select(
            "id, name, number, status, deadline, created_at, bonus, user_id"
          )
          .in("user_id", modelerIds);

      if (modelerListsError) {
        console.error(
          "Failed to fetch allocation lists for QA:",
          modelerListsError
        );
        return NextResponse.json(
          { error: "Failed to load allocation lists" },
          { status: 500 }
        );
      }

      (modelerLists ?? []).forEach((list) => {
        listSourceMap.set(list.id, { list, source: "default" });
      });
    }

    const overrideListIds = Array.from(
      new Set(
        (overrideAssignments ?? [])
          .map((assignment) => assignment.allocation_list_id as string | null)
          .filter(
            (listId): listId is string =>
              typeof listId === "string" && listId.length > 0
          )
      )
    );

    const overrideListsToFetch = overrideListIds.filter(
      (listId) => !listSourceMap.has(listId)
    );

    if (overrideListsToFetch.length > 0) {
      const { data: additionalLists, error: additionalListsError } =
        await supabaseAdmin
          .from("allocation_lists")
          .select(
            "id, name, number, status, deadline, created_at, bonus, user_id"
          )
          .in("id", overrideListsToFetch);

      if (additionalListsError) {
        console.error(
          "Failed to fetch override allocation lists:",
          additionalListsError
        );
        return NextResponse.json(
          { error: "Failed to load allocation lists" },
          { status: 500 }
        );
      }

      (additionalLists ?? []).forEach((list) => {
        listSourceMap.set(list.id, { list, source: "override" });
      });
    }

    const candidateListIds = Array.from(listSourceMap.keys());

    if (candidateListIds.length === 0) {
      return NextResponse.json({ lists: [] });
    }

    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from("asset_assignments")
      .select("allocation_list_id, role, asset_id, user_id, is_provisional")
      .in("allocation_list_id", candidateListIds);

    if (assignmentsError) {
      console.error(
        "Failed to fetch allocation list assignments:",
        assignmentsError
      );
      return NextResponse.json(
        { error: "Failed to load allocation lists" },
        { status: 500 }
      );
    }

    const overridesByList = new Map<string, Set<string>>();
    const listAssetMap = new Map<string, Set<string>>();

    (assignments ?? []).forEach((assignment) => {
      const listId = assignment.allocation_list_id as string | null;
      if (!listId) return;

      if (assignment.role === "qa" && assignment.is_provisional) {
        const qaIdValue = assignment.user_id as string | null;
        if (!qaIdValue) return;
        if (!overridesByList.has(listId)) {
          overridesByList.set(listId, new Set());
        }
        overridesByList.get(listId)!.add(qaIdValue);
      }

      if (
        assignment.role === "modeler" ||
        (assignment.role === "qa" && assignment.is_provisional)
      ) {
        const assetId = assignment.asset_id as string | null;
        if (!assetId) return;
        if (!listAssetMap.has(listId)) {
          listAssetMap.set(listId, new Set());
        }
        listAssetMap.get(listId)!.add(assetId);
      }
    });

    const allAssetIds = Array.from(
      new Set(
        candidateListIds.flatMap((listId) => [
          ...(listAssetMap.get(listId) ?? []),
        ])
      )
    );

    let assetDetails: Array<{
      id: string;
      status: string | null;
      priority: number | null;
      client: string | null;
      product_name: string | null;
      article_id: string | null;
    }> = [];

    if (allAssetIds.length > 0) {
      const { data: assetsData, error: assetsError } = await supabaseAdmin
        .from("onboarding_assets")
        .select("id, status, priority, client, product_name, article_id")
        .in("id", allAssetIds);

      if (assetsError) {
        console.error("Failed to fetch assets:", assetsError);
        return NextResponse.json(
          { error: "Failed to load allocation lists" },
          { status: 500 }
        );
      }

      assetDetails = (assetsData ?? []) as typeof assetDetails;
    }

    const assetMap = new Map<string, (typeof assetDetails)[number]>();
    assetDetails.forEach((asset) => {
      if (asset.id) {
        assetMap.set(asset.id, asset);
      }
    });

    const modelerIdSet = new Set<string>();
    listSourceMap.forEach(({ list }) => {
      if (list.user_id) {
        modelerIdSet.add(list.user_id);
      }
    });

    let modelerProfiles: Array<{
      id: string;
      email: string | null;
      title?: string | null;
    }> = [];

    if (modelerIdSet.size > 0) {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, title")
        .in("id", Array.from(modelerIdSet));

      if (profileError) {
        console.error("Failed to fetch modeler profiles:", profileError);
        return NextResponse.json(
          { error: "Failed to load allocation lists" },
          { status: 500 }
        );
      }

      modelerProfiles = (profileData ?? []) as typeof modelerProfiles;
    }

    const modelerMap = new Map<
      string,
      { email: string | null; title?: string | null }
    >();
    modelerProfiles.forEach((profile) => {
      if (profile.id) {
        modelerMap.set(profile.id, {
          email: profile.email ?? null,
          title: profile.title ?? null,
        });
      }
    });

    const summaries: Array<{
      id: string;
      name: string | null;
      number: number | null;
      status: string | null;
      deadline: string | null;
      createdAt: string | null;
      bonus: number | null;
      modelerId: string | null;
      modelerEmail?: string | null;
      modelerTitle?: string | null;
      assetIds: string[];
      assetCount: number;
      urgentCount: number;
      statusBreakdown: Record<string, number>;
      clients: string[];
      assets: Array<{
        id: string;
        status: string | null;
        priority: number | null;
        client: string | null;
        productName: string | null;
        articleId: string | null;
      }>;
    }> = [];

    listSourceMap.forEach(({ list, source }) => {
      const overrides = overridesByList.get(list.id) ?? new Set<string>();
      const hasOverrides = overrides.size > 0;
      const includesQa = overrides.has(qaId);

      if (hasOverrides && !includesQa) {
        return;
      }

      if (source === "override" && !includesQa) {
        return;
      }

      const assetIds = Array.from(
        listAssetMap.get(list.id) ?? new Set<string>()
      );
      const statusCounts: Record<string, number> = {};
      const clientsSet = new Set<string>();
      let urgent = 0;
      const assets: Array<{
        id: string;
        status: string | null;
        priority: number | null;
        client: string | null;
        productName: string | null;
        articleId: string | null;
      }> = [];

      assetIds.forEach((assetId) => {
        const asset = assetMap.get(assetId);
        if (!asset) return;
        const statusKey = asset.status || "unknown";
        statusCounts[statusKey] = (statusCounts[statusKey] ?? 0) + 1;
        if (asset.priority === 1) urgent += 1;
        if (asset.client) clientsSet.add(asset.client);
        assets.push({
          id: assetId,
          status: asset.status ?? null,
          priority: asset.priority ?? null,
          client: asset.client ?? null,
          productName: asset.product_name ?? null,
          articleId: asset.article_id ?? null,
        });
      });

      const modelerInfo = list.user_id
        ? modelerMap.get(list.user_id)
        : undefined;

      summaries.push({
        id: list.id,
        name: list.name ?? null,
        number: list.number ?? null,
        status: list.status ?? null,
        deadline: list.deadline ?? null,
        createdAt: list.created_at ?? null,
        bonus: list.bonus ?? null,
        modelerId: list.user_id ?? null,
        modelerEmail: modelerInfo?.email ?? null,
        modelerTitle: modelerInfo?.title ?? null,
        assetIds,
        assetCount: assetIds.length,
        urgentCount: urgent,
        statusBreakdown: statusCounts,
        clients: Array.from(clientsSet),
        assets,
      });
    });

    summaries.sort((a, b) => {
      const dateA = a.deadline
        ? new Date(a.deadline).getTime()
        : Number.POSITIVE_INFINITY;
      const dateB = b.deadline
        ? new Date(b.deadline).getTime()
        : Number.POSITIVE_INFINITY;
      if (dateA !== dateB) return dateA - dateB;
      return (a.number ?? 0) - (b.number ?? 0);
    });

    return NextResponse.json({ lists: summaries });
  } catch (error) {
    console.error("Unexpected error fetching QA asset lists:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

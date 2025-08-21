import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { role, resource, permission_type, can_access } = await req.json();

  if (!role || !resource || !permission_type) {
    return NextResponse.json({ message: "Missing data" }, { status: 400 });
  }

  const table =
    permission_type === "page"
      ? "role_permissions"
      : "role_feature_permissions";
  const key = permission_type === "page" ? "page" : "feature";

  const { error } = await supabaseAdmin
    .from(table)
    .upsert([{ role, [key]: resource, can_access }], {
      onConflict: `${key},role`,
    });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// PATCH /api/videos/:id — status (approve/reject) e notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if ("status" in body) {
    const status = body.status;
    if (!["pending", "approved", "rejected", "analyzed"].includes(status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }
    patch.status = status;
    // `approved` espelha o status para consultas simples
    patch.approved = status === "approved" ? true : status === "rejected" ? false : null;
  }
  if ("notes" in body) patch.notes = body.notes || null;

  const { data, error } = await supabaseAdmin()
    .from("videos")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

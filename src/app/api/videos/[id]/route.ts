import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH /api/videos/:id — status (approve/reject) e notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const sets: string[] = [];
  const values: unknown[] = [];

  if ("status" in body) {
    const status = body.status;
    if (!["pending", "approved", "rejected", "analyzed"].includes(status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }
    values.push(status);
    sets.push(`status = $${values.length}`);
    // `approved` espelha o status para consultas simples
    values.push(status === "approved" ? true : status === "rejected" ? false : null);
    sets.push(`approved = $${values.length}`);
  }
  if ("notes" in body) {
    values.push(body.notes || null);
    sets.push(`notes = $${values.length}`);
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: "nada para atualizar" }, { status: 400 });
  }

  values.push(id);
  const row = await one(
    `update videos set ${sets.join(", ")} where id = $${values.length} returning *`,
    values,
  );
  if (!row) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(row);
}

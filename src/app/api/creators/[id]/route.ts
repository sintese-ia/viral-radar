import { NextRequest, NextResponse } from "next/server";
import { one, q } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/creators/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await one("select * from creators where id = $1", [id]);
  if (!row) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(row);
}

// PATCH /api/creators/:id — approve/reject, notes, followers etc.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const allowed = [
    "name",
    "country",
    "followers_count",
    "niche",
    "positioning",
    "notes",
    "approved",
    "profile_url",
  ];
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in body) {
      values.push(body[key]);
      sets.push(`${key} = $${values.length}`);
    }
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: "nada para atualizar" }, { status: 400 });
  }
  values.push(id);
  const row = await one(
    `update creators set ${sets.join(", ")} where id = $${values.length} returning *`,
    values,
  );
  if (!row) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(row);
}

// DELETE /api/creators/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await q("delete from creators where id = $1", [id]);
  return NextResponse.json({ ok: true });
}

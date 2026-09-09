import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { medianViews } from "@/lib/metrics";
import type { Creator, CreatorWithStats } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/creators — lista com stats agregadas por creator
export async function GET() {
  const db = supabaseAdmin();
  const [{ data: creators, error: cErr }, { data: videos, error: vErr }] =
    await Promise.all([
      db.from("creators").select("*").order("created_at", { ascending: false }),
      db.from("videos").select("creator_id, views, outlier_score"),
    ]);
  if (cErr || vErr) {
    return NextResponse.json({ error: (cErr ?? vErr)!.message }, { status: 500 });
  }

  const byCreator = new Map<string, { views: number | null; outlier_score: number | null }[]>();
  for (const v of videos ?? []) {
    const list = byCreator.get(v.creator_id) ?? [];
    list.push(v);
    byCreator.set(v.creator_id, list);
  }

  const result: CreatorWithStats[] = (creators as Creator[]).map((c) => {
    const vids = byCreator.get(c.id) ?? [];
    const scores = vids
      .map((v) => v.outlier_score)
      .filter((s): s is number => typeof s === "number");
    return {
      ...c,
      video_count: vids.length,
      median_views: medianViews(vids),
      max_outlier_score: scores.length ? Math.max(...scores) : null,
    };
  });

  return NextResponse.json(result);
}

// POST /api/creators — cadastra creator
export async function POST(req: NextRequest) {
  const body = await req.json();
  const handle = String(body.handle ?? "").trim().replace(/^@/, "");
  if (!handle) {
    return NextResponse.json({ error: "handle é obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("creators")
    .insert({
      name: String(body.name ?? handle).trim(),
      handle,
      platform: body.platform ?? "instagram",
      country: body.country || null,
      profile_url: body.profile_url || `https://www.instagram.com/${handle}/`,
      followers_count: body.followers_count ? Number(body.followers_count) : null,
      niche: body.niche || null,
      positioning: body.positioning || null,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json(data, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchReels, fetchFollowersCount } from "@/lib/apify";
import { computeCreatorMetrics, medianViews } from "@/lib/metrics";
import type { Creator } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // o actor pode levar alguns minutos

// POST /api/creators/:id/sync — coleta Reels via Apify, upserta e recalcula métricas
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50);
  const db = supabaseAdmin();

  const { data: creator, error: cErr } = await db
    .from("creators")
    .select("*")
    .eq("id", id)
    .single<Creator>();
  if (cErr || !creator) {
    return NextResponse.json({ error: "creator não encontrado" }, { status: 404 });
  }

  try {
    // followers atualizados (não bloqueia se falhar) + reels, em paralelo
    const [freshFollowers, reels] = await Promise.all([
      fetchFollowersCount(creator.handle),
      fetchReels(creator.handle, limit),
    ]);
    const followers = freshFollowers ?? creator.followers_count;

    if (reels.length === 0) {
      return NextResponse.json(
        { error: "Apify não retornou vídeos (perfil privado, sem reels ou handle errado?)" },
        { status: 422 },
      );
    }

    // Upsert por (platform, external_id) — não toca status/approved/notes de
    // vídeos já revisados; métricas brutas e raw_data são atualizadas.
    const rows = reels.map((r) => ({
      ...r,
      creator_id: creator.id,
      creator_followers_at_capture: followers,
    }));
    const { error: upErr } = await db
      .from("videos")
      .upsert(rows, { onConflict: "platform,external_id" });
    if (upErr) throw new Error(`upsert videos: ${upErr.message}`);

    // Recalcula métricas derivadas sobre TODOS os vídeos do creator
    const { data: allVideos, error: vErr } = await db
      .from("videos")
      .select("id, external_id, platform, creator_id, views, likes, comments, shares, creator_followers_at_capture")
      .eq("creator_id", creator.id);
    if (vErr) throw new Error(vErr.message);

    const metrics = computeCreatorMetrics(allVideos!, followers);
    const metricRows = allVideos!.map((v) => ({
      id: v.id,
      external_id: v.external_id,
      platform: v.platform,
      creator_id: v.creator_id,
      ...metrics.get(v.id)!,
    }));
    const { error: mErr } = await db
      .from("videos")
      .upsert(metricRows, { onConflict: "id" });
    if (mErr) throw new Error(`update métricas: ${mErr.message}`);

    await db
      .from("creators")
      .update({ last_synced_at: new Date().toISOString(), followers_count: followers })
      .eq("id", creator.id);

    return NextResponse.json({
      synced: reels.length,
      total_videos: allVideos!.length,
      median_views: medianViews(allVideos!),
      followers_count: followers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Sync falhou: ${message}` }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { one, q } from "@/lib/db";
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

  const creator = await one<Creator>("select * from creators where id = $1", [id]);
  if (!creator) {
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
    for (const r of reels) {
      await q(
        `insert into videos (creator_id, external_id, platform, original_url, thumbnail_url,
                             video_url, caption, published_at, duration_seconds,
                             views, likes, comments, shares, plays,
                             creator_followers_at_capture, raw_data)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         on conflict (platform, external_id) do update set
           original_url = excluded.original_url,
           thumbnail_url = excluded.thumbnail_url,
           video_url = excluded.video_url,
           caption = excluded.caption,
           published_at = excluded.published_at,
           duration_seconds = excluded.duration_seconds,
           views = excluded.views,
           likes = excluded.likes,
           comments = excluded.comments,
           shares = excluded.shares,
           plays = excluded.plays,
           creator_followers_at_capture = excluded.creator_followers_at_capture,
           raw_data = excluded.raw_data`,
        [
          creator.id,
          r.external_id,
          r.platform,
          r.original_url,
          r.thumbnail_url,
          r.video_url,
          r.caption,
          r.published_at,
          r.duration_seconds,
          r.views,
          r.likes,
          r.comments,
          r.shares,
          r.plays,
          followers,
          JSON.stringify(r.raw_data),
        ],
      );
    }

    // Recalcula métricas derivadas sobre TODOS os vídeos do creator
    const allVideos = await q<{
      id: string;
      views: number | null;
      likes: number | null;
      comments: number | null;
      shares: number | null;
      creator_followers_at_capture: number | null;
    }>(
      `select id, views::float as views, likes::float as likes, comments::float as comments,
              shares::float as shares, creator_followers_at_capture::float as creator_followers_at_capture
       from videos where creator_id = $1`,
      [creator.id],
    );

    const metrics = computeCreatorMetrics(allVideos, followers);
    for (const v of allVideos) {
      const m = metrics.get(v.id)!;
      await q(
        `update videos set outlier_score = $1, engagement_rate = $2,
                view_to_follower_ratio = $3, viral_rank = $4 where id = $5`,
        [m.outlier_score, m.engagement_rate, m.view_to_follower_ratio, m.viral_rank, v.id],
      );
    }

    await q("update creators set last_synced_at = now(), followers_count = $1 where id = $2", [
      followers,
      creator.id,
    ]);

    return NextResponse.json({
      synced: reels.length,
      total_videos: allVideos.length,
      median_views: medianViews(allVideos),
      followers_count: followers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Sync falhou: ${message}` }, { status: 502 });
  }
}

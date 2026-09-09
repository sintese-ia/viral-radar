import { NextRequest, NextResponse } from "next/server";
import { isUniqueViolation, one, q } from "@/lib/db";
import type { CreatorWithStats } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/creators — lista com stats agregadas por creator
export async function GET() {
  try {
    const rows = await q<CreatorWithStats>(`
      select c.*,
             coalesce(s.video_count, 0)::int as video_count,
             s.median_views,
             s.max_outlier_score
      from creators c
      left join (
        select creator_id,
               count(*) as video_count,
               percentile_cont(0.5) within group (order by views)
                 filter (where views > 0) as median_views,
               max(outlier_score) as max_outlier_score
        from videos
        group by creator_id
      ) s on s.creator_id = c.id
      order by c.created_at desc
    `);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/creators — cadastra creator
export async function POST(req: NextRequest) {
  const body = await req.json();
  const handle = String(body.handle ?? "").trim().replace(/^@/, "");
  if (!handle) {
    return NextResponse.json({ error: "handle é obrigatório" }, { status: 400 });
  }

  try {
    const row = await one(
      `insert into creators (name, handle, platform, country, profile_url, followers_count, niche, positioning, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        String(body.name ?? handle).trim(),
        handle,
        body.platform ?? "instagram",
        body.country || null,
        body.profile_url || `https://www.instagram.com/${handle}/`,
        body.followers_count ? Number(body.followers_count) : null,
        body.niche || null,
        body.positioning || null,
        body.notes || null,
      ],
    );
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: `@${handle} já cadastrado` }, { status: 409 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

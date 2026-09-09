import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

const SORTS: Record<string, string> = {
  outlier: "v.outlier_score desc nulls last",
  views: "v.views desc nulls last",
  engagement: "v.engagement_rate desc nulls last",
  newest: "v.published_at desc nulls last",
};

// GET /api/videos?creator_id=&status=&sort=&top=
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const creatorId = sp.get("creator_id");
  const status = sp.get("status");
  const sort = SORTS[sp.get("sort") ?? "outlier"] ?? SORTS.outlier;
  const top = sp.get("top") ? Number(sp.get("top")) : null;

  const where: string[] = [];
  const values: unknown[] = [];
  if (creatorId) {
    values.push(creatorId);
    where.push(`v.creator_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    where.push(`v.status = $${values.length}`);
  }
  if (top) {
    values.push(top);
    where.push(`v.viral_rank is not null and v.viral_rank <= $${values.length}`);
  }

  try {
    const rows = await q(
      `select v.*,
              v.views::float as views, v.likes::float as likes, v.comments::float as comments,
              v.shares::float as shares, v.plays::float as plays,
              v.outlier_score::float as outlier_score,
              v.engagement_rate::float as engagement_rate,
              v.view_to_follower_ratio::float as view_to_follower_ratio,
              json_build_object('name', c.name, 'handle', c.handle,
                                'followers_count', c.followers_count) as creators
       from videos v
       join creators c on c.id = v.creator_id
       ${where.length ? "where " + where.join(" and ") : ""}
       order by ${sort}
       limit 1000`,
      values,
    );
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

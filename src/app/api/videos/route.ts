import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// GET /api/videos?creator_id=&status=&sort=&top=
// sort: outlier (default) | views | engagement | newest
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const creatorId = sp.get("creator_id");
  const status = sp.get("status");
  const sort = sp.get("sort") ?? "outlier";
  const top = sp.get("top") ? Number(sp.get("top")) : null;

  let q = supabaseAdmin().from("videos").select("*, creators(name, handle, followers_count)");
  if (creatorId) q = q.eq("creator_id", creatorId);
  if (status) q = q.eq("status", status);

  switch (sort) {
    case "views":
      q = q.order("views", { ascending: false, nullsFirst: false });
      break;
    case "engagement":
      q = q.order("engagement_rate", { ascending: false, nullsFirst: false });
      break;
    case "newest":
      q = q.order("published_at", { ascending: false, nullsFirst: false });
      break;
    default:
      q = q.order("outlier_score", { ascending: false, nullsFirst: false });
  }

  // top N = corte por viral_rank (posição dentro do creator)
  if (top) q = q.lte("viral_rank", top);

  const { data, error } = await q.limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

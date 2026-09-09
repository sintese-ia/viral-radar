import { ApifyClient } from "apify-client";

/**
 * Actors escolhidos (ver README para o racional):
 * - apify/instagram-reel-scraper  → Reels de um perfil (oficial Apify, mantido,
 *   retorna views/plays/likes/comments/duração/videoUrl/thumbnail)
 * - apify/instagram-profile-scraper → só para atualizar followers_count no sync
 *   (o reel scraper não traz followers)
 */
const REEL_ACTOR = "apify/instagram-reel-scraper";
const PROFILE_ACTOR = "apify/instagram-profile-scraper";

function client(): ApifyClient {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN não configurado no .env.local");
  return new ApifyClient({ token });
}

/** Item normalizado, pronto para upsert em `videos`. */
export interface NormalizedReel {
  external_id: string;
  platform: "instagram";
  original_url: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  caption: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  plays: number | null;
  raw_data: Record<string, unknown>;
}

type RawItem = Record<string, unknown>;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

export function normalizeReel(item: RawItem): NormalizedReel | null {
  const externalId = str(item.id) ?? str(item.shortCode);
  if (!externalId) return null;

  const shortCode = str(item.shortCode);
  const url =
    str(item.url) ?? (shortCode ? `https://www.instagram.com/reel/${shortCode}/` : null);

  // views vs plays: o actor reporta videoViewCount e/ou videoPlayCount.
  // Tratamos "views" como o melhor número disponível e guardamos plays à parte.
  const viewCount = num(item.videoViewCount);
  const playCount = num(item.videoPlayCount) ?? num(item.playCount);

  return {
    external_id: externalId,
    platform: "instagram",
    original_url: url,
    thumbnail_url: str(item.displayUrl) ?? str(item.thumbnailUrl),
    video_url: str(item.videoUrl),
    caption: str(item.caption),
    published_at: str(item.timestamp),
    duration_seconds: num(item.videoDuration),
    views: viewCount ?? playCount,
    likes: num(item.likesCount),
    comments: num(item.commentsCount),
    shares: num(item.sharesCount) ?? num(item.reshareCount), // raramente disponível
    plays: playCount,
    raw_data: item,
  };
}

/** Roda o reel scraper para um handle e devolve os itens normalizados. */
export async function fetchReels(
  handle: string,
  limit = 50,
): Promise<NormalizedReel[]> {
  const run = await client().actor(REEL_ACTOR).call(
    { username: [handle.replace(/^@/, "")], resultsLimit: limit },
    { timeout: 300 },
  );
  const { items } = await client()
    .dataset(run.defaultDatasetId)
    .listItems({ limit: limit * 2 });

  const normalized: NormalizedReel[] = [];
  for (const item of items as RawItem[]) {
    // itens de erro do actor vêm sem id (ex.: {error: "no_items"})
    const n = normalizeReel(item);
    if (n) normalized.push(n);
  }
  return normalized;
}

/** Busca followers_count atual do perfil. Retorna null se falhar (não bloqueia o sync). */
export async function fetchFollowersCount(handle: string): Promise<number | null> {
  try {
    const run = await client()
      .actor(PROFILE_ACTOR)
      .call({ usernames: [handle.replace(/^@/, "")] }, { timeout: 120 });
    const { items } = await client().dataset(run.defaultDatasetId).listItems({ limit: 1 });
    const first = items[0] as RawItem | undefined;
    return first ? num(first.followersCount) : null;
  } catch {
    return null;
  }
}

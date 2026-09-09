/**
 * Fórmulas de performance — centralizadas de propósito: vão mudar.
 *
 * outlier_score        = views / mediana(views do próprio creator)
 * view_to_follower     = views / followers_count
 * engagement_rate      = (likes + comments [+ shares]) / views
 * viral_rank           = posição do vídeo dentro do creator, ordenado
 *                        por outlier_score desc (1 = maior outlier)
 *
 * Vídeos sem views válidas (null, 0 ou negativo) ficam fora da mediana
 * e não recebem outlier_score.
 */

export function hasValidViews(views: number | null | undefined): views is number {
  return typeof views === "number" && Number.isFinite(views) && views > 0;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function medianViews(videos: { views: number | null }[]): number | null {
  return median(videos.map((v) => v.views).filter(hasValidViews));
}

export function outlierScore(views: number | null, medianV: number | null): number | null {
  if (!hasValidViews(views) || !medianV || medianV <= 0) return null;
  return views / medianV;
}

export function viewToFollowerRatio(
  views: number | null,
  followers: number | null,
): number | null {
  if (!hasValidViews(views) || !followers || followers <= 0) return null;
  return views / followers;
}

export function engagementRate(v: {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}): number | null {
  if (!hasValidViews(v.views)) return null;
  const interactions = (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0);
  return interactions / v.views;
}

/**
 * Recalcula todas as métricas derivadas de um conjunto de vídeos de UM creator.
 * Retorna os campos a persistir por vídeo (keyed por id).
 */
export function computeCreatorMetrics(
  videos: {
    id: string;
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    creator_followers_at_capture: number | null;
  }[],
  creatorFollowers: number | null,
): Map<
  string,
  {
    outlier_score: number | null;
    engagement_rate: number | null;
    view_to_follower_ratio: number | null;
    viral_rank: number | null;
  }
> {
  const med = medianViews(videos);
  const result = new Map<
    string,
    {
      outlier_score: number | null;
      engagement_rate: number | null;
      view_to_follower_ratio: number | null;
      viral_rank: number | null;
    }
  >();

  for (const v of videos) {
    const followers = v.creator_followers_at_capture ?? creatorFollowers;
    result.set(v.id, {
      outlier_score: outlierScore(v.views, med),
      engagement_rate: engagementRate(v),
      view_to_follower_ratio: viewToFollowerRatio(v.views, followers),
      viral_rank: null,
    });
  }

  // viral_rank: 1 = maior outlier do creator; vídeos sem score ficam sem rank
  const ranked = videos
    .filter((v) => result.get(v.id)!.outlier_score !== null)
    .sort((a, b) => result.get(b.id)!.outlier_score! - result.get(a.id)!.outlier_score!);
  ranked.forEach((v, i) => {
    result.get(v.id)!.viral_rank = i + 1;
  });

  return result;
}

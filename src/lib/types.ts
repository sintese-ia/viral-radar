export type VideoStatus = "pending" | "approved" | "rejected" | "analyzed";

export interface Creator {
  id: string;
  name: string;
  handle: string;
  platform: string;
  country: string | null;
  profile_url: string | null;
  followers_count: number | null;
  niche: string | null;
  positioning: string | null;
  notes: string | null;
  approved: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  creator_id: string;
  external_id: string;
  platform: string;
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
  creator_followers_at_capture: number | null;
  engagement_rate: number | null;
  view_to_follower_ratio: number | null;
  outlier_score: number | null;
  viral_rank: number | null;
  approved: boolean | null;
  status: VideoStatus;
  notes: string | null;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface CreatorStats {
  video_count: number;
  median_views: number | null;
  max_outlier_score: number | null;
}

export type CreatorWithStats = Creator & CreatorStats;

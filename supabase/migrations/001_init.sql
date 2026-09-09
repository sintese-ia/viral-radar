-- Viral Radar — migration inicial
-- Banco: Postgres do Easypanel (cells-postgres / dadoscells), schema próprio.
-- Rodar como user DDL (dadoscells). Idempotente.

create schema if not exists viral_radar;
set search_path to viral_radar;

-- ============================================================
-- CREATORS
-- ============================================================
create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text not null,
  platform text not null default 'instagram',
  country text,
  profile_url text,
  followers_count bigint,
  niche text,
  positioning text,
  notes text,
  approved boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, handle)
);

-- ============================================================
-- VIDEOS
-- ============================================================
create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  external_id text not null,
  platform text not null default 'instagram',
  original_url text,
  thumbnail_url text,
  video_url text,
  caption text,
  published_at timestamptz,
  duration_seconds numeric,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  plays bigint,
  creator_followers_at_capture bigint,
  engagement_rate numeric,
  view_to_follower_ratio numeric,
  outlier_score numeric,
  viral_rank integer,
  approved boolean,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'analyzed')),
  notes text,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- chave de dedupe: nunca duplicar o mesmo vídeo da mesma plataforma
  unique (platform, external_id)
);

create index if not exists videos_creator_idx on videos (creator_id);
create index if not exists videos_creator_outlier_idx
  on videos (creator_id, outlier_score desc nulls last);
create index if not exists videos_status_idx on videos (status);

-- ============================================================
-- VIDEO_ANALYSIS — preparada para a fase de análise por LLM.
-- Nada é preenchido no MVP.
-- ============================================================
create table if not exists video_analysis (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null unique references videos(id) on delete cascade,
  hook_verbal text,
  hook_visual text,
  hook_mechanism text,
  hook_strength integer,
  theme text,
  thesis text,
  format text,
  narrative_structure text,
  retention_mechanism text,
  cta text,
  editing_style text,
  first_3_seconds_notes text,
  analysis_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- updated_at automático
-- ============================================================
create or replace function viral_radar.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists creators_updated_at on creators;
create trigger creators_updated_at before update on creators
  for each row execute function viral_radar.set_updated_at();

drop trigger if exists videos_updated_at on videos;
create trigger videos_updated_at before update on videos
  for each row execute function viral_radar.set_updated_at();

drop trigger if exists video_analysis_updated_at on video_analysis;
create trigger video_analysis_updated_at before update on video_analysis
  for each row execute function viral_radar.set_updated_at();

-- ============================================================
-- Grants para o user DML que o app usa (claude_b2b)
-- ============================================================
grant usage on schema viral_radar to claude_b2b;
grant select, insert, update, delete on all tables in schema viral_radar to claude_b2b;
alter default privileges in schema viral_radar
  grant select, insert, update, delete on tables to claude_b2b;

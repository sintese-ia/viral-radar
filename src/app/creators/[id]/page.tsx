"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import VideoCard, { VideoWithCreator } from "@/components/VideoCard";
import { fmtCompact, fmtDateTime } from "@/lib/format";
import { medianViews } from "@/lib/metrics";
import type { Creator, Video } from "@/lib/types";

type Filter = "all" | "approved" | "rejected" | "pending" | "top5" | "top10";
type Sort = "outlier" | "views" | "engagement" | "newest";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "pending", label: "Pending" },
  { key: "top5", label: "Top 5" },
  { key: "top10", label: "Top 10" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "outlier", label: "Outlier score" },
  { key: "views", label: "Views" },
  { key: "engagement", label: "Engagement" },
  { key: "newest", label: "Newest" },
];

export default function CreatorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [videos, setVideos] = useState<VideoWithCreator[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("outlier");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ creator_id: id, sort });
    if (["approved", "rejected", "pending"].includes(filter)) qs.set("status", filter);
    if (filter === "top5") qs.set("top", "5");
    if (filter === "top10") qs.set("top", "10");
    const [cRes, vRes] = await Promise.all([
      fetch(`/api/creators/${id}`),
      fetch(`/api/videos?${qs}`),
    ]);
    if (cRes.ok) setCreator(await cRes.json());
    if (vRes.ok) setVideos(await vRes.json());
  }, [id, filter, sort]);

  useEffect(() => {
    load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/creators/${id}/sync`, { method: "POST" });
      if (!res.ok) setError((await res.json()).error);
    } finally {
      setSyncing(false);
      load();
    }
  }

  function onVideoUpdate(updated: Video) {
    setVideos((vs) => vs.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)));
  }

  if (!creator) return <p className="text-neutral-500 text-sm">carregando…</p>;

  const med = medianViews(videos);

  return (
    <div className="flex flex-col gap-4">
      {/* topo */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
            ← creators
          </Link>
          <h1 className="text-xl font-semibold text-neutral-100">
            {creator.name}{" "}
            <a
              href={creator.profile_url ?? `https://www.instagram.com/${creator.handle}/`}
              target="_blank"
              rel="noreferrer"
              className="text-neutral-500 font-normal hover:underline"
            >
              @{creator.handle} ↗
            </a>
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-400 tabular-nums">
            <span>
              <b className="text-neutral-200">{fmtCompact(creator.followers_count)}</b> followers
            </span>
            <span>
              mediana <b className="text-neutral-200">{fmtCompact(med)}</b> views
            </span>
            <span>
              <b className="text-neutral-200">{videos.length}</b> vídeos (filtro atual)
            </span>
            <span>sync: {fmtDateTime(creator.last_synced_at)}</span>
          </div>
        </div>
        <button className="btn btn-primary" disabled={syncing} onClick={sync}>
          {syncing ? "⏳ coletando via Apify…" : "⟳ Sync videos"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-800 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* filtros + ordenação */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`btn ${filter === f.key ? "border-neutral-400 bg-neutral-700" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          className="input w-auto text-xs"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              ordenar: {s.label}
            </option>
          ))}
        </select>
        <Link href={`/review?creator_id=${id}`} className="btn ml-auto">
          ▶ Review mode
        </Link>
      </div>

      {/* grid de cards */}
      {videos.length === 0 ? (
        <p className="text-neutral-500 text-sm">
          Nenhum vídeo neste filtro. {creator.last_synced_at ? "" : "Clique em Sync videos para coletar."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} onUpdate={onVideoUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import EmbedPlayer from "./EmbedPlayer";
import { fmtCompact, fmtDate, fmtPct, fmtRatio, fmtScore, outlierColor } from "@/lib/format";
import type { Video } from "@/lib/types";

export type VideoWithCreator = Video & {
  creators?: { name: string; handle: string; followers_count: number | null } | null;
};

const statusChip: Record<string, string> = {
  pending: "bg-neutral-800 text-neutral-400",
  approved: "bg-emerald-900/70 text-emerald-300",
  rejected: "bg-rose-900/60 text-rose-300",
  analyzed: "bg-sky-900/60 text-sky-300",
};

export default function VideoCard({
  video,
  onUpdate,
}: {
  video: VideoWithCreator;
  onUpdate: (v: Video) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState(video.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) onUpdate(await res.json());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 overflow-hidden flex flex-col">
      {/* mídia */}
      <div className="relative aspect-[9/12] bg-black">
        {playing ? (
          <EmbedPlayer originalUrl={video.original_url} className="h-full" />
        ) : (
          <button
            className="w-full h-full cursor-pointer group"
            onClick={() => setPlaying(true)}
            title="Assistir no painel"
          >
            {video.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.thumbnail_url}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            ) : null}
            <span className="absolute inset-0 flex items-center justify-center text-4xl opacity-70 group-hover:opacity-100">
              ▶
            </span>
          </button>
        )}
        <span
          className={`chip absolute top-2 left-2 ${statusChip[video.status]}`}
        >
          {video.status}
        </span>
        {video.viral_rank != null && video.viral_rank <= 10 && (
          <span className="chip absolute top-2 right-2 bg-amber-900/80 text-amber-200">
            #{video.viral_rank}
          </span>
        )}
      </div>

      {/* métricas */}
      <div className="p-3 flex flex-col gap-2 grow">
        <div className="flex items-baseline justify-between">
          <div className="text-xs text-neutral-400 truncate">
            {video.creators ? `@${video.creators.handle}` : ""} · {fmtDate(video.published_at)}
          </div>
          <div className={`text-lg font-bold tabular-nums ${outlierColor(video.outlier_score)}`}>
            {fmtScore(video.outlier_score)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs tabular-nums">
          <Metric label="views" value={fmtCompact(video.views)} strong />
          <Metric label="likes" value={fmtCompact(video.likes)} />
          <Metric label="comments" value={fmtCompact(video.comments)} />
          <Metric label="eng." value={fmtPct(video.engagement_rate)} />
          <Metric label="v/fol" value={fmtRatio(video.view_to_follower_ratio)} />
          <Metric label="shares" value={fmtCompact(video.shares)} />
        </div>

        {video.caption && (
          <p className="text-xs text-neutral-500 line-clamp-2" title={video.caption}>
            {video.caption}
          </p>
        )}

        {video.notes && !showNote && (
          <p className="text-xs text-amber-200/80 line-clamp-2">📝 {video.notes}</p>
        )}

        {showNote && (
          <div className="flex flex-col gap-1">
            <textarea
              className="input text-xs"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="nota sobre o vídeo…"
            />
            <div className="flex gap-1">
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={async () => {
                  await patch({ notes: note });
                  setShowNote(false);
                }}
              >
                Salvar
              </button>
              <button className="btn" onClick={() => setShowNote(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ações */}
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          <button
            className={`btn ${video.status === "approved" ? "btn-primary" : ""}`}
            disabled={busy}
            onClick={() => patch({ status: video.status === "approved" ? "pending" : "approved" })}
          >
            ✓ Approve
          </button>
          <button
            className={`btn ${video.status === "rejected" ? "btn-danger" : ""}`}
            disabled={busy}
            onClick={() => patch({ status: video.status === "rejected" ? "pending" : "rejected" })}
          >
            ✗ Reject
          </button>
          <button className="btn" onClick={() => setShowNote((s) => !s)}>
            📝 Note
          </button>
          {video.original_url && (
            <a className="btn" href={video.original_url} target="_blank" rel="noreferrer">
              ↗ Original
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-1">
      <span className="text-neutral-500">{label}</span>
      <span className={strong ? "text-neutral-100 font-semibold" : "text-neutral-300"}>{value}</span>
    </div>
  );
}

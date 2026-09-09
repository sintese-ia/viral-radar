"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import EmbedPlayer from "@/components/EmbedPlayer";
import { fmtCompact, fmtPct, fmtRatio, fmtScore, outlierColor } from "@/lib/format";
import type { VideoWithCreator } from "@/components/VideoCard";
import type { Creator } from "@/lib/types";

export default function ReviewPage() {
  return (
    <Suspense>
      <Review />
    </Suspense>
  );
}

function Review() {
  const sp = useSearchParams();
  const creatorId = sp.get("creator_id");

  const [queue, setQueue] = useState<VideoWithCreator[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [note, setNote] = useState("");
  const [creators, setCreators] = useState<Creator[]>([]);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // carrega a fila UMA vez por filtro (a fila não muda ao aprovar,
  // para não puxar o tapete da navegação)
  useEffect(() => {
    const qs = new URLSearchParams({ sort: "outlier" });
    if (creatorId) qs.set("creator_id", creatorId);
    if (statusFilter !== "all") qs.set("status", statusFilter);
    fetch(`/api/videos?${qs}`)
      .then((r) => r.json())
      .then((data) => {
        setQueue(Array.isArray(data) ? data : []);
        setIdx(0);
      });
    fetch("/api/creators")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCreators(data));
  }, [creatorId, statusFilter]);

  const current = queue?.[idx] ?? null;

  useEffect(() => {
    setNote(current?.notes ?? "");
  }, [current?.id, current?.notes]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!current) return;
      const res = await fetch(`/api/videos/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setQueue((q) => q!.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)));
      }
    },
    [current],
  );

  const next = useCallback(
    () => setIdx((i) => Math.min(i + 1, (queue?.length ?? 1) - 1)),
    [queue?.length],
  );
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  const approve = useCallback(async () => {
    await patch({ status: "approved" });
    next();
  }, [patch, next]);

  const reject = useCallback(async () => {
    await patch({ status: "rejected" });
    next();
  }, [patch, next]);

  // atalhos: A approve · R reject · ← prev · → next (fora de inputs)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key.toLowerCase() === "a") approve();
      else if (e.key.toLowerCase() === "r") reject();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, approve, reject]);

  if (queue === null) return <p className="text-neutral-500 text-sm">carregando…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-neutral-100">Review</h1>
        <select
          className="input w-auto text-xs"
          value={creatorId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            window.location.search = v ? `?creator_id=${v}` : "";
          }}
        >
          <option value="">todos os creators</option>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              @{c.handle}
            </option>
          ))}
        </select>
        <select
          className="input w-auto text-xs"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
          <option value="all">todos</option>
        </select>
        <span className="ml-auto text-xs text-neutral-500">
          atalhos: <kbd>A</kbd> approve · <kbd>R</kbd> reject · <kbd>←</kbd>/<kbd>→</kbd> navegar
        </span>
      </div>

      {!current ? (
        <p className="text-neutral-500 text-sm">Fila vazia neste filtro. 🎉</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr] gap-5">
          {/* vídeo grande */}
          <div className="rounded-lg overflow-hidden border border-neutral-800 bg-black">
            <EmbedPlayer
              key={current.id}
              originalUrl={current.original_url}
              className="aspect-[9/16] max-h-[75vh]"
            />
          </div>

          {/* painel de métricas + ações */}
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm text-neutral-400">
                Creator:{" "}
                <b className="text-neutral-100">
                  {current.creators?.name} @{current.creators?.handle}
                </b>
              </div>
              <div className={`mt-2 text-5xl font-bold tabular-nums ${outlierColor(current.outlier_score)}`}>
                {fmtScore(current.outlier_score)}
              </div>
              <div className="text-xs text-neutral-500">outlier vs. mediana do próprio perfil</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <Stat label="Views" value={fmtCompact(current.views)} />
              <Stat label="Likes" value={fmtCompact(current.likes)} />
              <Stat label="Comments" value={fmtCompact(current.comments)} />
              <Stat label="Engagement" value={fmtPct(current.engagement_rate)} />
              <Stat label="View/follower" value={fmtRatio(current.view_to_follower_ratio)} />
              <Stat label="Rank no perfil" value={current.viral_rank ? `#${current.viral_rank}` : "—"} />
            </div>

            {current.caption && (
              <div>
                <div className="text-xs text-neutral-500 mb-1">Caption</div>
                <p className="text-sm text-neutral-300 whitespace-pre-wrap max-h-32 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-900/60 p-2">
                  {current.caption}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                className={`btn btn-primary text-base px-5 py-2 ${current.status === "approved" ? "ring-2 ring-emerald-500" : ""}`}
                onClick={approve}
              >
                ✓ APPROVE (A)
              </button>
              <button
                className={`btn btn-danger text-base px-5 py-2 ${current.status === "rejected" ? "ring-2 ring-rose-500" : ""}`}
                onClick={reject}
              >
                ✗ REJECT (R)
              </button>
              {current.original_url && (
                <a className="btn self-center" href={current.original_url} target="_blank" rel="noreferrer">
                  ↗ Original
                </a>
              )}
              <span className="chip self-center bg-neutral-800 text-neutral-400">{current.status}</span>
            </div>

            <div>
              <div className="text-xs text-neutral-500 mb-1">Notes (salva ao sair do campo)</div>
              <textarea
                ref={noteRef}
                className="input"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note !== (current.notes ?? "") && patch({ notes: note })}
                placeholder="hook, tema, por que performou…"
              />
            </div>

            <div className="mt-auto flex items-center gap-4">
              <button className="btn" onClick={prev} disabled={idx === 0}>
                ← Previous
              </button>
              <span className="text-sm text-neutral-400 tabular-nums">
                {idx + 1} / {queue.length}
              </span>
              <button className="btn" onClick={next} disabled={idx >= queue.length - 1}>
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="text-neutral-100 font-semibold tabular-nums">{value}</div>
    </div>
  );
}

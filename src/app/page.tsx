"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fmtCompact, fmtDateTime, fmtScore, outlierColor } from "@/lib/format";
import type { CreatorWithStats } from "@/lib/types";

const emptyForm = { name: "", handle: "", country: "", followers_count: "", niche: "" };

export default function CreatorsPage() {
  const [creators, setCreators] = useState<CreatorWithStats[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/creators");
    if (res.ok) {
      setCreators(await res.json());
    } else {
      setCreators([]);
      const body = await res.json().catch(() => null);
      setError(body?.error ?? `API /creators falhou (${res.status})`);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addCreator(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "erro ao salvar");
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  async function toggleApproved(c: CreatorWithStats) {
    await fetch(`/api/creators/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: !c.approved }),
    });
    load();
  }

  async function sync(c: CreatorWithStats) {
    setSyncing((s) => ({ ...s, [c.id]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/creators/${c.id}/sync`, { method: "POST" });
      if (!res.ok) setError(`@${c.handle}: ${(await res.json()).error}`);
    } finally {
      setSyncing((s) => ({ ...s, [c.id]: false }));
      load();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Creators</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          + Add creator
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-800 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={addCreator}
          className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 grid grid-cols-2 md:grid-cols-5 gap-2"
        >
          <input
            className="input"
            placeholder="@handle *"
            required
            value={form.handle}
            onChange={(e) => setForm({ ...form, handle: e.target.value })}
          />
          <input
            className="input"
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input"
            placeholder="País (BR, US…)"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
          <input
            className="input"
            placeholder="Followers (opcional)"
            type="number"
            value={form.followers_count}
            onChange={(e) => setForm({ ...form, followers_count: e.target.value })}
          />
          <input
            className="input"
            placeholder="Nicho"
            value={form.niche}
            onChange={(e) => setForm({ ...form, niche: e.target.value })}
          />
          <div className="col-span-2 md:col-span-5 flex gap-2">
            <button type="submit" className="btn btn-primary">
              Salvar
            </button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <span className="text-xs text-neutral-500 self-center">
              followers é atualizado automaticamente no sync
            </span>
          </div>
        </form>
      )}

      {creators === null ? (
        <p className="text-neutral-500 text-sm">carregando…</p>
      ) : creators.length === 0 ? (
        <p className="text-neutral-500 text-sm">Nenhum creator ainda. Adicione o primeiro.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-800 bg-neutral-900/80">
                <th className="px-3 py-2">Creator</th>
                <th className="px-3 py-2">País</th>
                <th className="px-3 py-2 text-right">Followers</th>
                <th className="px-3 py-2 text-right">Vídeos</th>
                <th className="px-3 py-2 text-right">Mediana views</th>
                <th className="px-3 py-2 text-right">Max outlier</th>
                <th className="px-3 py-2">Último sync</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c) => (
                <tr key={c.id} className="border-b border-neutral-800/60 hover:bg-neutral-900/50">
                  <td className="px-3 py-2">
                    <Link href={`/creators/${c.id}`} className="hover:underline">
                      <span className="text-neutral-100 font-medium">{c.name}</span>{" "}
                      <span className="text-neutral-500">@{c.handle}</span>
                    </Link>
                    {c.niche && <div className="text-xs text-neutral-500">{c.niche}</div>}
                  </td>
                  <td className="px-3 py-2 text-neutral-400">{c.country ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtCompact(c.followers_count)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.video_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtCompact(c.median_views)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${outlierColor(c.max_outlier_score)}`}>
                    {fmtScore(c.max_outlier_score)}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{fmtDateTime(c.last_synced_at)}</td>
                  <td className="px-3 py-2">
                    <span className={`chip ${c.approved ? "bg-emerald-900/70 text-emerald-300" : "bg-neutral-800 text-neutral-400"}`}>
                      {c.approved ? "approved" : "pending"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <button
                        className={`btn ${c.approved ? "" : "btn-primary"}`}
                        onClick={() => toggleApproved(c)}
                        title={c.approved ? "Reprovar" : "Aprovar"}
                      >
                        {c.approved ? "✗" : "✓"}
                      </button>
                      <button
                        className="btn"
                        disabled={!!syncing[c.id]}
                        onClick={() => sync(c)}
                        title="Coletar últimos 50 reels via Apify"
                      >
                        {syncing[c.id] ? "⏳ syncing…" : "⟳ Sync"}
                      </button>
                      <Link href={`/creators/${c.id}`} className="btn">
                        Open
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

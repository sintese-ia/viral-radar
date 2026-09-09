export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function fmtScore(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}x`;
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtRatio(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(2);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Cor do outlier score: quanto maior, mais quente. */
export function outlierColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-neutral-500";
  if (score >= 5) return "text-rose-400";
  if (score >= 3) return "text-orange-400";
  if (score >= 1.5) return "text-amber-300";
  return "text-neutral-400";
}

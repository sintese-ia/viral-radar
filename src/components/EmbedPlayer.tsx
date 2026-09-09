"use client";

/**
 * Player via embed oficial do Instagram (instagram.com/reel/<code>/embed/).
 * Não depende das URLs de CDN do scraping, que expiram em horas.
 */
export function embedUrl(originalUrl: string | null): string | null {
  if (!originalUrl) return null;
  const m = originalUrl.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  return `https://www.instagram.com/p/${m[1]}/embed/`;
}

export default function EmbedPlayer({
  originalUrl,
  className = "",
}: {
  originalUrl: string | null;
  className?: string;
}) {
  const src = embedUrl(originalUrl);
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-neutral-900 text-neutral-500 text-sm ${className}`}>
        sem embed disponível
      </div>
    );
  }
  return (
    <iframe
      src={src}
      className={`w-full border-0 bg-black ${className}`}
      allow="autoplay; encrypted-media"
      allowFullScreen
      loading="lazy"
    />
  );
}

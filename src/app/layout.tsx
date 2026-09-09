import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viral Radar",
  description: "Pesquisa de conteúdo viral — Instagram/Reels",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="border-b border-neutral-800 bg-neutral-950/90 sticky top-0 z-20 backdrop-blur">
          <nav className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-6">
            <Link href="/" className="font-semibold text-neutral-100 tracking-tight">
              📡 Viral Radar
            </Link>
            <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-100">
              Creators
            </Link>
            <Link href="/review" className="text-sm text-neutral-400 hover:text-neutral-100">
              Review
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

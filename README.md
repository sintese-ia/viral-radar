# 📡 Viral Radar

Ferramenta interna de pesquisa de conteúdo viral em Instagram/Reels, com foco inicial em criadores de IA. MVP: coleta → organização → ranking → visualização → aprovação manual. A análise por LLM (hooks, temas, teses) vem numa fase futura — o banco já está preparado.

## 1. Arquitetura

```
Apify (scraping) ──▶ Next.js API routes ──▶ Supabase Postgres
                          │
                          ▼
              Painel Next.js + Tailwind
        (Creators · Creator detail · Review mode)
```

- **Next.js 15 (App Router) + Tailwind 4** — painel e API no mesmo app.
- **Supabase Postgres** — 3 tabelas: `creators`, `videos`, `video_analysis` (futura). Todo acesso ao banco é server-side via `SUPABASE_SERVICE_ROLE_KEY` (ferramenta interna; RLS ligado sem policies bloqueia o anon key).
- **Apify** — dois actors oficiais:
  - [`apify/instagram-reel-scraper`](https://apify.com/apify/instagram-reel-scraper) — coleta os Reels do perfil. **Escolhido por ser o actor oficial da Apify especializado em Reels**: mantido pela própria Apify, boa documentação, retorna views/plays, likes, comments, duração, caption, timestamp, thumbnail e videoUrl. A alternativa `apify/instagram-scraper` (genérico) cobre o mesmo caso mas com input mais complexo; ficamos com o especializado.
  - [`apify/instagram-profile-scraper`](https://apify.com/apify/instagram-profile-scraper) — só para atualizar `followers_count` no sync (o reel scraper não traz followers). Se falhar, o sync continua com o valor cadastrado.
- **Sem Supabase Storage** — não é necessário no MVP (não armazenamos mídia).

### Reprodução de vídeo (decisão importante)

As URLs de vídeo/thumbnail que o scraping retorna são **CDN do Instagram e expiram em horas**. Por isso o player do painel usa o **embed oficial** `instagram.com/p/<shortcode>/embed/`, que é estável (funciona enquanto o post existir). O `video_url` do CDN é salvo em banco mas nada no painel depende dele. Fallback: thumbnail + botão "Original" abrindo o post em nova aba.

## 2. Setup local

```bash
cd app
npm install
cp .env.example .env.local   # preencha as 4 variáveis
npm run dev                  # http://localhost:3000
```

## 3. Setup Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (free tier serve).
2. Em **Project Settings → API**, copie para o `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public (não usada hoje, reservada)
   - `SUPABASE_SERVICE_ROLE_KEY` — service_role (⚠️ nunca expor no client/commit)

## 4. Migrations

Abra o **SQL Editor** do Supabase e rode `supabase/migrations/001_init.sql` inteiro. Idempotente (`if not exists`). Cria:

- `creators` — unique `(platform, handle)`
- `videos` — unique `(platform, external_id)` ← **chave de dedupe do sync**
- `video_analysis` — campos para a fase de análise por IA (vazia no MVP)
- trigger de `updated_at` + RLS ligado

## 5. Configuração Apify

1. Crie conta em [apify.com](https://apify.com) (free tier: US$ 5/mês de créditos; o reel scraper custa ~US$ 1/1k reels — 20 perfis × 50 reels ≈ US$ 1).
2. **Console → Settings → API & Integrations** → copie o token para `APIFY_API_TOKEN` no `.env.local`.

## 6. Cadastrar creator

**Creators → + Add creator.** Só o `@handle` é obrigatório (sem `@`, o form aceita ambos). Followers é opcional — o sync atualiza sozinho. Depois, aprove o creator (botão ✓) — isso marca o perfil como validado para a Fase 2 da metodologia.

## 7. Sincronizar

**Sync videos** (na lista ou no detail) roda o pipeline completo:

1. chama o profile scraper (followers atualizados) e o reel scraper (últimos 50 Reels) em paralelo;
2. normaliza os itens (`src/lib/apify.ts`);
3. upsert em `videos` por `(platform, external_id)` — **nunca duplica** e **não sobrescreve** `status`/`notes` de vídeos já revisados; JSON bruto vai em `raw_data`;
4. recalcula mediana, outlier_score, engagement, view/follower ratio e viral_rank de **todos** os vídeos do creator;
5. grava `last_synced_at`.

Leva de 1 a 3 minutos (o actor roda na infra da Apify). O botão fica em "syncing…" enquanto isso.

## 8. Outlier score

Fórmulas centralizadas em **`src/lib/metrics.ts`** (vão evoluir; mude lá e re-sincronize):

```
median_views            = mediana das views dos vídeos do creator (views > 0)
outlier_score           = views / median_views          ← ranking principal
view_to_follower_ratio  = views / followers_count
engagement_rate         = (likes + comments + shares?) / views
viral_rank              = posição por outlier_score dentro do creator (1 = maior)
```

Vídeos sem views válidas (null/0) ficam fora da mediana e sem score/rank. Ex.: mediana 100k, vídeo com 1M → outlier 10x. No painel: Top 5 / Top 10 filtram por `viral_rank`.

## 9. Limitações atuais

- **Shares**: Instagram não expõe em scraping de perfil — quase sempre `null`; o engagement usa likes+comments na prática.
- **Views vs plays**: o actor reporta `videoViewCount` e/ou `videoPlayCount`; usamos o melhor disponível como `views` e guardamos `plays` à parte.
- **Followers** dependem do profile scraper; se falhar, fica o último valor conhecido.
- **Embed**: perfis privados ou posts com embed desativado não reproduzem no painel — use "Original".
- **Sem auth** no painel: rodar localmente ou atrás de proteção (não expor público — o service role está no server).
- **Sync é manual e um creator por vez** (suficiente para 20 perfis; cron/batch vem depois).
- Recalcular métricas após editar followers manualmente exige novo sync.

## 10. Próximos passos

1. **Fase de análise por IA**: preencher `video_analysis` (hook verbal/visual, mecanismo, tema, tese, formato, narrativa, retenção, CTA, 3 primeiros segundos) via LLM sobre `raw_data` + transcrição.
2. Sync em lote ("sync all approved") + agendamento (cron).
3. TikTok / YouTube Shorts — o schema já é multi-plataforma (`platform` + unique compostas).
4. Export CSV/planilha dos aprovados.
5. Histórico de snapshots de métricas (hoje o upsert sobrescreve — `raw_data` guarda só a última captura).

## Metodologia (fases de validação)

1. **Fase 1** — cadastrar 20 perfis (10 BR, 10 exterior) e aprovar manualmente.
2. **Fase 2** — Sync nos perfis aprovados (50 Reels cada).
3. **Fase 3** — filtro **Top 5** em cada perfil → ~100 vídeos.
4. **Fase 4** — **/review**: um vídeo por vez, atalhos `A` approve · `R` reject · `←`/`→` navegar, notas por vídeo.

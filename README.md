# 📡 Viral Radar

Ferramenta interna de pesquisa de conteúdo viral em Instagram/Reels, com foco inicial em criadores de IA. MVP: coleta → organização → ranking → visualização → aprovação manual. A análise por LLM (hooks, temas, teses) vem numa fase futura — o banco já está preparado.

## 1. Arquitetura

```
Apify (scraping) ──▶ Next.js API routes ──▶ Postgres (Easypanel, schema viral_radar)
                          │
                          ▼
              Painel Next.js + Tailwind
        (Creators · Creator detail · Review mode)
```

- **Next.js 15 (App Router) + Tailwind 4** — painel e API no mesmo app.
- **Postgres** — o `cells-postgres` que já roda no Easypanel (`dadoscells`), schema próprio **`viral_radar`** com 3 tabelas: `creators`, `videos`, `video_analysis` (futura). Acesso via `pg` só no server (API routes). *Decisão 09/09/2026: o spec original pedia Supabase; trocamos pelo Postgres existente com OK do Gabriel — zero conta nova, e o app deployado fala com o banco pela rede interna.*
- **Apify** — dois actors oficiais:
  - [`apify/instagram-reel-scraper`](https://apify.com/apify/instagram-reel-scraper) — coleta os Reels do perfil. **Escolhido por ser o actor oficial da Apify especializado em Reels**: mantido pela própria Apify, boa documentação, retorna views/plays, likes, comments, duração, caption, timestamp, thumbnail e videoUrl (~US$1/1k reels).
  - [`apify/instagram-profile-scraper`](https://apify.com/apify/instagram-profile-scraper) — só para atualizar `followers_count` no sync. Se falhar, o sync continua com o valor cadastrado.
- **Basic Auth** via middleware quando `BASIC_AUTH_PASS` está no env (deploy público). Sem a var (dev local), passa direto.

### Reprodução de vídeo (decisão importante)

As URLs de vídeo/thumbnail que o scraping retorna são **CDN do Instagram e expiram em horas**. Por isso o player usa o **embed oficial** `instagram.com/p/<shortcode>/embed/`, que é estável. O `video_url` do CDN é salvo em banco mas nada no painel depende dele. **Nenhum vídeo é baixado/armazenado.**

## 2. Setup local

```bash
npm install
cp .env.example .env.local   # DATABASE_URL + APIFY_API_TOKEN
npm run dev                  # http://localhost:3000
```

- `DATABASE_URL`: user `claude_b2b` (DML) — valor em `~/Documents/cells-crm-app/.env.local`, trocando apenas o path se preciso. Host local: `easypanel.sinteseia.com.br:5432`.
- `APIFY_API_TOKEN`: ver `cells/cells-infra/apis-externas.md` no vault MAGNUS.

## 3. Migrations

`supabase/migrations/001_init.sql` (nome de pasta é herança do rascunho Supabase). Rodar como user DDL (`dadoscells`, URL em `~/Documents/cells-crm-app/.env.admin.local`) — sem `psql` na máquina, usar `python3` + `psycopg2`. Idempotente. Cria o schema `viral_radar`, as 3 tabelas, triggers de `updated_at` e grants pro `claude_b2b`. **Rodada em 09/09/2026 — banco já está de pé.**

## 4. Como usar

1. **Cadastrar creator** — Creators → + Add creator (só o handle é obrigatório; followers atualiza no sync).
2. **Aprovar perfil** — botão ✓ (Fase 1 da metodologia).
3. **Sync videos** — roda o pipeline: profile scraper (followers) + reel scraper (últimos 50) em paralelo → normaliza → **upsert por `(platform, external_id)`** (nunca duplica; não sobrescreve `status`/`notes` já revisados; JSON bruto em `raw_data`) → recalcula todas as métricas do creator → `last_synced_at`. Leva ~30s–3min.
4. **Revisar** — grid com filtros (All/Approved/Rejected/Pending/Top 5/Top 10) e ordenação, ou `/review` (um por vez, atalhos `A`/`R`/`←`/`→`, notas).

## 5. Outlier score

Fórmulas centralizadas em **`src/lib/metrics.ts`** (vão evoluir; mude lá e re-sincronize):

```
median_views            = mediana das views dos vídeos do creator (views > 0)
outlier_score           = views / median_views          ← ranking principal
view_to_follower_ratio  = views / followers_count
engagement_rate         = (likes + comments + shares?) / views
viral_rank              = posição por outlier_score dentro do creator (1 = maior)
```

Vídeos sem views válidas (null/0) ficam fora da mediana e sem score/rank. Ex.: mediana 100k, vídeo 1M → 10x. A listagem de creators calcula a mediana em SQL (`percentile_cont(0.5)`), equivalente à do módulo.

## 6. Deploy (insta.sinteseia.com.br)

Padrão do `cells-analytics`: Easypanel builda o `Dockerfile` a partir do repo GitHub (`sintese-ia/viral-radar`, branch `main`), projeto `sintese`. Env vars do serviço:

```
DATABASE_URL=postgresql://claude_b2b:...@cells-postgres:5432/dadoscells   # rede interna
APIFY_API_TOKEN=...
BASIC_AUTH_USER=...
BASIC_AUTH_PASS=...
```

Domínio `insta.sinteseia.com.br`: CNAME no Hostinger → `easypanel.sinteseia.com.br.` (**com ponto final**) + domain no Easypanel com `certificateResolver: 'letsencrypt'`. Redeploy: push no `main` ou `services.app.deployService` via API.

## 7. Limitações atuais

- **Shares**: Instagram não expõe em scraping de perfil — quase sempre `null`; o engagement usa likes+comments na prática.
- **Views vs plays**: usamos `videoViewCount ?? videoPlayCount` como `views`; `plays` guardado à parte.
- **Embed**: perfis privados ou posts com embed desativado não reproduzem no painel — use "Original".
- **Sync manual, um creator por vez** (ok para 20 perfis; batch/cron depois).
- Snapshot único de métricas: o upsert sobrescreve a captura anterior (histórico não é guardado).

## 8. Próximos passos

1. **Fase de análise por IA**: preencher `video_analysis` (hook verbal/visual, mecanismo, tema, tese, formato, narrativa, retenção, CTA, 3 primeiros segundos) via LLM sobre `raw_data` + transcrição.
2. Sync em lote ("sync all approved") + agendamento.
3. TikTok / YouTube Shorts — schema já é multi-plataforma.
4. Export CSV dos aprovados.

## Metodologia (fases de validação)

1. **Fase 1** — cadastrar 20 perfis (10 BR, 10 exterior) e aprovar manualmente ✅ (20 cadastrados em 09/09)
2. **Fase 2** — Sync nos perfis aprovados (50 Reels cada)
3. **Fase 3** — filtro **Top 5** em cada perfil → ~100 vídeos
4. **Fase 4** — **/review**: um vídeo por vez, com notas

# Developer Knowledge Base

A developer-focused personal knowledge base built with Next.js 15, TypeScript, Tailwind CSS, Prisma, PostgreSQL (Neon), Zustand, and shadcn/ui-style components.

## Features

- Notion-style nested sidebar for categories and question lists
- Question management with difficulty levels, favorites, and pinned items (pinned notes stay at the top)
- Drag-and-drop reordering within pinned and unpinned groups
- Multiple solution tabs per question
- Raw markdown editor with live preview (GFM, syntax highlighting)
- Global search and command palette (`Ctrl+K`)
- PostgreSQL persistence via Prisma and Neon
- AI answer generation (structured markdown + suggested difficulty via OpenAI)

## Prerequisites

- Node.js 20+
- A Neon Postgres project with pooled + direct connection strings in `.env` (see `.env.example`)

## Getting Started

```bash
npm install
cp .env.example .env
# Fill in DATABASE_URL, DIRECT_URL (Neon), and OpenAI keys
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You start with an **empty workspace** — add categories and questions in the app.

## Fresh database (wipe all data)

To reset Postgres and apply the schema from scratch:

```bash
npm run prisma:reset
```

This runs `prisma migrate reset` (drops all tables, re-runs migrations, runs the empty seed).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon **pooled** URL (`-pooler` host, `pgbouncer=true`) |
| `DIRECT_URL` | Neon **direct** URL (non-pooler host, for `prisma migrate`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional Supabase anon key |
| `OPENAI_API_KEY` | AI answer generation (optional) |
| `OPENAI_MODEL` | OpenAI model id (optional) |

## Project Structure

```text
src/app              App Router pages and server actions
src/components       UI components
src/lib              Mappers, utilities, Prisma client
src/server           Data access and question ordering
src/store            Zustand workspace state (UI prefs in localStorage)
prisma               Schema and migrations
```

## Scripts

```bash
npm run dev              # Development server
npm run build            # Production build
npm run prisma:migrate   # Apply migrations
npm run prisma:reset     # Reset DB and migrate (empty workspace)
npm run prisma:seed      # No-op seed (empty workspace)
```

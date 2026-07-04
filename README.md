# Developer Knowledge Base

A developer-focused personal knowledge base built with Next.js 15, TypeScript, Tailwind CSS, Prisma, PostgreSQL (Neon), Zustand, and shadcn/ui-style components.

## Features

- Notion-style nested sidebar for categories and question lists
- Question management with difficulty levels, status tracking (Not Started / In Progress / Solved), favorites, and pinned items (pinned notes stay at the top)
- Color-labeled tags for filtering and organizing questions
- Drag-and-drop reordering within pinned and unpinned groups
- Multiple solution tabs per question with word count and read-time display
- Raw markdown editor with live preview (GFM, syntax highlighting, Mermaid diagrams, image support)
- Global search and command palette (`Ctrl+K`), keyboard shortcuts (`?` to open help)
- Spaced repetition review queue with SM-2 scheduling
- Workspace-level zip import/export and per-category markdown import/export
- **Per-user workspaces** with Supabase email/password sign-in
- AI answer generation and AI solution review (via OpenAI)
- PostgreSQL persistence via Prisma and Neon

## App pages

This app exposes 6 top-level views (besides `/login`):

- `/` (workspace home)
- `/most-viewed` (most viewed notes)
- `/starred` (user favorites)
- `/review` (spaced repetition review queue)
- `/stats` (activity and progress stats)
- `/public` (public/shared notes)


## Prerequisites

- Node.js 20+
- A Neon Postgres project with pooled + direct connection strings in `.env`
- A Supabase project for authentication (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## Getting Started

```bash
npm install
cp .env.example .env
# Fill in DATABASE_URL, DIRECT_URL (Neon), Supabase keys, and OpenAI keys
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to **Sign in**. Each account gets its own private categories and notes.

### Supabase auth setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy **Project URL** and **anon public** key into `.env`.
3. **Authentication → Providers → Email**: enable email provider; for local dev you may disable “Confirm email”.
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

> **Note:** The `add_user_id` migration clears existing categories/questions so every row is owned by a signed-in user. Back up data first if needed.

## Database tables missing?

Your app data lives in **Neon** (`DATABASE_URL` / `DIRECT_URL`), not in Supabase. In the Neon console, open **SQL Editor** or **Tables** for the same project as `.env`.

If migrations failed partway (empty tables, only `_prisma_migrations`), reset and re-apply:

```bash
# Stop npm run dev first
npm run prisma:reset
```

Or apply pending migrations:

```bash
npm run prisma:migrate
```

Verify tables: `node scripts/check-db.mjs` (should list `Category`, `Question`, `Solution`).

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
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (auth, required) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (auth, required) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — required for account deletion |
| `NEXT_PUBLIC_SITE_URL` | Public deployment URL — used in password-reset emails |
| `OPENAI_API_KEY` | OpenAI key — required for Premium AI features |
| `OPENAI_MODEL` | OpenAI model ID (default: `gpt-4o-mini`) |
| `ADMIN_EMAIL` | Email address that can access `/admin` (server-side check) |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Same value — shows the Admin panel link in the user menu |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL — distributed rate limiting (optional, falls back to in-memory) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `SENTRY_DSN` | Sentry DSN for server-side error monitoring (optional) |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for client-side error monitoring (optional) |
| `SENTRY_ORG` | Sentry org slug (for source map upload in CI) |
| `SENTRY_PROJECT` | Sentry project slug |

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

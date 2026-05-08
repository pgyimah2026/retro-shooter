# PyTutor

An AI-powered Python programming tutor built with Next.js 14 and Claude (claude-sonnet-4-20250514).

## Features

- **Chat** — streaming conversation with a Python tutor persona, thread history saved to localStorage
- **Study** — AI-generated Python quizzes, flashcards, and debugging case studies
- **Tools** — Big-O reference table, Python concept comparator, error explainer, and project build planner

## Tech stack

- Next.js 14 (App Router)
- TypeScript + Tailwind CSS
- Anthropic SDK (`@anthropic-ai/sdk`)
- react-markdown + remark-gfm
- shadcn/ui primitives (Radix UI)

## Local development

### 1. Prerequisites

- Node.js 18.17 or later
- An Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com)

### 2. Install dependencies

```bash
cd my-ai-tutor
npm install
```

### 3. Set up environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and replace the placeholder with your real key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> The API key is only ever read server-side inside `app/api/` route handlers. It is never exposed to the browser. There are no `NEXT_PUBLIC_` prefixed variables in this project.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Verify the build

```bash
npm run build
```

The build must complete with zero errors before deploying.

## Deploying to Vercel

### One-click deploy

1. Push this repository to GitHub (or it's already there).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Vercel auto-detects Next.js — no `vercel.json` is required.
4. **Add your environment variable** (see below).
5. Click **Deploy**.

### Adding the API key in Vercel

In your Vercel project dashboard:

1. Go to **Settings → Environment Variables**.
2. Click **Add New**.
3. Set:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key (`sk-ant-...`)
   - **Environment:** Production (add Staging/Preview too if you want those to work)
4. Click **Save** and then **Redeploy** to pick up the new variable.

> Vercel environment variables set this way are injected at the server level only. They are never sent to the browser.

### Function timeouts

Each API route exports `export const maxDuration = 60`, giving Claude up to 60 seconds to respond. This is the maximum on Vercel's Hobby plan. On Pro the limit is 300 s — raise the value if you upgrade.

## Project structure

```
my-ai-tutor/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Streaming chat endpoint
│   │   └── study/
│   │       ├── quiz/route.ts      # Returns structured JSON quiz
│   │       ├── flashcards/route.ts
│   │       └── case/route.ts
│   ├── study/page.tsx             # Study tab UI
│   ├── tools/page.tsx             # Tools tab UI
│   ├── page.tsx                   # Chat UI
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── LayoutShell.tsx            # Sidebar + nav shell
│   ├── Sidebar.tsx                # Thread list
│   ├── TopNav.tsx
│   └── ui/                        # shadcn/ui primitives
├── lib/
│   ├── chat-store.tsx             # React context + localStorage
│   └── utils.ts
├── types/index.ts
├── next.config.ts                 # Security headers
└── .env.local.example
```

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Server-side only. Never prefix with `NEXT_PUBLIC_`. |

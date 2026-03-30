# Lex Machina — AI Courtroom Simulator

A full-stack AI-powered courtroom simulator where you can play as the Judge, Prosecutor, or Defense counsel. The AI handles all other roles in real time — including witnesses, opposing counsel, and the presiding judge — with streaming responses and a fully immersive courtroom experience.

---

## Features

- **Role selection** — Play as Judge, Prosecutor, or Defense. All other roles are handled by AI.
- **Legal systems** — Choose between Indian, US, UK, or General legal frameworks.
- **Streaming AI responses** — Watch each character speak in real time, one after another.
- **Witness system** — Attorneys formally call witnesses to the stand, conduct direct examination, cross-examination, and dismissal.
- **Evidence board** — Track exhibits introduced during the trial.
- **Jury sentiment** — Live jury panel that shifts based on arguments made.
- **Objection tracking** — Sustained and overruled objections are logged.
- **Appeal mode** — File an appeal after a verdict to continue the case.
- **AI demeanor modes** — Characters can be formal, aggressive, empathetic, etc.
- **Pre-trial motions** — Handle motions before the main trial begins.
- **Auto-play viewer mode** — Watch the entire trial play out automatically.
- **Verdict history** — Review past verdicts from all your cases.
- **Case export** — Export the full transcript of any case.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (everywhere) |
| Backend | Node.js + Express |
| Frontend | React + Vite |
| Styling | Tailwind CSS + Shadcn/ui |
| State management | TanStack Query (React Query) |
| Animations | Framer Motion |
| Routing | Wouter |
| AI provider | LongCat API (OpenAI-compatible) |
| Real-time streaming | Server-Sent Events (SSE) |
| Package manager | pnpm (monorepo) |
| Data storage | Local JSON files |

---

## Project Structure

```
lex-machina/
├── api-server/              # Backend — Express API + AI logic
│   └── src/
│       ├── lib/
│       │   ├── aiEngine.ts  # All AI orchestration logic
│       │   ├── longcat.ts   # AI provider client (swap this to change provider)
│       │   ├── prompts.ts   # Character prompts for each role
│       │   └── memory.ts    # Session/case management
│       └── routes/
│           └── courtroom.ts # All API endpoints
├── artifacts/
│   └── courtroom/           # Frontend — React/Vite app
│       └── src/
│           ├── pages/       # Home and courtroom pages
│           ├── components/  # UI components
│           └── hooks/       # React Query hooks
└── lib/
    ├── api-spec/            # OpenAPI schema (single source of truth)
    ├── api-client-react/    # Auto-generated API hooks
    └── api-zod/             # Auto-generated validators
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher — https://nodejs.org
- **pnpm** — install with `npm install -g pnpm`
- An AI API key (LongCat, OpenAI, Groq, or others — see below)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/lex-machina.git
cd lex-machina

# 2. Install all dependencies
pnpm install

# 3. Create your environment file
cp .env.example .env
```

Edit `.env` and add your API key:

```env
LONGCAT_API_KEY=your_longcat_api_key_here
SESSION_SECRET=any_random_string_you_choose
```

### Running Locally

Open two terminal windows:

**Terminal 1 — Backend:**
```bash
pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — Frontend:**
```bash
pnpm --filter @workspace/courtroom run dev
```

Then open your browser at the URL shown by Vite (usually `http://localhost:5173`).

---

## Switching to a Different AI Provider

All AI calls go through one file: **`api-server/src/lib/longcat.ts`**

Open that file and change these three lines at the top:

```ts
const LONGCAT_BASE_URL = "https://api.longcat.chat/openai";  // ← API base URL
const DEFAULT_MODEL = "LongCat-Flash-Chat";                   // ← Model name
```

And in the two functions inside the file, change the env variable it reads:
```ts
const apiKey = process.env["LONGCAT_API_KEY"];  // ← Env variable name
```

### OpenAI

```ts
const LONGCAT_BASE_URL = "https://api.openai.com";
const DEFAULT_MODEL = "gpt-4o";
const apiKey = process.env["OPENAI_API_KEY"];
```

`.env`:
```env
OPENAI_API_KEY=sk-...
```

### Groq (free tier available, very fast)

```ts
const LONGCAT_BASE_URL = "https://api.groq.com/openai";
const DEFAULT_MODEL = "llama3-70b-8192";
const apiKey = process.env["GROQ_API_KEY"];
```

`.env`:
```env
GROQ_API_KEY=gsk_...
```

### OpenRouter (access Claude, Llama, Mistral, and more)

```ts
const LONGCAT_BASE_URL = "https://openrouter.ai/api";
const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";
const apiKey = process.env["OPENROUTER_API_KEY"];
```

`.env`:
```env
OPENROUTER_API_KEY=sk-or-...
```

### Together AI

```ts
const LONGCAT_BASE_URL = "https://api.together.xyz";
const DEFAULT_MODEL = "meta-llama/Llama-3-70b-chat-hf";
const apiKey = process.env["TOGETHER_API_KEY"];
```

`.env`:
```env
TOGETHER_API_KEY=...
```

### Ollama (100% local, no API key needed)

Run Ollama locally first: https://ollama.com

```ts
const LONGCAT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3";
const apiKey = process.env["OLLAMA_API_KEY"] ?? "ollama"; // Ollama ignores this
```

`.env`:
```env
OLLAMA_API_KEY=ollama
```

> **Note:** Anthropic (Claude direct API) uses a different request format and would require more extensive changes to `longcat.ts`. Use OpenRouter if you want Claude without code changes.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LONGCAT_API_KEY` | Yes (or your chosen provider key) | API key for the AI provider |
| `SESSION_SECRET` | Yes | Random string used to sign sessions. Any value works. |

---

## Running in Production (VPS/Server)

Install `pm2` to keep the processes running in the background:

```bash
npm install -g pm2

pm2 start "pnpm --filter @workspace/api-server run dev" --name lex-api
pm2 start "pnpm --filter @workspace/courtroom run dev" --name lex-web

pm2 save
pm2 startup
```

---

## Data Storage

Cases are stored as JSON files in `api-server/data/cases/`. This folder is excluded from Git by `.gitignore`. If you want persistent storage across deployments or multiple machines, the storage logic lives in `api-server/src/lib/memory.ts` and can be swapped for a database.

---

## License

MIT — free to use, modify, and distribute.

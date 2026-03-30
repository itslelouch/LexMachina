# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (not used yet — memory stored in JSON files)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: LongCat API (OpenAI-compatible format) via `LONGCAT_API_KEY` secret
- **Frontend**: React + Vite (framer-motion, Tailwind v4, shadcn/ui)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── courtroom/          # React + Vite courtroom simulator frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── data/cases/             # JSON memory store for courtroom sessions (created at runtime by api-server)
```

## Courtroom Simulator — Lex Machina

A full-stack AI courtroom simulator where:
- **3 AI roles**: Judge, Prosecutor (Advocate 1), Defense (Advocate 2)
- **LongCat API** powers each role with dedicated system prompts
- **User can control any combination** of roles; AI fills the rest
- **Role switching**: User can claim or release any role at any time
- **Shared memory**: All 3 roles share the full transcript (JSON file per case session)
- **Case upload**: User provides case brief/evidence at start
- **Developments**: User can add new evidence/testimony mid-proceedings
- **6 court phases**: Opening Statements → Prosecution Case → Defense Case → Closing Arguments → Verdict → Concluded
- **Viewer mode**: User controls no roles; "Auto Proceed" button advances all AI roles in sequence

### Key Backend Files
- `artifacts/api-server/src/lib/longcat.ts` — LongCat API client with retry + rate limit handling
- `artifacts/api-server/src/lib/memory.ts` — Case session CRUD, JSON file persistence in `data/cases/`
- `artifacts/api-server/src/lib/prompts.ts` — System prompts for Judge, Prosecutor, Defense
- `artifacts/api-server/src/lib/aiEngine.ts` — Orchestrates AI turns, builds messages, calls LongCat
- `artifacts/api-server/src/routes/cases.ts` — Case CRUD, role management, developments, phase updates
- `artifacts/api-server/src/routes/courtroom.ts` — speak, ai-turn, auto-proceed endpoints

### Key Frontend Files
- `artifacts/courtroom/src/pages/home.tsx` — Landing page with case creation form + recent dockets
- `artifacts/courtroom/src/pages/courtroom.tsx` — Main courtroom simulator UI
- `artifacts/courtroom/src/components/TranscriptEntryCard.tsx` — Per-role styled transcript entry
- `artifacts/courtroom/src/hooks/use-courtroom.ts` — Composite React Query hooks

### Memory System
Each case session is stored as a JSON file at `artifacts/api-server/data/cases/<caseId>.json`. Contains:
- Case title, case text
- Current phase
- Role assignments (judge/prosecutor/defense = "user" | "ai")
- Full transcript array (shared by all 3 AI roles for context)
- Developments array

### System Prompts
Each AI role receives:
1. A rich **system prompt** containing: role identity + responsibilities + conduct rules + current phase + case file + full proceedings transcript
2. A **turn prompt** asking the role to speak now

This ensures every AI response is grounded in the full case history.

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate React Query hooks + Zod schemas from OpenAPI spec

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`. Uses LongCat API (not OpenAI) for AI. Case memory in JSON files.

### `artifacts/courtroom` (`@workspace/courtroom`)

React + Vite frontend. Dark navy/gold legal theme. Uses framer-motion for animations. Cinzel font for display text.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Currently not used (memory = JSON files).

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

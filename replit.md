# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

Network Fingerprinting web application — upload `.pcap`/`.pcapng` network capture files to extract and analyze packet-level features (source IP, destination IP, packet size, TTL, protocol, time delta).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Python version**: 3.12 (for packet analysis via scapy)
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Packet analysis**: Python 3.12 + scapy

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   │   └── scripts/        # Python scripts (analyze_pcap.py)
│   └── web-app/            # React + Vite frontend (Network Fingerprinting UI)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes:
  - `src/routes/health.ts` — `GET /api/healthz` health check
  - `src/routes/analyze.ts` — `POST /api/analyze` accepts multipart file upload (.pcap/.pcapng), invokes Python script, returns packet features
- Scripts:
  - `scripts/analyze_pcap.py` — Python script using scapy to parse pcap/pcapng files and output JSON array of packet features
- Depends on: `@workspace/db`, `@workspace/api-zod`, `multer`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)

### `artifacts/web-app` (`@workspace/web-app`)

React + Vite frontend for Network Fingerprinting. Single-page app at root path `/`.

- File upload with drag-and-drop (react-dropzone)
- Interactive data table with sortable columns
- Client-side IP address filtering
- CSV export of filtered/full results
- Dark cybersecurity-themed UI with framer-motion animations

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`, `AnalyzePcapResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `useAnalyzePcap`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/healthz` | Health check |
| POST | `/api/analyze` | Upload pcap/pcapng → returns raw packet features + per-device fingerprints |
| GET | `/api/fingerprint/baselines` | List all saved device baselines |
| POST | `/api/fingerprint/baselines` | Save a device fingerprint as a named baseline |
| DELETE | `/api/fingerprint/baselines/:id` | Delete a saved baseline |
| POST | `/api/fingerprint/compare` | Upload pcap → compare each device against saved baseline, return verdict |

## Detection Algorithm

Similarity score = weighted average of three metrics:
- **TTL similarity** (40%) — deviation from baseline avg TTL, normalized over a 64-unit scale
- **Protocol distribution** (30%) — cosine similarity of protocol percentage distributions  
- **Packet size similarity** (30%) — relative deviation of average packet size

Verdicts:
- **Normal** — similarity ≥ 90%
- **Suspicious** — similarity 70–89%
- **Possible Spoofing** — similarity < 70%
- **No Baseline** — no saved profile exists for this device IP

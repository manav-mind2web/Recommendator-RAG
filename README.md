# Grounded Listings Assistant

A minimal streaming chat endpoint (and UI) that recommends from a **fixed dataset of 18 local listings — and only that dataset**. It never invents listings, never answers from open‑web or pretrained knowledge, only links via each listing's own `externalUrl`, and refuses or gracefully redirects anything out of scope.

The core idea: **the model can only touch data through typed tools, and a deterministic server‑side layer re‑validates everything the model emits.** Grounding is enforced in code, not just requested in the prompt.

---

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript (strict)**
- **Vercel AI SDK v5** (`streamText`) — provider‑swappable
- **Anthropic + OpenAI + Google (Gemini)** all wired, selected by the `PROVIDER` env var
- **pgvector** (Postgres) for real semantic search, seeded from the dataset
- **Local embeddings by default** (Transformers.js, `all-MiniLM-L6-v2`, on‑device, no API key) — switchable to **OpenAI `text-embedding-3-small`** via `EMBEDDING_PROVIDER`. Embeddings are decoupled from the chat provider.
- **Vitest** for the eval/test suite

---

## How it works

```
Browser (chat UI)
  └─ POST /api/chat ──► streamText(model, tools, systemPrompt)
                         ├─ tool calls ──► ListingRepository (pgvector) ──► per-turn "approved" allow-list
                         ├─ stream text tokens ──────────────► client
                         └─ onFinish ─► validateOutput(text, approved)
                                          ├─ strip + log ungrounded ids/URLs
                                          └─ emit `data-listings` (validated cards) ─► client
```

1. **Typed tools are the only data access** — `searchListings` and `getListingById` (`src/lib/ai/tools.ts`). The raw dataset is never placed in the prompt.
2. **System prompt + guardrails** (`src/lib/ai/system-prompt.ts`) — recommend only from tool results, link only via `externalUrl`, refuse bookings/availability/off‑topic, resist prompt injection, always show the disclaimer.
3. **Per‑turn allow‑list** (`src/lib/ai/approved.ts`) — every listing returned by a tool this turn is recorded.
4. **Server‑side validation** (`src/lib/ai/validate-output.ts`) — every listing id / URL in the final text is checked against the allow‑list; anything ungrounded is stripped from the rendered surface and logged (`src/lib/logging/logger.ts`). The structured cards are built only from approved listings, so they're valid by construction.
5. **Scalability seam** — `ListingRepository` (`src/lib/data/repository.ts`) is the only data interface. Today it's `PgVectorRepository`; scaling to a large dataset means a bigger Postgres + the already‑created HNSW index, not an app rewrite. (`InMemoryListingRepository` is a dependency‑free implementation used by the tests.)

---

## Running it

### Prerequisites

- Node.js 20+ and npm
- Docker (for the pgvector database)
- A chat API key for your chosen `PROVIDER`: Anthropic, OpenAI, **or** Google (Gemini).
- **Embeddings need no key by default** — they run on‑device (Transformers.js). Only set `OPENAI_API_KEY` for embeddings if you switch `EMBEDDING_PROVIDER=openai`.

### 1. Install & configure

```bash
npm install
cp .env.example .env      # then fill in keys
```

Set in `.env`:

- `PROVIDER` — `anthropic`, `openai`, or `google`
- The matching chat key: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY`
- `EMBEDDING_PROVIDER` — `local` (default, on‑device, no key) or `openai` (needs `OPENAI_API_KEY`)
- `DATABASE_URL` — already matches `docker-compose.yml`

> Switching `EMBEDDING_PROVIDER` changes the vector dimension (local = 384, OpenAI = 1536), so re‑run `npm run seed` after changing it — the seed script recreates the table at the correct dimension. The first local‑embedding run downloads the ~25 MB model once and caches it.

### 2. Start the database and seed it

```bash
docker compose up -d      # starts pgvector on localhost:5432
npm run seed              # creates the table, embeds 18 listings, builds the ANN index
```

### 3. Run

```bash
npm run dev               # http://localhost:3000
```

### Quality gates

```bash
npm run build             # production build
npm run lint              # ESLint (flat config, eslint-config-next)
npm run typecheck         # tsc --noEmit (strict)
npm test                  # Vitest
```

> The deterministic tests (`schema`, `tools`, `validation`) run with **no API key and no database**. The live‑model evals (`eval.test.ts`) are skipped automatically unless a chat API key is present.

---

## Streaming response contract

`POST /api/chat` accepts an AI‑SDK UI‑message body (`{ messages }`) and returns a **streamed UI‑message response** (`createUIMessageStreamResponse`). The stream carries two kinds of parts the front end consumes:

| Part | Shape | Purpose |
| --- | --- | --- |
| `text` | `{ type: "text", text: string }` | Conversational answer, streamed token‑by‑token. |
| `data-listings` | `{ type: "data-listings", data: { listings: ListingCard[]; disclaimer: string } }` | **Structured references** — the validated cards to render, plus the disclaimer. Emitted after generation completes. |

`ListingCard` = `{ id, name, category, city, priceTier, blurb, externalUrl }` (`src/lib/data/schema.ts`). The `id` is the join key between the prose and the cards. The contract types live in `src/lib/ai/messages.ts`, so a front end gets the part shapes for free via `useChat<LeadUIMessage>()`.

Every id/URL in `data-listings` is guaranteed to exist in that turn's approved tool‑result set — that's the validation invariant.

---

## Eval / test cases

`tests/` contains:

- **`schema.test.ts`** — dataset loads & validates (18 rows, unique ids, the `att-003` null‑URL edge case).
- **`tools.test.ts`** — tools only ever return dataset rows; `getListingById` reports not‑found without inventing data; tool results populate the allow‑list.
- **`validation.test.ts`** — feeds crafted model output with an invented id (`xyz-999`) and an off‑dataset URL → both stripped + logged; approved id/URL pass; the `att-003` null‑link case yields a card with no link and no violation.
- **`eval.test.ts`** (key‑gated live model) — the five required scenarios: (1) normal recommendation returns grounded cards, (2) out‑of‑scope flight request is redirected, (3) prompt injection doesn't break grounding, (4) invented‑place request yields no fabricated listing, (5) link handling never fabricates a URL for `att-003`.

This split keeps CI green without credentials while giving full scenario coverage when a key is present.

---

## Voice version (written answer)

For a phone‑based voice version of this same assistant I'd use **Twilio** for telephony (PSTN + Media Streams) feeding a **streaming STT** (Deepgram), the **exact same grounded core** (AI SDK `streamText` + the same `ListingRepository`, typed tools, system prompt, and `validate-output` layer), streaming **TTS** (ElevenLabs or Cartesia), all orchestrated by **Pipecat** (or **LiveKit Agents**) for low‑latency turn‑taking, voice‑activity detection, and barge‑in. The reason: voice's hard problems are latency and interruption, which Pipecat/LiveKit + streaming STT/TTS are built for — while **grounding stays identical**, because the same tool + validation core remains the only path to data, so the voice bot can drift no more than the text bot. (Explicitly not Vapi.)

---

## What I'd harden for production

- **Auth + per‑IP rate limiting** on `/api/chat`; request size limits.
- **Durable audit log** for violations (currently console + in‑memory ring) with alerting.
- **A prompt‑injection red‑team suite in CI** that fails the build on regressions.
- **Embedding cache + batch re‑seeding**; migration/versioning for the dataset.
- **Observability** (OpenTelemetry traces, token‑cost metrics) and DB pooling/retry/timeouts.
- **Output moderation** pass and schema‑versioned structured parts.
- **Secrets via a manager**, not `.env`; least‑privilege DB credentials.

## AI coding tools used

Built with **Claude Code** (Anthropic). Model defaults to `claude-opus-4-8`; override with `ANTHROPIC_MODEL` (e.g. `claude-haiku-4-5`) for a cheaper run on this tiny dataset.

---

## Project layout

```
data/sample-listings.json        # the dataset (single source of truth)
docker-compose.yml               # pgvector
scripts/seed.ts                  # load → validate → embed → upsert + ANN index
src/
  app/
    api/chat/route.ts            # streaming endpoint + onFinish validation
    page.tsx, layout.tsx
  components/                    # Chat, ListingCard, Disclaimer
  lib/
    ai/                          # tools, system-prompt, approved, validate-output, provider, run, messages
    data/                        # schema, load, repository (+ pgvector & in-memory impls)
    embeddings/embedder.ts       # embeddings (local Transformers.js | OpenAI)
    logging/logger.ts            # violation log
tests/                           # schema, tools, validation, eval
```

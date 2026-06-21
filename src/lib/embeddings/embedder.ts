import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";

/**
 * Embeddings are decoupled from the chat provider and selectable via
 * `EMBEDDING_PROVIDER`:
 *
 *   - "local"  (default) — runs fully on-device via Transformers.js. No API key,
 *     no network at query time after the model is cached. Model defaults to
 *     `Xenova/all-MiniLM-L6-v2` (384-dim).
 *   - "openai" — `text-embedding-3-small` (1536-dim). Requires `OPENAI_API_KEY`.
 *
 * The vector dimension differs per backend, so it is resolved dynamically and
 * used to size the pgvector column at seed time. Switching backends requires a
 * re-seed (the seed script recreates the table at the correct dimension).
 */

type EmbeddingProvider = "local" | "openai";

const LOCAL_MODEL =
  process.env.LOCAL_EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2";

/** Output dimensions per backend. */
const DIMS: Record<EmbeddingProvider, number> = {
  local: 384, // all-MiniLM-L6-v2
  openai: 1536, // text-embedding-3-small
};

function provider(): EmbeddingProvider {
  const p = (process.env.EMBEDDING_PROVIDER ?? "local").toLowerCase();
  if (p === "local" || p === "openai") return p;
  throw new Error(
    `Unknown EMBEDDING_PROVIDER "${p}". Set it to "local" or "openai".`,
  );
}

/** Vector dimension for the active embedding backend. */
export function embeddingDim(): number {
  return DIMS[provider()];
}

// ---- OpenAI backend ---------------------------------------------------------

function openaiModel() {
  const name = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  return openai.textEmbeddingModel(name);
}

// ---- Local backend (Transformers.js) ---------------------------------------

// Lazily import + initialise the pipeline so the (heavy) ML runtime is only
// loaded when local embeddings are actually used, and only once per process.
let extractorPromise:
  | Promise<(text: string | string[], opts: unknown) => Promise<{ data: Float32Array; dims: number[] }>>
  | undefined;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      return pipeline("feature-extraction", LOCAL_MODEL) as unknown as (
        text: string | string[],
        opts: unknown,
      ) => Promise<{ data: Float32Array; dims: number[] }>;
    })();
  }
  return extractorPromise;
}

async function embedLocal(texts: string[]): Promise<number[][]> {
  const extractor = await getExtractor();
  // Mean-pooled + L2-normalised sentence embeddings (cosine-ready).
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const [rows, dim] = output.dims;
  const flat = Array.from(output.data);
  const result: number[][] = [];
  for (let r = 0; r < rows; r++) {
    result.push(flat.slice(r * dim, r * dim + dim));
  }
  return result;
}

// ---- Public API -------------------------------------------------------------

/** Embed a single piece of text (used at query time). */
export async function embedText(text: string): Promise<number[]> {
  if (provider() === "local") {
    const [embedding] = await embedLocal([text]);
    return embedding;
  }
  const { embedding } = await embed({ model: openaiModel(), value: text });
  return embedding;
}

/** Embed many pieces of text in one batched call (used by the seed script). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (provider() === "local") {
    return embedLocal(texts);
  }
  const { embeddings } = await embedMany({
    model: openaiModel(),
    values: texts,
  });
  return embeddings;
}

/** Format a vector for a parameterized `::vector` cast in pgvector. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

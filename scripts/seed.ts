import { config } from "dotenv";
import { Pool } from "pg";

config();
import { loadListings } from "../src/lib/data/load";
import {
  embeddingDim,
  embedTexts,
  toVectorLiteral,
} from "../src/lib/embeddings/embedder";
import type { Listing } from "../src/lib/data/schema";

/** Text we embed per listing — name + blurb + facets for good semantic recall. */
function embeddingText(l: Listing): string {
  return `${l.name}. ${l.blurb} Category: ${l.category}. City: ${l.city}. Tags: ${l.tags.join(", ")}.`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }
  const embeddingProvider = (process.env.EMBEDDING_PROVIDER ?? "local").toLowerCase();
  if (embeddingProvider === "openai" && !process.env.OPENAI_API_KEY) {
    throw new Error(
      "EMBEDDING_PROVIDER=openai but OPENAI_API_KEY is not set. Set the key, or use EMBEDDING_PROVIDER=local for on-device embeddings.",
    );
  }

  const dim = embeddingDim();
  const listings = loadListings();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("Enabling pgvector extension…");
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");

    // Recreate the table so a change of embedding backend (and thus vector
    // dimension) always takes effect — a `vector(N)` column's dimension is fixed
    // at creation, so an old table from a different backend would mismatch.
    console.log(`Creating listings table (embedding dim ${dim}, provider "${embeddingProvider}")…`);
    await pool.query("DROP TABLE IF EXISTS listings");
    await pool.query(`
      CREATE TABLE listings (
        id           text PRIMARY KEY,
        name         text NOT NULL,
        category     text NOT NULL,
        city         text NOT NULL,
        tags         text[] NOT NULL,
        price_tier   text NOT NULL,
        blurb        text NOT NULL,
        external_url text,
        embedding    vector(${dim}) NOT NULL
      )
    `);

    console.log(`Embedding ${listings.length} listings…`);
    const embeddings = await embedTexts(listings.map(embeddingText));

    console.log("Upserting rows…");
    for (let i = 0; i < listings.length; i++) {
      const l = listings[i];
      await pool.query(
        `INSERT INTO listings (id, name, category, city, tags, price_tier, blurb, external_url, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           city = EXCLUDED.city,
           tags = EXCLUDED.tags,
           price_tier = EXCLUDED.price_tier,
           blurb = EXCLUDED.blurb,
           external_url = EXCLUDED.external_url,
           embedding = EXCLUDED.embedding`,
        [
          l.id,
          l.name,
          l.category,
          l.city,
          l.tags,
          l.priceTier,
          l.blurb,
          l.externalUrl,
          toVectorLiteral(embeddings[i]),
        ],
      );
    }

    console.log("Creating ANN index (HNSW, cosine)…");
    await pool.query(
      "CREATE INDEX IF NOT EXISTS listings_embedding_idx ON listings USING hnsw (embedding vector_cosine_ops)",
    );

    const { rows } = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM listings",
    );
    console.log(`Done. ${rows[0].count} listings in the database.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import type { Pool } from "pg";
import { embedText, toVectorLiteral } from "../embeddings/embedder";
import type { ListingRepository, SearchParams } from "./repository";
import { listingSchema, type Listing } from "./schema";

const COLUMNS = "id, name, category, city, tags, price_tier, blurb, external_url";

interface ListingRow {
  id: string;
  name: string;
  category: string;
  city: string;
  tags: string[];
  price_tier: string;
  blurb: string;
  external_url: string | null;
}

function rowToListing(row: ListingRow): Listing {
  // Re-validate on the way out so a malformed row can never leak past the
  // repository as an "approved" listing.
  return listingSchema.parse({
    id: row.id,
    name: row.name,
    category: row.category,
    city: row.city,
    tags: row.tags,
    priceTier: row.price_tier,
    blurb: row.blurb,
    externalUrl: row.external_url,
  });
}

/**
 * Production {@link ListingRepository} backed by Postgres + pgvector. Search is
 * hybrid: structured `WHERE` filters AND (when a free-text `query` is present)
 * semantic ranking via cosine distance over the configured embeddings (local or
 * OpenAI; see embedder.ts). To scale to a
 * large dataset, this stays the same — add an ANN index (already created by the
 * seed script) and grow Postgres.
 */
export class PgVectorRepository implements ListingRepository {
  constructor(private readonly pool: Pool) {}

  async search(params: SearchParams): Promise<Listing[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (params.category) {
      where.push(`category = $${i++}`);
      values.push(params.category);
    }
    if (params.city) {
      where.push(`lower(city) = lower($${i++})`);
      values.push(params.city);
    }
    if (params.priceTier) {
      where.push(`price_tier = $${i++}`);
      values.push(params.priceTier);
    }
    if (params.tags && params.tags.length > 0) {
      where.push(`tags && $${i++}`);
      values.push(params.tags);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const limit = params.limit ?? 5;
    const query = params.query?.trim();

    if (query) {
      const embedding = await embedText(query);
      const vectorParam = i++;
      const limitParam = i++;
      values.push(toVectorLiteral(embedding), limit);
      const sql = `SELECT ${COLUMNS} FROM listings ${whereSql} ORDER BY embedding <=> $${vectorParam}::vector LIMIT $${limitParam}`;
      const { rows } = await this.pool.query<ListingRow>(sql, values);
      return rows.map(rowToListing);
    }

    const limitParam = i++;
    values.push(limit);
    const sql = `SELECT ${COLUMNS} FROM listings ${whereSql} ORDER BY name LIMIT $${limitParam}`;
    const { rows } = await this.pool.query<ListingRow>(sql, values);
    return rows.map(rowToListing);
  }

  async getById(id: string): Promise<Listing | null> {
    const { rows } = await this.pool.query<ListingRow>(
      `SELECT ${COLUMNS} FROM listings WHERE id = $1`,
      [id],
    );
    return rows[0] ? rowToListing(rows[0]) : null;
  }

  async allIds(): Promise<Set<string>> {
    const { rows } = await this.pool.query<{ id: string }>(
      "SELECT id FROM listings",
    );
    return new Set(rows.map((r) => r.id));
  }
}

import type { Category, Listing, PriceTier } from "./schema";

/** Parameters accepted by a listing search. All fields are optional filters. */
export interface SearchParams {
  /** Free-text query used for semantic ranking. */
  query?: string;
  category?: Category;
  city?: string;
  tags?: string[];
  priceTier?: PriceTier;
  /** Max number of results. Defaults are applied by the caller (tool layer). */
  limit?: number;
}

/**
 * The ONLY way the rest of the app reaches listing data. Swapping the storage
 * engine (in-memory ➜ pgvector ➜ a managed vector DB) is a matter of providing a
 * new implementation of this interface — nothing above it changes. This is the
 * scalability seam: a larger dataset means a bigger Postgres + a tuned ANN index,
 * not an application rewrite.
 */
export interface ListingRepository {
  /** Hybrid structured-filter + (when `query` is present) semantic search. */
  search(params: SearchParams): Promise<Listing[]>;
  /** Fetch a single listing by id, or `null` if it does not exist. */
  getById(id: string): Promise<Listing | null>;
  /** The full set of approved ids — used by tests/diagnostics. */
  allIds(): Promise<Set<string>>;
}

import { getPool } from "./db";
import { PgVectorRepository } from "./pgvector-repository";
import type { ListingRepository } from "./repository";

let repository: ListingRepository | undefined;

/**
 * The repository the running app uses: pgvector-backed semantic search. Cached
 * across requests. (Tests construct an InMemoryListingRepository directly.)
 */
export function getRepository(): ListingRepository {
  if (!repository) {
    repository = new PgVectorRepository(getPool());
  }
  return repository;
}

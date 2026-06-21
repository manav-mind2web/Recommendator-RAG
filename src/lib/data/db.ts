import { Pool } from "pg";

let pool: Pool | undefined;

/**
 * Lazily-created singleton Postgres pool. Reused across requests (and across hot
 * reloads in dev) so we don't exhaust connections.
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and start the database with `docker compose up -d`.",
      );
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { datasetSchema, type Listing } from "./schema";

/**
 * Loads and validates the approved dataset from disk. Reading at runtime (server
 * + scripts + tests) keeps a single canonical copy and avoids bundler JSON-import
 * quirks. Throws if the file is missing or fails schema validation — we never want
 * to start serving against a malformed dataset.
 */
export function loadListings(): Listing[] {
  const path = join(process.cwd(), "data", "sample-listings.json");
  const raw = readFileSync(path, "utf-8");
  const parsed = datasetSchema.parse(JSON.parse(raw));
  return parsed.listings;
}

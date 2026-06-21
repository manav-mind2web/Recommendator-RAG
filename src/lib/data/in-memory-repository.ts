import { loadListings } from "./load";
import type { ListingRepository, SearchParams } from "./repository";
import type { Listing } from "./schema";

/**
 * A dependency-free {@link ListingRepository} backed by the in-process dataset.
 * Used by the test suite and as an offline fallback. Search here is keyword/filter
 * based (no embeddings) — good enough for 18 rows and deterministic for tests.
 * The production path uses {@link PgVectorRepository} for real semantic search.
 */
export class InMemoryListingRepository implements ListingRepository {
  private readonly listings: Listing[];

  constructor(listings: Listing[] = loadListings()) {
    this.listings = listings;
  }

  async search(params: SearchParams): Promise<Listing[]> {
    const limit = params.limit ?? 5;
    const tags = params.tags?.map((t) => t.toLowerCase());

    const filtered = this.listings.filter((l) => {
      if (params.category && l.category !== params.category) return false;
      if (params.city && l.city.toLowerCase() !== params.city.toLowerCase()) {
        return false;
      }
      if (params.priceTier && l.priceTier !== params.priceTier) return false;
      if (tags && tags.length > 0) {
        const listingTags = l.tags.map((t) => t.toLowerCase());
        if (!tags.some((t) => listingTags.includes(t))) return false;
      }
      return true;
    });

    const query = params.query?.trim().toLowerCase();
    if (!query) {
      return filtered.slice(0, limit);
    }

    const terms = query.split(/\s+/).filter(Boolean);
    const scored = filtered
      .map((l) => ({ listing: l, score: keywordScore(l, terms) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    // If nothing matched the keywords but filters were applied, fall back to the
    // filtered set so the model still gets relevant in-scope candidates.
    const ranked =
      scored.length > 0
        ? scored.map((s) => s.listing)
        : params.category || params.city || params.priceTier || tags
          ? filtered
          : [];

    return ranked.slice(0, limit);
  }

  async getById(id: string): Promise<Listing | null> {
    return this.listings.find((l) => l.id === id) ?? null;
  }

  async allIds(): Promise<Set<string>> {
    return new Set(this.listings.map((l) => l.id));
  }
}

function keywordScore(listing: Listing, terms: string[]): number {
  const haystack = [
    listing.name,
    listing.blurb,
    listing.category,
    listing.city,
    listing.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += 1;
    if (listing.name.toLowerCase().includes(term)) score += 2;
    if (listing.tags.some((t) => t.toLowerCase() === term)) score += 2;
  }
  return score;
}

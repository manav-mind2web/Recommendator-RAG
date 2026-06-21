import type { Listing } from "../data/schema";

/**
 * Accumulates every listing returned by tools during a single turn. This is the
 * allow-list the output validator checks against: anything the model emits that
 * is not in here is, by definition, ungrounded.
 */
export class ApprovedSet {
  private readonly byId = new Map<string, Listing>();
  private readonly urls = new Set<string>();

  add(listings: Listing[]): void {
    for (const listing of listings) {
      this.byId.set(listing.id.toLowerCase(), listing);
      if (listing.externalUrl) {
        this.urls.add(listing.externalUrl);
      }
    }
  }

  hasId(id: string): boolean {
    return this.byId.has(id.toLowerCase());
  }

  hasUrl(url: string): boolean {
    return this.urls.has(url);
  }

  get(id: string): Listing | undefined {
    return this.byId.get(id.toLowerCase());
  }

  all(): Listing[] {
    return [...this.byId.values()];
  }
}

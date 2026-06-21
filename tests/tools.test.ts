import type { ToolCallOptions } from "ai";
import { beforeEach, describe, expect, it } from "vitest";
import { ApprovedSet } from "@/lib/ai/approved";
import { createTools } from "@/lib/ai/tools";
import { InMemoryListingRepository } from "@/lib/data/in-memory-repository";
import { loadListings } from "@/lib/data/load";

const OPTS = { toolCallId: "test-call", messages: [] } as unknown as ToolCallOptions;
const DATASET_IDS = new Set(loadListings().map((l) => l.id));

describe("tools", () => {
  let approved: ApprovedSet;
  let tools: ReturnType<typeof createTools>;

  beforeEach(() => {
    approved = new ApprovedSet();
    tools = createTools(new InMemoryListingRepository(), approved);
  });

  it("searchListings returns only dataset listings and records them as approved", async () => {
    const result = await tools.searchListings.execute!(
      { category: "dining", city: "Brookline" },
      OPTS,
    );

    expect(result.count).toBeGreaterThan(0);
    for (const listing of result.listings) {
      expect(DATASET_IDS.has(listing.id)).toBe(true);
      expect(listing.category).toBe("dining");
      expect(listing.city).toBe("Brookline");
      expect(approved.hasId(listing.id)).toBe(true);
    }
  });

  it("searchListings ranks by query relevance", async () => {
    const result = await tools.searchListings.execute!(
      { query: "oyster bar seafood" },
      OPTS,
    );
    const ids = result.listings.map((l) => l.id);
    expect(ids).toContain("din-003"); // Harborlight Oyster Bar
  });

  it("getListingById returns a known listing", async () => {
    const result = await tools.getListingById.execute!({ id: "din-001" }, OPTS);
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.listing.name).toBe("The Mill House Cafe");
      expect(approved.hasId("din-001")).toBe(true);
    }
  });

  it("getListingById reports not-found for an unknown id without inventing data", async () => {
    const result = await tools.getListingById.execute!(
      { id: "zzz-999" },
      OPTS,
    );
    expect(result.found).toBe(false);
    expect(approved.hasId("zzz-999")).toBe(false);
  });
});

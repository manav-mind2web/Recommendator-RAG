import { describe, expect, it } from "vitest";
import { loadListings } from "@/lib/data/load";

describe("dataset", () => {
  const listings = loadListings();

  it("loads and validates all 18 listings", () => {
    expect(listings).toHaveLength(18);
  });

  it("has unique ids", () => {
    const ids = new Set(listings.map((l) => l.id));
    expect(ids.size).toBe(listings.length);
  });

  it("preserves the null-externalUrl edge case (att-003)", () => {
    const starfall = listings.find((l) => l.id === "att-003");
    expect(starfall).toBeDefined();
    expect(starfall?.externalUrl).toBeNull();
  });

  it("every externalUrl is either null or a dataset URL", () => {
    for (const l of listings) {
      if (l.externalUrl !== null) {
        expect(l.externalUrl.startsWith("https://example.com/")).toBe(true);
      }
    }
  });
});

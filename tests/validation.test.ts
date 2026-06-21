import { describe, expect, it } from "vitest";
import { ApprovedSet } from "@/lib/ai/approved";
import { validateOutput } from "@/lib/ai/validate-output";
import { InMemoryListingRepository } from "@/lib/data/in-memory-repository";

const repo = new InMemoryListingRepository();

async function approve(...ids: string[]): Promise<ApprovedSet> {
  const approved = new ApprovedSet();
  for (const id of ids) {
    const listing = await repo.getById(id);
    if (listing) approved.add([listing]);
  }
  return approved;
}

describe("validateOutput", () => {
  it("strips and logs an invented listing id and an off-dataset URL", async () => {
    const approved = await approve("din-001");
    const text =
      "I recommend The Mill House Cafe (din-001) at https://example.com/mill-house-cafe. " +
      "You might also like the Grand Plaza Resort (xyz-999) — https://evil.example.net/fake.";

    const { references, violations } = validateOutput(text, approved);

    // The approved listing is referenced.
    expect(references.map((r) => r.id)).toEqual(["din-001"]);

    // The invented id and off-dataset URL are flagged.
    const ids = violations.filter((v) => v.type === "unapproved-id");
    const urls = violations.filter((v) => v.type === "unapproved-url");
    expect(ids.map((v) => v.value)).toContain("xyz-999");
    expect(urls.map((v) => v.value)).toContain("https://evil.example.net/fake");

    // The approved id/url are NOT flagged.
    expect(ids.map((v) => v.value)).not.toContain("din-001");
    expect(urls.map((v) => v.value)).not.toContain(
      "https://example.com/mill-house-cafe",
    );
  });

  it("includes only approved listings that the model actually surfaced", async () => {
    const approved = await approve("din-001", "din-002");
    const text = "The Mill House Cafe is a great breakfast spot.";
    const { references } = validateOutput(text, approved);
    expect(references.map((r) => r.id)).toEqual(["din-001"]);
  });

  it("handles the null-externalUrl listing without fabricating a link", async () => {
    const approved = await approve("att-003");
    const text =
      "Starfall Observatory hosts public telescope nights. I don't have a website link for it.";
    const { references, violations } = validateOutput(text, approved);

    expect(references).toHaveLength(1);
    expect(references[0].id).toBe("att-003");
    expect(references[0].externalUrl).toBeNull();
    expect(violations).toHaveLength(0);
  });
});

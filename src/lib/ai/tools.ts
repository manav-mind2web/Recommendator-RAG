import { tool } from "ai";
import { z } from "zod";
import { categorySchema, priceTierSchema } from "../data/schema";
import type { ListingRepository } from "../data/repository";
import type { ApprovedSet } from "./approved";

/**
 * Builds the typed tools that are the ONLY channel between the model and the
 * dataset. Each call records the returned listings into `approved` so the
 * server-side validator can later confirm nothing ungrounded was emitted.
 *
 * The raw dataset is never placed in the prompt — the model must go through
 * these tools to see any listing.
 */
export function createTools(repo: ListingRepository, approved: ApprovedSet) {
  return {
    searchListings: tool({
      description:
        "Search the approved local directory for listings. Use a free-text `query` for intent (e.g. 'vegetarian breakfast'), and/or structured filters. Returns matching listings from the directory only.",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("Free-text description of what the user wants."),
        category: categorySchema
          .optional()
          .describe("Restrict to a category."),
        city: z.string().optional().describe("Restrict to a city."),
        tags: z
          .array(z.string())
          .optional()
          .describe("Match any of these tags."),
        priceTier: priceTierSchema
          .optional()
          .describe("Restrict to a price tier."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("Max results (default 5)."),
      }),
      execute: async (input) => {
        const results = await repo.search({ ...input, limit: input.limit ?? 5 });
        approved.add(results);
        return {
          count: results.length,
          listings: results,
        };
      },
    }),

    getListingById: tool({
      description:
        "Fetch a single listing from the approved directory by its id (e.g. 'din-001'). Returns { found: false } if no such listing exists.",
      inputSchema: z.object({
        id: z.string().describe("The listing id, e.g. din-001."),
      }),
      execute: async ({ id }) => {
        const listing = await repo.getById(id);
        if (!listing) {
          return { found: false as const, id };
        }
        approved.add([listing]);
        return { found: true as const, listing };
      },
    }),
  };
}

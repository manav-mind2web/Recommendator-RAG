import { z } from "zod";

/** The fixed set of categories present in the dataset. */
export const CATEGORIES = ["dining", "lodging", "attraction", "venue"] as const;

/** The fixed set of price tiers present in the dataset. */
export const PRICE_TIERS = ["free", "$", "$$", "$$$", "$$$$"] as const;

export const categorySchema = z.enum(CATEGORIES);
export const priceTierSchema = z.enum(PRICE_TIERS);

/**
 * A single approved listing. This schema is the single source of truth for the
 * shape of a listing across the app (loader, repository, tools, validation).
 */
export const listingSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: categorySchema,
  city: z.string(),
  tags: z.array(z.string()),
  priceTier: priceTierSchema,
  blurb: z.string(),
  externalUrl: z.string().url().nullable(),
});

export const datasetSchema = z.object({
  _note: z.string().optional(),
  listings: z.array(listingSchema),
});

export type Category = z.infer<typeof categorySchema>;
export type PriceTier = z.infer<typeof priceTierSchema>;
export type Listing = z.infer<typeof listingSchema>;
export type Dataset = z.infer<typeof datasetSchema>;

/**
 * The card projection sent to the front end as a structured reference. It is a
 * strict subset of {@link Listing} — exactly the fields a UI needs to render a
 * card and (only when present) a link.
 */
export type ListingCard = Pick<
  Listing,
  "id" | "name" | "category" | "city" | "priceTier" | "blurb" | "externalUrl"
>;

export function toListingCard(listing: Listing): ListingCard {
  return {
    id: listing.id,
    name: listing.name,
    category: listing.category,
    city: listing.city,
    priceTier: listing.priceTier,
    blurb: listing.blurb,
    externalUrl: listing.externalUrl,
  };
}

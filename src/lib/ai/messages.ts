import type { UIMessage } from "ai";
import type { ListingCard } from "../data/schema";

/**
 * Payload of the custom `data-listings` stream part. This is the structured
 * reference contract: alongside streamed text, the server emits validated cards
 * (and the disclaimer) that the front end renders directly.
 */
export interface ListingsDataPart {
  listings: ListingCard[];
  disclaimer: string;
}

export interface LeadDataParts {
  listings: ListingsDataPart;
}

/** The UIMessage shape exchanged between the route and the React client. */
export type LeadUIMessage = UIMessage<unknown, LeadDataParts>;

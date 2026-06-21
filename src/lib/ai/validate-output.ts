import { LISTING_ID_REGEX, URL_REGEX } from "../constants";
import { toListingCard, type ListingCard } from "../data/schema";
import type { Violation } from "../logging/logger";
import type { ApprovedSet } from "./approved";

export interface ValidationResult {
  /**
   * The validated structured references (cards) to render. Built ONLY from the
   * approved tool results that the model actually surfaced — valid by
   * construction.
   */
  references: ListingCard[];
  /** Ungrounded ids/urls found in the model's text. These are logged. */
  violations: Violation[];
}

function snippetAround(text: string, index: number, value: string): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + value.length + 30);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * Server-side defense-in-depth. Given the model's final text and the per-turn
 * allow-list:
 *  - Builds structured references from approved listings the model referenced
 *    (by exact name or id). These are the cards/links the UI renders, so the
 *    user-facing surface can never show an ungrounded listing or link.
 *  - Flags any listing id or URL in the text that is NOT in the approved set as
 *    a violation to be stripped/logged.
 */
export function validateOutput(
  text: string,
  approved: ApprovedSet,
): ValidationResult {
  const violations: Violation[] = [];

  // 1. Flag ungrounded ids.
  for (const match of text.matchAll(LISTING_ID_REGEX)) {
    const id = match[0];
    if (!approved.hasId(id)) {
      violations.push({
        type: "unapproved-id",
        value: id.toLowerCase(),
        snippet: snippetAround(text, match.index ?? 0, id),
      });
    }
  }

  // 2. Flag ungrounded urls.
  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0].replace(/[.,;:)\]}>'"]+$/, "");
    if (!approved.hasUrl(url)) {
      violations.push({
        type: "unapproved-url",
        value: url,
        snippet: snippetAround(text, match.index ?? 0, url),
      });
    }
  }

  // 3. Build references from approved listings the model actually surfaced.
  const lower = text.toLowerCase();
  const references = approved
    .all()
    .filter(
      (l) =>
        lower.includes(l.name.toLowerCase()) ||
        lower.includes(l.id.toLowerCase()),
    )
    .map(toListingCard);

  return { references, violations };
}

/** Shown persistently in the UI and appended to substantive recommendations. */
export const DISCLAIMER =
  "AI can be wrong — please verify details before you rely on them.";

/** Matches any dataset listing id, e.g. din-001, lod-003, att-006, ven-002. */
export const LISTING_ID_REGEX = /\b(?:din|lod|att|ven)-\d{3}\b/gi;

/** Matches http(s) URLs (trailing punctuation is trimmed by the validator). */
export const URL_REGEX = /https?:\/\/[^\s<>()[\]{}"']+/gi;

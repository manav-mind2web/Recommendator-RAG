import type { ListingCard as ListingCardData } from "@/lib/data/schema";

/**
 * Renders one validated listing reference. Only the dataset's own `externalUrl`
 * is ever linked; when it is null we say so explicitly (the att-003 edge case).
 */
export function ListingCard({ listing }: { listing: ListingCardData }) {
  return (
    <div className="card">
      <h3>{listing.name}</h3>
      <div className="meta">
        {listing.category} · {listing.city} · {listing.priceTier}
      </div>
      <p className="blurb">{listing.blurb}</p>
      {listing.externalUrl ? (
        <a href={listing.externalUrl} target="_blank" rel="noopener noreferrer">
          Visit website ↗
        </a>
      ) : (
        <span className="no-link">No link available</span>
      )}
    </div>
  );
}

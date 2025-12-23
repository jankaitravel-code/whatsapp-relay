const TRIP_TYPES = {
  ONE_WAY: "ONE_WAY",
  ROUND_TRIP: "ROUND_TRIP",
  MULTI_CITY: "MULTI_CITY"
};

const { resolveLocation } = require("./locationService");

const RETURN_MARKERS = [
  "return",
  "returning",
  "round trip",
  "roundtrip"
];

/**
 * Parses flight queries like:
 * - flight BLR to DEL on 2025-12-25
 * - flight bengaluru to del
 */
async function parseFlightQuery(text) {
  const cleaned = text.replace(/,/g, "").trim();

  const normalized = cleaned.toLowerCase();
  
  const hasReturnIntent = RETURN_MARKERS.some(marker =>
    normalized.includes(marker)
  );

  const hasMultiCityIntent =
  normalized.includes(" via ") ||
  normalized.includes(" stopover ") ||
  normalized.includes(" multi ");

  // FULL query with date
  let match = cleaned.match(
    /flight\s+(?:from\s+)?(.+?)\s+to\s+(.+?)\s+on\s+(\d{4}-\d{2}-\d{2})$/i
  );

  let originInput, destinationInput;
  let outboundDate = null;
  let returnDate = null;

  if (match) {
    originInput = match[1].trim();
    destinationInput = match[2].trim();
    outboundDate = match[3];
  } else {
    // PARTIAL query (no date)
    match = cleaned.match(
      /flight\s+(?:from\s+)?(.+?)\s+to\s+(.+?)$/i
    );

    if (!match) return null;

    originInput = match[1].trim();
    destinationInput = match[2].trim();
  }

  const dateMatches = normalized.match(/\d{4}-\d{2}-\d{2}/g) || [];

  if (dateMatches.length >= 1) {
    outboundDate = dateMatches[0];
  }
  
  if (hasReturnIntent && dateMatches.length >= 2) {
    returnDate = dateMatches[1];
  }

  let tripType = TRIP_TYPES.ONE_WAY;
  
  if (hasMultiCityIntent) {
    tripType = TRIP_TYPES.MULTI_CITY;
  } else if (hasReturnIntent || dateMatches.length >= 2) {
    tripType = TRIP_TYPES.ROUND_TRIP;
  }

  // Reject invalid date formats early
  const invalidDatePattern = /\b\d{2}-\d{2}-\d{4}\b/;
  
  if (invalidDatePattern.test(normalized)) {
    return null;
  }

  const origin = await resolveLocation(originInput);
  const destination = await resolveLocation(destinationInput);

  if (!origin || !destination) {
    return { error: "UNKNOWN_LOCATION" };
  }

  return {
    origin,
    destination,
    date: outboundDate,
    returnDate: returnDate || null,
    tripType
  };
}

module.exports = {
  parseFlightQuery
};

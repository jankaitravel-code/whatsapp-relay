const { resolveLocation } = require("./locationService");

/**
 * Parses flight queries like:
 * - flight BLR to DEL on 2025-12-25
 * - flight bengaluru to del
 */
async function parseFlightQuery(text) {
  const cleaned = text.replace(/,/g, "").trim();

  // FULL query with date
  let match = cleaned.match(
    /flight\s+(?:from\s+)?(.+?)\s+to\s+(.+?)\s+on\s+(\d{4}-\d{2}-\d{2})$/i
  );

  let originInput, destinationInput, date = null;

  if (match) {
    originInput = match[1].trim();
    destinationInput = match[2].trim();
    date = match[3];
  } else {
    // PARTIAL query (no date)
    match = cleaned.match(
      /flight\s+(?:from\s+)?(.+?)\s+to\s+(.+?)$/i
    );

    if (!match) return null;

    originInput = match[1].trim();
    destinationInput = match[2].trim();
  }

  const origin = await resolveLocation(originInput);
  const destination = await resolveLocation(destinationInput);

  if (!origin || !destination) {
    return { error: "UNKNOWN_LOCATION" };
  }

  return {
    origin,
    destination,
    date
  };
}

module.exports = {
  parseFlightQuery
};

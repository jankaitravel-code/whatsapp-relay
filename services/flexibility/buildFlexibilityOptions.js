/**
 * Build OTA flexibility options
 * Uses normalized fare rules + OTA pricing strategy
 *
 * INVARIANT:
 * Booking flexibility options must be a subset of search capability.
 * Options may downgrade (NONE), but must never contradict search.
 */

function buildFlexibilityOptions({ baseFare, capability }) {
  const options = [];

  // Always include NONE
  options.push({
    code: "NONE",
    label: "No date change or cancellation",
    priceDelta: 0
  });

  if (capability?.level === "CHANGE_ONLY") {
    options.push({
      code: "DATE_CHANGE",
      label: "Date change allowed",
      priceDelta: 0
    });
  }

  if (capability?.level === "CHANGE_CANCEL") {
    options.push({
      code: "DATE_CHANGE",
      label: "Free date change",
      priceDelta: 0
    });

    options.push({
      code: "CANCELLATION",
      label: "Free cancellation",
      priceDelta: 0
    });
  }

  return {
    currency: "INR",
    baseFare: baseFare ?? null,
    options
  };
}


module.exports = {
  buildFlexibilityOptions
};

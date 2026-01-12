/**
 * Build OTA flexibility options
 * Uses normalized fare rules + OTA pricing strategy
 *
 * INVARIANT:
 * Booking flexibility options must be a subset of search capability.
 * Options may downgrade (NONE), but must never contradict search.
 */

function buildFlexibilityOptions({
  baseFare,
  fareRules,
  capability
}) {
  // 🔒 Hard guard
  if (!capability || capability.level === "NONE") {
    return {
      currency: "INR",
      baseFare: baseFare ?? null,
      options: [
        {
          code: "NONE",
          label: "No date change or cancellation",
          priceDelta: 0
        }
      ]
    };
  }

  const options = [];

  // NONE is always present as downgrade
  options.push({
    code: "NONE",
    label: "No date change or cancellation",
    priceDelta: 0
  });

  const changeAllowed = fareRules?.change?.allowed === "YES";
  const cancelAllowed = fareRules?.cancellation?.allowed === "YES";

  // CHANGE_ONLY or CHANGE_CANCEL
  if (
    (capability.level === "CHANGE_ONLY" ||
     capability.level === "CHANGE_CANCEL") &&
    changeAllowed
  ) {
    options.push({
      code: "DATE_CHANGE",
      label: "Date change allowed",
      priceDelta: 10 // OTA upsell
    });
  }

  // CHANGE_CANCEL only
  if (capability.level === "CHANGE_CANCEL" && cancelAllowed) {
    options.push({
      code: "CANCELLATION",
      label: "Date change + cancellation",
      priceDelta: 25 // OTA upsell
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

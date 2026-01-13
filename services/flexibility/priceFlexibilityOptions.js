/**
 * Paid Flexibility Pricing
 * PURE FUNCTION — no side effects
 *
 * Input:
 * - flight: normalized flight object
 * - baseCapability: result of deriveFlexibilityCapability()
 *
 * Output:
 * - Array of priced upgrade options
 */

function round(amount) {
  return Math.round(amount);
}

function calculateUpgradePrice(flight, type) {
  const baseFare = Number(flight?.price?.total || 0);

  if (!baseFare) return 0;

  switch (type) {
    case "CHANGE_ONLY":
      return round(baseFare * 0.07);

    case "CHANGE_CANCEL":
      return round(baseFare * 0.12);

    default:
      return 0;
  }
}

function priceFlexibilityOptions({ flight, baseCapability }) {
  if (!baseCapability || !baseCapability.level) return [];

  const options = [];

  switch (baseCapability.level) {
    case "CHANGE_CANCEL":
      return options; // already max

    case "CHANGE_ONLY":
      options.push({
        type: "CHANGE_CANCEL",
        price: calculateUpgradePrice(flight, "CHANGE_CANCEL"),
        source: "PAID_UPGRADE"
      });
      break;

    case "NONE":
      options.push(
        {
          type: "CHANGE_ONLY",
          price: calculateUpgradePrice(flight, "CHANGE_ONLY"),
          source: "PAID_UPGRADE"
        },
        {
          type: "CHANGE_CANCEL",
          price: calculateUpgradePrice(flight, "CHANGE_CANCEL"),
          source: "PAID_UPGRADE"
        }
      );
      break;
  }

  return options.filter(o => o.price > 0);
}

module.exports = {
  priceFlexibilityOptions
};

/**
 * Build OTA flexibility options
 * Uses normalized fare rules + OTA pricing strategy
 */

function buildFlexibilityOptions({
  baseFare,
  fareRules,
  flexibilityRisk
}) {
  // 🔒 Defensive defaults
  const safeRules = fareRules || {};
  const changeRule = safeRules.change || {};
  const cancelRule = safeRules.cancellation || {};

  const options = [];

  // 1️⃣ No flexibility (always available)
  options.push({
    code: "NONE",
    label: "No date change or cancellation",
    priceDelta: 0
  });

  // 2️⃣ Date change
  if (changeRule.allowed && changeRule.allowed !== "NO") {
    options.push({
      code: "DATE_CHANGE",
      label: "Date change allowed",
      priceDelta: 10   // TEMP OTA pricing
    });
  }

  // 3️⃣ Cancellation
  if (cancelRule.allowed && cancelRule.allowed !== "NO") {
    options.push({
      code: "CANCELLATION",
      label: "Date change + cancellation",
      priceDelta: 25   // TEMP OTA pricing
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

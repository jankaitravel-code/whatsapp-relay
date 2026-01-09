/**
 * Build OTA flexibility options
 * Uses normalized fare rules + OTA pricing strategy
 */

function buildFlexibilityOptions({
  baseFare,
  fareRules
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

  // 2️⃣ Date change — ONLY if explicitly allowed
  if (changeRule.allowed === "YES") {
    options.push({
      code: "DATE_CHANGE",
      label: "Date change allowed",
      priceDelta: 10 // TEMP_OTA_DELTA
    });
  }

  // 3️⃣ Cancellation — ONLY if explicitly allowed
  if (cancelRule.allowed === "YES") {
    options.push({
      code: "CANCELLATION",
      label: "Date change + cancellation",
      priceDelta: 25 // TEMP_OTA_DELTA
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

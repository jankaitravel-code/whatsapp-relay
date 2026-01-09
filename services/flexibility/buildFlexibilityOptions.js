/**
 * Build OTA flexibility options
 * Uses normalized fare rules + OTA pricing strategy
 */

function buildFlexibilityOptions({
  fareRules,
  flexibilityRisk
}) {
  const options = [];
  const riskLevel = flexibilityRisk?.level || "UNKNOWN";

  // 1️⃣ No flexibility — always available
  options.push({
    code: "NONE",
    label: "No date change or cancellation",
    priceDelta: 0
  });

  // 2️⃣ Date change
  if (
    fareRules.change.allowed !== "NO" &&
    riskLevel !== "LOW"
  ) {
    options.push({
      code: "DATE_CHANGE",
      label: "Date change allowed",
      priceDelta: 10   // TEMP OTA pricing
    });
  }

  // 3️⃣ Cancellation
  if (
    fareRules.cancellation.allowed !== "NO" &&
    (riskLevel === "HIGH" || riskLevel === "MEDIUM")
  ) {
    options.push({
      code: "CANCELLATION",
      label: "Date change + cancellation",
      priceDelta: 25   // TEMP OTA pricing
    });
  }

  return {
    currency: fareRules?.change?.penalty?.currency || "INR",
    options
  };
}

module.exports = {
  buildFlexibilityOptions
};

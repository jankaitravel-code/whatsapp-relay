/**
 * Build OTA flexibility options
 * Uses normalized fare rules + OTA pricing strategy
 */

function buildFlexibilityOptions({
  baseFare,
  fareRules
}) {
  // Default conservative behaviour
  const options = [];

  // 1️⃣ No flexibility
  options.push({
    code: "NONE",
    label: "No date change or cancellation",
    delta: 0
  });

  // 2️⃣ Date change
  if (fareRules.change.allowed !== "NO") {
    options.push({
      code: "DATE_CHANGE",
      label: "Date change allowed",
      delta: 10   // TEMP OTA pricing
    });
  }

  // 3️⃣ Cancellation
  if (fareRules.cancellation.allowed !== "NO") {
    options.push({
      code: "CANCELLATION",
      label: "Date change + cancellation",
      delta: 25   // TEMP OTA pricing
    });
  }

  return {
    currency: "INR",
    baseFare,
    options
  };
}

module.exports = {
  buildFlexibilityOptions
};

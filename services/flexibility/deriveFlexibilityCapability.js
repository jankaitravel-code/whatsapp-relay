/**
 * Single source of truth for flexibility capability
 * Used by BOTH search and booking
 */

function deriveFlexibilityCapability({ fareRules }) {

  // 🧪 TEST MODE — explicit and reversible
  const forced = process.env.TEST_FLEX_MODE;
  if (forced) {
    return {
      level: forced,   // NONE | CHANGE_ONLY | CHANGE_CANCEL
      source: "FORCED"
    };
  }

  // 🔒 No rules → no promises
  if (!fareRules) {
    return { level: "NONE", source: "FARE_RULES" };
  }

  const changeAllowed =
    fareRules.change?.allowed === "YES";

  const cancelAllowed =
    fareRules.cancellation?.allowed === "YES";

  if (changeAllowed && cancelAllowed) {
    return { level: "CHANGE_CANCEL", source: "FARE_RULES" };
  }

  if (changeAllowed) {
    return { level: "CHANGE_ONLY", source: "FARE_RULES" };
  }

  return { level: "NONE", source: "FARE_RULES" };
}

module.exports = { deriveFlexibilityCapability };

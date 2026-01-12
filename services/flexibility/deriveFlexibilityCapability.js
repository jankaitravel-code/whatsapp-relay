/**
 * Single source of truth for flexibility capability
 * Used by BOTH search and booking
 */

function deriveFlexibilityCapability({ fareRules }) {

  // 🧪 TEST MODE — explicit and reversible
  const forced = process.env.TEST_FLEX_MODE;
  if (forced) {
    return {
      level: forced,              // NONE | CHANGE_ONLY | CHANGE_CANCEL
      source: "FORCED"
    };
  }

  // 🔒 Real airline rules only
  if (fareRules?.changeAllowed === true && fareRules?.cancelAllowed === true) {
    return { level: "CHANGE_CANCEL", source: "FARE_RULES" };
  }

  if (fareRules?.changeAllowed === true) {
    return { level: "CHANGE_ONLY", source: "FARE_RULES" };
  }

  if (!fareRules) {
    log("FLEX_CAPABILITY_FALLBACK_NO_RULES", {
      reason: "fareRules_missing"
    });
  }

  return { level: "NONE", source: "FARE_RULES" };
}

module.exports = { deriveFlexibilityCapability };

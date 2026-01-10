/**
 * Single source of truth for flexibility capability
 * Used by BOTH search and booking
 */

function deriveFlexibilityCapability({ fareRules, flexibilityRisk }) {
  // HARD FALLBACK — no rules means no promises
  if (!fareRules) {
    return {
      level: "NONE",
      refundType: "NONE",
      confidence: "LOW",
      searchTag: "NON_FLEXIBLE",
      source: "FALLBACK_NO_RULES"
    };
  }

  let level;

  if (!fareRules.changeAllowed && !fareRules.cancelAllowed) {
    level = "NONE";
  } else if (fareRules.changeAllowed && !fareRules.cancelAllowed) {
    level = "CHANGE_ONLY";
  } else {
    level = "CHANGE_CANCEL";
  }

  const refundType =
    fareRules.refundType === "ORIGINAL" ? "ORIGINAL" :
    fareRules.refundType === "CREDIT"   ? "CREDIT" :
    "NONE";

  const confidence = flexibilityRisk?.confidence ?? "LOW";

  const searchTag =
    level === "NONE"
      ? "NON_FLEXIBLE"
      : level === "CHANGE_ONLY"
      ? "SEMI_FLEXIBLE"
      : "FLEXIBLE";

  return {
    level,
    refundType,
    confidence,
    searchTag,
    source: "FARE_RULES"
  };
}

module.exports = {
  deriveFlexibilityCapability
};

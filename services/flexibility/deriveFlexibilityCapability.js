/**
 * Single source of truth for flexibility capability
 * Used by BOTH search and booking
 */

const { log } = require("../../utils/logger");

function deriveFlexibilityCapability({ fareRules }) {

  /* =================================================
     🌍 GLOBAL FLEXIBILITY OVERRIDER (KILL SWITCH)
     ================================================= */
  if (process.env.FLEXIBILITY_OVERRIDE_ALL === "true") {
    log("FLEXIBILITY_OVERRIDE_ALL_ACTIVE", {
      appliedLevel: "CHANGE_CANCEL"
    });

    return {
      level: "CHANGE_CANCEL",
      source: "GLOBAL_OVERRIDE"
    };
  }
  /* ================================================= */

  // 🔒 Normal rule-based derivation
  if (
    fareRules?.change?.allowed === "YES" &&
    fareRules?.cancellation?.allowed === "YES"
  ) {
    return { level: "CHANGE_CANCEL", source: "FARE_RULES" };
  }

  if (fareRules?.change?.allowed === "YES") {
    return { level: "CHANGE_ONLY", source: "FARE_RULES" };
  }

  return { level: "NONE", source: "FARE_RULES" };
}

module.exports = {
  deriveFlexibilityCapability
};

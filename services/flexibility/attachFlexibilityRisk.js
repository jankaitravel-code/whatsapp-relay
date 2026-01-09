const { log } = require("../../utils/logger");

const { normalizeFareRules } = require("../fareRules/normalizeFareRules");
const { scoreFareFlexibility } = require("./scoreFareFlexibility");

const FLEXIBILITY_ENABLED =
  process.env.FLEXIBILITY_ENABLED !== "false";

const FLEXIBILITY_AIRLINE_DENYLIST = new Set(
  (process.env.FLEXIBILITY_AIRLINE_DENYLIST || "")
    .split(",")
    .map(a => a.trim())
    .filter(Boolean)
);

function attachFlexibilityRisk(flightOffer) {
  if (!flightOffer) return flightOffer;

  // 🔴 Phase 9 — Global kill-switch
  if (!FLEXIBILITY_ENABLED) {
    log("FLEXIBILITY_DISABLED_GLOBALLY", {
      reason: "ENV_FLAG"
    });
    return flightOffer;
  }

  // 🟡 Phase 9 — Airline-level disablement
  if (FLEXIBILITY_AIRLINE_DENYLIST.has(flightOffer.airlineCode)) {
    log("FLEXIBILITY_DISABLED_FOR_AIRLINE", {
      airline: flightOffer.airlineCode
    });
    return flightOffer;
  }

  const rules = normalizeFareRules(flightOffer);
  if (!rules) {
    log("FLEX_RISK_MISSING", {
      flightId: flightOffer.id,
      airline: flightOffer.airlineCode,
      fareFamily: flightOffer.fareFamily,
      hasFareRules: false
    });
    return flightOffer;
  }

  const risk = scoreFareFlexibility({ fareRules: rules });

  log("FLEX_RISK_ATTACHED", {
    flightId: flightOffer.id,
    airline: flightOffer.airlineCode,
    fareFamily: flightOffer.fareFamily,
    hasFareRules: true
  });

  return {
    ...flightOffer,
    _fareRules: rules,
    _flexibilityRisk: {
      ...risk,
      rulesSnapshot: rules
    }
  };
}

module.exports = {
  attachFlexibilityRisk
};

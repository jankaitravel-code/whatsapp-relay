const { log } = require("../../utils/logger");

const { normalizeFareRules } = require("../fareRules/normalizeFareRules");
const { scoreFareFlexibility } = require("./scoreFareFlexibility");

function attachFlexibilityRisk(flightOffer) {
  if (!flightOffer) return flightOffer;

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

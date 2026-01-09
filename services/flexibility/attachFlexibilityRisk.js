const { normalizeFareRules } = require("../fareRules/normalizeFareRules");
const { scoreFareFlexibility } = require("./scoreFareFlexibility");

function attachFlexibilityRisk(flightOffer) {
  if (!flightOffer) return flightOffer;

  const rules = normalizeFareRules(flightOffer);
  if (!rules) return flightOffer;

  const risk = scoreFareFlexibility({ fareRules: rules });

  return {
    ...flightOffer,
    _flexibilityRisk: {
      ...risk,
      rulesSnapshot: rules
    }
  };
}

module.exports = {
  attachFlexibilityRisk
};

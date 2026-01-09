const { normalizeFareRules } = require("./normalizeFareRules");
const { scoreFareFlexibility } = require("./scoreFareFlexibility");

function attachFlexibilityRisk(flightOffer) {
  if (!flightOffer) return flightOffer;

  const rules = normalizeFareRules(flightOffer);
  const risk = scoreFareFlexibility({ fareRules: rules });

  return {
    ...flightOffer,
    _flexibilityRisk: {
      ...risk,
      _rulesSnapshot: rules
    }
  };
}

module.exports = {
  attachFlexibilityRisk
};

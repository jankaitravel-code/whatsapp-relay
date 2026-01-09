const { normalizeFareRules } = require("./normalizeFareRules");
const { computeFlexibilityRisk } = require("./computeFlexibilityRisk");

function attachFlexibilityRisk(flightOffer) {
  if (!flightOffer) return flightOffer;

  const rules = normalizeFareRules(flightOffer);
  const risk = computeFlexibilityRisk(rules);

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

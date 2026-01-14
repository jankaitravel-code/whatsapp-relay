/**
 * Derive Special Fare Eligibility
 * --------------------------------
 * PURE FUNCTION
 * Deterministic
 * No side effects
 */

const { STATIC_AIRLINE_SPECIAL_FARE_RULES } =
  require("./staticAirlineRules");

function deriveFromFareRules(fareRules) {
  if (!fareRules) return null;

  // Example hook — depends on how normalizeFareRules exposes data
  if (Array.isArray(fareRules.allowedPassengerTypes)) {
    return fareRules.allowedPassengerTypes;
  }

  return null;
}

function deriveSpecialFareEligibility({ flight, fareRules }) {
  if (!flight) {
    return { supported: [], source: "UNKNOWN" };
  }

  // 1️⃣ Explicit fare rule declaration
  const fromFareRules = deriveFromFareRules(fareRules);
  if (Array.isArray(fromFareRules) && fromFareRules.length > 0) {
    return {
      supported: fromFareRules,
      source: "FARE_RULES"
    };
  }

  // 2️⃣ Static airline fallback
  const airline =
    flight.validatingAirlineCodes?.[0] ||
    flight.airlineCode;

  const staticSupported =
    STATIC_AIRLINE_SPECIAL_FARE_RULES[airline];

  if (Array.isArray(staticSupported)) {
    return {
      supported: staticSupported,
      source: "STATIC_RULES"
    };
  }

  // 3️⃣ Unknown
  return {
    supported: [],
    source: "UNKNOWN"
  };
}

module.exports = {
  deriveSpecialFareEligibility
};

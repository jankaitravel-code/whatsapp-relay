/**
 * Static Airline → Special Fare Rules (India)
 * -------------------------------------------
 * Used only when fare rules do not explicitly specify eligibility
 */

const STATIC_AIRLINE_SPECIAL_FARE_RULES = {
  AI: ["SENIOR", "ARMED_FORCES", "LTC"],
  UK: ["SENIOR", "ARMED_FORCES", "LTC"],
  SG: ["SENIOR", "ARMED_FORCES"],
  6E: ["SENIOR", "STUDENT"],
  I5: ["SENIOR", "STUDENT"],
  G8: ["SENIOR"],
  AK: ["STUDENT"]
};

module.exports = {
  STATIC_AIRLINE_SPECIAL_FARE_RULES
};

/**
 * Special Fare Catalog — India
 * --------------------------------
 * Canonical list of supported special fare categories
 * Search-time only (read-only metadata)
 */

const SPECIAL_FARE_CATALOG = {
  SENIOR: {
    code: "SENIOR",
    label: "Senior Citizen",
    description: "Discounted fares for senior citizens (usually 60+)",
    requiresVerification: true
  },

  STUDENT: {
    code: "STUDENT",
    label: "Student",
    description: "Discounted fares for eligible students",
    requiresVerification: true
  },

  ARMED_FORCES: {
    code: "ARMED_FORCES",
    label: "Armed Forces",
    description: "Special fares for defence personnel",
    requiresVerification: true
  },

  LTC: {
    code: "LTC",
    label: "LTC / Government",
    description: "Leave Travel Concession fares for government employees",
    requiresVerification: true
  },

  DOCTOR_NURSE: {
    code: "DOCTOR_NURSE",
    label: "Doctor / Nurse",
    description: "Special fares for medical professionals",
    requiresVerification: true
  }
};

module.exports = {
  SPECIAL_FARE_CATALOG
};

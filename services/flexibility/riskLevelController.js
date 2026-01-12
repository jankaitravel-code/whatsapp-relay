/**
 * Flexibility Risk Level Controller
 *
 * ROLE:
 * - Central authority that controls how strict flexibility interpretation is
 * - Used for testing, rollout control, and safety
 *
 * IMPORTANT:
 * - This does NOT override airline data
 * - It only controls how much missing data we tolerate
 */

// Modes:
// STRICT   → airline rules must be explicit
// RELAXED  → inferred flexibility allowed
// TESTING  → optimistic inference for testing
const FLEX_RISK_MODE =
  process.env.FLEX_RISK_MODE || "STRICT";

/**
 * Given raw risk output, decide effective risk level
 */
function controlRiskLevel({ rawRisk, log, flight }) {
  let effectiveRisk = rawRisk;

  if (FLEX_RISK_MODE === "STRICT") {
    // Current production behavior
    effectiveRisk = rawRisk;
  }

  if (FLEX_RISK_MODE === "RELAXED") {
    // Allow inferred flexibility when signals are missing
    if (rawRisk === "LOW") {
      effectiveRisk = "MEDIUM";
    }
  }

  if (FLEX_RISK_MODE === "TESTING") {
    // Optimistic interpretation for end-to-end testing
    if (rawRisk === "LOW") {
      effectiveRisk = "HIGH";
    }
  }

  if (log) {
    log("FLEX_RISK_CONTROLLED", {
      flightId: flight?.id,
      mode: FLEX_RISK_MODE,
      rawRisk,
      effectiveRisk
    });
  }

  return effectiveRisk;
}

module.exports = {
  controlRiskLevel
};

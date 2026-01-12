/**
 * PHASE 3 — Fare Flexibility Risk Scoring Engine
 *
 * Pure, deterministic, price-agnostic
 */

const { log } = require("../../utils/logger");
const { controlRiskLevel } = require("./riskLevelController");

function scoreFareFlexibility({ fareRules }) {
  if (!fareRules) {
    return {
      score: 0,
      level: "LOW",
      label: "Low fare flexibility",
      signals: {},
      confidence: "LOW"
    };
  }

  let score = 100;
  let unknowns = 0;

  const signals = {
    refundability: fareRules.refundability?.status,
    changeAllowed: fareRules.change?.allowed,
    cancelAllowed: fareRules.cancellation?.allowed
  };

  // Refundability
  if (signals.refundability === "NON_REFUNDABLE") score -= 50;
  if (signals.refundability === "UNKNOWN") {
    score -= 10;
    unknowns++;
  }

  // Change
  if (signals.changeAllowed === "NO") score -= 20;
  if (signals.changeAllowed === "UNKNOWN") {
    score -= 10;
    unknowns++;
  }

  // Cancellation
  if (signals.cancelAllowed === "NO") score -= 30;
  if (signals.cancelAllowed === "UNKNOWN") {
    score -= 10;
    unknowns++;
  }

  score = Math.max(0, Math.min(100, score));

  let level;
  let label;

  if (score >= 70) {
    level = "HIGH";
    label = "High fare flexibility";
  } else if (score >= 40) {
    level = "MEDIUM";
    label = "Moderate fare flexibility";
  } else {
    level = "LOW";
    label = "Low fare flexibility";
  }

  const rawConfidence =
    unknowns === 0 ? "HIGH" :
    unknowns <= 1 ? "MEDIUM" :
    "LOW";

  const confidence = controlRiskLevel({
    rawRisk: rawConfidence,
    signals,
    unknowns
  });

  log("FLEX_RISK_CONTROLLED", {
    rawConfidence,
    effectiveConfidence: confidence,
    mode: process.env.FLEX_RISK_MODE || "STRICT"
  });

  // 🔍 PHASE 7 — Observability (confidence downgrade only)

  if (rawConfidence !== "HIGH") {
    log("FLEX_RISK_CONFIDENCE_DOWNGRADED", {
      missingSignals: Object.entries(signals)
        .filter(([, value]) => value === "UNKNOWN")
        .map(([key]) => key),
      originalConfidence: "HIGH",
      finalConfidence: rawConfidence
    });
  }

  return {
    score,
    level,
    label,
    signals,
    confidence
  };
}

module.exports = {
  scoreFareFlexibility
};

/**
 * Normalize fare rules from an Amadeus flight offer
 *
 * PHASE 1 — FOUNDATION
 *
 * Rules:
 * - Pure function
 * - No mutation
 * - No throws
 * - Never invents penalties
 * - Attaches confidence to every decision
 */

function normalizeFareRules(flightOffer) {
  try {
    if (!flightOffer) return emptyRules();

    const currency = flightOffer.price?.currency || "INR";

    /* -------------------------------
       1️⃣ REFUNDABILITY
    -------------------------------- */
    let refundability = {
      status: "UNKNOWN",
      confidence: "LOW"
    };

    if (typeof flightOffer.price?.refundable === "boolean") {
      refundability = {
        status: flightOffer.price.refundable
          ? "REFUNDABLE"
          : "NON_REFUNDABLE",
        confidence: "HIGH"
      };
    }

    /* -------------------------------
       2️⃣ STRUCTURED PENALTIES
    -------------------------------- */
    let changePenalty = null;
    let cancelPenalty = null;

    const travelerPricings = Array.isArray(flightOffer.travelerPricings)
      ? flightOffer.travelerPricings
      : [];
    
    travelerPricings.forEach(tp => {
      if (!Array.isArray(tp.fareDetailsBySegment)) return;
    
      tp.fareDetailsBySegment.forEach(seg => {
        if (!Array.isArray(seg.penalties)) return;
    
        seg.penalties.forEach(p => {
          if (!p || !p.type) return;
    
          const amount = Number(p.amount);
    
          if (p.type === "CHANGE" && Number.isFinite(amount)) {
            changePenalty = {
              type: "FIXED_FEE",
              amount,
              currency
            };
          }
    
          if (p.type === "CANCELLATION" && Number.isFinite(amount)) {
            cancelPenalty = {
              type: "FIXED_FEE",
              amount,
              currency
            };
          }
        });
      });
    });

    /* -------------------------------
       3️⃣ TEXT RULES (FALLBACK)
    -------------------------------- */
    const ruleText = extractRuleText(flightOffer);

    const changeFromText = inferFromText(ruleText, "CHANGE");
    const cancelFromText = inferFromText(ruleText, "CANCEL");

    /* -------------------------------
       4️⃣ CHANGE RULE
    -------------------------------- */
    const change = resolveRule({
      structuredPenalty: changePenalty,
      inferred: changeFromText
    });

    /* -------------------------------
       5️⃣ CANCELLATION RULE
    -------------------------------- */
    const cancellation = resolveRule({
      structuredPenalty: cancelPenalty,
      inferred: cancelFromText
    });

    return {
      refundability,
      change,
      cancellation
    };
  } catch {
    // Hard safety net — never throw upstream
    return emptyRules();
  }
}

/* ===============================
   Helpers
=============================== */

function emptyRules() {
  return {
    refundability: { status: "UNKNOWN", confidence: "LOW" },
    change: ruleUnknown(),
    cancellation: ruleUnknown()
  };
}

function ruleUnknown() {
  return {
    allowed: "UNKNOWN",
    penalty: null,
    confidence: "LOW",
    source: "MISSING"   // 👈 NEW (optional but powerful)
  };
}

function extractRuleText(flightOffer) {
  const rules = Array.isArray(flightOffer.fareRules)
    ? flightOffer.fareRules
    : [];

  const texts = [];

  rules.forEach(r =>
    r?.rules?.forEach(x => {
      if (typeof x.description === "string") {
        texts.push(x.description.toUpperCase());
      }
    })
  );

  return texts.join(" ");
}

function inferFromText(text, kind) {
  if (!text) return null;

  if (kind === "CHANGE") {
    if (text.includes("CHANGES NOT PERMITTED")) return "NO";
    if (text.includes("CHANGES PERMITTED")) return "YES";
  }

  if (kind === "CANCEL") {
    if (text.includes("NON-REFUNDABLE")) return "NO";
    if (text.includes("CANCELLATION CHARGES APPLY")) return "YES";
    if (text.includes("REFUNDABLE")) return "YES";
  }

  return null;
}

function resolveRule({ structuredPenalty, inferred }) {
  // Structured always wins
  if (structuredPenalty) {
    return {
      allowed: "YES",
      penalty: structuredPenalty,
      confidence: "HIGH",
      source: "STRUCTURED"
    };
  }

  if (inferred === "YES") {
    return {
      allowed: "YES",
      penalty: { type: "UNKNOWN" },
      confidence: "MEDIUM",
      source: "TEXT"
    };
  }

  if (inferred === "NO") {
    return {
      allowed: "NO",
      penalty: { type: "UNKNOWN" },
      confidence: "MEDIUM"
    };
  }

  return ruleUnknown();
}

module.exports = {
  normalizeFareRules
};

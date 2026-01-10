/**
 * Build OTA flexibility options
 * Uses normalized fare rules + OTA pricing strategy
   */

// INVARIANT:
// Booking flexibility options must be a subset of search capability.
// Options may downgrade (NONE), but must never contradict or disappear.

  function buildFlexibilityOptions({
    baseFare,
    fareRules,
    flexibilityCapability
  }) {
  // 🔒 Defensive defaults
  const safeRules = fareRules || {};
  const changeRule = safeRules.change || {};
  const cancelRule = safeRules.cancellation || {};

  const options = [];

    const cap = flexibilityCapability;
    
    // 🔒 SAFETY: booking must not contradict search
    if (cap?.level === "HIGH") {
      options.push({
        code: "NONE",
        label: "No date change or cancellation",
        priceDelta: 0 // OTA baseline
      });
    
      options.push({
        code: "DATE_CHANGE",
        label: "Free date change",
        priceDelta: 0
      });
    
      options.push({
        code: "CANCELLATION",
        label: "Free cancellation",
        priceDelta: 0
      });
    
      return {
        currency: "INR",
        baseFare: baseFare ?? null,
        options
      };
    }

    if (cap?.level === "MEDIUM") {
      options.push({
        code: "NONE",
        label: "No date change or cancellation",
        priceDelta: 0
      });
    
      options.push({
        code: "DATE_CHANGE",
        label: "Date change allowed",
        priceDelta: 10 // OTA upsell
      });
    
      return {
        currency: "INR",
        baseFare: baseFare ?? null,
        options
      };
    }

  // 1️⃣ No flexibility (always available)
  options.push({
    code: "NONE",
    label: "No date change or cancellation",
    priceDelta: 0 // priceDelta = OTA upsell delta, not airline fee
  });

  // 2️⃣ Date change — ONLY if explicitly allowed
  if (changeRule.allowed === "YES") {
    options.push({
      code: "DATE_CHANGE",
      label: "Date change allowed",
      priceDelta: 10 // TEMP_OTA_DELTA // priceDelta = OTA upsell delta, not airline fee
    });
  }

  // 3️⃣ Cancellation — ONLY if explicitly allowed
  if (cancelRule.allowed === "YES") {
    options.push({
      code: "CANCELLATION",
      label: "Date change + cancellation",
      priceDelta: 25 // TEMP_OTA_DELTA // priceDelta = OTA upsell delta, not airline fee
    });
  }

  return {
    currency: "INR",
    baseFare: baseFare ?? null,
    options
  };
}

module.exports = {
  buildFlexibilityOptions
};

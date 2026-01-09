/**
 * One-Way Booking Flow
 * Scope: Booking only
 * Entry: via conversation handoff from oneWayFlow.js
 */

// ⚠️ INVARIANT: Only ONE layer may own user input at a time.
// Router → Intent → Flow → Booking (strict handoff, no overlap)


const { log } = require("../../utils/logger");
const { computeOneWayFinalPrice } = require("../../services/price/computeOneWayFinalPrice");
const {
  normalizeBaggage
} = require("../../services/baggage/normalizeBaggage");



function getEmptyPreferences() {
  return {
    baggageKg: 0,
    meal: null,
    seats: null,
    insurance: false,
    flexibility: null
  };
}

function formatBaggageForBooking(baggage) {
  if (!baggage) {
    return "Baggage: Cabin Not specified | Check-in Not specified";
  }

  const cabin = baggage.cabin
    ? `Cabin ${baggage.cabin}`
    : "Cabin Not specified";

  const checkin = baggage.checkin
    ? `Check-in ${baggage.checkin}`
    : "Check-in Not specified";

  return `Baggage: ${cabin} | ${checkin}`;
}

function getEligibleSpecialFares(age) {
  const fares = [];

  if (age >= 60) fares.push("SENIOR");
  if (age >= 12 && age <= 25) fares.push("STUDENT");

  return fares;
}

function isValidHumanName(input) {
  if (!input) return false;

  const trimmed = input.trim();

  // Split once, define once
  const parts = trimmed.split(/\s+/);

  // Must have at least two name parts
  if (parts.length < 2) return false;

  /*
    Reject:
    - digits
    - emojis
    - symbols (except . ' -)
  */
  const invalidCharRegex =
    /[0-9!@#$%^&*()_+=\[\]{};:"\\|<>/?~`₹€]/;

  if (invalidCharRegex.test(trimmed)) {
    return false;
  }

  /*
    Each word must be:
    - Unicode letters
    - Optional trailing dot (initials)
    - May include apostrophe or hyphen inside
  */
  const wordRegex = /^[\p{L}]+([.'-][\p{L}]+)*\.?$/u;

  for (const part of parts) {
    if (!wordRegex.test(part)) {
      return false;
    }
  }

  return true;
}

function isValidFrequentFlyer(input) {
  if (!input) return false;

  const trimmed = input.trim();

  // Must be single-line
  if (trimmed.includes("\n")) return false;

  // Reject emojis and symbols outside ASCII-ish range
  const invalidCharRegex =
    /[\p{Extended_Pictographic}₹€£¥$]/u;

  if (invalidCharRegex.test(trimmed)) {
    return false;
  }

  // Must be at least 5 chars (industry-safe lower bound)
  if (trimmed.length < 5) return false;

  return true;
}

function isPlausibleGSTInput(input) {
  if (!input) return false;

  const trimmed = input.trim();

  // Single-line only
  if (trimmed.includes("\n")) return false;

  // Reject emojis and currency symbols early
  const invalidCharRegex =
    /[\p{Extended_Pictographic}₹€£¥$]/u;

  if (invalidCharRegex.test(trimmed)) {
    return false;
  }

  return true;
}

async function runPriceCompute({
  from,
  conversation,
  sendWhatsAppMessage,
  setConversation
}) {
  // 🔒 HARD GUARD — must only run once
  if (conversation.booking._priceComputed) {
    return;
  }

  const passengers = conversation.booking.travellers.map(t => ({
    index: t.index,
    age: t.age,
    ageCategory: t.ageCategory,
    specialFare: t.specialFare || "NONE",
    seat: t.seat || "FREE_AUTO",
    meal: t.meal || "NO_MEAL"
  }));

  const discountCode =
    conversation.booking.discountCode &&
    conversation.booking.discountCode.toUpperCase() !== "NONE"
      ? conversation.booking.discountCode
      : null;

  log("PRICE_COMPUTE_INPUT", {
    selectedFlight: conversation.booking.selectedFlight.id,
    passengers,
    preferences: conversation.booking.preferences,
    discountCode
  });

  const price = computeOneWayFinalPrice({
    selectedFlight: conversation.booking.selectedFlight,
    travellers: passengers,
    preferences: conversation.booking.preferences || {},
    discountCode
  });

  log("FINAL_PRICE_COMPUTED", price);

  // 🔥 STATE + MESSAGE IN SAME TURN
  setConversation(from, {
    ...conversation,
    state: "BOOKING_PRICE_REVIEW",
    booking: {
      ...conversation.booking,
      priceSnapshot: price,
      _priceComputed: true
    }
  });

  await sendWhatsAppMessage(
    from,
    `💰 Final Price\n\n` +
    `Base Fare: ${price.currency} ${price.base.total}\n` +
    `Extras: ${price.currency} ${price.totals.bookingAdjustments}\n` +
    `Discount: ${price.currency} ${price.bookingAdjustments.discount.delta}\n\n` +
    `*Total Payable: ${price.currency} ${price.totals.grandTotal}*\n\n` +
    `Reply *PAY* to continue`
  );
}

async function handle(context) {
  const {
    from,
    text,
    rawText,
    conversation,
    sendWhatsAppMessage,
    setConversation
  } = context;

  // Guard: booking only
  if (!conversation || conversation.intent !== "FLIGHT_BOOKING") {
    return false;
  }

  if (!rawText || !rawText.trim()) {
    return true;
  }

  if (!conversation.booking._bookingFlowStarted) {
    log("BOOKING_FLOW_STARTED", {
      user: from,
      flightId: conversation.booking?.selectedFlight?.id
    });
  
    setConversation(from, {
      ...conversation,
      booking: {
        ...conversation.booking,
        _bookingFlowStarted: true
      }
    });
  }

  if (!conversation.booking?.selectedFlight) {

    await sendWhatsAppMessage(
      from,
      "⚠️ Booking session expired.  Please type *flights* to start again."
    );
   
    return true;
  }
  
  const input = rawText ?? text;
  const lower = (input || "").toLowerCase();

  if (conversation.state === "BOOKING_BAGGAGE") {

    // 🔒 ENTRY LOGIC — runs ONCE only
    if (!conversation.booking._baggageInitDone) {
      const included = formatBaggageForBooking(
        normalizeBaggage(conversation.booking.selectedFlight)
      );
  
      setConversation(from, {
        ...conversation,
        booking: {
          ...conversation.booking,
          includedBaggage: included,
          preferences: getEmptyPreferences(),
          _baggageInitDone: true
        }
      });

      const baggageText = formatBaggageForBooking(
        normalizeBaggage(conversation.booking.selectedFlight)
      );
      
      await sendWhatsAppMessage(
        from,
        "✈️ Flight selected. Customising your booking...\n\n" +
        "Your flight includes:\n" +
        baggageText +
        "\n\n If you need additional allowance, enter the exact weight or enter 0.\n"+
        "Example: 0, 5, 10, or 15" 
      );
  
      return true;
    }
  
    // 🔒 INPUT IDEMPOTENCY GUARD
    if (conversation.booking._baggageCaptured) {
      return true;
    }
  
    const kg = Number(input);
  
    if (Number.isNaN(kg) || kg < 0 || kg > 50) {
      await sendWhatsAppMessage(
        from,
        "❌ Please enter a valid number.\nExample: 0, 5, 10 or 15"
      );
      return true;
    }
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_INSURANCE",
      booking: {
        ...conversation.booking,
        preferences: {
          ...conversation.booking.preferences,
          baggageKg: kg
        },
        _baggageCaptured: true
      }
    });
  
    await sendWhatsAppMessage(
      from,
      `✅ Extra baggage set to ${kg} kg.\n\n` +
      "🛡️ Would you like to add travel insurance?\n\n" +
      "1️⃣ Yes, add insurance\n" +
      "2️⃣ No, continue without insurance"
    );
  
    return true;
  }

  /*==============================
    Insurance block
  ==============================*/

  if (conversation.state === "BOOKING_INSURANCE") {
  
    if (conversation.booking._insuranceSelected) {
      return true;
    }
  
    if (lower !== "1" && lower !== "2") {
      await sendWhatsAppMessage(
        from,
        "❌ Please choose a valid option:\n\n1️⃣ Yes\n2️⃣ No"
      );
      return true;
    }
  
    const insuranceSelected = lower === "1";
  
    const updatedConversation = {
      ...conversation,
      state: "BOOKING_FLEXIBILITY",
      booking: {
        ...conversation.booking,
        preferences: {
          ...conversation.booking.preferences,
          insurance: insuranceSelected
        },
        _insuranceSelected: true
      }
    };
  
    // 🔒 Persist
    setConversation(from, updatedConversation);
  
    await sendWhatsAppMessage(
      from,
      insuranceSelected
        ? "🛡️ Travel insurance added.\n\n"
        : "⏭️ Skipping travel insurance.\n\n"
    );
  
    // 🔥 RE-ENTER WITH NEW STATE
    return handle({
      ...context,
      rawText: "__AUTO__",
      conversation: updatedConversation
    });
  }

  /*========================================
          Flexibility Block
  ==========================================*/
 
  if (conversation.state === "BOOKING_FLEXIBILITY") {

    // 🔒 HARD TERMINAL GUARD — must be first
    if (conversation.booking._flexibilityCompleted) {
      log("BOOKING_FLEXIBILITY_ALREADY_COMPLETED", {
        user: from,
        flightId: conversation.booking.selectedFlight.id
      });
      return true;
    }
  
    const { buildFlexibilityOptions } = require(
      "../../services/flexibility/buildFlexibilityOptions"
    );
  
    /* ===============================
       ENTRY — SHOW OPTIONS (ONCE)
    =============================== */
  
    if (!conversation.booking._flexibilityInitDone) {

      const risk = conversation.booking.selectedFlight._flexibilityRisk;

      if (risk) {
        log("FLEX_RISK_CONSUMED_IN_BOOKING", {
          flightId: conversation.booking.selectedFlight.id,
          riskLevel: risk.level,
          confidence: risk.confidence
        });
      } else {
        log("FLEX_RISK_MISSING_AT_BOOKING", {
          flightId: conversation.booking.selectedFlight.id
        });
      }

  
      const flex = buildFlexibilityOptions({
        fareRules: conversation.booking.selectedFlight._fareRules,
        flexibilityRisk: conversation.booking.selectedFlight._flexibilityRisk
      });

      log("FLEXIBILITY_OPTIONS_BUILT", {
        user: from,
        flightId: conversation.booking.selectedFlight.id,
        options: Array.isArray(flex?.options)
          ? flex.options.map(o => ({
              code: o.code,
              label: o.label,
              priceDelta: o.priceDelta ?? null
            }))
          : [],
        currency: flex?.currency ?? null
      });

      if (!conversation.booking.selectedFlight._fareRules) {
        log("FLEXIBILITY_RULES_MISSING", {
          user: from,
          flightId: conversation.booking.selectedFlight.id
        });
      }

  
      // ❌ No valid options → auto continue
      if (!flex || !Array.isArray(flex.options) || flex.options.length === 0) {

        log("FLEXIBILITY_SKIPPED", {
          user: from,
          flightId: conversation.booking.selectedFlight.id,
          reason: "NO_VALID_OPTIONS"
        });

        setConversation(from, {
          ...conversation,
          state: "BOOKING_DISCOUNT",
          booking: {
            ...conversation.booking,
            preferences: {
              ...conversation.booking.preferences,
              flexibility: "NONE"
            },
            _flexibilityInitDone: true,
            _flexibilitySelected: true,
            _flexibilityCompleted: true,   // ✅ ADD THIS
            _flexibilityOptions: null,
            _flexibilityOptionMap: null
          }
        });
  
        await sendWhatsAppMessage(
          from,
          "⚠️ Flexibility options are unavailable for this flight.\n\n" +
          "Continuing without flexibility."
        );
  
        return true;
      }
  
      // ✅ Build option map
      let message = "🔁 Choose a flexibility option:\n\n";
      const optionMap = {};
  
      flex.options.forEach((opt, idx) => {
        const key = String(idx + 1);
        optionMap[key] = opt.code;
        message += `${key}️⃣ ${opt.label}\n`;
      });

      setConversation(from, {
        ...conversation,
        state: "BOOKING_FLEXIBILITY", // ✅ explicit
        booking: {
          ...conversation.booking,
          _flexibilityOptions: flex.options,
          _flexibilityOptionMap: optionMap,
          _flexibilityInitDone: true
        }
      });
  
      await sendWhatsAppMessage(from, message);
      return true;
    }
  
    /* ===============================
       INPUT — CAPTURE SELECTION
    =============================== */

    if (conversation.booking._flexibilitySelected) {
      return true;
    }
  
    const map = conversation.booking._flexibilityOptionMap;
    const selectedCode = map?.[lower];
  
    if (!selectedCode) {
      await sendWhatsAppMessage(
        from,
        "❌ Please select a valid flexibility option."
      );
      return true;
    }

    log("FLEXIBILITY_SELECTED", {
      user: from,
      flightId: conversation.booking.selectedFlight.id,
      selectedCode
    });

    setConversation(from, {
      ...conversation,
      state: "BOOKING_DISCOUNT",
      booking: {
        ...conversation.booking,
        preferences: {
          ...conversation.booking.preferences,
          flexibility: selectedCode   // 🔒 CODE ONLY (correct)
        },
        _flexibilitySelected: true,
        _flexibilityCompleted: true   // ✅ ADD THIS
      }
    });
  
    await sendWhatsAppMessage(
      from,
      `🔁 Flexibility selected.\n\n` +
      "If you have a discount or coupon code, please enter it now.\n" +
      "Reply *NONE* if you don’t have one."
    );
  
    return true;
  }

  /* ===============================
     BOOKING_DISCOUNT
  =============================== */
  
  if (conversation.state === "BOOKING_DISCOUNT") {
  
    // 🔒 Idempotency guard
    if (conversation.booking._discountCaptured) {
      return true;
    }
  
    const input = rawText.trim();
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLERS_INIT",
      booking: {
        ...conversation.booking,
        discountCode: input === "NONE" ? null : input,
        _discountCaptured: true,
        _travellerConsentAsked: false   // 👈 gate flag
      }
    });
  
    await sendWhatsAppMessage(
      from,
      (input === "NONE"
        ? "🏷️ No discount code applied.\n\n"
        : `🏷️ Discount code *${input}* noted.\n\n`) +
      "Ready to add traveller details?\n\n" +
      "Reply *Yes* to continue or *No* to cancel booking."
    );
  
    return true;
  }

  /* ===============================
     BOOKING_TRAVELLERS_INIT
  =============================== */
  
  if (conversation.state === "BOOKING_TRAVELLERS_INIT") {
  
    // 🔒 HARD IDEMPOTENCY — init must never re-run
    if (conversation.booking._travellersInitDone) {
      return true;
    }
  
    if (!rawText || !rawText.trim()) {
      return true;
    }
  
    const input = rawText.trim().toLowerCase();
  
    /* ✅ YES → INIT + ADVANCE IN SAME TURN */
    if (["yes", "y", "ok", "1", "continue"].includes(input)) {
  
      const total = conversation.booking.passengersCount;
  
      setConversation(from, {
        ...conversation,
        state: "BOOKING_TRAVELLER_NAME",
        booking: {
          ...conversation.booking,
          travellers: [],
          currentTravellerIndex: 0,
          _travellersInitDone: true
        }
      });
  
      await sendWhatsAppMessage(
        from,
        `🧑 Traveller details\n\n` +
        `Traveller 1 of ${total}\n` +
        `Please enter the full name of the traveller as it appears on the proof document.\n\n` +
        `Example: Rahul Sharma`
      );
  
      return true;
    }

    /* ❌ NO → EXIT BOOKING CLEANLY */
    if (["no", "n"].includes(input)) {
    
      setConversation(from, {
        intent: "FLIGHT_MENU",
        state: "MENU"
      });
    
      await sendWhatsAppMessage(
        from,
        "❌ Booking cancelled.\n\n" +
        "✈️ Flights menu\n\n" +
        "Reply:\n" +
        "➡️ oneway\n" +
        "➡️ roundtrip\n" +
        "➡️ multicity"
      );
    
      return true;
    }
  
    /* 🔁 INVALID INPUT → RE-PROMPT */
    await sendWhatsAppMessage(
      from,
      "Ready to add traveller details?\n\nReply *Yes* to continue or *No* to cancel booking."
    );
  
    return true;
  }

  // NAME INPUT → AGE
  if (conversation.state === "BOOKING_TRAVELLER_NAME") {
    const idx = conversation.booking.currentTravellerIndex;
  
    // 🔒 Idempotency guard — retry-safe
    if (conversation.booking._nameCapturedForIndex === idx) {
      return true;
    }
  
    const raw = rawText?.trim();
  
    if (!isValidHumanName(raw)) {
      await sendWhatsAppMessage(
        from,
        "❌ Please enter a valid full name as it appears on your identity proof document\n\n" +
        "Examples:\n" +
        "• Rahul Sharma\n" +
        "• Rahul R. Sharma\n" +
        "• Ananya Sharma P."
      );
      return true;
    }
  
    // ✅ PARSE NAME HERE (this was missing)
    const parts = raw.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");
  
    const travellers = [...conversation.booking.travellers];
  
    travellers[idx] = {
      index: idx + 1,
      firstName,
      lastName,
      ageCategory: "ADULT",
      specialFare: "NONE",
      seat: null,
      meal: null
    };
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLER_AGE",
      booking: {
        ...conversation.booking,
        travellers,
        travellerLocked: false,
        _nameCapturedForIndex: idx,
        _travellerEditInProgress: null
      }
    });
  
    await sendWhatsAppMessage(
      from,
      "🎂 Please enter traveller's age."
    );
  
    return true;
  }

  // Traveller's age → Special Fare
  
  if (conversation.state === "BOOKING_TRAVELLER_AGE") {
    const idx = conversation.booking.currentTravellerIndex;
  
    // 🔒 Idempotency guard — retry-safe
    if (conversation.booking._ageCapturedForIndex === idx) {
      return true;
    }

    const age = Number(rawText);

    // 🔒 HARD VALIDATION — integer only
    if (
      Number.isNaN(age) ||
      !Number.isInteger(age) ||
      age <= 0 ||
      age > 120
    ) {
      await sendWhatsAppMessage(
        from,
        "❌ Please enter a valid age (whole number only).\nExample: 25"
      );
      return true;
    }
  
    const travellers = [...conversation.booking.travellers];
  
    const ageCategory =
      age < 2 ? "INFANT" :
      age < 12 ? "CHILD" :
      "ADULT";
  
    travellers[idx] = {
      ...travellers[idx],
      age,
      ageCategory,
      eligibleSpecialFares: getEligibleSpecialFares(age)
    };
  
    const t = travellers[idx];
  
    // 🔽 Build dynamic fare options
    let message =
      `🎫 Special fares for ${t.firstName} ${t.lastName}\n\n` +
      "1️⃣ None\n";
  
    const optionMap = { "1": "NONE" };
    let optionNumber = 2;
  
    if (t.eligibleSpecialFares.includes("SENIOR")) {
      message += `${optionNumber}️⃣ Senior Citizen\n`;
      optionMap[String(optionNumber)] = "SENIOR";
      optionNumber++;
    }
  
    if (t.eligibleSpecialFares.includes("STUDENT")) {
      message += `${optionNumber}️⃣ Student\n`;
      optionMap[String(optionNumber)] = "STUDENT";
    }
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLER_SPECIAL_FARE",
      booking: {
        ...conversation.booking,
        travellers,
        _specialFareOptionMap: optionMap,
        _ageCapturedForIndex: idx
      }
    });
  
    await sendWhatsAppMessage(from, message);
  
    return true;
  }

  // SPECIAL FARE → Seat Selection
  
  if (conversation.state === "BOOKING_TRAVELLER_SPECIAL_FARE") {
    const idx = conversation.booking.currentTravellerIndex;
  
    // 🔒 Idempotency guard — retry-safe
    if (conversation.booking._specialFareLockedForIndex === idx) {
      return true;
    }
  
    const optionMap = conversation.booking._specialFareOptionMap;
  
    if (!optionMap) {
      // Safety fallback — should never happen, but retry-safe
      return true;
    }
  
    const selectedFare = optionMap[lower];
  
    if (!selectedFare) {
      await sendWhatsAppMessage(
        from,
        "❌ Please choose one of the listed options."
      );
      return true;
    }
  
    const travellers = [...conversation.booking.travellers];
  
    travellers[idx] = {
      ...travellers[idx],
      specialFare: selectedFare
    };
  
    // 🔥 Clean up temporary map safely
    const { _specialFareOptionMap, ...bookingRest } = conversation.booking;
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLER_SEAT",
      booking: {
        ...bookingRest,
        travellers,
        _specialFareLockedForIndex: idx,
        _specialFareOptionMap: null
      }
    });
  
    await sendWhatsAppMessage(
      from,
      "💺 Seat selection\n\n" +
      "1️⃣ Any free seat\n" +
      "2️⃣ Choose a paid seat"
    );
  
    return true;
  }

  // SEAT SELECTION → Meal selection

  if (conversation.state === "BOOKING_TRAVELLER_SEAT") {
    const idx = conversation.booking.currentTravellerIndex;
  
    // 🔒 Idempotency guard — retry-safe
    if (conversation.booking._seatCapturedForIndex === idx) {
      return true;
    }
  
    if (lower !== "1" && lower !== "2") {
      await sendWhatsAppMessage(
        from,
        "❌ Please choose:\n1️⃣ Any free seat\n2️⃣ Paid seat"
      );
      return true;
    }
  
    const travellers = [...conversation.booking.travellers];
  
    travellers[idx] = {
      ...travellers[idx],
      seat: lower === "1" ? "FREE_AUTO" : "PAID_MANUAL"
    };
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLER_MEAL",
      booking: {
        ...conversation.booking,
        travellers,
        _seatCapturedForIndex: idx
      }
    });
  
    await sendWhatsAppMessage(
      from,
      "🍽️ Meal preference\n\n" +
      "1️⃣ No meal\n" +
      "2️⃣ Vegetarian\n" +
      "3️⃣ Non-Vegetarian\n" +
      "4️⃣ Vegan"
    );
  
    return true;
  }

  // MEAL SELECTION → Traveller review

  if (conversation.state === "BOOKING_TRAVELLER_MEAL") {
    const idx = conversation.booking.currentTravellerIndex;
  
    // 🔒 Idempotency guard
    if (conversation.booking._mealCapturedForIndex === idx) {
      return true;
    }
  
    const map = {
      "1": "NO_MEAL",
      "2": "VEG",
      "3": "NON_VEG",
      "4": "VEGAN"
    };
  
    if (!map[lower]) {
      await sendWhatsAppMessage(
        from,
        "❌ Please select a valid meal option."
      );
      return true;
    }
  
    const travellers = [...conversation.booking.travellers];
  
    travellers[idx] = {
      ...travellers[idx],
      meal: map[lower]
    };
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLER_CONFIRM",
      booking: {
        ...conversation.booking,
        travellers,
        _mealCapturedForIndex: idx
      }
    });
  
    const t = travellers[idx];
  
    await sendWhatsAppMessage(
      from,
      `👤 Traveller Review\n\n` +
      `Name: ${t.firstName} ${t.lastName}\n` +
      `Age: ${t.age} (${t.ageCategory})\n` +
      `Special Fare: ${t.specialFare}\n` +
      `Seat: ${t.seat}\n` +
      `Meal: ${t.meal}\n\n` +
      `Reply:\nOK to confirm\nEDIT to modify`
    );
  
    return true;
  }
  
  // Edit / Confirm → next traveller loop

  if (conversation.state === "BOOKING_TRAVELLER_CONFIRM") {
  
    // 🔒 Terminal guard
    if (conversation.booking._travellersCompleted === true) {
      return true;
    }
  
    const idx = conversation.booking.currentTravellerIndex;
    const input = lower.trim();
  
    if (input !== "ok" && input !== "edit") {
      await sendWhatsAppMessage(
        from,
        "❌ Reply OK to confirm or EDIT to modify."
      );
      return true;
    }
  
    /* ✏️ EDIT */
    if (input === "edit") {
      if (conversation.booking._travellerEditInProgress === idx) {
        return true;
      }
  
      const travellers = [...conversation.booking.travellers];
      travellers.splice(idx, 1);
  
      setConversation(from, {
        ...conversation,
        state: "BOOKING_TRAVELLER_NAME",
        booking: {
          ...conversation.booking,
          travellers,
          travellerLocked: false,
          _travellerEditInProgress: idx
        }
      });
  
      await sendWhatsAppMessage(
        from,
        "✏️ Let’s edit traveller details.\nEnter first and last name."
      );
  
      return true;
    }
  
    /* ✅ CONFIRM */
    const nextIndex = idx + 1;
    const total = conversation.booking.passengersCount;
  
    // 🔒 Last traveller → FF (STATE + PROMPT SAME TURN)
    if (nextIndex >= total) {

        if (conversation.booking._travellersCompleted !== true) {
          log("TRAVELLERS_COMPLETED", {
            user: from,
            count: total
          });
        }

      const profileFF = conversation.profile?.frequentFlyer;
  
      setConversation(from, {
        ...conversation,
        state: "BOOKING_FREQUENT_FLYER",
        booking: {
          ...conversation.booking,
          travellerLocked: true,
          _travellersCompleted: true,
          _ffCaptured: false
        }
      });
  
      await sendWhatsAppMessage(
        from,
        profileFF
          ? "✈️ Frequent Flyer\n\nReply:\n1️⃣ Use saved number\n2️⃣ Enter a new number\n3️⃣ Skip"
          : "✈️ Frequent Flyer\n\nPlease enter your frequent flyer number.\nReply *NONE* to skip."
      );
  
      return true;
    }
  
    /* ➡️ NEXT TRAVELLER */
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLER_NAME",
      booking: {
        ...conversation.booking,
        currentTravellerIndex: nextIndex,
        travellerLocked: false
      }
    });
  
    await sendWhatsAppMessage(
      from,
      `🧑 Traveller ${nextIndex + 1} of ${total}\n\nPlease enter first and last name.`
    );
  
    return true;
  }

  /* ===============================
     BOOKING_FREQUENT_FLYER
  =============================== */
  
  if (conversation.state === "BOOKING_FREQUENT_FLYER") {
  
    // 🔒 Idempotency
    if (conversation.booking._ffCaptured) {
      return true;
    }
  
    const profileFF = conversation.profile?.frequentFlyer;
  
    /* ⏭️ SKIP */
    if (lower === "none" || lower === "3") {
      setConversation(from, {
        ...conversation,
        state: "BOOKING_GST_DETAILS",
        booking: {
          ...conversation.booking,
          _ffCaptured: true
        }
      });
  
      await sendWhatsAppMessage(
        from,
        "⏭️ Skipped frequent flyer.\n\nEnter your GST number or type NONE if you don’t have one."
      );
      return true;
    }
  
    /* 💾 USE SAVED */
    if (profileFF && lower === "1") {
      setConversation(from, {
        ...conversation,
        state: "BOOKING_GST_DETAILS",
        booking: {
          ...conversation.booking,
          frequentFlyer: {
            ...profileFF,
            confirmed: true
          },
          _ffCaptured: true
        }
      });
  
      await sendWhatsAppMessage(
        from,
        "✅ Frequent flyer number saved.\n\nEnter your GST number or type NONE if you don’t have one."
      );
      return true;
    }
  
    /* ✏️ MANUAL ENTRY */
    if (isValidFrequentFlyer(rawText)) {
      setConversation(from, {
        ...conversation,
        state: "BOOKING_GST_DETAILS",
        booking: {
          ...conversation.booking,
          frequentFlyer: {
            airline: conversation.booking.selectedFlight.validatingAirlineCodes?.[0],
            number: rawText.trim(),
            confirmed: true
          },
          _ffCaptured: true
        }
      });
  
      await sendWhatsAppMessage(
        from,
        "✅ Frequent flyer number saved.\n\nEnter your GST number or type NONE if you don’t have one."
      );
      return true;
    }
  
    await sendWhatsAppMessage(
      from,
      "❌ Please enter a valid frequent flyer number or reply NONE."
    );
    return true;
  }

  /* ===============================
     BOOKING_GST_DETAILS
  =============================== */
  
  if (conversation.state === "BOOKING_GST_DETAILS") {
  
    // 🔒 ENTRY — prompt exactly once
    if (!conversation.booking._gstEntryShown) {
      setConversation(from, {
        ...conversation,
        booking: {
          ...conversation.booking,
          _gstEntryShown: true
        }
      });
  
      await sendWhatsAppMessage(
        from,
        "🏢 GST Details (optional)\n\n" +
        "Please enter your GST number.\n" +
        "Reply *NONE* to skip."
      );
  
      return true;
    }
  
    if (!rawText || !rawText.trim()) {
      return true;
    }
  
    // 🔒 TERMINAL IDEMPOTENCY
    if (conversation.booking._gstCaptured) {
      return true;
    }
  
    const input = lower.trim();
  
    // ⏭️ SKIP
    if (input === "none") {
      const updatedConversation = {
        ...conversation,
        booking: {
          ...conversation.booking,
          _gstCaptured: true
        }
      };
  
      setConversation(from, updatedConversation);
  
      await sendWhatsAppMessage(
        from,
        "⏭️ GST details skipped.\n\nCalculating final price…"
      );
  
      await runPriceCompute({
        from,
        conversation: updatedConversation,
        sendWhatsAppMessage,
        setConversation
      });
  
      return true;
    }
  
    // 🔒 PLAUSIBILITY (emoji / junk)
    if (!isPlausibleGSTInput(rawText)) {
      await sendWhatsAppMessage(
        from,
        "❌ Please enter a valid GST number or reply *NONE* to skip."
      );
      return true;
    }
  
    // ✅ STRICT GST FORMAT
    const gstRegex =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  
    if (gstRegex.test(rawText.trim().toUpperCase())) {
      const updatedConversation = {
        ...conversation,
        booking: {
          ...conversation.booking,
          gst: {
            gstin: rawText.trim().toUpperCase()
          },
          _gstCaptured: true
        }
      };
  
      setConversation(from, updatedConversation);
  
      await sendWhatsAppMessage(
        from,
        "✅ GST details saved.\n\nCalculating final price…"
      );
  
      await runPriceCompute({
        from,
        conversation: updatedConversation,
        sendWhatsAppMessage,
        setConversation
      });
  
      return true;
    }
  
    // 🔁 INVALID BUT PLAUSIBLE
    await sendWhatsAppMessage(
      from,
      "❌ GST number format looks incorrect.\nReply *NONE* to skip."
    );
  
    return true;
  }

  /* ===============================
     BOOKING_PRICE_REVIEW
  =============================== */
  
  if (conversation.state === "BOOKING_PRICE_REVIEW") {
  
    // 🔒 Idempotency
    if (conversation.booking._priceReviewHandled) {
      return true;
    }
  
    if (lower !== "pay") {
      await sendWhatsAppMessage(
        from,
        "❌ Reply *PAY* to continue to payment."
      );
      return true;
    }
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_PAYMENT_INIT",
      booking: {
        ...conversation.booking,
        _priceReviewHandled: true
      }
    });
  
    await sendWhatsAppMessage(
      from,
      "💳 Proceeding to payment…"
    );
  
    return true;
  }

  /* ===============================
     BOOKING_PAYMENT_INIT
  =============================== */
  
  if (conversation.state === "BOOKING_PAYMENT_INIT") {
  
    // 🔒 ENTRY ONCE
    if (!conversation.booking._paymentStubShown) {
      setConversation(from, {
        ...conversation,
        booking: {
          ...conversation.booking,
          _paymentStubShown: true
        }
      });
  
      log("BOOKING_READY_FOR_PAYMENT", {
        user: from,
        flightId: conversation.booking.selectedFlight.id,
        total: conversation.booking.priceSnapshot?.totals?.grandTotal
      });
  
      await sendWhatsAppMessage(
        from,
        "💳 Payment is not enabled yet.\n\n" +
        "This booking flow test is complete.\n\n" +
        "Type *cancel* to exit."
      );
    }
  
    return true;
  }
  
  /* ===============================
     FALLBACK
  =============================== */
  return true;
}

module.exports = {
  handle
};


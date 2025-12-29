/**
 * One-Way Booking Flow
 * Scope: Booking only
 * Entry: via conversation handoff from oneWayFlow.js
 */

const { log } = require("../../utils/logger");
const { recordSignal } = require("../../utils/abuseSignals");

function getEmptyPreferences() {
  return {
    baggageKg: 0,
    seats: null,
    meals: null,
    insurance: false,
    flexibility: null
  };
}

function getIncludedBaggage(selectedFlight) {
  // 🔒 Stub for now — replace with real Amadeus parsing later
  return {
    cabinKg: 5,
    checkinKg: 15
  };
}

async function handle(context) {
  const {
    from,
    text,
    rawText,
    conversation,
    sendWhatsAppMessage,
    setConversation,
    clearConversation
  } = context;

  
  // Guard: booking only
  if (!conversation || conversation.intent !== "FLIGHT_BOOKING") {
    return false;
  }

  const lower = (rawText || text || "").toLowerCase();
  
  if (conversation.state === "BOOKING_BAGGAGE") {
    const kg = Number(rawText);
  
    if (Number.isNaN(kg) || kg < 0 || kg > 50) {
      await sendWhatsAppMessage(
        from,
        "❌ Please enter a valid number.\n" +
        "Example: 0, 5, 10 or 15"
      );
      return true;
    }

    setConversation(from, {
      ...conversation,
      state: "BOOKING_MEALS",
      booking: {
        ...conversation.booking,
        preferences: {
          ...conversation.booking.preferences,
          baggageKg: kg
        }
      }
    });
    
    await sendWhatsAppMessage(
      from,
      `✅ Extra baggage set to ${kg} kg.\n\n` +
      "Please select your meal preference:\n\n" +
      "1️⃣ No meals\n" +
      "2️⃣ Vegetarian\n" +
      "3️⃣ Non-Vegetarian\n" +
      "4️⃣ Vegan"
    );
    
    return true;
  }

  if (conversation.state === "BOOKING_MEALS") {
  const mealMap = {
    "1": "NO_MEALS",
    "2": "VEGETARIAN",
    "3": "NON_VEGETARIAN",
    "4": "VEGAN"
  };

  const selectedMeal = mealMap[lower];

  if (!selectedMeal) {
    await sendWhatsAppMessage(
      from,
      "❌ Please select a valid meal option:\n" +
      "1️⃣ No meals\n" +
      "2️⃣ Vegetarian\n" +
      "3️⃣ Non-Vegetarian\n" +
      "4️⃣ Vegan"
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
        meal: selectedMeal
      }
    }
  });

  await sendWhatsAppMessage(
    from,
    "🍽️ Meal preference saved.\n\n" +
    "Next, let's look at travel insurance."
  );

  return true;
  }

  if (conversation.state === "BOOKING_INSURANCE") {
    if (lower !== "1" && lower !== "2") {
      await sendWhatsAppMessage(
        from,
        "❌ Please choose a valid option:\n\n" +
        "1️⃣ Yes, add insurance\n" +
        "2️⃣ No, continue without insurance"
      );
      return true;
    }
  
    const insuranceSelected = lower === "1";
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_FLEXIBILITY",
      booking: {
        ...conversation.booking,
        preferences: {
          ...conversation.booking.preferences,
          insurance: insuranceSelected
        }
      }
    });
  
    await sendWhatsAppMessage(
      from,
      insuranceSelected
        ? "🛡️ Travel insurance added.\n\nNext, let’s choose flexibility options."
        : "⏭️ Skipping travel insurance.\n\nNext, let’s choose flexibility options."
    );
  
    return true;
  }

  

 

  /* ===============================
     GLOBAL CANCEL
  =============================== */
  if (lower === "cancel") {
    recordSignal("booking_cancelled", { user: from });
    clearConversation(from);
    await sendWhatsAppMessage(from, "❌ Booking cancelled.");
    return true;
  }

  /* ===============================
     BOOKING_PREFERENCES
  =============================== */

  if (conversation.state === "BOOKING_PREFERENCES") {
    const included = getIncludedBaggage(
      conversation.booking.selectedFlight
    );
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_BAGGAGE",
      booking: {
        ...conversation.booking,
        preferences: {
          baggageKg: 0,
          seats: null,
          meal: null,
          insurance: false,
          flexibility: null
        },
        includedBaggage: included
      }
    });
  
    await sendWhatsAppMessage(
      from,
      "🧳 Let’s customise your booking\n\n" +
      `Your flight includes:\n` +
      `• Cabin baggage: ${included.cabinKg} kg\n` +
      `• Check-in baggage: ${included.checkinKg} kg\n\n` +
      "If you need extra baggage, reply with the total additional weight.\n" +
      "Reply **0** if you don’t need extra baggage.\n\n" +
      "Example: 0, 5, 10 or 15"
    );
  
    return true;
  }

  /* ===============================
     BOOKING_ANALYTICS
  =============================== */
  if (conversation.state === "BOOKING_ANALYTICS") {
    await sendWhatsAppMessage(
      from,
      "📊 Here are your available options (cheapest / fastest)."
    );

    setConversation(from, {
      ...conversation,
      state: "BOOKING_PRICE_LOCK"
    });

    return true;
  }

  /* ===============================
     BOOKING_PRICE_LOCK
  =============================== */
  if (conversation.state === "BOOKING_PRICE_LOCK") {
    log("BOOKING_PRICE_LOCKED", { user: from });

    setConversation(from, {
      ...conversation,
      state: "BOOKING_PASSENGERS"
    });

    return true;
  }

  /* ===============================
     BOOKING_PASSENGERS
  =============================== */
  if (conversation.state === "BOOKING_PASSENGERS") {
    await sendWhatsAppMessage(
      from,
      "🧑 Let’s capture traveller details."
    );

    setConversation(from, {
      ...conversation,
      state: "BOOKING_PAYMENT"
    });

    return true;
  }

  /* ===============================
     BOOKING_PAYMENT
  =============================== */
  if (conversation.state === "BOOKING_PAYMENT") {
    await sendWhatsAppMessage(
      from,
      "💳 Redirecting to payment."
    );

    setConversation(from, {
      ...conversation,
      state: "BOOKING_CONFIRMATION"
    });

    return true;
  }

  /* ===============================
     BOOKING_CONFIRMATION
  =============================== */
  if (conversation.state === "BOOKING_CONFIRMATION") {
    await sendWhatsAppMessage(
      from,
      "✅ Booking confirmed. PNR will be shared shortly."
    );
    return true;
  }

  /* ===============================
     FALLBACK
  =============================== */
  await sendWhatsAppMessage(
    from,
    "Please reply *cancel* to stop booking."
  );
  return true;
}

module.exports = {
  handle
};

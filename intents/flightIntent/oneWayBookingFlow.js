/**
 * One-Way Booking Flow
 * Scope: BOOKING only (invoked after search + flight selection)
 * Version: v2.0
 */

const { log } = require("../../utils/logger");
const { recordSignal } = require("../../utils/abuseSignals");

/* ===============================
   Entry
=============================== */

async function start(context, bookingContext) {
  const { from, setConversation, sendWhatsAppMessage } = context;

  // Guard: bookingContext must exist
  if (
    !bookingContext ||
    !bookingContext.selectedFlight ||
    !bookingContext.searchQuery ||
    !bookingContext.seatsAvailable
  ) {
    await sendWhatsAppMessage(
      from,
      "⚠️ Booking couldn’t be started. Please search again."
    );
    return;
  }

  setConversation(from, {
    intent: "FLIGHT_BOOKING",
    flow: "ONE_WAY_BOOKING",
    state: "BOOKING_PREFERENCES",
    booking: {
      selectedFlight: bookingContext.selectedFlight,
      searchQuery: bookingContext.searchQuery,
      seatsAvailable: bookingContext.seatsAvailable,
      preferences: {},
      priceSnapshot: null
    }
  });

  await sendWhatsAppMessage(
    from,
    "🧳 Let’s set your travel preferences.\n\n" +
    "You can choose baggage, seats, meals, discounts and flexibility."
  );
}

/* ===============================
   Main Handler
=============================== */

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

  const lower = (rawText || text || "").toLowerCase();

  if (!conversation || conversation.intent !== "FLIGHT_BOOKING") {
    return false;
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
    // TODO: collect baggage / seat / meal / discounts / flexibility
    await sendWhatsAppMessage(
      from,
      "⚙️ Preferences captured.\n(Stub — logic to be added)"
    );

    setConversation(from, {
      ...conversation,
      state: "BOOKING_PRICE_COMPUTE"
    });
    return true;
  }

  /* ===============================
     BOOKING_PRICE_COMPUTE
  =============================== */

  if (conversation.state === "BOOKING_PRICE_COMPUTE") {
    // TODO: compute final price snapshot
    log("BOOKING_PRICE_COMPUTE_STUB", { user: from });

    setConversation(from, {
      ...conversation,
      state: "BOOKING_ANALYTICS",
      booking: {
        ...conversation.booking,
        priceSnapshot: {} // placeholder
      }
    });

    return true;
  }

  /* ===============================
     BOOKING_ANALYTICS
  =============================== */

  if (conversation.state === "BOOKING_ANALYTICS") {
    // TODO: cheapest / fastest comparison
    await sendWhatsAppMessage(
      from,
      "📊 Analytics ready.\n(Stub — logic to be added)"
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
    // TODO: lock price
    log("BOOKING_PRICE_LOCKED", { user: from });

    setConversation(from, {
      ...conversation,
      state: "BOOKING_PAYMENT_INIT"
    });
    return true;
  }

  /* ===============================
     BOOKING_PAYMENT_INIT
  =============================== */

  if (conversation.state === "BOOKING_PAYMENT_INIT") {
    // TODO: initiate payment
    await sendWhatsAppMessage(
      from,
      "💳 Proceeding to payment.\n(Stub — logic to be added)"
    );

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
    // TODO: collect passenger details
    await sendWhatsAppMessage(
      from,
      "🧑 Passenger details captured.\n(Stub — logic to be added)"
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
      "✅ Booking confirmed!\n(Stub — PNR generation pending)"
    );
    return true;
  }

  /* ===============================
     FALLBACK
  =============================== */

  await sendWhatsAppMessage(
    from,
    "I didn’t understand that. You can reply *cancel* to stop booking."
  );
  return true;
}

module.exports = {
  start,
  handle
};

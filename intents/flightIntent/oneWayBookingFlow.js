/**
 * One-Way Booking Flow
 * Scope: Booking only
 * Entry: via conversation handoff from oneWayFlow.js
 */

const { log } = require("../../utils/logger");
const { recordSignal } = require("../../utils/abuseSignals");

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
    // stub
    await sendWhatsAppMessage(
      from,
      "🧳 Let’s start with your travel preferences."
    );

    setConversation(from, {
      ...conversation,
      state: "BOOKING_PRICE_COMPUTE",
      booking: {
        ...conversation.booking,
        preferences: {}
      }
    });

    return true;
  }

  /* ===============================
     BOOKING_PRICE_COMPUTE
  =============================== */
  if (conversation.state === "BOOKING_PRICE_COMPUTE") {
    log("BOOKING_PRICE_COMPUTE", { user: from });

    setConversation(from, {
      ...conversation,
      state: "BOOKING_ANALYTICS",
      booking: {
        ...conversation.booking,
        priceSnapshot: {}
      }
    });

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

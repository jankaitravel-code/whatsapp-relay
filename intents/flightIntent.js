/**
 * Flight Intent
 * Handles all flight-related messages and conversation continuation
 */

const { parseFlightQuery } = require("../services/flightParser");
const { searchFlights } = require("../services/flightSearchService");

function canHandle(text, context) {
  if (!text) return false;

  // New flight query
  if (text.toLowerCase().includes("flight")) return true;

  // Conversation continuation (date / change date)
  if (context?.conversation?.intent === "FLIGHT_SEARCH") return true;

  return false;
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

  /* ===============================
     CHANGE DATE
  =============================== */
  if (
    conversation?.intent === "FLIGHT_SEARCH" &&
    rawText.toLowerCase().includes("change date")
  ) {
    const dateMatch = rawText.match(/\d{4}-\d{2}-\d{2}/);

    if (!dateMatch) {
      await sendWhatsAppMessage(
        from,
        "📅 Please provide the new date in YYYY-MM-DD format."
      );
      return;
    }

    conversation.date = dateMatch[0];
  }

  /* ===============================
     DATE-ONLY RESPONSE
  =============================== */
  if (
    conversation?.intent === "FLIGHT_SEARCH" &&
    conversation.awaiting === "date"
  ) {
    const dateMatch = rawText.match(/\d{4}-\d{2}-\d{2}/);

    if (!dateMatch) {
      await sendWhatsAppMessage(
        from,
        "📅 Please provide the date in YYYY-MM-DD format."
      );
      return;
    }

    conversation.date = dateMatch[0];
  }

  /* ===============================
     PARSE NEW QUERY IF NEEDED
  =============================== */
  let flightQuery = null;

  if (!conversation || text.toLowerCase().includes("flight")) {
    flightQuery = await parseFlightQuery(text);

    if (flightQuery?.error === "UNKNOWN_LOCATION") {
      await sendWhatsAppMessage(
        from,
        "❌ I couldn’t recognize one of the locations.\n" +
        "Please try a major city or airport."
      );
      return;
    }

    if (!flightQuery) {
      await sendWhatsAppMessage(
        from,
        "✈️ Try:\nflight DEL to DXB on 2025-12-25"
      );
      return;
    }

    // Partial query
    if (!flightQuery.date) {
      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        origin: flightQuery.origin,
        destination: flightQuery.destination,
        date: null,
        awaiting: "date"
      });

      await sendWhatsAppMessage(
        from,
        "✈️ Got it. What date would you like to travel? (YYYY-MM-DD)"
      );
      return;
    }

    // Full query
    setConversation(from, {
      intent: "FLIGHT_SEARCH",
      origin: flightQuery.origin,
      destination: flightQuery.destination,
      date: flightQuery.date,
      awaiting: null
    });
  }

  /* ===============================
     EXECUTE SEARCH
  =============================== */
  const active = getActiveQuery(conversation, flightQuery);

  const flights = await searchFlights({
    originLocationCode: active.origin.cityCode,
    destinationLocationCode: active.destination.cityCode,
    date: active.date
  });

  if (!flights || flights.length === 0) {
    await sendWhatsAppMessage(
      from,
      "Sorry, I couldn’t find flights for that route and date."
    );
    return;
  }

  const reply = flights
    .map((f, i) => {
      const s = f.itineraries[0].segments[0];
      return `${i + 1}. ${s.carrierCode} ${s.number} – ₹${f.price.total}`;
    })
    .join("\n");

  await sendWhatsAppMessage(
    from,
    `✈️ Here are your flight options:\n\n${reply}`
  );
}

function getActiveQuery(conversation, flightQuery) {
  if (flightQuery) return flightQuery;

  return {
    origin: conversation.origin,
    destination: conversation.destination,
    date: conversation.date
  };
}

module.exports = {
  canHandle,
  handle
};

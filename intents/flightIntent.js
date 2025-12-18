/**
 * Flight Intent
 * Handles all flight-related messages
 */

const { parseFlightQuery } = require("../services/flightParser");
const { searchFlights } = require("../services/flightSearchService");

function canHandle(text) {
  return typeof text === "string" && text.toLowerCase().includes("flight");
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

  const flightQuery = await parseFlightQuery(text);

  if (flightQuery?.error === "UNKNOWN_LOCATION") {
    await sendWhatsAppMessage(
      from,
      "❌ I couldn’t recognize one of the locations.\n" +
      "Please try again using a major city or airport name."
    );
    return;
  }

  if (!flightQuery) {
    await sendWhatsAppMessage(
      from,
      "✈️ I can help you find flights.\n\n" +
      "Please use:\nflight DEL to DXB on 2025-12-25"
    );
    return;
  }

  // 📝 Partial query (missing date)
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

  // ✅ Full query
  const flights = await searchFlights({
    originLocationCode: flightQuery.origin.cityCode,
    destinationLocationCode: flightQuery.destination.cityCode,
    date: flightQuery.date
  });

  if (!flights || flights.length === 0) {
    await sendWhatsAppMessage(
      from,
      "Sorry, I couldn’t find any flights for that route and date."
    );
    return;
  }

  // 💾 Persist completed search (for change-date, etc.)
  setConversation(from, {
    intent: "FLIGHT_SEARCH",
    origin: flightQuery.origin,
    destination: flightQuery.destination,
    date: flightQuery.date,
    awaiting: null
  });

  const reply = flights
    .map((f, i) => {
      const segment = f.itineraries[0].segments[0];
      return `${i + 1}. ${segment.carrierCode} ${segment.number} – ₹${f.price.total}`;
    })
    .join("\n");

  await sendWhatsAppMessage(
    from,
    `✈️ Here are some flight options:\n\n${reply}`
  );
}

module.exports = {
  canHandle,
  handle
};

const { searchFlights } = require("../../services/flightSearchService");
const { log } = require("../../utils/logger");

function buildConfirmationMessage(q) {
  return (
    "✈️ Please confirm your one-way flight:\n\n" +
    `From: ${q.origin.cityName}\n` +
    `To: ${q.destination.cityName}\n` +
    `Date: ${q.date}\n\n` +
    "Reply:\n" +
    "• Yes — to search\n" +
    "• Cancel — to stop"
  );
}

async function start(context, parsed) {
  const { from, setConversation, sendWhatsAppMessage } = context;

  // HARD INVARIANT — must have full query
  if (!parsed.origin || !parsed.destination || !parsed.date) {
    await sendWhatsAppMessage(
      from,
      "✈️ Please provide a full one-way query.\n\n" +
      "Example:\nflight from mumbai to new york on 2025-12-25"
    );
    return;
  }

  const flightQuery = {
    origin: parsed.origin,
    destination: parsed.destination,
    date: parsed.date
  };

  setConversation(from, {
    intent: "FLIGHT_SEARCH",
    flow: "ONE_WAY",
    state: "READY_TO_CONFIRM",
    flightQuery
  });

  await sendWhatsAppMessage(
    from,
    buildConfirmationMessage(flightQuery)
  );
}

async function handle(context) {
  const {
    from,
    rawText,
    conversation,
    sendWhatsAppMessage,
    setConversation,
    clearConversation
  } = context;

  const lower = (rawText || "").toLowerCase();

  if (lower === "cancel") {
    clearConversation(from);
    await sendWhatsAppMessage(from, "❌ Flight search cancelled.");
    return;
  }

  if (conversation.state === "READY_TO_CONFIRM") {
    if (lower !== "yes") {
      await sendWhatsAppMessage(
        from,
        "Please reply *Yes* to search or *Cancel*."
      );
      return;
    }

    const q = conversation.flightQuery;

    log("state_transition", {
      intent: "FLIGHT_SEARCH",
      flow: "ONE_WAY",
      state: "SEARCHING",
      user: from
    });

    const { flights } = await searchFlights({
      originLocationCode: q.origin.cityCode,
      destinationLocationCode: q.destination.cityCode,
      date: q.date
    });

    if (!Array.isArray(flights) || flights.length === 0) {
      await sendWhatsAppMessage(
        from,
        "Sorry, I couldn’t find flights for that route and date."
      );
      clearConversation(from);
      return;
    }

    const summary = flights.slice(0, 3).map((f, i) => {
      const s = f.itineraries[0].segments[0];
      return `${i + 1}. ${s.carrierCode} ${s.number} — ₹${f.price.total}`;
    }).join("\n");

    setConversation(from, {
      intent: "FLIGHT_SEARCH",
      flow: "ONE_WAY",
      state: "RESULTS",
      flightQuery: q
    });

    await sendWhatsAppMessage(
      from,
      "✈️ Flight options:\n\n" + summary
    );
  }
}

module.exports = {
  start,
  handle
};

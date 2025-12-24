const oneWayFlow = require("./oneWayFlow");
const roundTripFlow = require("./roundTripFlow");
const multiCityFlow = require("./multiCityFlow");
const { parseFlightQuery } = require("../../services/flightParser");

function canHandle(text, context) {
  if (!text) return false;

  // Any ongoing flight flow
  if (context?.conversation?.intent === "FLIGHT_SEARCH") {
    return true;
  }

  // New flight-related message
  return text.toLowerCase().includes("flight");
}

async function canHandle(text, context) {
  if (!text) return false;
  if (text.toLowerCase().includes("flight")) return true;
  if (context?.conversation?.intent === "FLIGHT_SEARCH") return true;
  return false;
}

async function handle(context) {
  const { text, conversation, sendWhatsAppMessage, from } = context;
  const lower = (text || "").toLowerCase();

  // 1️⃣ Continue existing flow
  if (conversation?.flow === "ONE_WAY") {
    return oneWayFlow.handle(context);
  }
  if (conversation?.flow === "ROUND_TRIP") {
    return roundTripFlow.handle(context);
  }
  if (conversation?.flow === "MULTI_CITY") {
    return multiCityFlow.handle(context);
  }

  // 2️⃣ Ignore non-flight small talk
  if (!lower.includes("flight")) {
    await sendWhatsAppMessage(
      from,
      "✈️ Hi! I am Jank.ai. I can help you with flights.\n\n" +
      "Try:\nflight from mumbai to new york on 2025-12-25"
    );
    return;
  }

  // 3️⃣ ONLY NOW parse flight query
  let parsed;
  try {
    parsed = await parseFlightQuery(text);
  } catch (err) {
    await sendWhatsAppMessage(
      from,
      "✈️ I couldn’t understand that flight request.\n\n" +
      "Try:\nflight from mumbai to new york on 2025-12-25"
    );
    return;
  }

  // 4️⃣ Route by trip type
  switch (parsed?.tripType) {
    case "ONE_WAY":
      return oneWayFlow.start(context, parsed);

    case "ROUND_TRIP":
      return roundTripFlow.start(context, parsed);

    case "MULTI_CITY":
      return multiCityFlow.start(context, parsed);

    default:
      await sendWhatsAppMessage(
        from,
        "✈️ I can help with:\n" +
        "• One-way flights\n" +
        "• Round-trip flights\n" +
        "• Multi-city trips"
      );
      return;
  }
}
module.exports = {
  canHandle,
  handle
};

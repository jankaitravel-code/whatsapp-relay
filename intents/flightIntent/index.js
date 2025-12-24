const oneWayFlow = require("./oneWayFlow");
const roundTripFlow = require("./roundTripFlow");
const multiCityFlow = require("./multiCityFlow");
const { parseFlightQuery } = require("../../services/flightParser");

async function canHandle(text, context) {
  if (!text) return false;
  if (text.toLowerCase().includes("flight")) return true;
  if (context?.conversation?.intent === "FLIGHT_SEARCH") return true;
  return false;
}

async function handle(context) {
  const { text, conversation, sendWhatsAppMessage } = context;

  // Existing flow → continue
  if (conversation?.flow === "ONE_WAY") {
    return oneWayFlow.handle(context);
  }
  if (conversation?.flow === "ROUND_TRIP") {
    return roundTripFlow.handle(context);
  }
  if (conversation?.flow === "MULTI_CITY") {
    return multiCityFlow.handle(context);
  }

  // New message → detect trip type
  const parsed = await parseFlightQuery(text);

  if (!parsed?.tripType) {
    await sendWhatsAppMessage(
      context.from,
      "✈️ I can help with flights.\n\n" +
      "Reply:\n" +
      "1️⃣ One-way flight\n" +
      "2️⃣ Round-trip flight\n" +
      "3️⃣ Multi-city trip"
    );
    return;
  }

  switch (parsed.tripType) {
    case "ONE_WAY":
      return oneWayFlow.start(context, parsed);

    case "ROUND_TRIP":
      return roundTripFlow.start(context, parsed);

    case "MULTI_CITY":
      return multiCityFlow.start(context, parsed);

    default:
      await sendWhatsAppMessage(
        context.from,
        "✈️ I can help with flights. Please try again."
      );
  }
}

module.exports = {
  canHandle,
  handle
};

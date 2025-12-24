const oneWayFlow = require("./oneWayFlow");
const roundTripFlow = require("./roundTripFlow");
const multiCityFlow = require("./multiCityFlow");

function canHandle(text, context) {
  if (!text) return false;

  const lower = text.toLowerCase();

  if (lower === "flights" || lower === "flight") return true;
  if (["1", "2", "3"].includes(lower)) return true;

  if (context?.conversation?.intent === "FLIGHT_SEARCH") return true;

  return false;
}

async function handle(context) {
  const { text, conversation } = context;
  const lower = text.toLowerCase();

  /* ===============================
     CONTINUE ACTIVE FLOW
  =============================== */
  if (conversation?.intent === "FLIGHT_SEARCH") {
    if (conversation.flow === "ONE_WAY") {
      const handled = await oneWayFlow.handle(context);
      if (handled) return;
    }

    if (conversation.flow === "ROUND_TRIP") {
      const handled = await roundTripFlow.handle(context);
      if (handled) return;
    }

    if (conversation.flow === "MULTI_CITY") {
      const handled = await multiCityFlow.handle(context);
      if (handled) return;
    }
  }

  /* ===============================
     FLOW SELECTION
  =============================== */
  if (!conversation) {
    if (lower === "1") return oneWayFlow.start(context);
    if (lower === "2") return roundTripFlow.start(context);
    if (lower === "3") return multiCityFlow.start(context);
  }

  if (lower === "flights" || lower === "flight") {
    await context.sendWhatsAppMessage(
      context.from,
      "✈️ You have selected flights.\n\n" +
        "Say:\n" +
        "1️⃣ for One-way\n" +
        "2️⃣ for Round-trip\n" +
        "3️⃣ for Multi-city"
    );
    return;
  }

  /* ===============================
     FALLBACK
  =============================== */
  await context.sendWhatsAppMessage(
    context.from,
    "Please choose:\n1️⃣ for One-way\n2️⃣ for Round-trip\n3️⃣ for Multi-city"
  );
}

module.exports = {
  canHandle,
  handle
};

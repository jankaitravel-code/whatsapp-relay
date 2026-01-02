// ⚠️ INVARIANT: Only ONE layer may own user input at a time.
// Router → Intent → Flow → Booking (strict handoff, no overlap)



const oneWayFlow = require("./oneWayFlow");
const roundTripFlow = require("./roundTripFlow");
const multiCityFlow = require("./multiCityFlow");
const oneWayBookingFlow = require("./oneWayBookingFlow");

function canHandle(text, context) {
  // 🔒 Intent router ONLY passes `text`
  if (typeof text !== "string") return false;

  const input = text.trim();
  if (!input) return false;

  const lower = input.toLowerCase();

  // Explicit entry
  if (lower === "flights" || lower === "flight") return true;

  if (
    ["oneway", "roundtrip", "multicity"].includes(lower) &&
    context?.conversation?.intent === "FLIGHT_MENU"
  ) {
    return true;
  }

  // ❌ Booking owns input — flightIntent must disappear
  if (context?.conversation?.intent === "FLIGHT_BOOKING") {
    return false;
  }

  // Continue active flight flows
  if (
    context?.conversation?.intent === "FLIGHT_SEARCH" ||
    context?.conversation?.intent === "FLIGHT_MENU"
  ) {
    return true;
  }

  return false;
}

async function handle(context) {
 const { text, rawText, conversation } = context;
  const input =
    typeof text === "string" && text.trim().length > 0
      ? text
      : rawText;
  
  if (!input) return;
  
  const lower = input.toLowerCase();


  /* ===============================
   BOOKING FLOW (HIGHEST PRIORITY)
  =============================== */
  if (conversation?.intent === "FLIGHT_BOOKING") {
    await oneWayBookingFlow.handle(context);
    return; // 🔒 HARD STOP — booking owns input
  }

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
    if (lower === "oneway") return oneWayFlow.start(context);
    if (lower === "roundtrip") return roundTripFlow.start(context);
    if (lower === "multicity") return multiCityFlow.start(context);
  }

  if (lower === "flights" || lower === "flight") {
    context.setConversation(context.from, {
      intent: "FLIGHT_MENU",
      state: "MENU"
    });
  
    await context.sendWhatsAppMessage(
      context.from,
      "✈️ You have selected flights.\n\n" +
        "Reply:\n" +
        "➡️ oneway\n" +
        "➡️ roundtrip\n" +
        "➡️ multicity"
    );
    return;
  }

  if (
    conversation?.intent === "FLIGHT_MENU" &&
    conversation.state === "MENU"
  ) {
    if (lower === "oneway") return oneWayFlow.start(context);
    if (lower === "roundtrip") return roundTripFlow.start(context);
    if (lower === "multicity") return multiCityFlow.start(context);
  
    // 🔒 Invalid input → repeat same menu
    await context.sendWhatsAppMessage(
      context.from,
      "✈️ Flights menu\n\n" +
        "Reply:\n" +
        "➡️ oneway\n" +
        "➡️ roundtrip\n" +
        "➡️ multicity"
    );
    return;
  }

  /* ===============================
     FALLBACK
  =============================== */
  
  // 🔒 If a search flow is active, do NOT show menu fallback

  if (
    conversation?.intent === "FLIGHT_SEARCH" ||
    conversation?.intent === "FLIGHT_BOOKING"
  ) {
    return;
  }
  
  await context.sendWhatsAppMessage(
    context.from,
    "✈️ Flights menu\n\n" +
      "Reply:\n" +
      "➡️ oneway\n" +
      "➡️ roundtrip\n" +
      "➡️ multicity"
  );
  }

module.exports = {
  canHandle,
  handle
};

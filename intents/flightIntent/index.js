const oneWayFlow = require("./oneWayFlow");


function canHandle(text, context) {
  if (!text) return false;

  if (context?.conversation?.intent === "FLIGHT_SEARCH") {
    return true;
  }

  return text.toLowerCase().includes("flight");
}

async function handle(context) {
  const { text, rawText } = context;
  const input = (rawText || text || "").trim().toLowerCase();

  // ENTRY MENU
  if (input === "1") {
    return oneWayFlow.start(context);
  }

  if (input === "2") {
    await context.sendWhatsAppMessage(
      context.from,
      "🚧 Round-trip is coming soon.\n\nReply *1* for one-way."
    );
    return;
  }

  if (input === "3") {
    await context.sendWhatsAppMessage(
      context.from,
      "🚧 Multi-city is coming soon.\n\nReply *1* for one-way."
    );
    return;
  }

  // Default welcome
  await context.sendWhatsAppMessage(
    context.from,
    "✈️ You have selected flights.\n\n" +
    "Say:\n" +
    "• 1 for One-way\n" +
    "• 2 for Round-trip\n" +
    "• 3 for Multi-city"
  );
}

module.exports = {
  canHandle,
  handle
};

function canHandle(text, context) {
  if (!text) return false;

  if (context?.conversation?.intent === "FLIGHT_SEARCH") {
    return true;
  }

  return text.toLowerCase().includes("flight");
}

async function handle(context) {
  const { sendWhatsAppMessage } = context;

  await sendWhatsAppMessage(
    context.from,
    "✈️ Say:\n" +
    "• 1 — One-way flight\n" +
    "• 2 — Round-trip (coming soon)\n" +
    "• 3 — Multi-city (coming soon)"
  );
}

module.exports = {
  canHandle,
  handle
};

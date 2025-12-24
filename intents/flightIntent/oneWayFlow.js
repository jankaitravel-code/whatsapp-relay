// intents/flightIntent/oneWayFlow.js

async function start(context) {
  const { from, setConversation, sendWhatsAppMessage } = context;

  setConversation(from, {
    intent: "FLIGHT_SEARCH",
    flow: "ONE_WAY",
    state: "ASK_ROUTE"
  });

  await sendWhatsAppMessage(
    from,
    "✈️ One-way flight selected.\n\nPlease tell me your route.\nExample:\nflight from mumbai to new york on 2025-12-25"
  );
}

async function handle(context) {
  const { conversation, sendWhatsAppMessage } = context;

  // TEMP — we’ll expand this next
  if (conversation.state === "ASK_ROUTE") {
    await sendWhatsAppMessage(
      context.from,
      "✅ Route received. (Parsing comes next)"
    );
    return true;
  }

  return false;
}

module.exports = {
  start,
  handle
};

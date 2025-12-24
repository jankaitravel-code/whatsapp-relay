async function start(context) {
  const {
    from,
    sendWhatsAppMessage,
    setConversation
  } = context;

  // Initialize one-way flow
  setConversation(from, {
    intent: "FLIGHT_SEARCH",
    flow: "ONE_WAY",
    state: "AWAITING_ROUTE"
  });

  await sendWhatsAppMessage(
    from,
    "✈️ One-way flight selected.\n\n" +
    "Please tell me your route.\n\n" +
    "Example:\n" +
    "flight from mumbai to new york on 2025-12-25"
  );
}

module.exports = {
  start
};

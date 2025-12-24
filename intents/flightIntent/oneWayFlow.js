async function handle(context) {
  const { text, conversation, from, sendWhatsAppMessage } = context;

  // We only handle our own flow
  if (conversation?.flow !== "ONE_WAY") return false;

  if (conversation.state === "AWAITING_ROUTE") {
    await sendWhatsAppMessage(
      from,
      "✅ Got it.\n\nNow I’ll parse this route next."
    );

    // TEMP: stop here for now
    return true;
  }

  return false;
}

module.exports = {
  start
};

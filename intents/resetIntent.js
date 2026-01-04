/**
 * Reset Intent
 * Handles cancel / reset / start over commands
 */

function canHandle(text, context) {
  const normalized = text.trim().toLowerCase();

  // 🔒 Do not interrupt booking
  if (context?.conversation?.intent === "FLIGHT_BOOKING") {
    return false;
  }

  return normalized === "reset" || normalized === "restart";
}

async function handle({ from, sendWhatsAppMessage, clearConversation }) {
  clearConversation(from);

  await sendWhatsAppMessage(
    from,
    "✅ All set. Let’s start fresh.\n\n" +
    "You can reply: Flights"
  );
}

module.exports = {
  canHandle,
  handle
};

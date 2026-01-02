/**
 * Reset Intent
 * Handles cancel / reset / start over commands
 */

function canHandle(text) {
  if (context?.conversation?.intent === "FLIGHT_BOOKING") {
    return false; // 🔒 booking owns cancel
  }
  
  const normalized = text.trim().toLowerCase();

  return (
    normalized === "reset" ||
    normalized === "New Search" ||
    normalized === "Restart" ||
    normalized === "start over"
  );
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

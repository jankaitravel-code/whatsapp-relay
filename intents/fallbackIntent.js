/**
 * Fallback Intent
 * Runs only when no other intent matches
 */

async function handle({ from, sendWhatsAppMessage, conversation }) {
  // 🔒 Absolute silence during booking
  if (conversation?.intent === "FLIGHT_BOOKING") {
    return;
  }

  await sendWhatsAppMessage(
    from,
    "I can help with flights ✈️\n\n" +
    "Try replying:\nflights"
  );
}
module.exports = {
  handle
};

/**
 * Fallback Intent
 * Runs only when no other intent matches
 */

async function handle({ from, sendWhatsAppMessage }) {
  await sendWhatsAppMessage(
    from,
    "I can help with flights ✈️\n\n" +
    "Try saying:\nflights"
  );
}

module.exports = {
  handle
};

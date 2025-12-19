/**
 * Fallback Intent
 * Runs only when no other intent matches
 */

async function handle({ from, sendWhatsAppMessage }) {
  await sendWhatsAppMessage(
    from,
    "I can help with flights ✈️\n\n" +
    "Try:\nflight from bengaluru to mumbai on 2025-12-25"
  );
}

module.exports = {
  handle
};

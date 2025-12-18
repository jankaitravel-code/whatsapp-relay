/**
 * Fallback Intent
 * Runs only when no other intent matches
 */

async function handle({ from, sendWhatsAppMessage }) {
  await sendWhatsAppMessage(
    from,
    "I can help with flights ✈️\n\n" +
    "Try:\nflight DEL to DXB on 2025-12-25"
  );
}

module.exports = {
  handle
};

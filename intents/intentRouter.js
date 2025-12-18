/**
 * Intent Router
 * Decides which intent handler should process the message
 */

const resetIntent = require("./resetIntent");
const greetingIntent = require("./greetingIntent");
const flightIntent = require("./flightIntent");
const fallbackIntent = require("./fallbackIntent");

async function routeIntent(context) {
  const { text } = context;

  // 1️⃣ Reset has highest priority
  if (resetIntent.canHandle(text)) {
    await resetIntent.handle(context);
    return;
  }

  // 2️⃣ Flight intent (full or partial)
  if (flightIntent.canHandle(text, context)) {
    await flightIntent.handle(context);
    return;
  }

  // 3️⃣ Greeting intent
  if (greetingIntent.canHandle(text)) {
    await greetingIntent.handle(context);
    return;
  }

  // 4️⃣ Fallback (always last)
  await fallbackIntent.handle(context);
}

module.exports = {
  routeIntent
};

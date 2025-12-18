/**
 * Intent Router
 * Decides which intent handler should process the message
 */

const handleResetIntent = require("./resetIntent");
const handleGreetingIntent = require("./greetingIntent");
const handleFlightIntent = require("./flightIntent");
const handleFallbackIntent = require("./fallbackIntent");
async function routeIntent(context) {
  const { text } = context;

  // 🔁 If we are mid-conversation, let server.js handle it
  if (conversation?.awaiting) {
    return false;
  }

  if (handleResetIntent.canHandle(text)) {
    await handleResetIntent.handle(context);
    return true;
  }

  if (handleGreetingIntent.canHandle(text)) {
    await handleGreetingIntent.handle(context);
    return true;
  }

  if (handleFlightIntent.canHandle(text)) {
    // Let server.js handle flight logic
    return false;
  }

  await handleFallbackIntent.handle(context);
  return true;
}

module.exports = {
  routeIntent
};

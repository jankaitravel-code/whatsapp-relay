/**
 * Intent Router
 * Decides which intent handler should process the message
 */

// ⚠️ INVARIANT: Only ONE layer may own user input at a time.
// Router → Intent → Flow → Booking (strict handoff, no overlap)


const resetIntent = require("./resetIntent");
const greetingIntent = require("./greetingIntent");
const flightIntent = require("./flightIntent/index");
const fallbackIntent = require("./fallbackIntent");
const { log } = require("../utils/logger");

async function routeIntent(context) {
  const { text, conversation } = context;

  /* 🔒 ABSOLUTE BOOKING LOCK — MUST BE FIRST */
  if (conversation?.intent === "FLIGHT_BOOKING") {
    log("intent_routed", {
      intent: "FLIGHT_BOOKING",
      user: context.from,
      requestId: context.requestContext?.requestId
    });

    await flightIntent.handle(context);
    return;
  }

  // 1️⃣ Reset
  if (resetIntent.canHandle(text)) {
    log("intent_routed", {
      intent: "RESET",
      user: context.from,
      requestId: context.requestContext?.requestId
    });

    await resetIntent.handle(context);
    return;
  }

  // 2️⃣ Flight intent (search/menu only)
  if (flightIntent.canHandle(text, context)) {
    log("intent_routed", {
      intent: conversation?.intent || "FLIGHT_SEARCH",
      user: context.from,
      requestId: context.requestContext?.requestId
    });

    await flightIntent.handle(context);
    return;
  }

  // 3️⃣ Greeting intent
  if (greetingIntent.canHandle(text)) {
    log("intent_routed", {
      intent: "GREETING",
      user: context.from,
      requestId: context.requestContext?.requestId
    });

    await greetingIntent.handle(context);
    return;
  }

  // 4️⃣ Fallback (always last)
  log("intent_fallback", {
    user: context.from,
    requestId: context.requestContext?.requestId
  });

  await fallbackIntent.handle(context);
}

module.exports = {
  routeIntent
};

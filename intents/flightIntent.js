/**
 * Flight Intent
 * Handles all flight-related messages and conversation continuation
 * Production-safe with explicit confirmation (Step 7.2.4)
 */

const { parseFlightQuery } = require("../services/flightParser");
const { searchFlights } = require("../services/flightSearchService");

function canHandle(text, context) {
  if (!text) return false;

  if (text.toLowerCase().includes("flight")) return true;

  if (context?.conversation?.intent === "FLIGHT_SEARCH") return true;

  return false;
}

function isQueryComplete(q) {
  return Boolean(q?.origin && q?.destination && q?.date);
}

function buildConfirmationMessage(q) {
  return (
    `✈️ Please confirm your flight search:\n\n` +
    `From: ${q.origin.cityName}\n` +
    `To: ${q.destination.cityName}\n` +
    `Date: ${q.date}\n\n` +
    `Reply:\n` +
    `• Yes — to search\n` +
    `• Change — to modify\n` +
    `• Cancel — to stop`
  );
}

async function handle(context) {
  const {
    from,
    text,
    rawText,
    conversation,
    sendWhatsAppMessage,
    setConversation,
    clearConversation
  } = context;

  const lower = rawText.toLowerCase();

  /* ===============================
     GLOBAL CANCEL (always allowed)
  =============================== */
  if (lower === "cancel") {
    clearConversation(from);
    await sendWhatsAppMessage(from, "❌ Flight search cancelled.");
    return;
  }

       /* ===============================
       DATE-ONLY INPUT (COLLECTING)
    =============================== */
  if (
    conversation?.state === "COLLECTING" &&
    conversation.flightQuery &&
    !conversation.flightQuery.date
  ) {
    const dateMatch = rawText.match(/^\d{4}-\d{2}-\d{2}$/);

    if (!dateMatch) {
      await sendWhatsAppMessage(
        from,
        "📅 Please provide the date in YYYY-MM-DD format."
      );
      return;
    }

    const updatedQuery = {
      ...conversation.flightQuery,
      date: dateMatch[0]
    };

    setConversation(from, {
      intent: "FLIGHT_SEARCH",
      state: "READY_TO_CONFIRM",
      flightQuery: updatedQuery
    });

    await sendWhatsAppMessage(
      from,
      buildConfirmationMessage(updatedQuery)
    );
    return;
  }
 
  /* ===============================
     READY_TO_CONFIRM STATE
  =============================== */
  if (conversation?.state === "READY_TO_CONFIRM") {
    if (lower === "yes") {
      const locked = { ...conversation.flightQuery };

      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        state: "SEARCHING",
        lockedFlightQuery: locked
      });

      // 🔥 IMMEDIATELY execute search
      const flights = await searchFlights({
        originLocationCode: locked.origin.cityCode,
        destinationLocationCode: locked.destination.cityCode,
        date: locked.date
      });

      if (!flights || flights.length === 0) {
        await sendWhatsAppMessage(
          from,
          "Sorry, I couldn’t find flights for that route and date."
        );
        return;
      }

      const reply = flights
        .slice(0, 5)
        .map((f, i) => {
          const s = f.itineraries[0].segments[0];
          return `${i + 1}. ${s.carrierCode} ${s.number} – ₹${f.price.total}`;
        })
        .join("\n");

      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        state: "RESULTS",
        lockedFlightQuery: locked
      });

      await sendWhatsAppMessage(
        from,
        `✈️ Here are your flight options:\n\n${reply}`
      );
      return;
    } else if (lower === "change") {
      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        state: "COLLECTING",
        flightQuery: { ...conversation.flightQuery }
      });
      await sendWhatsAppMessage(
        from,
        "✏️ Okay, what would you like to change?"
      );
      return;
    } else {
      await sendWhatsAppMessage(
        from,
        "Please reply with *Yes*, *Change*, or *Cancel*."
      );
      return;
    }
  }

  /* ===============================
     COLLECT / PARSE INPUT
  =============================== */
  if (lower.startsWith("flight")) {
    const parsed = await parseFlightQuery(text);

    if (parsed?.error === "UNKNOWN_LOCATION") {
      await sendWhatsAppMessage(
        from,
        "❌ I couldn’t recognize one of the locations.\nPlease try a major city or airport."
      );
      return;
    }

    if (!parsed) {
      await sendWhatsAppMessage(
        from,
        "✈️ Try:\nflight from delhi to mumbai on 2025-12-25"
      );
      return;
    }

    flightQuery = {
      origin: parsed.origin,
      destination: parsed.destination,
      date: parsed.date || null
    };

    // Always set base state
    setConversation(from, {
      intent: "FLIGHT_SEARCH",
      state: "COLLECTING",
      flightQuery
    });

    // 🔴 SCENARIO 2 FIX — ASK FOR DATE IMMEDIATELY
    if (!flightQuery.date) {
      await sendWhatsAppMessage(
        from,
        "📅 What date would you like to travel? (YYYY-MM-DD)"
      );
      return;
    }

    // Full query → confirmation
    setConversation(from, {
      intent: "FLIGHT_SEARCH",
      state: "READY_TO_CONFIRM",
      flightQuery
    });

    await sendWhatsAppMessage(
      from,
      buildConfirmationMessage(flightQuery)
    );
    return;
  }
  /* ===============================
     EXECUTE SEARCH (CONFIRMED ONLY)
  =============================== */
  if (conversation?.state === "SEARCHING") {
    const q = conversation.lockedFlightQuery;

    const flights = await searchFlights({
      originLocationCode: q.origin.cityCode,
      destinationLocationCode: q.destination.cityCode,
      date: q.date
    });

    if (!flights || flights.length === 0) {
      await sendWhatsAppMessage(
        from,
        "Sorry, I couldn’t find flights for that route and date."
      );
      return;
    }

    const reply = flights
      .slice(0, 5)
      .map((f, i) => {
        const s = f.itineraries[0].segments[0];
        return `${i + 1}. ${s.carrierCode} ${s.number} - ₹${f.price.total}`;
      })
      .join("\n");

    setConversation(from, {
      ...conversation,
      state: "RESULTS"
    });

    await sendWhatsAppMessage(
      from,
      `✈️ Here are your flight options:\n\n${reply}`
    );
  }
}

module.exports = {
  canHandle,
  handle
};

/**
 * Flight Intent
 * Handles all flight-related messages and conversation continuation
 * Production-safe with explicit confirmation (Step 7.2.4)
 */

const { parseFlightQuery } = require("../services/flightParser");
const { searchFlights } = require("../services/flightSearchService");
const { log } = require("../utils/logger");
const { recordSignal } = require("../utils/abuseSignals");

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";

  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatDuration(isoDuration) {
  if (!isoDuration || typeof isoDuration !== "string") {
    return "—";
  }

  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return "—";

  const h = match[1] || "0";
  const m = match[2] || "0";
  return `${h}h ${m}m`;
}

function safeFlightSummary(f, index) {
  const itinerary = f.itineraries?.[0];
  const segments = itinerary?.segments || [];

  if (!itinerary || segments.length === 0) {
    return `${index}. Flight details unavailable`;
  }

  const first = segments[0];
  const last = segments[segments.length - 1];

  const depTime = formatTime(first.departure?.at);
  const arrTime = formatTime(last.arrival?.at);
  const duration = formatDuration(itinerary.duration);

  const stops = segments.length - 1;
  const stopLabel = stops === 0 ? "Non-stop" : `${stops} stop${stops > 1 ? "s" : ""}`;

  const price = f.price?.total ? `₹${f.price.total}` : "Price unavailable";

  return (
    `${index}. ${first.carrierCode} ${first.number} — ${price}\n` +
    `   ${first.departure.iataCode} ${depTime} → ${last.arrival.iataCode} ${arrTime}\n` +
    `   ${stopLabel} • ${duration}`
  );
}

function getAirlineName(carrierCode, carriersDict) {
  // Absolute safety first
  if (!carrierCode || typeof carrierCode !== "string") {
    return "Unknown Airline";
  }

  // If Amadeus carriers dictionary is missing or invalid
  if (!carriersDict || typeof carriersDict !== "object") {
    return carrierCode;
  }

  // Happy path
  return carriersDict[carrierCode] || carrierCode;
}


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
    recordSignal("flight_cancelled", {
      user: from,
      requestId: context.requestContext?.requestId
    });

    clearConversation(from);

    log("state_transition", {
      intent: "FLIGHT_SEARCH",
      state: "CANCELLED",
      user: from,
      requestId: context.requestContext?.requestId
    });
    
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

    log("state_transition", {
      intent: "FLIGHT_SEARCH",
      state: "READY_TO_CONFIRM",
      user: from,
      requestId: context.requestContext?.requestId
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

      log("state_transition", {
        intent: "FLIGHT_SEARCH",
        state: "SEARCHING",
        user: from,
        requestId: context.requestContext?.requestId
      });

      // 🔥 IMMEDIATELY execute search
      recordSignal("flight_search_executed", {
        origin: locked.origin.cityCode,
        destination: locked.destination.cityCode,
        date: locked.date,
        user: from,
        requestId: context.requestContext?.requestId
      });

      const { flights, carriers } = await searchFlights({
        originLocationCode: locked.origin.cityCode,
        destinationLocationCode: locked.destination.cityCode,
        date: locked.date
      });

      if (!Array.isArray(flights)) {
        log("flight_search_invalid_response", {
          user: from,
          type: typeof flights,
          requestId: context.requestContext?.requestId
        });
      
        await sendWhatsAppMessage(
          from,
          "⚠️ I’m having trouble fetching flights right now. Please try again in a moment."
        );
        return;
      }
      
      console.log("🧪 searchFlights raw return:", flights);
      console.log("🧪 typeof flights:", typeof flights);
      
      if (!flights || flights.length === 0) {
        await sendWhatsAppMessage(
          from,
          "Sorry, I couldn’t find flights for that route and date."
        );
        return;
      }

      const sortedFlights = flights
        .filter(f => f.itineraries?.[0]?.segments?.[0]?.departure?.at)
        .sort((a, b) => {
          const aTime = new Date(a.itineraries[0].segments[0].departure.at).getTime();
          const bTime = new Date(b.itineraries[0].segments[0].departure.at).getTime();
          return aTime - bTime; // earliest first
        });

      if (sortedFlights.length === 0) {
        await sendWhatsAppMessage(
          from,
          "Sorry, I couldn’t find reliable flight options for that route and date."
        );
        return;
      }
      
      const reply = sortedFlights
        .slice(0, 5)
        .map((f, i) => {
          const itinerary = f.itineraries?.[0];
          const segments = itinerary?.segments;
      
          if (!itinerary || !segments || segments.length === 0) {
            return `${i + 1}. Flight details unavailable`;
          }
      
          const first = segments[0];

          const airlineName = getAirlineName(first.carrierCode, carriers);

          const last = segments[segments.length - 1];
      
          const depTime = formatTime(first.departure.at);
          const arrTime = formatTime(last.arrival.at);
          const duration = formatDuration(itinerary.duration);
      
          const stopsCount = segments.length - 1;
          const stopsLabel =
            stopsCount === 0 ? "Non-stop" :
            stopsCount === 1 ? "1 stop" :
            `${stopsCount} stops`;
      
          return (
            `${i + 1}. ${airlineName} (${first.carrierCode} ${first.number}) — ₹${f.price.total}\n` +
            `   ${first.departure.iataCode} ${depTime} → ${last.arrival.iataCode} ${arrTime}\n` +
            `   ${duration} · ${stopsLabel}`
          );
        })
        .join("\n\n");
      

      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        state: "RESULTS",
        lockedFlightQuery: locked
      });

      log("state_transition", {
        intent: "FLIGHT_SEARCH",
        state: "RESULTS",
        user: from,
        requestId: context.requestContext?.requestId
      });

      await sendWhatsAppMessage(
        from,
        `✈️ Here are your flight options:\n\n${reply}`
      );
      return;
    } else if (lower === "change") {
      recordSignal("flight_state_change", {
        fromState: "READY_TO_CONFIRM",
        toState: "COLLECTING",
        user: from,
        requestId: context.requestContext?.requestId
      });

      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        state: "COLLECTING",
        flightQuery: { ...conversation.flightQuery }
      });

      log("state_transition", {
        intent: "FLIGHT_SEARCH",
        state: "COLLECTING",
        user: from,
        requestId: context.requestContext?.requestId
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
      recordSignal("flight_invalid_location", {
        user: from,
        inputLength: rawText.length,
        requestId: context.requestContext?.requestId
      });
      
      await sendWhatsAppMessage(
        from,
        "❌ I couldn’t recognize one of the locations.\nPlease try a major city or airport."
      );
      return;
    }

    if (!parsed) {
      recordSignal("flight_unparseable_query", {
        user: from,
        inputLength: rawText.length,
        requestId: context.requestContext?.requestId
      });

      await sendWhatsAppMessage(
        from,
        "✈️ Try:\nflight from delhi to mumbai on 2025-12-25"
      );
      return;
    }

    const flightQuery = {
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

    log("state_transition", {
      intent: "FLIGHT_SEARCH",
      state: "COLLECTING",
      user: from,
      requestId: context.requestContext?.requestId
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

    log("state_transition", {
      intent: "FLIGHT_SEARCH",
      state: "READY_TO_CONFIRM",
      user: from,
      requestId: context.requestContext?.requestId
    });

    await sendWhatsAppMessage(
      from,
      buildConfirmationMessage(flightQuery)
    );
    return;
  }
}

module.exports = {
  canHandle,
  handle
};



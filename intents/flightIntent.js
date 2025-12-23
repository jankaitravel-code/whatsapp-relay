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
  const returnLine = q.returnDate
    ? `Return: ${q.returnDate}\n`
    : "";

  return (
    `✈️ Please confirm your flight search:\n\n` +
    `From: ${q.origin.cityName}\n` +
    `To: ${q.destination.cityName}\n` +
    `Departure: ${q.date}\n` +
    returnLine + `\n` +
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
     RESULTS → CHANGE INTENT
  =============================== */
  if (conversation?.state === "RESULTS") {
    if (lower === "change date") {
      setConversation(from, {
        ...conversation,
        state: "RESULTS_CHANGE",
        changeTarget: "date"
      });

      await sendWhatsAppMessage(
        from,
        "📅 What is the new travel date? (YYYY-MM-DD)"
      );
      return;
    }

    if (lower === "change destination") {
      setConversation(from, {
        ...conversation,
        state: "RESULTS_CHANGE",
        changeTarget: "destination"
      });

      await sendWhatsAppMessage(
        from,
        "📍 What is the new destination city?"
      );
      return;
    }

    if (lower === "change origin") {
      setConversation(from, {
        ...conversation,
        state: "RESULTS_CHANGE",
        changeTarget: "origin"
      });

      await sendWhatsAppMessage(
        from,
        "📍 What is the new origin city?"
      );
      return;
    }
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
     RESULTS_CHANGE → APPLY UPDATE
  =============================== */
  if (conversation?.state === "RESULTS_CHANGE") {
    const target = conversation.changeTarget;

    // Defensive fallback
    if (!target || !conversation.lockedFlightQuery) {
      await sendWhatsAppMessage(
        from,
        "⚠️ Something went wrong. Please say what you'd like to change again."
      );
      return;
    }

    const updatedQuery = { ...conversation.lockedFlightQuery };

    if (target === "date") {
      const dateMatch = rawText.match(/^\d{4}-\d{2}-\d{2}$/);

      if (!dateMatch) {
        await sendWhatsAppMessage(
          from,
          "📅 Please provide the date in YYYY-MM-DD format."
        );
        return;
      }

      updatedQuery.date = dateMatch[0];
    }

    if (target === "origin") {
      const parsed = await parseFlightQuery(
        `flight from ${rawText.trim()} to ${updatedQuery.destination.cityName}`
      );
    
      if (!parsed?.origin) {
        await sendWhatsAppMessage(
          from,
          "📍 I couldn’t recognize that city. Please try a major city or airport."
        );
        return;
      }
    
      updatedQuery.origin = parsed.origin;
    }

    if (target === "destination") {
      const parsed = await parseFlightQuery(
        `flight from ${updatedQuery.origin.cityName} to ${rawText.trim()}`
      );
    
      if (!parsed?.destination) {
        await sendWhatsAppMessage(
          from,
          "📍 I couldn’t recognize that city. Please try a major city or airport."
        );
        return;
      }
    
      updatedQuery.destination = parsed.destination;
    }

    setConversation(from, {
      intent: "FLIGHT_SEARCH",
      state: "RESULTS",
      lockedFlightQuery: updatedQuery,
      changeTarget: null,
      results: null
    });

    await sendWhatsAppMessage(
      from,
      `✅ Updated ${target}.

You can:
• Say "run search" to run again
• Change date
• Change origin
• Change destination`
    );
    return;
  }

    /* ===============================
     RESULTS → RUN SEARCH (EXPLICIT)
  =============================== */
  if (
    conversation?.state === "RESULTS" &&
    lower === "run search"
  ) {
    const locked = conversation.lockedFlightQuery;
    const last = conversation.lastExecutedSearch;
    const results = conversation.results;

    // If parameters are identical AND we have cached results → reprint page 1
    if (
      last &&
      results &&
      locked &&
      last.originCode === locked.origin.cityCode &&
      last.destinationCode === locked.destination.cityCode &&
      last.date === locked.date &&
      last.returnDate === locked.returnDate
    ) {
      // 🔒 Refinement 2: defensive check
      if (!Array.isArray(results.items) || results.items.length === 0) {
        await sendWhatsAppMessage(
          from,
          "⚠️ I don’t have previous results to show. Please run the search again."
        );
        return;
      }
    
      const PAGE_SIZE = results.pageSize || 3;
    
      const firstPage = results.items
        .slice(0, PAGE_SIZE)
        .join("\n\n");
    
      // 🔒 Refinement 1: explicitly preserve lastExecutedSearch
      setConversation(from, {
        ...conversation,
        lastExecutedSearch: last,
        results: {
          ...results,
          cursor: PAGE_SIZE
        }
      });

      await sendWhatsAppMessage(
        from,
        `${locked.returnDate ? "✈️ Round-trip flight options" : "✈️ Flight options"}
        
        From: ${locked.origin.cityName}
        To: ${locked.destination.cityName}
        Departure: ${locked.date}${locked.returnDate ? `\nReturn: ${locked.returnDate}` : ""}
        
        ${firstPage}
        
      You can:
      • show more
      • change date / origin / destination
      • run search`
      );
      return;
    }
     
    if (!locked?.origin || !locked?.destination || !locked?.date) {
      await sendWhatsAppMessage(
        from,
        "⚠️ I don’t have enough details to run the search again."
      );
      return;
    }

    setConversation(from, {
      intent: "FLIGHT_SEARCH",
      state: "SEARCHING",
      lockedFlightQuery: locked,
      results: null
    });

    log("state_transition", {
      intent: "FLIGHT_SEARCH",
      state: "SEARCHING",
      user: from,
      requestId: context.requestContext?.requestId
    });

    recordSignal("flight_search_reexecuted", {
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
   
    if (!Array.isArray(flights) || flights.length === 0) {
      await sendWhatsAppMessage(
        from,
        "Sorry, I couldn’t find flights for the updated details."
      );
      return;
    }

    const formattedResults = flights.map((f, i) => {
      const itinerary = f.itineraries?.[0];
      const segments = itinerary?.segments;
    
      if (!itinerary || !segments || segments.length === 0) {
        return `${i + 1}. Flight details unavailable`;
      }
    
      const first = segments[0];
      const last = segments[segments.length - 1];
    
      const airlineName = getAirlineName(first.carrierCode, carriers);
    
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
    });

    const PAGE_SIZE = 3;
    const firstPage = formattedResults.slice(0, PAGE_SIZE).join("\n\n");

    setConversation(from, {
      intent: "FLIGHT_SEARCH",
      state: "RESULTS",
      lockedFlightQuery: locked,
      results: {
        items: formattedResults,
        cursor: PAGE_SIZE,
        pageSize: PAGE_SIZE
      }, 
      lastExecutedSearch: {
        originCode: locked.origin.cityCode,
        destinationCode: locked.destination.cityCode,
        date: locked.date,
        returnDate: locked.returnDate || null
      }
    });

    log("state_transition", {
      intent: "FLIGHT_SEARCH",
      state: "RESULTS",
      user: from,
      requestId: context.requestContext?.requestId
    });

    await sendWhatsAppMessage(
      from,
      `${locked.returnDate ? "✈️ Round-trip flight options" : "✈️ Flight options"}
      
      From: ${locked.origin.cityName}
      To: ${locked.destination.cityName}
      Departure: ${locked.date}${locked.returnDate ? `\nReturn: ${locked.returnDate}` : ""}
      
      ${firstPage}
      
    You can:
    • show more
    • change date / origin / destination
    • run search`
    );
    return;
  }

    /* ===============================
     COLLECTING → SELECT CHANGE TARGET (PRE-SEARCH)
  =============================== */
  if (
    conversation?.state === "COLLECTING" &&
    conversation.changeTarget === "PENDING"
  ) {
    if (lower === "date") {
      setConversation(from, {
        ...conversation,
        changeTarget: "date"
      });

      await sendWhatsAppMessage(
        from,
        "📅 What date would you like to travel? (YYYY-MM-DD)"
      );
      return;
    }

    if (lower === "origin") {
      setConversation(from, {
        ...conversation,
        changeTarget: "origin"
      });

      await sendWhatsAppMessage(
        from,
        "📍 What is the new origin city?"
      );
      return;
    }

    if (lower === "destination") {
      setConversation(from, {
        ...conversation,
        changeTarget: "destination"
      });

      await sendWhatsAppMessage(
        from,
        "📍 What is the new destination city?"
      );
      return;
    }

    await sendWhatsAppMessage(
      from,
      "Please reply with: Date, Origin, or Destination."
    );
    return;
  }

    /* ===============================
     COLLECTING → APPLY CHANGE (PRE-SEARCH)
  =============================== */
  if (
    conversation?.state === "COLLECTING" &&
    conversation.changeTarget &&
    conversation.changeTarget !== "PENDING"
  ) {
    const updatedQuery = { ...conversation.flightQuery };

    if (conversation.changeTarget === "date") {
      const dateMatch = rawText.match(/^\d{4}-\d{2}-\d{2}$/);

      if (!dateMatch) {
        await sendWhatsAppMessage(
          from,
          "📅 Please provide the date in YYYY-MM-DD format."
        );
        return;
      }

      updatedQuery.date = dateMatch[0];
    }

    if (conversation.changeTarget === "origin") {
      const parsed = await parseFlightQuery(
        `flight from ${rawText.trim()} to ${updatedQuery.destination?.cityName || "delhi"}`
      );
    
      if (!parsed?.origin) {
        await sendWhatsAppMessage(
          from,
          "📍 I couldn’t recognize that city.\nPlease try a major city or airport."
        );
        return;
      }
    
      updatedQuery.origin = parsed.origin;
    }
    

    if (conversation.changeTarget === "destination") {
      const parsed = await parseFlightQuery(
        `flight from ${updatedQuery.origin?.cityName || "delhi"} to ${rawText.trim()}`
      );
    
      if (!parsed?.destination) {
        await sendWhatsAppMessage(
          from,
          "📍 I couldn’t recognize that destination city.\nPlease try a major city or airport."
        );
        return;
      }
    
      updatedQuery.destination = parsed.destination;
    }

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
   RESULTS → SHOW MORE (PAGINATION)
  =============================== */
  if (
    conversation?.state === "RESULTS" &&
    lower === "show more"
  ) {
    if (conversation.lockedFlightQuery?.returnDate) {
      await sendWhatsAppMessage(
        from,
        "ℹ️ Pagination is unavailable for round-trip previews."
      );
      return;
    }
    const results = conversation.results;
  
    if (!results || !Array.isArray(results.items)) {
      await sendWhatsAppMessage(
        from,
        "⚠️ That's all the results I have for this search."
      );
      return;
    }
  
    const { items, cursor, pageSize } = results;
  
    if (cursor >= items.length) {
      await sendWhatsAppMessage(
        from,
        "⚠️ That's all the results I have for this search."
      );
      return;
    }
  
    const nextPage = items
      .slice(cursor, cursor + pageSize)
      .join("\n\n");
  
    setConversation(from, {
      ...conversation,
      results: {
        ...results,
        cursor: cursor + pageSize
      }
    });
  
    await sendWhatsAppMessage(
      from,
      `${nextPage}
  
  Say:
  • show more — to see more results
  • change date / origin / destination
  • run search`
    );
    return;
  }
 
  /* ===============================
     READY_TO_CONFIRM STATE
  =============================== */
  if (conversation?.state === "READY_TO_CONFIRM") {
    if (lower === "yes") {
      const locked = { ...conversation.flightQuery };

      // v2 safety: round-trip execution not supported
      if (locked.returnDate) {
        await sendWhatsAppMessage(
          from,
          `✈️ Round-trip flights are recognized but not searchable yet.\n\n` +
          `Departure: ${locked.date}\n` +
          `Return: ${locked.returnDate}\n\n` +
          `Please remove the return date to continue.`
          
        );
        return;
      }
      
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

      const formattedResults = sortedFlights.map((f, i) => {
        const itinerary = f.itineraries?.[0];
        const segments = itinerary?.segments;
      
        if (!itinerary || !segments || segments.length === 0) {
          return `${i + 1}. Flight details unavailable`;
        }
      
        const first = segments[0];
        const last = segments[segments.length - 1];
      
        const airlineName = getAirlineName(first.carrierCode, carriers);
      
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
      });

      const PAGE_SIZE = 3;
      
      const firstPage = formattedResults.slice(0, PAGE_SIZE).join("\n\n");

      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        state: "RESULTS",
        lockedFlightQuery: locked,
        results: {
          items: formattedResults,
          cursor: PAGE_SIZE,
          pageSize: PAGE_SIZE
        },
        lastExecutedSearch: {
          originCode: locked.origin.cityCode,
          destinationCode: locked.destination.cityCode,
          date: locked.date
        }
      });

      log("state_transition", {
        intent: "FLIGHT_SEARCH",
        state: "RESULTS",
        user: from,
        requestId: context.requestContext?.requestId
      });

      await sendWhatsAppMessage(
        from,
        `${locked.returnDate ? "✈️ Round-trip flight options" : "✈️ Flight options"}

        From: ${locked.origin.cityName}
        To: ${locked.destination.cityName}
        Departure: ${locked.date}${locked.returnDate ? `\nReturn: ${locked.returnDate}` : ""}
        
        ${firstPage}

      You can:
      • show more
      • change date / origin / destination
      • run search`
      );
      return;

    } else if (lower === "change") {
      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        state: "COLLECTING",
        flightQuery: { ...conversation.flightQuery },
        changeTarget: "PENDING"
      });
    
      await sendWhatsAppMessage(
        from,
        `What would you like to change?
    • Date
    • Origin
    • Destination`
      );
      return;
    } else {
      await sendWhatsAppMessage(
        from,
        "Please reply with *Yes*, *Change* (to edit), or *Cancel*."
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
      date: parsed.date || null,
      returnDate: parsed.returnDate || null
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



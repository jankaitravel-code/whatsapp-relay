/**
 * One-Way Flight Flow
 * Extracted from legacy flightIntent.js
 * Scope: ONE_WAY only
 */

const { parseFlightQuery } = require("../../services/flightParser");
const { searchFlights } = require("../../services/flightSearchService");
const { log } = require("../../utils/logger");
const { recordSignal } = require("../../utils/abuseSignals");

/* ===============================
   Helpers (unchanged)
=============================== */

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
  if (!isoDuration || typeof isoDuration !== "string") return "—";
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return "—";
  return `${match[1] || "0"}h ${match[2] || "0"}m`;
}

function getAirlineName(code, carriers) {
  if (!code) return "Unknown Airline";
  if (!carriers || typeof carriers !== "object") return code;
  return carriers[code] || code;
}

function buildConfirmationMessage(q) {
  return (
    `✈️ Please confirm your flight search:\n\n` +
    `From: ${q.origin.cityName}\n` +
    `To: ${q.destination.cityName}\n` +
    `Departure: ${q.date}\n` +
   `Class: ${q.cabinClass.replace("_", " ")}\n\n` +
    `Reply:\n` +
    `• Yes — to search\n` +
    `• Change date / origin / destination / class — to modify\n` +
    `• Cancel — to stop`
  );
}

/* ===============================
   Flow Entry
=============================== */

async function start(context) {
  const { from, sendWhatsAppMessage, setConversation } = context;

  setConversation(from, {
    intent: "FLIGHT_SEARCH",
    flow: "ONE_WAY",
    state: "COLLECTING",
    flightQuery: {
      tripType: "ONE_WAY",
      cabinClass: "ECONOMY" // 🔒 default
    }
  });

  await sendWhatsAppMessage(
    from,
    "✈️ One-way flight selected.\n\nPlease tell me your route.\nExample:\n mumbai to new york"
  );
}

/* ===============================
   Main Handler
=============================== */

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

  const lower = (rawText || text || "").toLowerCase();

   /* ===============================
     GLOBAL CANCEL
   =============================== */
   
   if (lower === "cancel") {
     recordSignal("flight_cancelled", { user: from });
     clearConversation(from);
     await sendWhatsAppMessage(from, "❌ Flight search cancelled.");
     return true;
   }

   /* ===============================
      ROUTE INPUT (COLLECTING)
   =============================== */
   if (
     conversation?.state === "COLLECTING" &&
     !conversation.flightQuery?.origin &&
     !conversation.flightQuery?.destination
   ) {
     let queryText = text;
   
     // Allow "mumbai to new york"
     if (!queryText.toLowerCase().includes("flight")) {
       queryText = `flight from ${queryText}`;
     }
   
     const parsed = await parseFlightQuery(queryText);
   
     if (!parsed?.origin || !parsed?.destination) {
       await sendWhatsAppMessage(
         from,
         "❌ I couldn’t understand the route.\n\nExample:\nmumbai to new york"
       );
       return true;
     }
   
     const updated = {
       ...conversation.flightQuery,
       origin: parsed.origin,
       destination: parsed.destination,
       date: parsed.date || null
     };
   
     // If date already present → confirm
     if (updated.date) {
       setConversation(from, {
         intent: "FLIGHT_SEARCH",
         flow: "ONE_WAY",
         state: "READY_TO_CONFIRM",
         flightQuery: updated
       });
   
       await sendWhatsAppMessage(from, buildConfirmationMessage(updated));
       return true;
     }
   
     // Else ask for date
     setConversation(from, {
       intent: "FLIGHT_SEARCH",
       flow: "ONE_WAY",
       state: "COLLECTING",
       flightQuery: updated
     });
   
     await sendWhatsAppMessage(
       from,
       "📅 What date would you like to travel? (YYYY-MM-DD)"
     );
     return true;
   }

   
   /* ===============================
      DATE-ONLY INPUT
   =============================== */
   
   if (
     conversation?.state === "COLLECTING" &&
     conversation.flightQuery?.origin &&
     conversation.flightQuery?.destination &&
     !conversation.flightQuery.date
   ) {
     const match = rawText.match(/^\d{4}-\d{2}-\d{2}$/);
     if (!match) {
       await sendWhatsAppMessage(from, "📅 Please provide date as YYYY-MM-DD.");
       return;
     }

     const updated = {
       ...conversation.flightQuery,
       date: match[0]
     };

     setConversation(from, {
       intent: "FLIGHT_SEARCH",
       flow: "ONE_WAY", 
       state: "READY_TO_CONFIRM",
       flightQuery: updated
     });

     await sendWhatsAppMessage(from, buildConfirmationMessage(updated));
     return true;
   }

   if (
     conversation?.state === "RESULTS" &&
     lower === "change date"
   ) {
     log("CHANGE_DATE_FROM_RESULTS", { user: from });

     setConversation(from, {
       intent: "FLIGHT_SEARCH",
       flow: "ONE_WAY",
       state: "AWAITING_NEW_DATE",
       flightQuery: conversation.lockedFlightQuery || conversation.flightQuery
       // 🔥 results intentionally dropped
     });
      
     await sendWhatsAppMessage(
       from,
       "📅 Sure — what new date would you like to travel? (YYYY-MM-DD)"
     );
     return true;
   }

   if (conversation?.state === "AWAITING_NEW_DATE") {
     const match = rawText.match(/^\d{4}-\d{2}-\d{2}$/);
   
     if (!match) {
       await sendWhatsAppMessage(
         from,
         "📅 Please provide the date in YYYY-MM-DD format."
       );
       return true;
     }
   
     const updatedQuery = {
       ...conversation.flightQuery,
       date: match[0]
     };
   
     log("DATE_UPDATED", {
       user: from,
       newDate: match[0]
     });
   
     setConversation(from, {
       intent: "FLIGHT_SEARCH",
       flow: "ONE_WAY",
       state: "AWAITING_RECONFIRMATION",
       flightQuery: updatedQuery
     });
   
     await sendWhatsAppMessage(
       from,
       buildConfirmationMessage(updatedQuery)
     );
     return true;
   }

   if (
     conversation?.state === "RESULTS" &&
     lower === "change origin"
   ) {
     log("CHANGE_ORIGIN_FROM_RESULTS", { user: from });
   
     setConversation(from, {
       intent: "FLIGHT_SEARCH",
       flow: "ONE_WAY",
       state: "AWAITING_NEW_ORIGIN",
       flightQuery: conversation.lockedFlightQuery
     });
   
     await sendWhatsAppMessage(
       from,
       "📍 Sure — where will you be departing from?"
     );
     return true;
   }

   if (conversation?.state === "AWAITING_NEW_ORIGIN") {
     const destination = conversation.flightQuery?.destination;
   
     if (!destination) {
       await sendWhatsAppMessage(
         from,
         "⚠️ Missing destination context. Please cancel and start again."
       );
       return true;
     }
   
     // 🔥 Force a full route so parser can resolve origin
     const syntheticQuery = `flight from ${rawText} to ${destination.cityName}`;
     const parsed = await parseFlightQuery(syntheticQuery);
      
     if (!parsed?.origin) {
       await sendWhatsAppMessage(
         from,
         "❌ I couldn’t understand the origin city.\n\nExample:\nMumbai"
       );
       return true;
     }
   
     const updatedQuery = {
       ...conversation.flightQuery,
       origin: parsed.origin
     };
   
     log("ORIGIN_UPDATED", {
       user: from,
       origin: parsed.origin.cityCode
     });
   
     setConversation(from, {
       intent: "FLIGHT_SEARCH",
       flow: "ONE_WAY",
       state: "AWAITING_RECONFIRMATION",
       flightQuery: updatedQuery
     });
   
     await sendWhatsAppMessage(
       from,
       buildConfirmationMessage(updatedQuery)
     );
     return true;
   }

   if (
     conversation?.state === "RESULTS" &&
     lower === "change destination"
   ) {
     log("CHANGE_DESTINATION_FROM_RESULTS", { user: from });
   
     setConversation(from, {
       intent: "FLIGHT_SEARCH",
       flow: "ONE_WAY",
       state: "AWAITING_NEW_DESTINATION",
       flightQuery: conversation.lockedFlightQuery
     });
   
     await sendWhatsAppMessage(
       from,
       "📍 Sure — where do you want to fly to?"
     );
     return true;
   }
   if (conversation?.state === "AWAITING_NEW_DESTINATION") {
     const origin = conversation.flightQuery?.origin;
   
     if (!origin) {
       await sendWhatsAppMessage(
         from,
         "⚠️ Missing origin context. Please cancel and start again."
       );
       return true;
     }
   
     // 🔥 Force a full route so parser can resolve destination
     const syntheticQuery = `flight from ${origin.cityName} to ${rawText}`;
   
     const parsed = await parseFlightQuery(syntheticQuery);
   
     if (!parsed?.destination) {
       await sendWhatsAppMessage(
         from,
         "❌ I couldn’t understand the destination city.\n\nExample:\nGoa"
       );
       return true;
     }
   
     const updatedQuery = {
       ...conversation.flightQuery,
       destination: parsed.destination
     };
   
     log("DESTINATION_UPDATED", {
       user: from,
       destination: parsed.destination.cityCode
     });
   
     setConversation(from, {
       intent: "FLIGHT_SEARCH",
       flow: "ONE_WAY",
       state: "AWAITING_RECONFIRMATION",
       flightQuery: updatedQuery
     });
   
     await sendWhatsAppMessage(
       from,
       buildConfirmationMessage(updatedQuery)
     );
     return true;
   }

   if (conversation?.state === "AWAITING_CABIN_CLASS") {
     const map = {
       "1" : "ECONOMY",
       "2" : "PREMIUM_ECONOMY",
       "3" : "BUSINESS",
       "4" : "FIRST"
     };
   
     const selected = map[lower];
   
     if (!selected) {
       await sendWhatsAppMessage(
         from,
         "❌ Please choose a valid option:\n1 for Economy\n2 for Premium Economy\n3 for Business\n4 for First"
       );
       return true;
     }
   
     const updatedQuery = {
       ...conversation.flightQuery,
       cabinClass: selected
     };
   
     log("CABIN_CLASS_UPDATED", {
       user: from,
       cabinClass: selected
     });
   
     setConversation(from, {
       intent: "FLIGHT_SEARCH",
       flow: "ONE_WAY",
       state: "AWAITING_RECONFIRMATION",
       flightQuery: updatedQuery
     });
   
     await sendWhatsAppMessage(
       from,
       buildConfirmationMessage(updatedQuery)
     );
     return true;
   }

   /* ===============================
   RESULTS → SHOW MORE
   =============================== */
   if (
      conversation?.state === "RESULTS" &&
      lower === "show more"
    ) {
      const results = conversation.results;
   
      if (!results || !Array.isArray(results.items)) {
        await sendWhatsAppMessage(
          from,
          "⚠️ No more results available."
        );
        return true;
      }
   
      const { items, cursor, pageSize } = results;
   
      if (cursor >= items.length) {
        await sendWhatsAppMessage(
          from,
          "⚠️ That's all the results I have. You can reply cancel or reset to search again."
        );
        return true;
      }
   
      const nextPage = items
        .slice(cursor, cursor + pageSize)
        .join("\n\n");
   
      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        flow: "ONE_WAY",
        state: "RESULTS",
        lockedFlightQuery: conversation.lockedFlightQuery,
        results: {
          ...results,
          cursor: cursor + pageSize
        }
      });
   
      await sendWhatsAppMessage(
        from,
        `${nextPage}\n\nReply:\n• show more\n• change date / origin / destination`
      );
   
      return true;
    }

   if (conversation?.state === "AWAITING_RECONFIRMATION") {

     if (lower === "change date") {
       log("CHANGE_DATE_FROM_RECONFIRMATION", { user: from });
   
       setConversation(from, {
         ...conversation,
         state: "AWAITING_NEW_DATE"
       });
   
       await sendWhatsAppMessage(
         from,
         "📅 Sure — what new date would you like to travel? (YYYY-MM-DD)"
       );
       return true;
     }
   
     if (lower === "change origin") {
       log("CHANGE_ORIGIN_FROM_RECONFIRMATION", { user: from });
   
       setConversation(from, {
         ...conversation,
         state: "AWAITING_NEW_ORIGIN"
       });
   
       await sendWhatsAppMessage(
         from,
         "📍 Sure — where will you be departing from?"
       );
       return true;
      }

     if (lower === "change destination") {
       log("CHANGE_DESTINATION_FROM_RECONFIRMATION", { user: from });
      
       setConversation(from, {
         ...conversation,
         state: "AWAITING_NEW_DESTINATION"
       });
      
       await sendWhatsAppMessage(
         from,
         "📍 Sure — where do you want to fly to?"
       );
       return true;
      }

      if (lower === "change class") {
        log("CHANGE_CLASS_FROM_RECONFIRMATION", { user: from });
      
        setConversation(from, {
          ...conversation,
          state: "AWAITING_CABIN_CLASS"
        });
      
        await sendWhatsAppMessage(
          from,
          "Choose cabin class:\n1 for Economy\n2 for Premium Economy\n3 for Business\n4 for First"
        );
        return true;
      }


     if (lower === "yes") {
       const q = conversation.flightQuery;
   
       recordSignal("flight_search_executed", {
         origin: q.origin.cityCode,
         destination: q.destination.cityCode,
         date: q.date,
         user: from
       });
   
       const { flights, carriers } = await searchFlights({
         originLocationCode: q.origin.cityCode,
         destinationLocationCode: q.destination.cityCode,
         date: q.date
       });
   
       if (!Array.isArray(flights) || flights.length === 0) {
         await sendWhatsAppMessage(
           from,
           "Sorry, I couldn’t find flights for that route and date."
         );
         return true;
       }
   
       const formatted = flights
         .filter(f => f.itineraries?.[0]?.segments?.length)
         .map((f, i) => {
           const segs = f.itineraries[0].segments;
           const first = segs[0];
           const last = segs[segs.length - 1];
   
           return (
             `${i + 1}. ${getAirlineName(first.carrierCode, carriers)} — ₹${f.price.total}\n` +
             `   ${first.departure.iataCode} ${formatTime(first.departure.at)} → ` +
             `${last.arrival.iataCode} ${formatTime(last.arrival.at)}\n` +
             `   ${formatDuration(f.itineraries[0].duration)} · ${segs.length - 1} stop(s)`
           );
         });
   
       const PAGE_SIZE = 3;
   
       setConversation(from, {
         intent: "FLIGHT_SEARCH",
         flow: "ONE_WAY",
         state: "RESULTS",
         lockedFlightQuery: q,
         results: {
           items: formatted,
           cursor: PAGE_SIZE,
           pageSize: PAGE_SIZE
         }
       });
   
       await sendWhatsAppMessage(
         from,
         `✈️ Flight options with base fare (final price may change)\n\n${formatted.slice(0, PAGE_SIZE).join("\n\n")}\n\n` +
         `Reply:\n• show more\n• change date / origin / destination\n• cancel`
       );
   
       return true;
     }
   
     if (lower === "cancel") {
       clearConversation(from);
       await sendWhatsAppMessage(from, "❌ Flight search cancelled.");
       return true;
     }
   
     await sendWhatsAppMessage(
       from,
       "Please reply with *Yes*, *Change date / origin / destination / CLASS*, or *Cancel*."
     );
     return true;
   }
   
   /* ===============================
      READY_TO_CONFIRM
   =============================== */
   if (conversation?.state === "READY_TO_CONFIRM") {
      if (lower === "change date") {
        log("CHANGE_DATE_AT_CONFIRMATION", { user: from });
      
        setConversation(from, {
          ...conversation,
          state: "AWAITING_NEW_DATE"
        });
      
        await sendWhatsAppMessage(
          from,
          "📅 Sure — what new date would you like to travel? (YYYY-MM-DD)"
        );
        return true;
      }

      if (lower === "change origin") {
        log("CHANGE_ORIGIN_AT_CONFIRMATION", { user: from });
      
        setConversation(from, {
          ...conversation,
          state: "AWAITING_NEW_ORIGIN"
        });
      
        await sendWhatsAppMessage(
          from,
          "📍 Sure — where will you be departing from?"
        );
        return true;
      }

      if (lower === "change destination") {
        log("CHANGE_DESTINATION_AT_CONFIRMATION", { user: from });
      
        setConversation(from, {
          ...conversation,
          state: "AWAITING_NEW_DESTINATION"
        });
      
        await sendWhatsAppMessage(
          from,
          "📍 Sure — where do you want to fly to?"
        );
        return true;
      }

      if (lower === "change class") {
        log("CHANGE_CLASS_AT_CONFIRMATION", { user: from });
      
        setConversation(from, {
          ...conversation,
          state: "AWAITING_CABIN_CLASS"
        });
      
        await sendWhatsAppMessage(
          from,
          "Choose cabin class:\n1 for Economy\n2 for Premium Economy\n3 for Business\n4 for First"
        );
        return true;
      }
            
      if (lower === "yes") {
         const q = conversation.flightQuery;

        if (!q.origin || !q.destination || !q.date) {
          clearConversation(from);
          await sendWhatsAppMessage(
            from,
            "⚠️ Missing trip details. Please start again."
          );
          return true;
        }

        recordSignal("flight_search_executed", {
          origin: q.origin.cityCode,
          destination: q.destination.cityCode,
          date: q.date,
          user: from 
         });

        const { flights, carriers } = await searchFlights({
          originLocationCode: q.origin.cityCode,
          destinationLocationCode: q.destination.cityCode,
          date: q.date,
          travelClass: q.cabinClass // 🔥 critical
        });

        if (!Array.isArray(flights) || flights.length === 0) {
          await sendWhatsAppMessage(
            from,
            "Sorry, I couldn’t find flights for that route and date."
          );
          return true;
        }

        const formatted = flights
          .filter(f => f.itineraries?.[0]?.segments?.length)
          .map((f, i) => {
            const segs = f.itineraries[0].segments;
            const first = segs[0];
            const last = segs[segs.length - 1];

            return (
              `${i + 1}. ${getAirlineName(first.carrierCode, carriers)} — ₹${f.price.total}\n` +
              `   ${first.departure.iataCode} ${formatTime(first.departure.at)} → ` +
              `${last.arrival.iataCode} ${formatTime(last.arrival.at)}\n` +
              `   ${formatDuration(f.itineraries[0].duration)} · ${segs.length - 1} stop(s)`
            );
          });

        const PAGE_SIZE = 3;

        setConversation(from, {
          intent: "FLIGHT_SEARCH",
          flow: "ONE_WAY",
          state: "RESULTS",
          lockedFlightQuery: q,
          results: {
            items: formatted,
            cursor: PAGE_SIZE,
            pageSize: PAGE_SIZE
          }
        });

        await sendWhatsAppMessage(
          from,
          `✈️ Flight options with base fare (final price may change)\n\n${formatted.slice(0, PAGE_SIZE).join("\n\n")}\n\n` +
          `Reply:\n• show more\n• change date / origin / destination`
        );
        return true;
      }
   
      await sendWhatsAppMessage(
        from,
        "Please reply with *Yes*, *Change date / origin / destination / class*, or *Cancel*."
      );
      return true;
    }

    if (
      (conversation?.state === "RESULTS" ||
      conversation?.state === "AWAITING_RECONFIRMATION") &&
      lower === "change class"
    ) {
      await sendWhatsAppMessage(
        from,
        "✋ Cabin class can’t be changed after search. Please restart the search to choose a different class."
      );
      return true;
    }


   /* ===============================
   FLOW CATCH-ALL (LAST!)
   =============================== */
   await sendWhatsAppMessage(
      from,
      "I didn’t understand that. You can reply:\n• show more\n• change date / origin / destination\n• cancel"
    );
    return true;
  }

  module.exports = {
    start,
    handle
  };

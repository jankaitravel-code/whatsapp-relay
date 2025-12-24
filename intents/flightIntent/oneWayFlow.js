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
    `Departure: ${q.date}\n\n` +
    `Reply:\n` +
    `• Yes — to search\n` +
    `• Change — to modify\n` +
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
      tripType: "ONE_WAY"
    }
  });

  await sendWhatsAppMessage(
    from,
    "✈️ One-way flight selected.\n\nPlease tell me your route.\nExample:\nflight from mumbai to new york"
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
     return;
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
       state: "READY_TO_CONFIRM",
       flightQuery: updated
     });

     await sendWhatsAppMessage(from, buildConfirmationMessage(updated));
     return;
   }

   /* ===============================
      READY_TO_CONFIRM
   =============================== */
   if (conversation?.state === "READY_TO_CONFIRM") {
     if (lower === "yes") {
       const q = conversation.flightQuery;

       if (!q.origin || !q.destination || !q.date) {
         clearConversation(from);
         await sendWhatsAppMessage(
           from,
           "⚠️ Missing trip details. Please start again."
         );
         return;
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
         date: q.date
       });

       if (!Array.isArray(flights) || flights.length === 0) {
         await sendWhatsAppMessage(
           from,
           "Sorry, I couldn’t find flights for that route and date."
         );
         return;
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
         `✈️ Flight options\n\n${formatted.slice(0, PAGE_SIZE).join("\n\n")}\n\n` +
         `Say:\n• show more\n• change date / origin / destination`
       );
       return;
     }
   
     if (lower === "change") {
       setConversation(from, {
         intent: "FLIGHT_SEARCH",
         state: "COLLECTING",
         flightQuery: conversation.flightQuery,
         changeTarget: "PENDING"
       });

       await sendWhatsAppMessage(
         from,
         "What would you like to change?\n• Date\n• Origin\n• Destination"
       );
       return;
     }

     await sendWhatsAppMessage(
       from,
       "Please reply with *Yes*, *Change*, or *Cancel*."
     );
     return;
   }

  /* ===============================
     ROUTE PARSING
  =============================== */
   if (conversation.state === "ONEWAY_AWAITING_ROUTE") {
     let queryText = text;
   
     if (!text.toLowerCase().includes("flight")) {
       queryText = `flight from ${text}`;
     }
   
     const parsed = await parseFlightQuery(queryText);
   
     if (!parsed?.origin || !parsed?.destination) {
       await sendWhatsAppMessage(
         from,
         "❌ I couldn’t understand the route.\n\n" +
         "Please try:\nmumbai to new york"
       );
       return true;
     }
   
     const flightQuery = {
       origin: parsed.origin,
       destination: parsed.destination,
       date: parsed.date || null,
       tripType: "ONE_WAY"
     };
   
     if (!flightQuery.date) {
       setConversation(from, {
         intent: "FLIGHT_SEARCH",
         flow: "ONE_WAY",
         state: "ONEWAY_AWAITING_DATE",
         flightQuery
       });
   
       await sendWhatsAppMessage(
         from,
         "📅 What date would you like to travel? (YYYY-MM-DD)"
       );
       return true;
     }
   
     await sendWhatsAppMessage(
       from,
       "✅ Route and date received.\n(Confirmation step comes next)"
     );
     return true;
   }
 }

 module.exports = {
   start,
   handle
 };

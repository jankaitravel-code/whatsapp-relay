/**
 * WhatsApp Relay Server
 * Production-oriented baseline
 */

const express = require("express");
const axios = require("axios");
const config = require("./config");

const { routeIntent } = require("./intents/intentRouter");


const {
  getConversation,
  setConversation,
  clearConversation
} = require("./state/conversationStore");


const { searchFlights } = require("./services/flightSearchService");

const { resolveLocation } = require("./services/locationService");

const app = express();
app.use(express.json());

/**
 * ================================
 * centralized tokens
 * ================================
 */
const { verifyToken, accessToken, phoneNumberId } = config.whatsapp;

/**
 * ================================
 * HEALTH CHECK
 * ================================
 */
app.get("/", (req, res) => {
  res.send("✅ WhatsApp relay is running");
});

/**
 * ================================
 * WEBHOOK VERIFICATION
 * ================================
 */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

/**
 * ================================
 * FLIGHT QUERY PARSER
 * (Deterministic & safe)
 * ================================
 */
async function parseFlightQuery(text) {
  const cleaned = text.replace(/,/g, "").trim();

  // FULL query with date
  let match = cleaned.match(
    /flight\s+(.+?)\s+to\s+(.+?)\s+on\s+(\d{4}-\d{2}-\d{2})$/i
  );

  let originInput, destinationInput, date = null;

  if (match) {
    originInput = match[1].trim();
    destinationInput = match[2].trim();
    date = match[3];
  } else {
    // PARTIAL query (no date)
    match = cleaned.match(
      /flight\s+(.+?)\s+to\s+(.+?)$/i
    );

    if (!match) return null;

    originInput = match[1].trim();
    destinationInput = match[2].trim();
  }

  const origin = await resolveLocation(originInput);
  const destination = await resolveLocation(destinationInput);

  if (!origin || !destination) {
    return { error: "UNKNOWN_LOCATION" };
  }

  return {
    origin,
    destination,
    date
  };
}

/**
 * ================================
 * SEND WHATSAPP MESSAGE
 * ================================
 */
async function sendWhatsAppMessage(to, body) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );
}

/**
 * ================================
 * INCOMING WHATSAPP MESSAGES
 * ================================
 */
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const rawText = message.text?.body || "";
    const text = rawText.toLowerCase();

    console.log("📩 Message received:", rawText);

    const intentContext = {
      from,
      text,
      rawText,
      sendWhatsAppMessage,
      clearConversation,
      getConversation,
      setConversation,
      searchFlights,
      resolveLocation
    };
    // 🔀 Route reset / greeting / flight intents
    const handled = await routeIntent(intentContext);
    if (handled) {
      return res.sendStatus(200);
    }


    // 🔄 New flight command always overrides pending conversation
    if (/^flight\s+/i.test(text)) {
      clearConversation(from);
    }


    const conversation = getConversation(from);

    if (conversation) {
      console.log("🧠 Existing conversation state:", conversation);
    }

    // 🗓️ Change date intent
    if (
      conversation?.intent === "FLIGHT_SEARCH" &&
      text.includes("change date")
    ) {
      const dateMatch = rawText.match(/\d{4}-\d{2}-\d{2}/);

      if (!dateMatch) {
        await sendWhatsAppMessage(
          from,
          "📅 Please provide the new date in YYYY-MM-DD format."
        );
        return res.sendStatus(200);
      }

      const updatedQuery = {
        ...conversation,
        date: dateMatch[0],
        awaiting: null
      };

      // 💾 Persist completed search for corrections
      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        origin: conversation.origin,
        destination: conversation.destination,
        date: updatedQuery.date,
        awaiting: null
      });

      const flights = await searchFlights({
        originLocationCode: updatedQuery.origin.cityCode,
        destinationLocationCode: updatedQuery.destination.cityCode,
        date: updatedQuery.date
      });

      if (!flights || flights.length === 0) {
        await sendWhatsAppMessage(
          from,
          "Sorry, I couldn’t find any flights for that new date."
        );
        return res.sendStatus(200);
      }

      const reply = flights
        .map((f, i) => {
          const segment = f.itineraries[0].segments[0];
          const price = f.price.total;
          return `${i + 1}. ${segment.carrierCode} ${segment.number} – ₹${price}`;
        })
        .join("\n");

      await sendWhatsAppMessage(
        from,
        `✈️ Updated flight options:\n\n${reply}`
      );

      return res.sendStatus(200);
    }

   /**
     * ================================
     * FLIGHT INTENT HANDLING
     * ================================
     */
    const flightQuery = await parseFlightQuery(text);
    // 🔁 Resume pending flight search ONLY if this message is NOT a new flight query
    if (
      conversation?.intent === "FLIGHT_SEARCH" &&
      conversation.awaiting === "date" &&
      !flightQuery
    ) {
      const dateMatch = rawText.match(/\d{4}-\d{2}-\d{2}/);

      if (!dateMatch) {
        await sendWhatsAppMessage(
          from,
          "📅 Please provide the date in YYYY-MM-DD format."
        );
        return res.sendStatus(200);
      }

      const completedQuery = {
        origin: conversation.origin,
        destination: conversation.destination,
        date: dateMatch[0]
      };

      console.log("🔁 Resuming flight search with:", completedQuery);

      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        origin: completedQuery.origin,
        destination: completedQuery.destination,
        date: completedQuery.date,
        awaiting: null
      });

      const flights = await searchFlights({
        originLocationCode: completedQuery.origin.cityCode,
        destinationLocationCode: completedQuery.destination.cityCode,
        date: completedQuery.date
      });

      if (!flights || flights.length === 0) {
        await sendWhatsAppMessage(
          from,
          "Sorry, I couldn’t find any flights for that route and date."
        );
        return res.sendStatus(200);
      }

      const reply = flights
        .map((f, i) => {
          const segment = f.itineraries[0].segments[0];
          const price = f.price.total;
          return `${i + 1}. ${segment.carrierCode} ${segment.number} – ₹${price}`;
        })
        .join("\n");

      await sendWhatsAppMessage(
        from,
        `✈️ Here are some flight options:\n\n${reply}`
      );

      return res.sendStatus(200);
    }
    
    if (flightQuery?.error === "UNKNOWN_LOCATION") {
      await sendWhatsAppMessage(
        from,
        "❌ I couldn’t recognize one of the locations.\n" +
          "Please try again using a major city or airport name."
      );
      return res.sendStatus(200);
    }

    if (text.includes("flight") && !flightQuery) {
      await sendWhatsAppMessage(
        from,
        "✈️ I can help you find flights.\n\n" +
          "Please use this format:\n" +
          "flight DEL to DXB on 2025-12-25"
      );
      return res.sendStatus(200);
    }

    if (flightQuery) {
      console.log("✈️ Flight search using city codes:", {
        originCity: flightQuery.origin.cityCode,
        destinationCity: flightQuery.destination.cityCode,
        date: flightQuery.date,
        selectedOriginAirport: flightQuery.origin.airportCode,
        selectedDestinationAirport: flightQuery.destination.airportCode
      });
    
      // 💾 Store completed flight search for possible corrections
    if (flightQuery.date) {
      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        origin: flightQuery.origin,
        destination: flightQuery.destination,
        date: flightQuery.date,
        awaiting: null
      });
    }


    // 📝 Handle partial flight query (missing date)
    if (!flightQuery.date) {
      setConversation(from, {
        intent: "FLIGHT_SEARCH",
        origin: flightQuery.origin,
        destination: flightQuery.destination,
        date: null,
        awaiting: "date"
      });

      await sendWhatsAppMessage(
        from,
        "✈️ Got it. What date would you like to travel? (YYYY-MM-DD)"
      );

      return res.sendStatus(200);
    }
  
      const flights = await searchFlights({
        originLocationCode: flightQuery.origin.cityCode,
        destinationLocationCode: flightQuery.destination.cityCode,
        date: flightQuery.date
      });


      if (!flights || flights.length === 0) {
        await sendWhatsAppMessage(
          from,
          "Sorry, I couldn’t find any flights for that route and date."
        );
        return res.sendStatus(200);
      }

      const reply = flights
        .map((f, i) => {
          const segment = f.itineraries[0].segments[0];
          const price = f.price.total;
          return `${i + 1}. ${segment.carrierCode} ${
            segment.number
          } – ₹${price}`;
        })
        .join("\n");

      await sendWhatsAppMessage(
        from,
        `✈️ Here are some flight options:\n\n${reply}`
      );

      return res.sendStatus(200);
    }

    /**
     * ================================
     * BASIC GREETING
     * ================================
     */
    if (text === "hi" || text === "hello") {
      await sendWhatsAppMessage(
        from,
        "Hello 👋 I’m your travel assistant"
      );
      return res.sendStatus(200);
    }

    /**
     * ================================
     * FALLBACK
     * ================================
     */
    await sendWhatsAppMessage(
      from,
      "I can help with flights.\nTry:\nflight DEL to DXB on 2025-12-25"
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error(
      "❌ Error handling message",
      err.response?.data || err.message
    );
    return res.sendStatus(200);
  }
});

/**
 * ================================
 * SERVER START
 * ================================
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Relay server running on port", PORT);
});

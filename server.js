/**
 * WhatsApp Relay Server
 * Production-oriented baseline
 */

const express = require("express");
const axios = require("axios");

const { searchFlights } = require("./services/flightSearchService");

const { resolveLocation } = require("./services/locationService");

const app = express();
app.use(express.json());

/**
 * ================================
 * TEMPORARY HARDCODED SECRETS
 * (Tracked technical debt)
 * ================================
 */
const VERIFY_TOKEN = "my_verify_token_123";
const WHATSAPP_TOKEN = "EAFoqwCGEN2oBQDXB0bZAha63ejWig1FZBcZAMim0sGcCiYZAEy1RjZAKSamQ3zmkhSPBUvJrT7JdyAZBC68oLzZCqZA7pDBhNfGZCYulvnaAZAHZBGdqRJz2VSBwS8hQ4GQAy4vAYupMp5l21CnxpeoB1um8KB47Nc5rpAl5FeD9bcrMfLwXUURdAWXO4KiSYL7SgFPZB6VkKXSKjqfiSJsVBGCfpXrofZCKKWGxLy0BW4wdUyzcLXb17IKn77ROCi7FM0FJrHVj8MRzEo0x9cIOxDmzqiQ3YPPIA8epwbAZDZD";
const PHONE_NUMBER_ID = "948142088373793";

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

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
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
  const cleaned = text.replace(/,/g, "");

  // Accept city names OR IATA codes
  const match = cleaned.match(
    /flight\s+(.+?)\s+to\s+(.+?)\s+on\s+(\d{4}-\d{2}-\d{2})/
  );

  if (!match) return null;

  const originInput = match[1].trim();
  const destinationInput = match[2].trim();
  const date = match[3];

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
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body }
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
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

    /**
     * ================================
     * FLIGHT INTENT HANDLING
     * ================================
     */
    const flightQuery = await parseFlightQuery(text);

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


      const flights = await searchFlights({
        originLocationCode: flightQuery.origin.citycode,
        destinationLocationCode: flightQuery.destination.citycode,
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

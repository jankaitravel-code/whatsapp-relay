// Minimal WhatsApp relay server
const express = require("express");
const axios = require("axios");
const WHATSAPP_TOKEN = "EAFoqwCGEN2oBQKJG9ZAc6YiQGTXBpBpd4wSwEtdwc9M9QcMGW0XmmkT4MGCu1vcEYzD0S4fspUgVSehXptXIjmYLE1VbvEaapSgGaZB9pSHVmZBrb9FOodwHu3FAHGRHBB22ZB7fRpxNTYG77wLkYOrh3moU4tQ43ZAUaNrTl7KBrBsC49HrAXnn8i6PC5SzLuNeVkyNjRPZAeZBY3CREPIxa7SrlZB7KZBCZCdiZCE3TrwqOUOwcVBEduvW3e8PljtQ4kvcR1cZAFwAD8FuKlvk8xi1MpZCZCBBeqNjF7xQZDZD";
const PHONE_NUMBER_ID = "948142088373793";

const app = express();

app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("✅ WhatsApp relay is running");
});

// Webhook verification (Meta will call this)
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "Jank_ai";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Incoming WhatsApp messages (just log for now)
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from; // user's phone number
    const rawText = message.text?.body || "";
    const text = rawText.toLowerCase();

    console.log("📩 Message received:", text);
    const { searchFlights } = require("./services/flightSearchService");

    function parseFlightQuery(text) {
      const match = text.match(/flight\s+(\w+)\s+to\s+(\w+)\s+on\s+([\d-]+)/);
      if (!match) return null;

      return {
        origin: match[1].toUpperCase(),
        destination: match[2].toUpperCase(),
        date: match[3]
      };
    }
    const flightQuery = parseFlightQuery(text);

    if (flightQuery) {
      const flights = await searchFlights(flightQuery);

      if (!flights.length) {
        await axios.post(
          `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: "No flights found for your query." }
          },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
        );
        return res.sendStatus(200);
      }

      const reply = flights
        .map((f, i) => {
          const price = f.price.total;
          const segments = f.itineraries[0].segments[0];
          return `${i + 1}. ${segments.carrierCode} ${segments.number} – ₹${price}`;
        })
        .join("\n");

      await axios.post(
        `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: `Here are some options:\n${reply}` }
        },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
      );

  return res.sendStatus(200);
}

    if (text === "hi" || text === "hello") {
      await axios.post(
        `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: {
            body: "Hello 👋 I’m your travel assistant"
          }
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("✅ Reply sent");
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error handling message", err.response?.data || err.message);
    res.sendStatus(200);
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Relay server running on port", PORT);
});


// Minimal WhatsApp relay server
const express = require("express");
const axios = require("axios");
const WHATSAPP_TOKEN = "EAFoqwCGEN2oBQFZAKZAPFECSlZCSqNlpHV5nZBJvavm6dioZA8MLap5kyRnr1kZCyc5jOC8ukBKJ0uCvFPYAvIJZBtNz9mL3sm5YLZCpqzLZCPcXW1tXPpKWuYZCJIxYdfe3ZCXdem1mLq5B3lqHkRd3PZALKwDZC9xtulqbeO7YX7TOoEBAcNqzh6dBKwsgsMjdeO1EZB8mFqmb279yN7UqOC4ZBFWmUQKyx1J8xrufIwrPV2neDHbGJW8vZBez6R9C4v9KkRNJXW3E37Dq5RK3VgNUs955QraoLq8VxePt0p0ZD";
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
    const text = message.text?.body?.toLowerCase() || "";

    console.log("📩 Message received:", text);

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


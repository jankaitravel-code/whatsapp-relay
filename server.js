// Minimal WhatsApp relay server
const express = require("express");
const axios = require("axios");
const WHATSAPP_TOKEN = "EAFoqwCGEN2oBQHZCOBHYL2VA6gxqalpNfe22tMC8FWkznjiBvkwrpQ5WWMW3oYqWipHbScIP6jE254zUwvfg4iugfGaAmkZCUxOZCl89n5wWjxlbKi08iuPew4jsznBK7KYx2CoZCG9hpoebzVT4ySSLHR2exOfqoQpOAnZAL0NwBakGnWxsJ99uDHvnfH7o3ZBP2fnNKmxCaQ4IM6U0tvEjnxvTIPjhAlG4N2n88JWezzJT7XJFAZBbgdNqDAlGQnCHHZBHQaZBDdHAz0ummvkNWg4z2XsNqXuSZCRwZDZD";
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


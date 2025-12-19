/**
 * WhatsApp Relay Server
 * Transport-only (7.2+ architecture)
 */

const express = require("express");
const axios = require("axios");
const config = require("./config");

const { buildRequestContext } = require("./utils/requestContext");

const { checkRateLimit } = require("./security/rateLimiter");
const { log } = require("./utils/logger");

const { routeIntent } = require("./intents/intentRouter");
const {
  getConversation,
  setConversation,
  clearConversation
} = require("./state/conversationStore");

const app = express();
app.use(express.json());

/**
 * ================================
 * Centralized WhatsApp tokens
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
 * SEND WHATSAPP MESSAGE (transport helper)
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
        
    // 🔐 Build request context FIRST
    const requestContext = buildRequestContext({ from });

    // 🛡️ B1: Rate limit check (log-only)
    const allowed = checkRateLimit({ user: from });

    log("rate_limit_check", {
      user: from,
      allowed,
      requestId: requestContext.requestId
    });

    // B1: rate limiting is log-only for now (no blocking)

    const conversation = getConversation(from);
          
    const intentContext = {
      from,
      text,
      rawText,
      conversation,

      // helpers available to intents
      sendWhatsAppMessage,
      setConversation,
      clearConversation,
  
        // 🔐 A3 addition
      requestContext
    };

    console.log("🧪 Router received text:", text);

    await routeIntent(intentContext);
    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ Error handling message", err.message);
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

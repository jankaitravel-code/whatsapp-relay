/**
 * WhatsApp Relay Server
 * Transport-only (7.2+ architecture)
 */

const express = require("express");
const axios = require("axios");
const config = require("./config");

const { buildRequestContext } = require("./utils/requestContext");

const { checkRateLimit } = require("./security/rateLimiter");
const RATE_LIMIT_WARNING_THRESHOLD = 10;
const { log } = require("./utils/logger");
const { recordSignal } = require("./utils/abuseSignals");

const BLOCKED_RESULTS_INPUTS = ["yes", "ok", "search"];


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

    // 🛡️ B1: Rate limit check (warn)
    const rate = checkRateLimit({ user: from });

    log("rate_limit_check", {
      user: from,
      allowed: rate.allowed,
      count: rate.count,
      limit: rate.limit,
      windowMs: rate.windowMs,
      requestId: requestContext.requestId
    });

    // B3: Recording abuse signal - still log only no blocking yet
    recordSignal("MESSAGE_RECEIVED", {
      user: from,
      textLength: rawText.length,
      requestId: requestContext.requestId
    });


    // 🟡 B2: Soft warning (non-blocking, failure-safe)
    if (rate.count === RATE_LIMIT_WARNING_THRESHOLD) {
      (async () => {
        try {
          await sendWhatsAppMessage(
            from,
            "⚠️ You’re sending messages very quickly.\n" +
            "Please slow down to avoid temporary limits."
          );

          log("rate_limit_warning_sent", {
            user: from,
            count: rate.count,
            requestId: requestContext.requestId
          });
        } catch (err) {
          log("rate_limit_warning_failed", {
            user: from,
            error: err.message,
            requestId: requestContext.requestId
          });
        }
      })();
    }

    // B1: rate limiting is warn-only for now (no blocking)

    const conversation = getConversation(from);

    // 🔒 7.2.6.1 — Freeze search execution after RESULTS
    const normalizedText = rawText.trim().toLowerCase();
    
    if (
      conversation?.state === "RESULTS" &&
      BLOCKED_RESULTS_INPUTS.includes(normalizedText)
    ) {
      await sendWhatsAppMessage(
        from,
        `You're already viewing search results.
    
    You can:
    • Change dates
    • Change destination
    • Start a new search
    
    Tell me what you'd like to change.`
      );
    
      return res.sendStatus(200); // 🔒 HARD STOP
    }
    
          
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

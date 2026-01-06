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

function hasProcessedMessage(conversation, waMessageId) {
  return conversation?.processedMessageIds?.includes(waMessageId);
}

function markMessageProcessed(conversation, waMessageId) {
  const existing = conversation?.processedMessageIds || [];
  return {
    ...conversation,
    processedMessageIds: [...existing, waMessageId]
  };
}

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

    const waMessageId = message.id;
    const from = message.from;

    // 🔍 Transport-level observability
    console.log("📩 INCOMING_WHATSAPP_MESSAGE", {
      waMessageId,
      from,
      text: message.text?.body || null
    });

    // 🔒 TRANSPORT-LEVEL IDEMPOTENCY GUARD (MUST BE FIRST)
    const existingConversation = getConversation(from);

    if (hasProcessedMessage(existingConversation, waMessageId)) {
      log("duplicate_whatsapp_message_ignored", {
        waMessageId,
        user: from
      });
      return res.sendStatus(200);
    }

    // 🐢 TEMPORARY DELAY (TEST ONLY — SAFE NOW)
    await new Promise(res => setTimeout(res, 12000));

    const rawText = message.text?.body || "";
    const text = rawText.toLowerCase();

    console.log("📩 Message received:", rawText);

    const requestContext = buildRequestContext({ from });

    const rate = checkRateLimit({ user: from });

    log("rate_limit_check", {
      user: from,
      allowed: rate.allowed,
      count: rate.count,
      limit: rate.limit,
      windowMs: rate.windowMs,
      requestId: requestContext.requestId
    });

    recordSignal("MESSAGE_RECEIVED", {
      user: from,
      textLength: rawText.length,
      requestId: requestContext.requestId
    });

    const conversation = getConversation(from);
    const normalizedText = rawText.trim().toLowerCase();

    /* GLOBAL CANCEL — TRANSPORT LEVEL */
    if (normalizedText === "cancel") {
      const updatedConversation = markMessageProcessed(
        conversation,
        waMessageId
      );

      setConversation(from, updatedConversation);
      clearConversation(from);

      await sendWhatsAppMessage(
        from,
        "❌ Session cancelled.\n\nType *flights* to start again."
      );

      return res.sendStatus(200);
    }

    const intentContext = {
      from,
      text,
      rawText,
      conversation,
      sendWhatsAppMessage,
      setConversation,
      clearConversation,
      requestContext
    };

    console.log("🧪 Router received text:", text);

    await routeIntent(intentContext);

    // ✅ Mark processed AFTER successful handling
    const updatedConversation = markMessageProcessed(
      getConversation(from),
      waMessageId
    );

    setConversation(from, updatedConversation);

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ Error handling message", err);
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

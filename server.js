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

function hasResponded(conversation, waMessageId) {
  return conversation?.respondedMessageIds?.includes(waMessageId);
}

function markResponded(conversation, waMessageId) {
  const existing = conversation?.respondedMessageIds || [];
  return {
    ...conversation,
    respondedMessageIds: [...existing, waMessageId]
  };
}

/**
 * Low-level WhatsApp send (NO dedup, transport only)
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
 * High-level send with response deduplication
 * Guarantees: at most ONE outbound message per waMessageId
 */
async function sendOnce(from, waMessageId, body) {
  const conversation = getConversation(from); // re-fetch after claim

  if (hasResponded(conversation, waMessageId)) {
    log("duplicate_response_suppressed", {
      waMessageId,
      user: from
    });
    return; // 🔒 HARD STOP — response already sent
  }

  await sendWhatsAppMessage(from, body);

  const updatedConversation = markResponded(
    getConversation(from),
    waMessageId
  );

  setConversation(from, updatedConversation);
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

    // 🔒 Claim this waMessageId immediately to block concurrent retries
    const claimedConversation = markMessageProcessed(
      existingConversation || {},
      waMessageId
    );
    
    setConversation(from, claimedConversation);


    // 🐢 TEMPORARY DELAY (TEST ONLY — SAFE NOW)
    await new Promise(res => setTimeout(res, 30000));

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

    const normalizedText = rawText.trim().toLowerCase();

    // 🔁 Re-fetch conversation AFTER waMessageId claim
    const conversation = getConversation(from);

    /* GLOBAL CANCEL — TRANSPORT LEVEL */
    if (normalizedText === "cancel") {

      // 🔒 Mark BOTH processed + responded BEFORE clearing
      const updatedConversation = markResponded(
        markMessageProcessed(conversation, waMessageId),
        waMessageId
      );
      
      setConversation(from, updatedConversation);
      
      // Send response exactly once
      await sendOnce(
        from,
        waMessageId,
        "❌ Session cancelled.\n\nType *flights* to start again."
      );
      
      // Now it is safe to clear
      clearConversation(from);
      
      return res.sendStatus(200);
    }

    const intentContext = {
      from,
      text,
      rawText,
      conversation,
      sendMessage: (message) =>
        sendOnce(from, waMessageId, message),
      setConversation,
      clearConversation,
      requestContext
    };

    console.log("🧪 Router received text:", text);

    await routeIntent(intentContext);

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

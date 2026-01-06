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
const { recordSignal } = require("./utils/abuseSignals");

const {
  getConversation,
  setConversation,
  clearConversation
} = require("./state/conversationStore");

const { routeIntent } = require("./intents/intentRouter");

const app = express();
app.use(express.json());

/* ================================
   WhatsApp config
================================ */
const { verifyToken, accessToken, phoneNumberId } = config.whatsapp;

/* ================================
   Dedup helpers
================================ */
function hasProcessedMessage(conversation, waMessageId) {
  return conversation?.processedMessageIds?.includes(waMessageId);
}

function markMessageProcessed(conversation, waMessageId) {
  return {
    ...conversation,
    processedMessageIds: [
      ...(conversation?.processedMessageIds || []),
      waMessageId
    ]
  };
}

function hasResponded(conversation, waMessageId) {
  return conversation?.respondedMessageIds?.includes(waMessageId);
}

function markResponded(conversation, waMessageId) {
  return {
    ...conversation,
    respondedMessageIds: [
      ...(conversation?.respondedMessageIds || []),
      waMessageId
    ]
  };
}

/* ================================
   WhatsApp send helpers
================================ */
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
 * Send at most once per waMessageId
 */
async function sendOnce(from, waMessageId, body) {
  const conversation = getConversation(from);

  if (hasResponded(conversation, waMessageId)) {
    log("duplicate_response_suppressed", {
      waMessageId,
      user: from
    });
    return;
  }

  await sendWhatsAppMessage(from, body);

  setConversation(
    from,
    markResponded(getConversation(from), waMessageId)
  );
}

/* ================================
   Health check
================================ */
app.get("/", (_, res) => {
  res.send("✅ WhatsApp relay is running");
});

/* ================================
   Webhook verification
================================ */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

/* ================================
   Incoming messages
================================ */
app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    /**
     * 🧪 TEST ONLY — force WhatsApp retry
     * Toggle with: FORCE_WA_RETRY=true
     * DO NOT COMMIT ENABLED
     
    if (process.env.FORCE_WA_RETRY === "true") {
      await new Promise(r => setTimeout(r, 90000));*/

    if (process.env.DELAY_ACK === "true") {
      await new Promise(r => setTimeout(r, 30000));
    }

    const waMessageId = message.id;
    const from = message.from;
    const rawText = message.text?.body || "";
    const text = rawText.toLowerCase();
    const normalizedText = rawText.trim().toLowerCase();

    console.log("📩 INCOMING_WHATSAPP_MESSAGE", {
      waMessageId,
      from,
      text: rawText
    });

    /* ===============================
       GLOBAL CANCEL — TRANSPORT LEVEL
       =============================== */
    if (normalizedText === "cancel") {
      clearConversation(from);

      await sendWhatsAppMessage(
        from,
        "❌ Session cancelled.\n\nType *flights* to start again."
      );

      return res.sendStatus(200);
    }

    /* ===============================
       Transport-level idempotency
       =============================== */
    const existingConversation = getConversation(from);

    if (hasProcessedMessage(existingConversation, waMessageId)) {
      log("duplicate_whatsapp_message_ignored", {
        waMessageId,
        user: from
      });
      return res.sendStatus(200);
    }

    // Claim message immediately
    setConversation(
      from,
      markMessageProcessed(existingConversation || {}, waMessageId)
    );

    /* ===============================
       Request context + telemetry
       =============================== */
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

    /* ===============================
       Safe send wrapper (backward compatible)
       =============================== */
    const send = (arg1, arg2) => {
      if (typeof arg2 === "undefined") {
        return sendOnce(from, waMessageId, arg1);
      }
      return sendOnce(from, waMessageId, arg2);
    };

    const intentContext = {
      from,
      text,
      rawText,
      conversation,
      sendMessage: send,
      sendWhatsAppMessage: send, // backward compatibility
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

/* ================================
   Server start
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Relay server running on port", PORT);
});

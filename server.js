// Minimal WhatsApp relay server
const express = require("express");
const app = express();

app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("✅ WhatsApp relay is running");
});

// Webhook verification (Meta will call this)
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Incoming WhatsApp messages (just log for now)
app.post("/webhook", (req, res) => {
  console.log("📩 Incoming WhatsApp message:");
  console.log(JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Relay server running on port", PORT);
});


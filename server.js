require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// DB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Database connected"))
  .catch(err => console.log(err));

// Test route
app.get("/", (req, res) => {
  res.send("Automation system running");
});

// Webhook (WhatsApp + Instagram)
app.post("/webhook", (req, res) => {
  console.log("Incoming message:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

// Webhook verification
app.get("/webhook", (req, res) => {
  const verifyToken = "wa_010201";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === verifyToken) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Incoming messages
app.post("/webhook", (req, res) => {
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const message = value?.messages?.[0];

  if (message) {
    const from = message.from;
    const text = message.text?.body || "";

    console.log("Message from:", from, text);
  }

  res.sendStatus(200);
});


const axios = require("axios");

const sendMessage = async (to, text) => {
  await axios.post(
    `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
};

app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.toLowerCase();

  if (!text || text === "hi") {
    await sendMessage(
      from,
      `Welcome 👋  
How can we help you today?

1️⃣ Buy a product  
2️⃣ Book a service  
3️⃣ Talk to support`
    );
  }

  if (text === "1") {
    await sendMessage(from, "Please tell us the product you’re interested in.");
  }

  if (text === "2") {
    await sendMessage(from, "Please tell us the service you want to book.");
  }

  if (text === "3") {
    await sendMessage(from, "A human agent will respond shortly.");
  }

  res.sendStatus(200);
});

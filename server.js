require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const Lead = require("./models/Lead");
const clients = require("./clients");

const app = express();
app.use(express.json());

//scheduler
setInterval(async () => {
  const leads = await Lead.find({
    createdAt: { $lte: new Date(Date.now() - 60 * 60 * 1000) }
  });

  for (let lead of leads) {
    await sendMessage(lead.phone, "Just checking in 😊 Are you still interested?");
  }
}, 60 * 60 * 1000);

// MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(()=> console.log("Database connected"))
.catch(err=> console.log(err));

// Test route
app.get("/", (req,res)=>{
  res.send("Automation system running");
});

// Webhook verification
app.get("/webhook",(req,res)=>{
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if(mode === "subscribe" && token === VERIFY_TOKEN){
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// Send WhatsApp message
const sendMessage = async (to,text)=>{
  await axios.post(
    `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      messaging_product:"whatsapp",
      to:to,
      text:{ body:text }
    },
    {
      headers:{
        Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type":"application/json"
      }
    }
  );
};

// Incoming messages
app.post("/webhook", async (req, res) => {
  const value = req.body.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.toLowerCase();
  const platform = value?.metadata?.display_phone_number ? "whatsapp" : "instagram";

  const clientId = "client_001"; // later dynamic per client
  const client = clients[clientId];

  if (platform === "instagram") {
  if (text.includes("price")) {
    await sendMessage(from, client.igKeywords.price);
  }

  if (text.includes("book")) {
    await sendMessage(from, client.igKeywords.book);
  }
}

  // Save lead
  await Lead.create({
    clientId,
    platform,
    phone: from,
    message: text
  });

  // Auto replies
  if (!text || text === "hi") {
    await sendMessage(from, client.welcome);
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


const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`Server running on ${PORT}`));

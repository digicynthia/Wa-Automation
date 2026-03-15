require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");

const app = express();
app.use(express.json());

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
app.post("/webhook", async (req,res)=>{

  console.log("Incoming:",JSON.stringify(req.body,null,2));

  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if(!message){
    return res.sendStatus(200);
  }

  const from = message.from;
  const text = message.text?.body?.toLowerCase();

  console.log("User:",from,"Message:",text);

  if(!text || text==="hi"){
    await sendMessage(from,
`Welcome 👋

How can we help you today?

1️⃣ Buy a product
2️⃣ Book a service
3️⃣ Talk to support`);
  }

  else if(text==="1"){
    await sendMessage(from,"Please tell us the product you're interested in.");
  }

  else if(text==="2"){
    await sendMessage(from,"Please tell us the service you want to book.");
  }

  else if(text==="3"){
    await sendMessage(from,"A human agent will respond shortly.");
  }

  res.sendStatus(200);

});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`Server running on ${PORT}`));

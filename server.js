require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");

const Lead = require("./models/Lead");
const clients = require("./clients");

const app = express();
app.use(express.json());

/* ===============================
   DATABASE
================================ */

mongoose.connect(process.env.MONGO_URI)
.then(()=> console.log("Database connected"))
.catch(err=> console.log(err));


/* ===============================
   CLIENT DETECTION
================================ */

const getClientByPhoneNumberId = (phoneNumberId) => {
  return Object.keys(clients).find(
    key => clients[key].phoneNumberId === phoneNumberId
  );
};

const getClientByInstagramId = (igId) => {
  return Object.keys(clients).find(
    key => clients[key].instagramAccountId === igId
  );
};


/* ===============================
   WHATSAPP SEND MESSAGE
================================ */

const sendWhatsAppMessage = async (to,text,phoneNumberId,token)=>{

  try{

    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product:"whatsapp",
        to,
        text:{ body:text }
      },
      {
        headers:{
          Authorization:`Bearer ${token}`,
          "Content-Type":"application/json"
        }
      }
    );

  }catch(error){

    console.log(
      "WhatsApp send error:",
      error.response?.data || error.message
    );

  }

};


/* ===============================
   INSTAGRAM SEND MESSAGE
================================ */

const sendInstagramMessage = async (recipientId,text,igAccountId,token)=>{

  try{

    await axios.post(
      `https://graph.facebook.com/v18.0/${igAccountId}/messages`,
      {
        recipient:{ id:recipientId },
        message:{ text }
      },
      {
        headers:{
          Authorization:`Bearer ${token}`,
          "Content-Type":"application/json"
        }
      }
    );

  }catch(error){

    console.log(
      "Instagram send error:",
      error.response?.data || error.message
    );

  }

};


/* ===============================
   FOLLOW UP SCHEDULER
   12 HOURS → THEN EVERY 2 HOURS
================================ */

setInterval(async () => {

  const leads = await Lead.find();

  const now = Date.now();

  for (let lead of leads) {

    let sendFollowUp = false;

    const createdTime = new Date(lead.createdAt).getTime();

    // FIRST FOLLOW-UP (after 5 hours)
    if (lead.followUpCount === 0) {

      if (now - createdTime >= 5 * 60 * 60 * 1000) {
        sendFollowUp = true;
      }

    }

    // SECOND FOLLOW-UP (after 24 hours total)
    if (lead.followUpCount === 1) {

      if (now - createdTime >= 24 * 60 * 60 * 1000) {
        sendFollowUp = true;
      }

    }

    // Stop after 2 follow-ups
    if (lead.followUpCount >= 2) continue;

    if (sendFollowUp) {

      const client = clients[lead.clientId];
      if (!client) continue;

      if (lead.platform === "whatsapp") {

        await sendWhatsAppMessage(
          lead.phone,
          client.followUp,
          client.phoneNumberId,
          client.whatsappToken
        );

      }

      if (lead.platform === "instagram") {

        await sendInstagramMessage(
          lead.phone,
          client.followUp,
          client.instagramAccountId,
          client.instagramToken
        );

      }

      lead.followUpCount += 1;
      lead.lastFollowUp = new Date();

      await lead.save();

    }

  }

}, 60 * 60 * 1000);



/* ===============================
   TEST ROUTE
================================ */

app.get("/",(req,res)=>{

  res.send("Automation system running");

});


/* ===============================
   WEBHOOK VERIFICATION
================================ */

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


/* ===============================
   INCOMING WEBHOOK
================================ */

app.post("/webhook", async (req,res)=>{

  try{

    const value = req.body.entry?.[0]?.changes?.[0]?.value;

    const message = value?.messages?.[0];

    if(!message) return res.sendStatus(200);

    const from = message.from;

    const text = message.text?.body?.toLowerCase();

    const phoneNumberId = value?.metadata?.phone_number_id;

    const igAccountId = value?.metadata?.instagram_account_id;

    let platform = "whatsapp";

    let clientId = null;

    if(phoneNumberId){

      clientId = getClientByPhoneNumberId(phoneNumberId);

      platform = "whatsapp";

    }

    if(igAccountId){

      clientId = getClientByInstagramId(igAccountId);

      platform = "instagram";

    }

    if(!clientId){

      console.log("Client not found");

      return res.sendStatus(200);

    }

    const client = clients[clientId];


    /* SAVE LEAD */

    await Lead.create({

      clientId,

      platform,

      phone:from,

      message:text

    });


    /* INSTAGRAM KEYWORDS */

    if(platform === "instagram" && text){

      if(text.includes("price")){

        await sendInstagramMessage(

          from,

          client.igKeywords.price,

          client.instagramAccountId,

          client.instagramToken

        );

      }

      if(text.includes("book")){

        await sendInstagramMessage(

          from,

          client.igKeywords.book,

          client.instagramAccountId,

          client.instagramToken

        );

      }

    }


    /* WHATSAPP MENU */

    if(platform === "whatsapp"){

      if(!text || text === "hi"){

        await sendWhatsAppMessage(

          from,

          client.welcome,

          client.phoneNumberId,

          client.whatsappToken

        );

      }

      if(text === "1"){

        await sendWhatsAppMessage(

          from,

          "Please tell us the product you’re interested in.",

          client.phoneNumberId,

          client.whatsappToken

        );

      }

      if(text === "2"){

        await sendWhatsAppMessage(

          from,

          "Please tell us the service you want to book.",

          client.phoneNumberId,

          client.whatsappToken

        );

      }

      if(text === "3"){

        await sendWhatsAppMessage(

          from,

          "A human agent will respond shortly.",

          client.phoneNumberId,

          client.whatsappToken

        );

      }

    }

    res.sendStatus(200);

  }catch(error){

    console.log("Webhook error:",error);

    res.sendStatus(200);

  }

});


/* ===============================
   SERVER
================================ */

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{

  console.log(`Server running on ${PORT}`);

});

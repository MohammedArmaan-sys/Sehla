
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
const PORT = process.env.PORT || 3000;

// Predefined responses
const responses = {
  timings_en: "Our clinic is open from 9am to 9pm, Sunday to Thursday.",
  timings_ar: "ساعات العمل من الساعة ٩ صباحًا إلى ٩ مساءً من الأحد إلى الخميس.",
  location_en: "We are located on King Fahd Road, Riyadh. Google Maps: https://maps.google.com",
  location_ar: "نحن في طريق الملك فهد، الرياض. خرائط جوجل: https://maps.google.com",
  price_en: "Consultation is 100 SAR. Whitening starts from 500 SAR.",
  price_ar: "سعر الاستشارة العامة هو ١٠٠ ريال. يبدأ تبييض الأسنان من ٥٠٠ ريال.",
  booking_en: "Please share your preferred date and time. We’ll confirm your appointment shortly.",
  booking_ar: "فضلًا أرسل اليوم والوقت المناسب وسنقوم بتأكيد الموعد."
};

// Synonyms for intent mapping
const intentMap = {
  timings: ["timing", "open", "hours", "working", "ساعات", "وقت", "متى", "تفتح", "الدوام"],
  location: ["location", "where", "address", "map", "reach", "directions", "come", "get to", "how to reach", "how can i come", "where is the clinic", "pin", "google maps", "gps", "send location", "nearby", "الموقع", "عنوان", "وين", "فين", "مكان", "وينك", "وين العيادة", "كيف أجيكم", "كيف أوصل", "وين تكونون", "ارسلي اللوكيشن", "الخريطة", "قوقل", "ألقاكم"],
  price: ["price", "cost", "consultation", "how much", "فلوس", "بكم", "السعر", "تكلفة", "استشارة"],
  booking: ["book", "appointment", "reserve", "احجز", "موعد", "ميعاد", "حجز", "أحجز"]
};

function detectArabic(text) {
  return /[\u0600-\u06FF]/.test(text);
}

function logUnmatched(message, from, lang, response) {
  const logEntry = {
    from: from,
    message: message,
    intent_detected: null,
    language: lang,
    response_sent: response,
    timestamp: new Date().toISOString()
  };

  const logs = fs.existsSync("logs.json")
    ? JSON.parse(fs.readFileSync("logs.json"))
    : [];

  logs.push(logEntry);
  fs.writeFileSync("logs.json", JSON.stringify(logs, null, 2));
}

const handleMessage = async (msg, from) => {
  const raw = msg;
  const message = msg.normalize("NFKD").replace(/[\u064B-\u0652]/g, "").toLowerCase();
  const isArabic = detectArabic(msg);
  let detectedIntent = null;

  for (const [intent, keywords] of Object.entries(intentMap)) {
    if (keywords.some(keyword => message.includes(keyword))) {
      detectedIntent = intent;
      return responses[`${intent}_${isArabic ? "ar" : "en"}`];
    }
  }

  // GPT fallback
  try {
    const gptRes = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: isArabic
            ? "أنت مساعد ذكي في عيادة طبية سعودية. رد على الرسائل باحترافية وباللغة العربية."
            : "You are a helpful assistant for a Saudi medical clinic. Reply clearly and professionally."
        },
        { role: "user", content: raw }
      ]
    }, {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const fallbackResponse = gptRes.data.choices[0].message.content;
    logUnmatched(raw, from, isArabic ? "ar" : "en", fallbackResponse);
    return fallbackResponse;
  } catch (err) {
    const fallbackResponse = isArabic
      ? "شكرًا لرسالتك. سنقوم بالرد عليك قريبًا."
      : "Thank you for your message. A representative will get back to you shortly.";

    logUnmatched(raw, from, isArabic ? "ar" : "en", fallbackResponse);
    return fallbackResponse;
  }
};

app.post("/webhook", async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body;

  const response = await handleMessage(body, from);

  const twiml = `
    <Response>
      <Message>${response}</Message>
    </Response>
  `;

  res.set("Content-Type", "text/xml");
  res.send(twiml);
});

app.get("/", (req, res) => {
  res.send("🚀 SehlaBot with Learning is live and logging unmatched messages!");
});

app.listen(PORT, () => {
  console.log("SehlaBot learning version running on port " + PORT);
});

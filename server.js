// Cài đặt: npm install express cors dotenv node-fetch
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Hoặc dùng fetch có sẵn trong Node v18+
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Cho phép App của bạn gọi vào (CORS)
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, systemInstruction, jsonMode } = req.body;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Server chưa cấu hình API Key" });
    }

    // Cấu hình body gửi sang Gemini
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      }
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (jsonMode) {
      body.generationConfig.responseMimeType = "application/json";
    }

    // Gọi Google Gemini API từ Server
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API Error');
    }

    // Trả kết quả về cho Frontend
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.json({ text });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Lỗi xử lý từ server" });
  }
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại port ${PORT}`);
});
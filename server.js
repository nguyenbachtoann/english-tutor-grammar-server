// Cài đặt: npm install express cors dotenv axios
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

app.use(express.json({ limit: '5mb' }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, systemInstruction, jsonMode } = req.body;

    if (!GEMINI_API_KEY) {
      console.error("Lỗi: Server chưa có API Key");
      return res.status(500).json({ error: "Server chưa cấu hình API Key" });
    }

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // --- CẤU HÌNH BODY ---
    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 40,
        responseMimeType: jsonMode ? "application/json" : "text/plain"
      }
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    // --- CẤU HÌNH MODEL ---
    // Sử dụng model Gemini 2.5 Flash Preview (phiên bản 09-2025)
    const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    res.json({ result: text, raw: data });

  } catch (error) {
    if (error.response) {
      console.error("Gemini API Error:", error.response.data);
      // Trả về lỗi chi tiết để dễ debug
      res.status(error.response.status).json({
        error: "Lỗi từ Gemini API",
        details: error.response.data
      });
    } else if (error.request) {
      console.error("No response from Gemini:", error.request);
      res.status(503).json({ error: "Không thể kết nối tới Gemini" });
    } else {
      console.error("Server Error:", error.message);
      res.status(500).json({ error: "Lỗi xử lý nội bộ server" });
    }
  }
});

app.get('/', (req, res) => {
  res.send('GrammarFlow Server is running!');
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
// Cài đặt: npm install express cors dotenv axios
const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Dùng Axios thay cho fetch để ổn định hơn
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Cấu hình CORS
app.use(cors({
    origin: '*', // Trong production nên đổi thành domain của App bạn
    methods: ['GET', 'POST']
}));

// Sử dụng express.json() và tăng giới hạn kích thước body
app.use(express.json({ limit: '5mb' }));

// Lấy API Key từ biến môi trường
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Endpoint để gọi Gemini API
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

    // Cấu hình body gửi sang Gemini
    // LƯU Ý QUAN TRỌNG: Cấu trúc phải đúng chuẩn Google API
    const body = {
      // 1. Contents
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],

      // 2. Generation Config (KHÔNG DÙNG "config")
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 40,
        // Nếu bật jsonMode thì set responseMimeType
        responseMimeType: jsonMode ? "application/json" : "text/plain"
      }
    };

    // 3. System Instruction (Nằm ngang hàng với contents, KHÔNG nằm trong config)
    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    // Chọn Model (nằm trên URL)
    // Bạn có thể đổi thành 'gemini-1.5-pro' hoặc 'gemini-2.0-flash-exp' tùy nhu cầu
    const MODEL_NAME = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    // Gọi Google Gemini API bằng AXIOS
    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Axios tự động parse JSON, data nằm trong response.data
    const data = response.data;

    // Lấy text an toàn
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    res.json({ result: text, raw: data });

  } catch (error) {
    // Xử lý lỗi chi tiết từ Axios
    if (error.response) {
      // Lỗi từ phía Google trả về (400, 500...)
      console.error("Gemini API Error:", error.response.data);
      res.status(error.response.status).json({
        error: "Lỗi từ Gemini API",
        details: error.response.data
      });
    } else if (error.request) {
      // Không nhận được phản hồi
      console.error("No response from Gemini:", error.request);
      res.status(503).json({ error: "Không thể kết nối tới Gemini" });
    } else {
      // Lỗi cấu hình request
      console.error("Server Error:", error.message);
      res.status(500).json({ error: "Lỗi xử lý nội bộ server" });
    }
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('GrammarFlow Server is running!');
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
// Cài đặt: npm install express cors dotenv node-fetch
const express = require('express');
const cors = require('cors');
// Phải require node-fetch để đảm bảo hàm fetch hoạt động
const fetch = require('node-fetch'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Cho phép App của bạn gọi vào (CORS)
app.use(cors());

// Sử dụng express.json() và tăng giới hạn kích thước body (khắc phục lỗi tiềm ẩn)
app.use(express.json({ limit: '5mb' }));

// Lấy API Key từ biến môi trường
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Endpoint để gọi Gemini API
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, systemInstruction, jsonMode } = req.body;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Server chưa cấu hình API Key. Vui lòng kiểm tra file .env" });
    }

    if (!prompt) {
      return res.status(400).json({ error: "Thiếu 'prompt' trong yêu cầu." });
    }

    // Cấu hình body gửi sang Gemini
    const body = {
      // Sử dụng model gemini-2.5-flash để hỗ trợ JSON và System Instruction tốt hơn
      model: "gemini-2.5-flash", 
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        maxOutputTokens: 2048, // Tăng giới hạn đầu ra token
      }
    };

    if (systemInstruction) {
      // Thêm System Instruction (Hướng dẫn hệ thống) vào cấu hình
      body.config.systemInstruction = systemInstruction;
    }

    if (jsonMode) {
      // Bật chế độ JSON Mode
      body.config.responseMimeType = "application/json";
    }

    // Gọi Google Gemini API từ Server
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${body.model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Lỗi HTTP từ API (ví dụ: 400, 403, 500)
      console.error("Gemini API Error Response:", data);
      throw new Error(data.error?.message || 'Lỗi từ Gemini API');
    }

    // Trả kết quả về cho Frontend
    // Kiểm tra và lấy nội dung từ phản hồi của Gemini
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.json({ text, data });

  } catch (error) {
    console.error("Lỗi Server:", error.message);
    res.status(500).json({ error: "Lỗi xử lý từ server", details: error.message });
  }
});

// Khởi động Server
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

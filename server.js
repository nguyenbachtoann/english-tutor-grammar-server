// Cài đặt: npm install express cors dotenv axios
const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Dùng Axios thay cho fetch để ổn định hơn
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình CORS
app.use(cors({
    origin: '*', // Trong production nên đổi thành domain của App bạn (ví dụ: https://my-app.vercel.app)
    methods: ['GET', 'POST']
}));

app.use(express.json());

// Sử dụng express.json() và tăng giới hạn kích thước body (khắc phục lỗi tiềm ẩn)
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

    // Gọi Google Gemini API bằng AXIOS
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      body,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Axios tự động parse JSON, data nằm trong response.data
    const data = response.data;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    res.json({ text });

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

// Health check endpoint (để Render biết server còn sống)
app.get('/', (req, res) => {
  res.send('GrammarFlow Server is running!');
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

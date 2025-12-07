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

// Đổi tên biến môi trường cho khớp với Groq
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;

// --- HÀM GỌI API VỚI CƠ CHẾ RETRY ---
async function callAIWithRetry(url, body, config, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(url, body, config);
      return response;
    } catch (error) {
      const status = error.response?.status;
      // 429: Too Many Requests, 503: Service Unavailable
      if ((status === 429 || status === 503) && i < retries - 1) {
        const retryAfter = error.response?.headers['retry-after'];
        let delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i + 1) * 1000;
        if (delay > 5000) delay = 5000;

        console.log(`⚠️ Lỗi ${status}. Thử lại lần ${i + 1} sau ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, systemInstruction, jsonMode } = req.body;

    if (!GROQ_API_KEY) {
      console.error("Thiếu API Key");
      return res.status(500).json({ error: "Server chưa cấu hình GROQ_API_KEY" });
    }

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // --- CẤU HÌNH GROQ ---
    const url = "https://api.groq.com/openai/v1/chat/completions";

    // CẬP NHẬT MODEL MỚI NHẤT (Thay thế Llama 3 cũ đã bị xóa)
    // "llama-3.3-70b-versatile": Model mới nhất, rất mạnh mẽ (tương đương GPT-4 class), Free Tier.
    const MODEL_NAME = "llama-3.3-70b-versatile";

    const messages = [];

    // 1. Thêm System Instruction
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    } else {
        messages.push({ role: "system", content: "You are a helpful AI assistant." });
    }

    // 2. Thêm User Prompt
    messages.push({ role: "user", content: prompt });

    const body = {
      model: MODEL_NAME,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 1,
      stream: false,
      // Groq yêu cầu trong prompt phải có chữ "json" nếu bật chế độ này
      response_format: jsonMode ? { type: "json_object" } : { type: "text" }
    };

    // --- GỌI API ---
    const response = await callAIWithRetry(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      }
    });

    const data = response.data;
    const text = data.choices?.[0]?.message?.content || "";

    res.json({ result: text, raw: data });

  } catch (error) {
    if (error.response) {
      console.error("Groq API Error:", error.response.data);

      // Ưu tiên hiển thị thông báo lỗi trực tiếp từ Groq
      let message = error.response.data?.error?.message || "Lỗi từ AI Provider";

      // Fallback các mã lỗi phổ biến nếu Groq không trả về message rõ ràng
      if (!error.response.data?.error?.message) {
          if (error.response.status === 401) message = "Sai API Key hoặc API Key đã hết hạn.";
          if (error.response.status === 429) message = "Hệ thống đang bận (Rate Limit Exceeded).";
          if (error.response.status === 404) message = "Model không tồn tại hoặc đã bị xóa.";
          if (error.response.status === 400) message = "Lỗi Request (Kiểm tra lại format JSON hoặc Prompt).";
      }

      res.status(error.response.status).json({
        error: message,
        details: error.response.data
      });
    } else if (error.request) {
      console.error("No response:", error.request);
      res.status(503).json({ error: "Không thể kết nối tới Groq API" });
    } else {
      console.error("Server Error:", error.message);
      res.status(500).json({ error: "Lỗi xử lý nội bộ server" });
    }
  }
});

app.get('/', (req, res) => {
  res.send('GrammarFlow Server (Groq - Llama 3.3) is running!');
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
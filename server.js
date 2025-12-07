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

// --- HÀM GỌI API VỚI CƠ CHẾ RETRY ---
// Tự động thử lại khi gặp lỗi 429 (Too Many Requests) hoặc 5xx (Server Error)
async function callGeminiWithRetry(url, body, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // Gọi API
      const response = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response;
    } catch (error) {
      const status = error.response?.status;

      // Nếu là lỗi 429 (Quota) hoặc 503 (Service Unavailable) và còn lượt retry
      if ((status === 429 || status === 503) && i < retries - 1) {
        // Lấy thời gian chờ từ header (nếu có) hoặc tính theo Exponential Backoff
        // Ví dụ: lần 1 chờ 2s, lần 2 chờ 4s...
        const retryAfter = error.response?.headers['retry-after'];
        let delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i + 1) * 1000;

        // Giới hạn delay tối đa 10s để tránh client timeout
        if (delay > 10000) delay = 10000;

        console.log(`⚠️ Gặp lỗi ${status}. Đang thử lại lần ${i + 1} sau ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Nếu không thể retry hoặc lỗi khác, ném lỗi ra ngoài
      throw error;
    }
  }
}

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, systemInstruction, jsonMode } = req.body;

    if (!GEMINI_API_KEY) {
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

    // --- CHỌN MODEL ---
    // SỬ DỤNG 'gemini-1.5-flash': Bản ổn định, giới hạn quota tốt hơn (15 RPM)
    // TRÁNH 'gemini-2.5-flash-preview': Bản preview giới hạn rất thấp (5 RPM) gây lỗi 429
    const MODEL_NAME = "Gemini 2.5 Flash-Lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    // Gọi hàm có Retry
    const response = await callGeminiWithRetry(url, body);

    const data = response.data;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    res.json({ result: text, raw: data });

  } catch (error) {
    if (error.response) {
      console.error("Gemini API Error:", error.response.data);

      // Xử lý thông báo lỗi thân thiện hơn
      let message = "Lỗi từ Google API";
      if (error.response.status === 429) {
        message = "Hệ thống đang bận (Quá tải request). Vui lòng thử lại sau vài giây.";
      }

      res.status(error.response.status).json({
        error: message,
        details: error.response.data
      });
    } else if (error.request) {
      console.error("No response from Gemini:", error.request);
      res.status(503).json({ error: "Không thể kết nối tới Google Gemini" });
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
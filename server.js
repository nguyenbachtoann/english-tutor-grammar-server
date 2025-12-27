// Cài đặt: npm install express cors dotenv axios
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

app.use(express.json({ limit: '5mb' }));

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;

// --- HÀM TRỢ GIÚP ĐỌC FILE JSON ---
const getIdiomsData = () => {
    try {
        const filePath = path.join(__dirname, 'idioms.json');
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const rawData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error("Lỗi khi đọc file idioms.json:", error);
        return null;
    }
};

// --- API: LẤY TẤT CẢ IDIOMS ---
app.get('/api/idioms', (req, res) => {
    const data = getIdiomsData();
    if (!data) {
        return res.status(404).json({ error: "Không tìm thấy dữ liệu thành ngữ." });
    }
    res.json(data);
});

// --- API: LẤY IDIOM THEO CATEGORY ---
// Ví dụ: /api/idioms/idioms_Money
app.get('/api/idioms/:category', (req, res) => {
    const { category } = req.params;
    const data = getIdiomsData();

    if (!data) {
        return res.status(500).json({ error: "Lỗi hệ thống khi tải dữ liệu." });
    }

    if (data[category]) {
        res.json(data[category]);
    } else {
        res.status(404).json({ error: `Không tìm thấy danh mục: ${category}` });
    }
});

// --- HÀM GỌI API VỚI CƠ CHẾ RETRY (DÀNH CHO GROQ) ---
async function callAIWithRetry(url, body, config, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(url, body, config);
      return response;
    } catch (error) {
      const status = error.response?.status;
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

// --- API GENERATE (GIỮ NGUYÊN) ---
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, systemInstruction, jsonMode } = req.body;

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: "Server chưa cấu hình API Key" });
    }

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const url = "https://api.groq.com/openai/v1/chat/completions";
    const MODEL_NAME = "llama-3.3-70b-versatile";

    const messages = [];
    messages.push({
        role: "system",
        content: systemInstruction || "You are a helpful AI assistant."
    });
    messages.push({ role: "user", content: prompt });

    const body = {
      model: MODEL_NAME,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048,
      response_format: jsonMode ? { type: "json_object" } : { type: "text" }
    };

    const response = await callAIWithRetry(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      }
    });

    const text = response.data.choices?.[0]?.message?.content || "";
    res.json({ result: text, raw: response.data });

  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message;
    res.status(status).json({ error: message });
  }
});

app.get('/', (req, res) => {
  res.send('GrammarFlow Server (Idioms support) is running!');
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
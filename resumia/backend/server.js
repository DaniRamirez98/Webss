const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 8080;

app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  }
}));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas solicitudes. Espera un momento.' }
});
app.use('/api/summarize', limiter);

app.get('/', (req, res) => res.json({ message: 'ResumIA Backend activo ✓', version: '1.0' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/summarize', async (req, res) => {
  const { text, length = 'moderado', style = 'general' } = req.body;

  // 1. Validaciones básicas
  if (!text || text.trim().length < 50) {
    return res.status(400).json({ error: 'Texto muy corto.' });
  }

  // 2. Definición del Prompt (se queda igual)
  const prompt = `Resume este texto...`; 

  try {
    // --- AQUÍ ESTÁ LA SOLUCIÓN ---
    // Definimos el modelo único (el ID que vimos en tu AI Studio)
    const modelId = 'gemini-1.5-flash'; 
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelId}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const responseData = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error('Error de Google:', responseData);
      return res.status(502).json({ error: 'Gemini falló al responder.' });
    }

    // Extraer el texto generado
    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Limpieza de formato Markdown si existe
    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return res.json({ success: true, data: parsed });

  } catch (err) {
    console.error('Error del servidor:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});
app.listen(PORT, () => console.log(`✅ ResumIA backend corriendo en puerto ${PORT}`));
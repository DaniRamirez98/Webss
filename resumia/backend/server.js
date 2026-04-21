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
    // Usamos el ID técnico que NUNCA falla en México
    const modelId = 'gemini-1.5-flash'; 
    
    // Cambiamos a la versión estable v1
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelId}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    console.log(`Conectando con modelo estable: ${modelId}`);

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const responseText = await geminiRes.text();
    
    if (!geminiRes.ok) {
      console.error("Error de Google:", responseText);
      return res.status(502).json({ error: 'Error de conexión con Google.' });
    }

    const geminiData = JSON.parse(responseText);
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpieza de JSON
    const clean = rawText.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error('Respuesta malformada');

    const parsed = JSON.parse(jsonMatch[0]);
    return res.json({ success: true, data: parsed });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});
app.listen(PORT, () => console.log(`✅ ResumIA backend corriendo en puerto ${PORT}`));
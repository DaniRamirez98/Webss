const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ──────────────────────────────────────────────
app.use(express.json());

// CORS: solo permite peticiones desde tu dominio
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

// Rate limit: máximo 10 resúmenes por minuto por IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.' }
});
app.use('/api/summarize', limiter);

// ── Ruta principal ───────────────────────────────────────────
app.post('/api/summarize', async (req, res) => {
  const { text, length = 'moderado', style = 'general' } = req.body;

  // Validaciones
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'El campo "text" es requerido.' });
  }
  if (text.trim().length < 50) {
    return res.status(400).json({ error: 'El texto es demasiado corto (mínimo 50 caracteres).' });
  }
  if (text.length > 30000) {
    return res.status(400).json({ error: 'El texto es demasiado largo (máximo 30,000 caracteres).' });
  }

  const lengthMap = {
    breve:    'muy conciso, máximo 3-4 oraciones para el resumen principal',
    moderado: 'moderado, 2-4 párrafos para el resumen principal',
    detallado:'detallado y completo, varios párrafos bien desarrollados'
  };
  const styleMap = {
    general:   'lenguaje claro y accesible para el público general',
    academico: 'lenguaje formal y académico, preciso y técnico',
    informal:  'tono informal, amigable y fácil de leer',
    ejecutivo: 'tono ejecutivo y directo, enfocado en conclusiones accionables'
  };

  const prompt = `Eres un experto en síntesis y análisis de textos. Resume el siguiente texto de manera ${lengthMap[length] || lengthMap.moderado}, usando ${styleMap[style] || styleMap.general}.

Responde ÚNICAMENTE en formato JSON válido, sin backticks ni texto extra:
{
  "titulo": "Título descriptivo y atractivo",
  "resumen": "Resumen principal del texto.",
  "puntos_clave": [
    "Punto clave 1",
    "Punto clave 2",
    "Punto clave 3"
  ]
}

TEXTO:
${text}`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 }
      })
    });

    if (!geminiRes.ok) {
      const errData = await geminiRes.json();
      console.error('Error Gemini:', errData);
      return res.status(502).json({ error: 'Error al conectar con Gemini. Intenta más tarde.' });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.json({ success: true, data: parsed });

  } catch (err) {
    console.error('Error del servidor:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`✅ ResumIA backend corriendo en puerto ${PORT}`));

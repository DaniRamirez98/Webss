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
  try {
    const { text } = req.body;

    if (!text || text.length < 50) {
      return res.status(400).json({ error: 'Texto demasiado corto.' });
    }

    // Usaremos el ID más básico y compatible
    const model = 'gemini-1.5-flash';
    // URL con v1 (versión estable)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Resume este texto en español: ${text}` }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error de Google:', JSON.stringify(data));
      return res.status(502).json({ error: 'Error en la API de Google.' });
    }

    const summary = data.candidates[0].content.parts[0].text;
    
    return res.json({ 
      success: true, 
      data: { resumen: summary, titulo: "Resumen Generado", puntos_clave: [] } 
    });

  } catch (err) {
    console.error('Error crítico:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});
app.listen(PORT, () => console.log(`✅ ResumIA backend corriendo en puerto ${PORT}`));
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
    // CAMBIO CLAVE: El ID debe incluir el prefijo 'models/' para que v1beta lo encuentre
    const modelPath = 'models/gemini-1.5-flash'; 
    
    // Construimos la URL usando el path completo
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    console.log(`Solicitando recurso a Google: ${modelPath}`);

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const responseText = await geminiRes.text();
    
    if (!geminiRes.ok) {
      console.error("Respuesta de error de Google:", responseText);
      return res.status(502).json({ error: 'El modelo no está disponible actualmente.' });
    }

    const geminiData = JSON.parse(responseText);
    // ... (el resto de tu lógica de parseo de JSON se queda igual)
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = rawText.replace(/```json|```/g, '').trim();
    return res.json({ success: true, data: JSON.parse(clean) });

  } catch (err) {
    console.error('Error interno:', err.message);
    return res.status(500).json({ error: 'Error en el servidor.' });
  }
});
app.listen(PORT, () => console.log(`✅ ResumIA backend corriendo en puerto ${PORT}`));
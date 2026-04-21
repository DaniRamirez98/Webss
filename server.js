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
    
    // ID técnico exacto
    const modelId = 'gemini-1.5-flash'; 
    
    // CAMBIO CLAVE: Usamos v1beta y el path 'models/' explícito
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    console.log(`Intentando conectar con: models/${modelId} en v1beta`);

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Resume el siguiente texto de forma concisa: ${text}` }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Respuesta de Google:', JSON.stringify(data));
      // Si sale 404 aquí, el problema es la API Key
      return res.status(502).json({ error: 'Google no reconoce el modelo o la versión.' });
    }

    const summary = data.candidates[0].content.parts[0].text;
    return res.json({ success: true, data: { resumen: summary } });

  } catch (err) {
    console.error('Error del servidor:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});
app.listen(PORT, () => console.log(`✅ ResumIA backend corriendo en puerto ${PORT}`));
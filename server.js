const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Configuración de CORS para Railway/Producción
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

app.get('/', (req, res) => res.json({ message: 'ResumIA Backend activo ✓', version: '1.1' }));

// RUTA PRINCIPAL CORREGIDA
app.post('/api/summarize', limiter, async (req, res) => {
  try {
    const { text } = req.body;

    // Validación de entrada
    if (!text || text.length < 20) {
      return res.status(400).json({ error: 'El texto es muy corto para generar un resumen de calidad.' });
    }

    const modelId = 'gemini-2.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const prompt = `Actúa como un experto en síntesis de información. 
    Analiza el siguiente texto y devuelve estrictamente un objeto JSON con esta estructura:
    {
      "titulo": "Un título elegante y breve",
      "resumen": "Un resumen fluido en uno o dos párrafos",
      "puntos_clave": ["mínimo 3 puntos clave", "relevantes", "concisos"]
    }
    
    Texto a procesar: ${text}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error de Google:', data);
      return res.status(502).json({ error: 'Error en la respuesta de la inteligencia artificial.' });
    }

    // Extraer y parsear el string JSON que devuelve Gemini
    const contentString = data.candidates[0].content.parts[0].text;
    const structuredData = JSON.parse(contentString);

    // Respuesta final que el frontend leerá perfectamente
    return res.json({
      success: true,
      data: structuredData
    });

  } catch (err) {
    console.error('Error del servidor:', err);
    return res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
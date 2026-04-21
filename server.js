const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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
    breve:     'muy conciso, máximo 3-4 oraciones',
    moderado:  'moderado, 2-4 párrafos',
    detallado: 'detallado, varios párrafos bien desarrollados'
  };
  const styleMap = {
    general:   'lenguaje claro y accesible',
    academico: 'lenguaje formal y académico',
    informal:  'tono informal y amigable',
    ejecutivo: 'tono ejecutivo y directo'
  };

  const prompt = `Eres un experto en síntesis de textos. Resume el siguiente texto de manera ${lengthMap[length] || lengthMap.moderado}, usando ${styleMap[style] || styleMap.general}.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin backticks, sin explicaciones. Solo el JSON:
{"titulo":"título aquí","resumen":"resumen aquí","puntos_clave":["punto 1","punto 2","punto 3"]}

TEXTO:
${text}`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json'
        }
      })
    });

    const responseText = await geminiRes.text();

    if (!geminiRes.ok) {
      console.error('Error Gemini status:', geminiRes.status, responseText);
      return res.status(502).json({ error: 'Error al conectar con Gemini. Intenta más tarde.' });
    }

    let geminiData;
    try {
      geminiData = JSON.parse(responseText);
    } catch (e) {
      console.error('Error parseando respuesta de Gemini:', responseText);
      return res.status(502).json({ error: 'Respuesta inválida de Gemini.' });
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!rawText) {
      console.error('Gemini no devolvió texto:', JSON.stringify(geminiData));
      return res.status(502).json({ error: 'Gemini no devolvió contenido. Intenta con un texto diferente.' });
    }

    const clean = rawText.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error('No se encontró JSON en respuesta:', clean);
      return res.status(502).json({ error: 'No se pudo procesar la respuesta. Intenta de nuevo.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('Error parseando JSON extraído:', jsonMatch[0]);
      return res.status(502).json({ error: 'Error al procesar el resumen. Intenta de nuevo.' });
    }

    if (!parsed.titulo || !parsed.resumen) {
      return res.status(502).json({ error: 'Respuesta incompleta de Gemini. Intenta de nuevo.' });
    }

    return res.json({ success: true, data: parsed });

  } catch (err) {
    console.error('Error del servidor:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor: ' + err.message });
  }
});

app.listen(PORT, () => console.log(`✅ ResumIA backend corriendo en puerto ${PORT}`));
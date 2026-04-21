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

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin backticks, sin explicaciones. Solo el JSON puro:
{"titulo":"título aquí","resumen":"resumen aquí","puntos_clave":["punto 1","punto 2","punto 3"]}

TEXTO A RESUMIR:
${text}`;

try {
    // Definimos el modelo único directamente aquí
    const model = 'gemini-1.5-flash'; 
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const responseText = await geminiRes.text();

    if (!geminiRes.ok) {
      throw new Error(`Error de Gemini: ${responseText}`);
    }

    const geminiData = JSON.parse(responseText);
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!rawText) throw new Error('Gemini no devolvió texto');

    // Limpiar y extraer JSON de la respuesta
    const clean = rawText.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta');

    const parsed = JSON.parse(jsonMatch[0]);
    return res.json({ success: true, data: parsed });

  } catch (err) {
    console.error('Error del servidor:', err.message);
    return res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});
app.listen(PORT, () => console.log(`✅ ResumIA backend corriendo en puerto ${PORT}`));
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

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin backticks, sin explicaciones. Solo el JSON puro:
{"titulo":"título aquí","resumen":"resumen aquí","puntos_clave":["punto 1","punto 2","punto 3"]}

TEXTO A RESUMIR:
${text}`;

  try {
    // Intentar con gemini-2.0-flash primero, si falla usar gemini-pro
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro'];
    let lastError = '';
    
    for (const model of models) {
const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024
          }
        })
      });

      const responseText = await geminiRes.text();
      console.log(`Modelo ${model} - Status:`, geminiRes.status);

      if (!geminiRes.ok) {
        lastError = responseText;
        console.error(`Modelo ${model} falló:`, responseText.substring(0, 200));
        continue; // probar siguiente modelo
      }

      let geminiData;
      try {
        geminiData = JSON.parse(responseText);
      } catch (e) {
        lastError = 'Respuesta no es JSON válido';
        continue;
      }

      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!rawText) {
        lastError = 'Gemini no devolvió texto';
        console.error('Sin texto en respuesta:', JSON.stringify(geminiData).substring(0, 200));
        continue;
      }

      // Limpiar y extraer JSON
      const clean = rawText.replace(/```json|```/g, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        lastError = 'No se encontró JSON en respuesta';
        console.error('Sin JSON en:', clean.substring(0, 200));
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseErr) {
        lastError = 'JSON malformado';
        continue;
      }

      if (!parsed.titulo || !parsed.resumen) {
        lastError = 'JSON incompleto';
        continue;
      }

      console.log(`✅ Éxito con modelo: ${model}`);
      return res.json({ success: true, data: parsed });
    }

    // Si todos los modelos fallaron
    console.error('Todos los modelos fallaron. Último error:', lastError);
    return res.status(502).json({ error: 'No se pudo conectar con Gemini. Verifica tu API Key.' });

  } catch (err) {
    console.error('Error del servidor:', err.message);
    return res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});

app.listen(PORT, () => console.log(`✅ ResumIA backend corriendo en puerto ${PORT}`));
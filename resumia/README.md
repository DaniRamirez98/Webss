# ResumIA 📄✨

Aplicación web para resumir textos con IA (Gemini), con lectura en voz alta.

## Estructura del proyecto

```
resumia/
├── frontend/        → Va en GitHub Pages (público)
│   └── index.html
└── backend/         → Va en Railway (servidor seguro)
    ├── server.js
    ├── package.json
    ├── .env.example
    └── .gitignore
```

---

## 🚀 Paso 1 — Desplegar el Backend en Railway

Railway es gratis para proyectos pequeños y guarda tu API key de forma segura.

1. Ve a **[railway.app](https://railway.app)** e inicia sesión con GitHub
2. Click en **"New Project" → "Deploy from GitHub repo"**
3. Selecciona el repositorio de tu **backend**
4. Una vez desplegado, ve a **"Variables"** y agrega:
   ```
   GEMINI_API_KEY = AIza_TU_CLAVE_AQUI
   ALLOWED_ORIGINS = https://TU_USUARIO.github.io
   PORT = 3000
   ```
5. Copia la URL que te da Railway, algo como:
   `https://resumia-backend.railway.app`

---

## 🌐 Paso 2 — Conectar el Frontend

Abre `frontend/index.html` y busca esta línea (cerca del inicio del `<script>`):

```javascript
const API_URL = 'https://TU-BACKEND.railway.app/api/summarize';
```

Cámbiala por la URL real de tu backend Railway.

---

## 📁 Paso 3 — Subir a GitHub Pages

### Frontend (página pública):
1. Crea un repositorio en GitHub llamado `resumia` (o el nombre que quieras)
2. Sube **solo** la carpeta `frontend/` (el archivo `index.html`)
3. Ve a **Settings → Pages → Branch: main → / (root) → Save**
4. Tu página estará en: `https://TU_USUARIO.github.io/resumia`

### Backend (servidor):
1. Crea **otro** repositorio en GitHub llamado `resumia-backend`
2. Sube el contenido de la carpeta `backend/`
3. ⚠️ **NUNCA subas el archivo `.env`** — ya está en `.gitignore`
4. Conecta ese repositorio a Railway (Paso 1)

---

## ✅ Verificar que funciona

Abre en el navegador:
```
https://TU-BACKEND.railway.app/api/health
```
Debes ver: `{"status":"ok"}`

---

## 🔒 Seguridad incluida

- La API key de Gemini **nunca llega al navegador**
- Rate limiting: máximo 10 resúmenes/minuto por IP
- Validación de texto en el servidor
- CORS configurado solo para tu dominio

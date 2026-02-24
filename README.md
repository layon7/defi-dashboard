# ⬡ DeFi Pulse Dashboard

Dashboard DeFi en tiempo real con **CoinGecko API** + **DeBank API**.

---

## 🚀 Deploy en GitHub Pages — paso a paso

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
```
Edita `.env` y pon tu API key de DeBank:
```
VITE_DEBANK_API_KEY=tu_api_key_aqui
```
> ⚠️ Obtén tu key gratis en https://cloud.debank.com

### 3. Configurar tu repo en vite.config.js
Abre `vite.config.js` y cambia `'defi-dashboard'` por el nombre exacto de tu repo en GitHub:
```js
base: '/nombre-de-tu-repo/',
```

### 4. Correr en local (para probar)
```bash
npm run dev
```
Abre http://localhost:5173

### 5. Deploy a GitHub Pages
```bash
# Primera vez: crea el repo en github.com, luego:
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main

# Hacer deploy:
npm run deploy
```

Tu dashboard quedará en:
```
https://TU_USUARIO.github.io/TU_REPO/
```

### Deploys futuros
Cada vez que hagas cambios:
```bash
git add .
git commit -m "Update"
git push
npm run deploy
```

---

## 📡 APIs utilizadas

| API | Datos | Plan gratis |
|-----|-------|-------------|
| CoinGecko | Precios, market cap, volumen, historial | ✅ 30 req/min |
| DeBank | Portfolio wallet, tokens, protocolos DeFi | ✅ Requiere key gratis |

---

## 🛠 Stack
- React 18 + Vite
- IBM Plex Mono (Google Fonts)
- gh-pages (deploy automático)

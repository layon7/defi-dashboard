# ⬡ DeFi Pulse Dashboard

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
# DeFi Pulse — Backup & Deploy Guide
**Versión estable: v10.3** | Fecha: Marzo 2026

---

## ESTRUCTURA DE ARCHIVOS

```
defi-dashboard/
├── api/
│   └── zerion.js              ← Vercel serverless proxy (NO tocar)
├── src/
│   ├── App.jsx                ← UI completa (Overview/Precios/Watchlist/Análisis/Wallet)
│   ├── hooks/
│   │   └── useDefiData.js     ← Todos los hooks React
│   ├── services/
│   │   └── api.js             ← Fetches CoinGecko + Zerion
│   └── utils/
│       └── indicators.js      ← 14 indicadores técnicos
├── package.json
└── vite.config.js
```

---

## CÓMO HACER BACKUP ANTES DE CUALQUIER CAMBIO

```bash
# En Codespaces, antes de tocar cualquier archivo:
git add .
git commit -m "BACKUP estable antes de: [describe qué vas a cambiar]"
git push

# Si algo se rompe, vuelves con:
git log --oneline          # ver commits
git checkout <hash>        # volver a ese punto
```

---

## DEPLOY (Vercel + GitHub Codespaces)

```bash
# Después de actualizar archivos:
git add .
git commit -m "descripción del cambio"
git push
# Vercel redeploya automáticamente en ~1 minuto
```

### Variables de entorno en Vercel:
| Variable | Valor | Dónde |
|---|---|---|
| `VITE_ZERION_API_KEY` | tu key de zerion.io | Vercel → Settings → Environment Variables |

---

## QUÉ HACE CADA ARCHIVO

### `api.js` — reglas de fetch
- **Rate limit CoinGecko free**: max ~10-15 req/minuto en ráfaga
- Páginas 1+2 en paralelo → UI visible en ~1.5s
- Páginas 3-5 **secuenciales** con 700ms entre ellas (evita 429)
- Cache: precios 5min, historial 30min, búsquedas 15min
- `fetchPriceHistory()` devuelve `{ coin, btc }` — ambos objetos

### `useDefiData.js` — hooks
- `usePrices()`: carga CoinGecko → luego WS Binance con 1.5s delay
- `useAnalysis(coinId)`: espera 300ms, luego historial, luego precio
- Cancellation token (`cancelled`) evita setState en componentes desmontados

### `indicators.js` — cálculos
- Recibe: `generateSignal(prices, volumes, btcPrices)`
- `prices`: array de números (90 días)
- `volumes`: array de números o null
- `btcPrices`: array de números o null (para correlación)
- Devuelve objeto con `signal`, `atr`, `btcCorrelation`, `signals[]`

### `App.jsx` — UI
- Tab Análisis: busca cualquier moneda, no hardcodea sugerencias
- Precio en señal global: viene de `coinData` (siempre fetch fresco)
- Overview: solo 2 KPIs (Market Cap + Volumen), sin ETH hardcodeado

### `zerion.js` — proxy
- Solo para wallet. No tiene lógica que cambiar.
- Requiere `VITE_ZERION_API_KEY` en env de Vercel.

---

## ERRORES COMUNES Y SOLUCIÓN

| Error | Causa | Solución |
|---|---|---|
| "Failed to fetch" en análisis | Rate limit CoinGecko (429) | Espera 1 min, refresca. O reduce requests paralelos en api.js |
| Precios no cargan | Demasiados requests simultáneos | Ver `_bgRunning` flag en api.js |
| WS no conecta | Binance bloqueado en red | Normal en algunas redes, los precios cargan igual de CoinGecko |
| Análisis se queda cargando | Timeout en fetch historial | Subir `ms=8000` a `ms=12000` en fx() de api.js |
| Wallet "Zerion HTTP 401" | API key incorrecta o no seteada | Revisar env var en Vercel |
| Chains todos como "ethereum" | Bug viejo (resuelto v9) | Verificar `pos.relationships?.chain?.data?.id` en useDefiData |

---

## REGLAS PARA NO ROMPER EL PROYECTO

1. **Antes de cualquier cambio**: `git commit -m "BACKUP"` primero
2. **No cambiar la firma de `generateSignal`**: recibe `(prices, volumes, btcPrices)`
3. **No hacer más de 2 fetches en paralelo** a CoinGecko — causa 429
4. **`fetchPriceHistory` devuelve `{ coin, btc }`** — destructurar correctamente
5. **No mover** zerion.js — debe estar en `/api/zerion.js` (raíz del proyecto)
6. **Cache keys**: si cambias nombres de cache keys, usuarios pierden cache y hay requests extra al arrancar

---

## INDICADORES IMPLEMENTADOS (14)

| Indicador | Archivo | Nota |
|---|---|---|
| RSI 14 + RSI 7 | indicators.js | Umbrales dinámicos por régimen |
| Divergencia RSI | indicators.js | Bullish/bearish |
| MACD (12,26,9) | indicators.js | Cruce + aceleración histograma |
| EMA 20/50/200 | indicators.js | Golden cross largo plazo |
| Bollinger Bands (20,2) | indicators.js | |
| Stochastic RSI | indicators.js | |
| Williams %R | indicators.js | |
| ADX + DI+/DI- | indicators.js | Fuerza de tendencia |
| ROC 10d + ROC 30d | indicators.js | Rate of Change |
| Volumen relativo | indicators.js | vs promedio 20d |
| OBV + sesgo | indicators.js | Acumulación/distribución |
| Soporte/Resistencia | indicators.js | Rango 30d |
| ATR 14 | indicators.js | Stop/Target dinámicos |
| Correlación BTC | indicators.js | Pearson 30d sobre retornos |

---

// ── Cálculo de indicadores técnicos (puro JS, sin librerías) ──

// EMA — Exponential Moving Average
export function calcEMA(prices, period) {
  if (prices.length < period) return []
  const k   = 2 / (period + 1)
  const ema = [prices.slice(0, period).reduce((a,b)=>a+b,0) / period]
  for (let i = period; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[ema.length-1] * (1-k))
  }
  return ema
}

// SMA — Simple Moving Average
export function calcSMA(prices, period) {
  const sma = []
  for (let i = period - 1; i < prices.length; i++) {
    sma.push(prices.slice(i - period + 1, i + 1).reduce((a,b)=>a+b,0) / period)
  }
  return sma
}

// RSI — Relative Strength Index (14 períodos estándar)
export function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return []
  const changes = prices.slice(1).map((p,i) => p - prices[i])
  const rsi = []
  let avgGain = changes.slice(0, period).filter(c=>c>0).reduce((a,b)=>a+b,0) / period
  let avgLoss = Math.abs(changes.slice(0, period).filter(c=>c<0).reduce((a,b)=>a+b,0)) / period
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0
    avgGain = (avgGain * (period-1) + gain) / period
    avgLoss = (avgLoss * (period-1) + loss) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    rsi.push(100 - (100 / (1 + rs)))
  }
  return rsi
}

// MACD — Moving Average Convergence Divergence (12, 26, 9)
export function calcMACD(prices) {
  const ema12 = calcEMA(prices, 12)
  const ema26 = calcEMA(prices, 26)
  // Alinear — ema26 es más corto
  const diff  = ema26.length - (prices.length - 12 + 1 - 1)
  const macdLine   = ema12.slice(ema12.length - ema26.length).map((v,i) => v - ema26[i])
  const signalLine = calcEMA(macdLine, 9)
  const histogram  = signalLine.map((s,i) => macdLine[macdLine.length - signalLine.length + i] - s)
  return { macdLine, signalLine, histogram }
}

// Bollinger Bands (20 períodos, 2 desviaciones estándar)
export function calcBollinger(prices, period = 20, mult = 2) {
  const bands = []
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1)
    const mean  = slice.reduce((a,b)=>a+b,0) / period
    const std   = Math.sqrt(slice.reduce((a,b)=>a+(b-mean)**2,0) / period)
    bands.push({ mid: mean, upper: mean + mult*std, lower: mean - mult*std })
  }
  return bands
}

// Stochastic RSI (14,14,3,3)
export function calcStochRSI(prices, rsiPeriod=14, stochPeriod=14) {
  const rsi = calcRSI(prices, rsiPeriod)
  if (rsi.length < stochPeriod) return []
  const stoch = []
  for (let i = stochPeriod - 1; i < rsi.length; i++) {
    const slice = rsi.slice(i - stochPeriod + 1, i + 1)
    const mn = Math.min(...slice), mx = Math.max(...slice)
    stoch.push(mx === mn ? 50 : ((rsi[i] - mn) / (mx - mn)) * 100)
  }
  return stoch
}

// ── Generar señal de trading (COMPRAR / VENDER / NEUTRAL) ─────
export function generateSignal(prices) {
  if (!prices || prices.length < 30) return null

  const rsi       = calcRSI(prices, 14)
  const { macdLine, signalLine, histogram } = calcMACD(prices)
  const ema20     = calcEMA(prices, 20)
  const ema50     = calcEMA(prices, 50)
  const bollinger = calcBollinger(prices, 20)
  const stochRsi  = calcStochRSI(prices, 14, 14)

  const currentPrice = prices[prices.length - 1]
  const lastRSI      = rsi[rsi.length - 1]
  const lastMACD     = macdLine[macdLine.length - 1]
  const lastSignal   = signalLine[signalLine.length - 1]
  const lastHist     = histogram[histogram.length - 1]
  const prevHist     = histogram[histogram.length - 2]
  const lastEMA20    = ema20[ema20.length - 1]
  const lastEMA50    = ema50.length > 0 ? ema50[ema50.length - 1] : null
  const lastBoll     = bollinger[bollinger.length - 1]
  const lastStoch    = stochRsi[stochRsi.length - 1]

  let score = 0  // positivo = COMPRAR, negativo = VENDER
  const signals = []

  // RSI
  if (lastRSI < 30) { score += 2; signals.push({ ind:'RSI', val:`${lastRSI.toFixed(1)}`, msg:'Sobrevendido — señal de compra', type:'buy' }) }
  else if (lastRSI > 70) { score -= 2; signals.push({ ind:'RSI', val:`${lastRSI.toFixed(1)}`, msg:'Sobrecomprado — señal de venta', type:'sell' }) }
  else { signals.push({ ind:'RSI', val:`${lastRSI.toFixed(1)}`, msg:'Zona neutral', type:'neutral' }) }

  // MACD cruce
  if (lastHist > 0 && prevHist <= 0) { score += 2; signals.push({ ind:'MACD', val:`${lastHist.toFixed(4)}`, msg:'Cruce alcista — momentum positivo', type:'buy' }) }
  else if (lastHist < 0 && prevHist >= 0) { score -= 2; signals.push({ ind:'MACD', val:`${lastHist.toFixed(4)}`, msg:'Cruce bajista — momentum negativo', type:'sell' }) }
  else if (lastHist > 0) { score += 1; signals.push({ ind:'MACD', val:`${lastHist.toFixed(4)}`, msg:'Histograma positivo', type:'buy' }) }
  else { score -= 1; signals.push({ ind:'MACD', val:`${lastHist.toFixed(4)}`, msg:'Histograma negativo', type:'sell' }) }

  // EMA 20/50 cruce
  if (lastEMA50) {
    if (lastEMA20 > lastEMA50) { score += 1; signals.push({ ind:'EMA 20/50', val:`${((lastEMA20/lastEMA50-1)*100).toFixed(2)}%`, msg:'EMA20 > EMA50 — tendencia alcista', type:'buy' }) }
    else { score -= 1; signals.push({ ind:'EMA 20/50', val:`${((lastEMA20/lastEMA50-1)*100).toFixed(2)}%`, msg:'EMA20 < EMA50 — tendencia bajista', type:'sell' }) }
  }

  // Bollinger
  if (lastBoll) {
    if (currentPrice < lastBoll.lower) { score += 1; signals.push({ ind:'Bollinger', val:`${((currentPrice/lastBoll.lower-1)*100).toFixed(2)}%`, msg:'Precio bajo banda inferior — posible rebote', type:'buy' }) }
    else if (currentPrice > lastBoll.upper) { score -= 1; signals.push({ ind:'Bollinger', val:`${((currentPrice/lastBoll.upper-1)*100).toFixed(2)}%`, msg:'Precio sobre banda superior — posible corrección', type:'sell' }) }
    else { signals.push({ ind:'Bollinger', val:'Dentro', msg:'Precio dentro de las bandas', type:'neutral' }) }
  }

  // Stoch RSI
  if (lastStoch < 20) { score += 1; signals.push({ ind:'Stoch RSI', val:`${lastStoch.toFixed(1)}`, msg:'Sobrevendido', type:'buy' }) }
  else if (lastStoch > 80) { score -= 1; signals.push({ ind:'Stoch RSI', val:`${lastStoch.toFixed(1)}`, msg:'Sobrecomprado', type:'sell' }) }
  else { signals.push({ ind:'Stoch RSI', val:`${lastStoch.toFixed(1)}`, msg:'Zona neutral', type:'neutral' }) }

  // Señal global
  let overall, strength
  if (score >= 4)       { overall = 'COMPRAR';       strength = 'Fuerte' }
  else if (score >= 2)  { overall = 'COMPRAR';       strength = 'Moderado' }
  else if (score <= -4) { overall = 'VENDER';        strength = 'Fuerte' }
  else if (score <= -2) { overall = 'VENDER';        strength = 'Moderado' }
  else                  { overall = 'NEUTRAL';       strength = '' }

  return {
    overall, strength, score,
    rsi: lastRSI, macd: lastMACD, macdSignal: lastSignal, macdHist: lastHist,
    ema20: lastEMA20, ema50: lastEMA50,
    bollUpper: lastBoll?.upper, bollLower: lastBoll?.lower, bollMid: lastBoll?.mid,
    stochRsi: lastStoch,
    signals,
  }
}
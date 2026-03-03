// src/utils/indicators.js — v3
// Mejoras clave:
// - RSI percentílico (compara vs historia del propio activo, no umbral fijo)
// - Detección de régimen de mercado (tendencia/lateral/reversión)
// - Score por confianza del indicador según contexto ADX
// - Williams %R como confirmador adicional
// - Rate of Change (ROC) para momentum de precio
// - Precio promedio ponderado por volumen (VWAP aproximado)

export function calcEMA(prices, period) {
  if (prices.length < period) return []
  const k = 2 / (period + 1)
  const ema = [prices.slice(0, period).reduce((a, b) => a + b, 0) / period]
  for (let i = period; i < prices.length; i++)
    ema.push(prices[i] * k + ema[ema.length - 1] * (1 - k))
  return ema
}

export function calcSMA(prices, period) {
  const out = []
  for (let i = period - 1; i < prices.length; i++)
    out.push(prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period)
  return out
}

export function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return []
  const changes = prices.slice(1).map((p, i) => p - prices[i])
  let avgGain = changes.slice(0, period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period
  let avgLoss = Math.abs(changes.slice(0, period).filter(c => c < 0).reduce((a, b) => a + b, 0)) / period
  const rsi = []
  for (let i = period; i < changes.length; i++) {
    const g = changes[i] > 0 ? changes[i] : 0
    const l = changes[i] < 0 ? Math.abs(changes[i]) : 0
    avgGain = (avgGain * (period - 1) + g) / period
    avgLoss = (avgLoss * (period - 1) + l) / period
    rsi.push(100 - 100 / (1 + (avgLoss === 0 ? 9999 : avgGain / avgLoss)))
  }
  return rsi
}

export function calcMACD(prices) {
  const ema12 = calcEMA(prices, 12)
  const ema26 = calcEMA(prices, 26)
  const macdLine   = ema12.slice(ema12.length - ema26.length).map((v, i) => v - ema26[i])
  const signalLine = calcEMA(macdLine, 9)
  const histogram  = signalLine.map((s, i) => macdLine[macdLine.length - signalLine.length + i] - s)
  return { macdLine, signalLine, histogram }
}

export function calcBollinger(prices, period = 20, mult = 2) {
  const bands = []
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1)
    const mean  = slice.reduce((a, b) => a + b, 0) / period
    const std   = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period)
    bands.push({ mid: mean, upper: mean + mult * std, lower: mean - mult * std, std })
  }
  return bands
}

export function calcStochRSI(prices, rsiPeriod = 14, stochPeriod = 14) {
  const rsi = calcRSI(prices, rsiPeriod)
  const stoch = []
  for (let i = stochPeriod - 1; i < rsi.length; i++) {
    const slice = rsi.slice(i - stochPeriod + 1, i + 1)
    const mn = Math.min(...slice), mx = Math.max(...slice)
    stoch.push(mx === mn ? 50 : ((rsi[i] - mn) / (mx - mn)) * 100)
  }
  return stoch
}

export function calcOBV(prices, volumes) {
  if (!volumes || volumes.length !== prices.length) return []
  const obv = [0]
  for (let i = 1; i < prices.length; i++) {
    if      (prices[i] > prices[i-1]) obv.push(obv[i-1] + volumes[i])
    else if (prices[i] < prices[i-1]) obv.push(obv[i-1] - volumes[i])
    else                               obv.push(obv[i-1])
  }
  return obv
}

export function calcADX(highs, lows, closes, period = 14) {
  if (!highs || highs.length < period + 2) return { adx: [], pdi: [], mdi: [] }
  const tr = [], plusDM = [], minusDM = []
  for (let i = 1; i < closes.length; i++) {
    const h = highs[i] - highs[i-1]
    const l = lows[i-1]  - lows[i]
    plusDM.push(h > l && h > 0 ? h : 0)
    minusDM.push(l > h && l > 0 ? l : 0)
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])))
  }
  const smooth = arr => {
    const out = [arr.slice(0, period).reduce((a, b) => a + b, 0)]
    for (let i = period; i < arr.length; i++) out.push(out[out.length-1] - out[out.length-1]/period + arr[i])
    return out
  }
  const sTR = smooth(tr), sPDM = smooth(plusDM), sMDM = smooth(minusDM)
  const pdi = sPDM.map((v, i) => sTR[i] ? (v / sTR[i]) * 100 : 0)
  const mdi = sMDM.map((v, i) => sTR[i] ? (v / sTR[i]) * 100 : 0)
  const dx  = pdi.map((v, i) => (v + mdi[i]) ? Math.abs(v - mdi[i]) / (v + mdi[i]) * 100 : 0)
  const adx = smooth(dx).map(v => v / period)
  return { adx, pdi, mdi }
}

// ── Williams %R ───────────────────────────────────────────────
export function calcWilliamsR(highs, lows, closes, period = 14) {
  if (!highs || closes.length < period) return []
  const out = []
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1))
    const ll  = Math.min(...lows.slice(i - period + 1, i + 1))
    out.push(hh === ll ? -50 : ((hh - closes[i]) / (hh - ll)) * -100)
  }
  return out
}

// ── Rate of Change ────────────────────────────────────────────
export function calcROC(prices, period = 10) {
  const out = []
  for (let i = period; i < prices.length; i++)
    out.push(((prices[i] - prices[i-period]) / prices[i-period]) * 100)
  return out
}

// ── RSI percentílico ──────────────────────────────────────────
// Compara el RSI actual vs su distribución histórica → más preciso que umbral fijo
export function rsiPercentile(rsiSeries) {
  if (rsiSeries.length < 2) return 50
  const sorted = [...rsiSeries].sort((a, b) => a - b)
  const last   = rsiSeries[rsiSeries.length - 1]
  const rank   = sorted.filter(v => v <= last).length
  return (rank / sorted.length) * 100
}

// ── Divergencias (precio vs RSI) ─────────────────────────────
export function detectDivergence(prices, rsi, lookback = 14) {
  if (prices.length < lookback || rsi.length < lookback) return 'none'
  const rp = prices.slice(-lookback), rr = rsi.slice(-lookback)
  const priceDown = rp[rp.length-1] < rp[0], priceUp = rp[rp.length-1] > rp[0]
  const rsiUp     = rr[rr.length-1] > rr[0],  rsiDown = rr[rr.length-1] < rr[0]
  if (priceDown && rsiUp)  return 'bullish'
  if (priceUp   && rsiDown) return 'bearish'
  return 'none'
}

// ── Régimen de mercado ────────────────────────────────────────
export function detectRegime(prices, adxVal) {
  if (prices.length < 50) return 'unknown'
  const ema20 = calcEMA(prices, 20), ema50 = calcEMA(prices, 50)
  if (!ema50.length) return 'unknown'
  const e20 = ema20[ema20.length-1], e50 = ema50[ema50.length-1]
  const diff = (e20 - e50) / e50

  // ADX bajo → lateral independientemente de EMAs
  if (adxVal != null && adxVal < 18) return 'lateral'
  if (diff > 0.07)  return 'strong_bull'
  if (diff > 0.02)  return 'bull'
  if (diff < -0.07) return 'strong_bear'
  if (diff < -0.02) return 'bear'
  return 'lateral'
}

// ── Análisis de volumen ───────────────────────────────────────
export function analyzeVolume(prices, volumes, period = 20) {
  if (!volumes || volumes.length < period) return null
  const recent  = volumes.slice(-period)
  const avgVol  = recent.reduce((a, b) => a + b, 0) / period
  const lastVol = volumes[volumes.length - 1]
  const volRatio = lastVol / avgVol
  const priceDiff = prices[prices.length-1] - prices[prices.length-2]

  let signal = 'neutral', msg = ''
  if      (volRatio > 2.0 && priceDiff > 0)  { signal = 'buy';     msg = `Volumen ${volRatio.toFixed(1)}x · breakout alcista con alto volumen` }
  else if (volRatio > 1.5 && priceDiff > 0)  { signal = 'buy';     msg = `Volumen ${volRatio.toFixed(1)}x · subida confirmada` }
  else if (volRatio > 2.0 && priceDiff < 0)  { signal = 'sell';    msg = `Volumen ${volRatio.toFixed(1)}x · caída con alto volumen — sell off` }
  else if (volRatio > 1.5 && priceDiff < 0)  { signal = 'sell';    msg = `Volumen ${volRatio.toFixed(1)}x · bajada confirmada` }
  else if (volRatio < 0.4)                    { signal = 'neutral'; msg = `Volumen muy bajo (${(volRatio*100).toFixed(0)}%) · movimiento sin convicción` }
  else                                         { signal = 'neutral'; msg = `Volumen normal (${(volRatio*100).toFixed(0)}% del promedio 20d)` }

  const obv      = calcOBV(prices, volumes)
  const obvEMA   = calcEMA(obv, 10)
  const obvTrend = obvEMA.length > 2
    ? (obvEMA[obvEMA.length-1] > obvEMA[obvEMA.length-3] ? 'up' : 'down')
    : 'neutral'

  // Volumen en tendencia: más interesante si sube en días alcistas
  const upDays   = prices.slice(1).map((p, i) => p > prices[i])
  const upVol    = volumes.slice(1).filter((_, i) => upDays[i]).slice(-10).reduce((a,b)=>a+b,0)/10 || 0
  const downVol  = volumes.slice(1).filter((_, i) => !upDays[i]).slice(-10).reduce((a,b)=>a+b,0)/10 || 0
  const volBias  = upVol > downVol ? 'buy' : 'sell'

  return { avgVol, lastVol, volRatio, signal, msg, obvTrend, volBias, upVol, downVol }
}

// ── Soporte y resistencia (niveles clave) ─────────────────────
export function findSR(prices, lookback = 30) {
  const slice = prices.slice(-lookback)
  const support    = Math.min(...slice)
  const resistance = Math.max(...slice)
  const price      = prices[prices.length-1]
  const range      = resistance - support
  const position   = range > 0 ? (price - support) / range : 0.5

  // Niveles intermedios (pivots simples)
  const mid = (support + resistance) / 2
  return { support, resistance, mid, position, range }
}

// ── SEÑAL PRINCIPAL v3 ────────────────────────────────────────
export function generateSignal(prices, volumes = null, ohlcData = null) {
  if (!prices || prices.length < 30) return null

  const highs = ohlcData ? ohlcData.map(c => c.high)  : prices.map((p, i) => Math.max(p, i > 0 ? prices[i-1] : p))
  const lows  = ohlcData ? ohlcData.map(c => c.low)   : prices.map((p, i) => Math.min(p, i > 0 ? prices[i-1] : p))

  // ── Calcular todos los indicadores ────────────────────────
  const rsi14   = calcRSI(prices, 14)
  const rsi7    = calcRSI(prices, 7)
  const { macdLine, signalLine, histogram } = calcMACD(prices)
  const ema20   = calcEMA(prices, 20)
  const ema50   = calcEMA(prices, 50)
  const ema200  = calcEMA(prices, 200)
  const boll    = calcBollinger(prices, 20)
  const stoch   = calcStochRSI(prices, 14, 14)
  const { adx: adxArr, pdi, mdi } = calcADX(highs, lows, prices)
  const willR   = calcWilliamsR(highs, lows, prices, 14)
  const roc10   = calcROC(prices, 10)
  const roc30   = calcROC(prices, 30)
  const vol     = volumes ? analyzeVolume(prices, volumes) : null
  const sr      = findSR(prices, 30)
  const diverg  = detectDivergence(prices, rsi14)

  // ── Últimos valores ────────────────────────────────────────
  const price      = prices[prices.length - 1]
  const lastRSI    = rsi14[rsi14.length - 1]
  const lastRSI7   = rsi7[rsi7.length - 1]
  const lastHist   = histogram[histogram.length - 1]
  const prevHist   = histogram[histogram.length - 2]
  const prev2Hist  = histogram[histogram.length - 3]
  const lastBoll   = boll[boll.length - 1]
  const lastStoch  = stoch[stoch.length - 1]
  const lastE20    = ema20[ema20.length - 1]
  const lastE50    = ema50.length > 0 ? ema50[ema50.length - 1] : null
  const lastE200   = ema200.length > 0 ? ema200[ema200.length - 1] : null
  const lastADX    = adxArr.length > 0 ? adxArr[adxArr.length - 1] : null
  const lastPDI    = pdi.length > 0 ? pdi[pdi.length - 1] : null
  const lastMDI    = mdi.length > 0 ? mdi[mdi.length - 1] : null
  const lastWillR  = willR[willR.length - 1]
  const lastROC10  = roc10[roc10.length - 1]
  const lastROC30  = roc30[roc30.length - 1]
  const rsiPct     = rsiPercentile(rsi14)

  // ── Régimen (ajusta umbrales dinámicamente) ────────────────
  const regime  = detectRegime(prices, lastADX)
  const lateral = regime === 'lateral'
  const bull    = regime === 'bull' || regime === 'strong_bull'
  const bear    = regime === 'bear' || regime === 'strong_bear'

  // Peso del indicador según régimen ADX
  // En lateral, osciladores son más confiables; en tendencia, EMAs y MACD
  const wOsc  = lateral ? 1.5 : 1.0   // peso osciladores (RSI, Stoch, WilliamsR)
  const wTrend= lateral ? 0.6 : 1.3   // peso indicadores de tendencia (EMA, MACD)
  const wVol  = 1.2                    // volumen siempre importa

  // ── Umbrales dinámicos RSI por régimen ─────────────────────
  const rsiBuy  = regime === 'strong_bull' ? 22 : regime === 'bull' ? 27 : regime === 'strong_bear' ? 35 : 30
  const rsiSell = regime === 'strong_bull' ? 82 : regime === 'bull' ? 78 : regime === 'strong_bear' ? 62 : 70

  let score = 0
  const signals = []

  // ── 1. RSI con umbrales dinámicos + percentil ──────────────
  {
    const rsiContext = `(percentil histórico: ${rsiPct.toFixed(0)}%)`
    if (lastRSI < rsiBuy) {
      score += 2 * wOsc
      signals.push({ ind:'RSI 14', val:`${lastRSI.toFixed(1)}`, msg:`Sobrevendido — compra potencial ${rsiContext}`, type:'buy' })
    } else if (lastRSI > rsiSell) {
      score -= 2 * wOsc
      signals.push({ ind:'RSI 14', val:`${lastRSI.toFixed(1)}`, msg:`Sobrecomprado — venta potencial ${rsiContext}`, type:'sell' })
    } else if (lastRSI > 50 && bull) {
      score += 0.8 * wOsc
      signals.push({ ind:'RSI 14', val:`${lastRSI.toFixed(1)}`, msg:`>50 en tendencia alcista — momentum positivo ${rsiContext}`, type:'buy' })
    } else if (lastRSI < 50 && bear) {
      score -= 0.8 * wOsc
      signals.push({ ind:'RSI 14', val:`${lastRSI.toFixed(1)}`, msg:`<50 en tendencia bajista — momentum negativo ${rsiContext}`, type:'sell' })
    } else {
      signals.push({ ind:'RSI 14', val:`${lastRSI.toFixed(1)}`, msg:`Zona neutral ${rsiContext}`, type:'neutral' })
    }
  }

  // ── 2. Divergencia RSI ─────────────────────────────────────
  if (diverg === 'bullish') {
    score += 2.5 * wOsc
    signals.push({ ind:'Divergencia RSI', val:'🟢 Alcista', msg:'Precio baja pero RSI sube → reversión al alza probable', type:'buy' })
  } else if (diverg === 'bearish') {
    score -= 2.5 * wOsc
    signals.push({ ind:'Divergencia RSI', val:'🔴 Bajista', msg:'Precio sube pero RSI baja → reversión a la baja probable', type:'sell' })
  } else {
    signals.push({ ind:'Divergencia RSI', val:'Sin divergencia', msg:'RSI y precio alineados — sin señal de reversión', type:'neutral' })
  }

  // ── 3. MACD ────────────────────────────────────────────────
  {
    // Cruce + aceleración del histograma
    const histAccel = prev2Hist != null ? lastHist - prev2Hist : 0
    if (lastHist > 0 && prevHist <= 0) {
      score += 2.2 * wTrend
      signals.push({ ind:'MACD cruce', val:`hist: ${lastHist.toFixed(4)}`, msg:'Cruce alcista reciente → señal de entrada', type:'buy' })
    } else if (lastHist < 0 && prevHist >= 0) {
      score -= 2.2 * wTrend
      signals.push({ ind:'MACD cruce', val:`hist: ${lastHist.toFixed(4)}`, msg:'Cruce bajista reciente → señal de salida', type:'sell' })
    } else if (lastHist > 0 && histAccel > 0) {
      score += 1.0 * wTrend
      signals.push({ ind:'MACD histograma', val:`${lastHist.toFixed(4)} ↑`, msg:'Histograma positivo y acelerando', type:'buy' })
    } else if (lastHist < 0 && histAccel < 0) {
      score -= 1.0 * wTrend
      signals.push({ ind:'MACD histograma', val:`${lastHist.toFixed(4)} ↓`, msg:'Histograma negativo y empeorando', type:'sell' })
    } else if (lastHist > 0) {
      score += 0.5 * wTrend
      signals.push({ ind:'MACD histograma', val:`${lastHist.toFixed(4)}`, msg:'Histograma positivo (sin aceleración)', type:'buy' })
    } else {
      score -= 0.5 * wTrend
      signals.push({ ind:'MACD histograma', val:`${lastHist.toFixed(4)}`, msg:'Histograma negativo (sin aceleración)', type:'sell' })
    }
  }

  // ── 4. EMA 20/50 y 200 ────────────────────────────────────
  if (lastE50) {
    const d = ((lastE20 - lastE50) / lastE50 * 100).toFixed(2)
    if (lastE20 > lastE50) {
      score += 1.2 * wTrend
      signals.push({ ind:'EMA 20/50', val:`+${d}%`, msg:'EMA20 > EMA50 → tendencia alcista', type:'buy' })
    } else {
      score -= 1.2 * wTrend
      signals.push({ ind:'EMA 20/50', val:`${d}%`, msg:'EMA20 < EMA50 → tendencia bajista', type:'sell' })
    }
  }
  if (lastE200) {
    const d = ((price - lastE200) / lastE200 * 100).toFixed(1)
    if (price > lastE200) {
      score += 0.8 * wTrend
      signals.push({ ind:'EMA 200', val:`+${d}% sobre`, msg:'Precio sobre EMA200 → largo plazo alcista', type:'buy' })
    } else {
      score -= 0.8 * wTrend
      signals.push({ ind:'EMA 200', val:`${d}% bajo`, msg:'Precio bajo EMA200 → cuidado largo plazo', type:'sell' })
    }
  }

  // ── 5. Bollinger Bands ────────────────────────────────────
  if (lastBoll) {
    const pos = (price - lastBoll.lower) / (lastBoll.upper - lastBoll.lower)
    const bw  = ((lastBoll.upper - lastBoll.lower) / lastBoll.mid * 100).toFixed(1)
    if (price < lastBoll.lower) {
      score += 1.5 * wOsc
      signals.push({ ind:'Bollinger', val:`Bajo inf. · ancho ${bw}%`, msg:'Precio bajo banda inferior → zona de rebote', type:'buy' })
    } else if (price > lastBoll.upper) {
      score -= 1.5 * wOsc
      signals.push({ ind:'Bollinger', val:`Sobre sup. · ancho ${bw}%`, msg:'Precio sobre banda superior → posible corrección', type:'sell' })
    } else {
      signals.push({ ind:'Bollinger', val:`${(pos*100).toFixed(0)}% de banda · ancho ${bw}%`, msg:`Precio en ${pos > 0.6 ? 'zona alta' : pos < 0.4 ? 'zona baja' : 'centro'}`, type:'neutral' })
    }
  }

  // ── 6. Stochastic RSI ─────────────────────────────────────
  if (lastStoch < 15) {
    score += 1.2 * wOsc
    signals.push({ ind:'Stoch RSI', val:`${lastStoch.toFixed(1)}`, msg:'Sobrevendido extremo (<15)', type:'buy' })
  } else if (lastStoch < 25) {
    score += 0.8 * wOsc
    signals.push({ ind:'Stoch RSI', val:`${lastStoch.toFixed(1)}`, msg:'Zona sobrevendido (<25)', type:'buy' })
  } else if (lastStoch > 85) {
    score -= 1.2 * wOsc
    signals.push({ ind:'Stoch RSI', val:`${lastStoch.toFixed(1)}`, msg:'Sobrecomprado extremo (>85)', type:'sell' })
  } else if (lastStoch > 75) {
    score -= 0.8 * wOsc
    signals.push({ ind:'Stoch RSI', val:`${lastStoch.toFixed(1)}`, msg:'Zona sobrecomprado (>75)', type:'sell' })
  } else {
    signals.push({ ind:'Stoch RSI', val:`${lastStoch.toFixed(1)}`, msg:'Zona neutral', type:'neutral' })
  }

  // ── 7. Williams %R ────────────────────────────────────────
  if (lastWillR != null) {
    if (lastWillR < -80) {
      score += 1.0 * wOsc
      signals.push({ ind:'Williams %R', val:`${lastWillR.toFixed(1)}`, msg:'Sobrevendido extremo (<-80)', type:'buy' })
    } else if (lastWillR > -20) {
      score -= 1.0 * wOsc
      signals.push({ ind:'Williams %R', val:`${lastWillR.toFixed(1)}`, msg:'Sobrecomprado (>-20)', type:'sell' })
    } else {
      signals.push({ ind:'Williams %R', val:`${lastWillR.toFixed(1)}`, msg:'Zona neutral (-80 a -20)', type:'neutral' })
    }
  }

  // ── 8. ADX + DI ──────────────────────────────────────────
  if (lastADX != null) {
    const strength = lastADX > 30 ? 'Fuerte' : lastADX > 20 ? 'Moderada' : 'Débil/Lateral'
    if (lastADX > 25 && lastPDI > lastMDI) {
      score += 1.0 * wTrend
      signals.push({ ind:'ADX + DI', val:`${lastADX.toFixed(1)} · ${strength}`, msg:`+DI>${lastPDI.toFixed(1)} > -DI>${lastMDI.toFixed(1)} · tendencia alcista fuerte`, type:'buy' })
    } else if (lastADX > 25 && lastPDI < lastMDI) {
      score -= 1.0 * wTrend
      signals.push({ ind:'ADX + DI', val:`${lastADX.toFixed(1)} · ${strength}`, msg:`-DI>${lastMDI.toFixed(1)} > +DI>${lastPDI.toFixed(1)} · tendencia bajista fuerte`, type:'sell' })
    } else {
      signals.push({ ind:'ADX + DI', val:`${lastADX.toFixed(1)} · ${strength}`, msg:`Mercado lateral o tendencia débil — indicadores menos fiables`, type:'neutral' })
    }
  }

  // ── 9. ROC — Momentum de precio ──────────────────────────
  if (lastROC10 != null) {
    if (lastROC10 > 5) {
      score += 0.7 * wTrend
      signals.push({ ind:'ROC 10d', val:`+${lastROC10.toFixed(2)}%`, msg:'Momentum positivo fuerte en 10 días', type:'buy' })
    } else if (lastROC10 < -5) {
      score -= 0.7 * wTrend
      signals.push({ ind:'ROC 10d', val:`${lastROC10.toFixed(2)}%`, msg:'Momentum negativo fuerte en 10 días', type:'sell' })
    } else {
      signals.push({ ind:'ROC 10d', val:`${lastROC10.toFixed(2)}%`, msg:'Momentum neutral a 10 días', type:'neutral' })
    }
  }
  if (lastROC30 != null) {
    if (lastROC30 > 15) {
      score += 0.5 * wTrend
      signals.push({ ind:'ROC 30d', val:`+${lastROC30.toFixed(2)}%`, msg:'Tendencia mensual positiva (+15%)', type:'buy' })
    } else if (lastROC30 < -15) {
      score -= 0.5 * wTrend
      signals.push({ ind:'ROC 30d', val:`${lastROC30.toFixed(2)}%`, msg:'Tendencia mensual negativa (-15%)', type:'sell' })
    } else {
      signals.push({ ind:'ROC 30d', val:`${lastROC30.toFixed(2)}%`, msg:'Tendencia mensual moderada', type:'neutral' })
    }
  }

  // ── 10. Volumen + OBV ─────────────────────────────────────
  if (vol) {
    if (vol.signal === 'buy')  score += 1.0 * wVol
    if (vol.signal === 'sell') score -= 1.0 * wVol
    signals.push({ ind:'Volumen', val:`${(vol.volRatio*100).toFixed(0)}% prom.`, msg:vol.msg, type:vol.signal })

    if (vol.obvTrend === 'up') {
      score += 0.8 * wVol
      signals.push({ ind:'OBV', val:'▲ Acumulación', msg:'Compradores absorbiendo oferta', type:'buy' })
    } else if (vol.obvTrend === 'down') {
      score -= 0.8 * wVol
      signals.push({ ind:'OBV', val:'▼ Distribución', msg:'Vendedores presionando precio', type:'sell' })
    } else {
      signals.push({ ind:'OBV', val:'Neutral', msg:'Sin tendencia clara de volumen', type:'neutral' })
    }

    // Sesgo de volumen (más vol en días alcistas vs bajistas)
    if (vol.volBias === 'buy' && bull) {
      score += 0.5 * wVol
      signals.push({ ind:'Sesgo de volumen', val:'Alcista', msg:'Más volumen en días de subida que de bajada', type:'buy' })
    } else if (vol.volBias === 'sell' && bear) {
      score -= 0.5 * wVol
      signals.push({ ind:'Sesgo de volumen', val:'Bajista', msg:'Más volumen en días de bajada', type:'sell' })
    }
  }

  // ── 11. Soporte / Resistencia ────────────────────────────
  if (sr.position < 0.08) {
    score += 1.0
    signals.push({ ind:'Soporte/Resistencia', val:`Cerca soporte $${sr.support.toFixed(2)}`, msg:'Precio cerca del soporte 30d — zona de rebote', type:'buy' })
  } else if (sr.position > 0.92) {
    score -= 1.0
    signals.push({ ind:'Soporte/Resistencia', val:`Cerca resistencia $${sr.resistance.toFixed(2)}`, msg:'Precio cerca de resistencia 30d — posible rechazo', type:'sell' })
  } else {
    const pos = (sr.position * 100).toFixed(0)
    signals.push({ ind:'Soporte/Resistencia', val:`${pos}% del rango`, msg:`S: $${sr.support.toFixed(2)} · R: $${sr.resistance.toFixed(2)}`, type:'neutral' })
  }

  // ── Score final ───────────────────────────────────────────
  // Score máximo teórico ~20 con todos los indicadores
  const buyCount  = signals.filter(s => s.type === 'buy').length
  const sellCount = signals.filter(s => s.type === 'sell').length
  const totalSig  = signals.length

  // Confianza = proporción de señales alineadas, ponderada por ADX
  const alignPct    = Math.max(buyCount, sellCount) / totalSig
  const adxBoost    = lastADX != null ? Math.min(lastADX / 30, 1) : 0.5
  const confidence  = Math.round(alignPct * 70 + adxBoost * 20 + (Math.abs(score) > 5 ? 10 : 0))

  let overall, strength
  if      (score >= 6)  { overall = 'COMPRAR'; strength = 'Fuerte' }
  else if (score >= 3)  { overall = 'COMPRAR'; strength = 'Moderado' }
  else if (score <= -6) { overall = 'VENDER';  strength = 'Fuerte' }
  else if (score <= -3) { overall = 'VENDER';  strength = 'Moderado' }
  else                  { overall = 'NEUTRAL'; strength = lateral ? '(mercado lateral)' : '' }

  return {
    overall, strength, confidence, score: Math.round(score * 10) / 10,
    regime, divergence: diverg,
    rsi: lastRSI, rsi7: lastRSI7, rsiPercentile: rsiPct,
    macd: macdLine[macdLine.length-1], macdSignal: signalLine[signalLine.length-1], macdHist: lastHist,
    ema20: lastE20, ema50: lastE50, ema200: lastE200,
    bollUpper: lastBoll?.upper, bollLower: lastBoll?.lower, bollMid: lastBoll?.mid, bollStd: lastBoll?.std,
    stochRsi: lastStoch, williamsR: lastWillR,
    roc10: lastROC10, roc30: lastROC30,
    adx: lastADX, pdi: lastPDI, mdi: lastMDI,
    support: sr.support, resistance: sr.resistance, srPosition: sr.position,
    volRatio: vol?.volRatio, obvTrend: vol?.obvTrend, volBias: vol?.volBias,
    currentPrice: price,
    buyCount, sellCount, totalSignals: totalSig,
    signals,
  }
}
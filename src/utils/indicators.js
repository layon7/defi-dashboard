// src/utils/indicators.js — v2
// Timeframe: DIARIO (1D) sobre 90 días de histórico
// Mejoras: OBV, divergencias RSI, ADX, contexto de tendencia, señales ponderadas

// ── Funciones base ────────────────────────────────────────────
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
    const gain = changes[i] > 0 ? changes[i] : 0
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    rsi.push(100 - (100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss))))
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
  return prices.slice(period - 1).map((_, idx) => {
    const slice = prices.slice(idx, idx + period)
    const mean  = slice.reduce((a, b) => a + b, 0) / period
    const std   = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period)
    return { mid: mean, upper: mean + mult * std, lower: mean - mult * std }
  })
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

// ── OBV — On Balance Volume ───────────────────────────────────
// Requiere precios + volúmenes del mismo largo
export function calcOBV(prices, volumes) {
  if (!volumes || volumes.length !== prices.length) return []
  const obv = [0]
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i-1])      obv.push(obv[i-1] + volumes[i])
    else if (prices[i] < prices[i-1]) obv.push(obv[i-1] - volumes[i])
    else                               obv.push(obv[i-1])
  }
  return obv
}

// ── ADX — Average Directional Index (fuerza de tendencia) ────
export function calcADX(highs, lows, closes, period = 14) {
  if (!highs || highs.length < period + 1) return { adx: [], pdi: [], mdi: [] }
  const tr = [], plusDM = [], minusDM = []
  for (let i = 1; i < closes.length; i++) {
    const h = highs[i] - highs[i-1]
    const l = lows[i-1] - lows[i]
    plusDM.push(h > l && h > 0 ? h : 0)
    minusDM.push(l > h && l > 0 ? l : 0)
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])))
  }
  const smooth = (arr) => {
    const out = [arr.slice(0, period).reduce((a, b) => a + b, 0)]
    for (let i = period; i < arr.length; i++) out.push(out[out.length-1] - out[out.length-1]/period + arr[i])
    return out
  }
  const sTR = smooth(tr), sPDM = smooth(plusDM), sMDM = smooth(minusDM)
  const pdi = sPDM.map((v, i) => sTR[i] ? (v / sTR[i]) * 100 : 0)
  const mdi = sMDM.map((v, i) => sTR[i] ? (v / sTR[i]) * 100 : 0)
  const dx  = pdi.map((v, i) => pdi[i] + mdi[i] ? Math.abs(v - mdi[i]) / (v + mdi[i]) * 100 : 0)
  const adx = smooth(dx).map(v => v / period) // normalize
  return { adx, pdi, mdi }
}

// ── Divergencias RSI ──────────────────────────────────────────
// Busca divergencia alcista (precio baja, RSI sube) o bajista (precio sube, RSI baja)
export function detectDivergence(prices, rsi, lookback = 10) {
  if (prices.length < lookback || rsi.length < lookback) return 'none'
  const recentPrices = prices.slice(-lookback)
  const recentRSI    = rsi.slice(-lookback)
  const priceDown = recentPrices[recentPrices.length-1] < recentPrices[0]
  const priceUp   = recentPrices[recentPrices.length-1] > recentPrices[0]
  const rsiUp     = recentRSI[recentRSI.length-1]   > recentRSI[0]
  const rsiDown   = recentRSI[recentRSI.length-1]   < recentRSI[0]
  if (priceDown && rsiUp)  return 'bullish'   // divergencia alcista — señal de compra
  if (priceUp   && rsiDown) return 'bearish'  // divergencia bajista — señal de venta
  return 'none'
}

// ── Análisis de volumen ───────────────────────────────────────
export function analyzeVolume(prices, volumes, period = 20) {
  if (!volumes || volumes.length < period) return null
  const recent    = volumes.slice(-period)
  const avgVol    = recent.reduce((a, b) => a + b, 0) / period
  const lastVol   = volumes[volumes.length - 1]
  const lastPrice = prices[prices.length - 1]
  const prevPrice = prices[prices.length - 2]
  const volRatio  = lastVol / avgVol

  let signal = 'neutral', msg = ''
  if (volRatio > 1.5 && lastPrice > prevPrice)       { signal = 'buy';     msg = `Volumen ${(volRatio).toFixed(1)}x promedio con precio subiendo — confirmación alcista` }
  else if (volRatio > 1.5 && lastPrice < prevPrice)  { signal = 'sell';    msg = `Volumen ${(volRatio).toFixed(1)}x promedio con precio bajando — confirmación bajista` }
  else if (volRatio < 0.5)                            { signal = 'neutral'; msg = `Volumen bajo (${(volRatio*100).toFixed(0)}% del promedio) — movimiento sin convicción` }
  else                                                { signal = 'neutral'; msg = `Volumen normal (${(volRatio*100).toFixed(0)}% del promedio)` }

  // OBV trend
  const obv       = calcOBV(prices, volumes)
  const obvEMA    = calcEMA(obv, 10)
  const obvTrend  = obvEMA.length > 1 ? (obvEMA[obvEMA.length-1] > obvEMA[obvEMA.length-2] ? 'up' : 'down') : 'neutral'

  return { avgVol, lastVol, volRatio, signal, msg, obvTrend }
}

// ── Contexto de tendencia ─────────────────────────────────────
// Detecta si el mercado está en tendencia o lateral → ajusta señales RSI
export function detectTrendContext(prices) {
  if (prices.length < 50) return 'unknown'
  const ema20 = calcEMA(prices, 20)
  const ema50 = calcEMA(prices, 50)
  if (!ema50.length) return 'unknown'
  const lastE20 = ema20[ema20.length - 1]
  const lastE50 = ema50[ema50.length - 1]
  const diff    = (lastE20 - lastE50) / lastE50
  if (diff > 0.05)  return 'strong_bull'  // EMA20 >5% sobre EMA50
  if (diff > 0.01)  return 'bull'
  if (diff < -0.05) return 'strong_bear'
  if (diff < -0.01) return 'bear'
  return 'lateral'
}

// ── Soporte y resistencia simples ─────────────────────────────
export function findSupportResistance(prices, lookback = 30) {
  const recent = prices.slice(-lookback)
  const support    = Math.min(...recent)
  const resistance = Math.max(...recent)
  const current    = prices[prices.length - 1]
  const range      = resistance - support
  const position   = range > 0 ? (current - support) / range : 0.5 // 0=soporte, 1=resistencia
  return { support, resistance, position }
}

// ── SEÑAL PRINCIPAL — v2 mejorada ─────────────────────────────
export function generateSignal(prices, volumes = null, ohlcData = null) {
  if (!prices || prices.length < 30) return null

  // Extraer high/low de OHLC si disponibles, sino aproximar
  const highs  = ohlcData ? ohlcData.map(c => c.high)  : prices.map((p, i) => i > 0 ? Math.max(p, prices[i-1]) : p)
  const lows   = ohlcData ? ohlcData.map(c => c.low)   : prices.map((p, i) => i > 0 ? Math.min(p, prices[i-1]) : p)

  const rsi      = calcRSI(prices, 14)
  const rsiShort = calcRSI(prices, 7)   // RSI rápido para confirmación
  const { macdLine, signalLine, histogram } = calcMACD(prices)
  const ema20    = calcEMA(prices, 20)
  const ema50    = calcEMA(prices, 50)
  const ema200   = calcEMA(prices, 200) // golden cross largo plazo
  const boll     = calcBollinger(prices, 20)
  const stoch    = calcStochRSI(prices, 14, 14)
  const { adx: adxArr, pdi, mdi } = calcADX(highs, lows, prices)
  const volAnalysis = volumes ? analyzeVolume(prices, volumes) : null
  const divergence  = detectDivergence(prices, rsi)
  const trend       = detectTrendContext(prices)
  const sr          = findSupportResistance(prices)

  const price     = prices[prices.length - 1]
  const lastRSI   = rsi[rsi.length - 1]
  const lastRSI7  = rsiShort[rsiShort.length - 1]
  const lastHist  = histogram[histogram.length - 1]
  const prevHist  = histogram[histogram.length - 2]
  const lastBoll  = boll[boll.length - 1]
  const lastStoch = stoch[stoch.length - 1]
  const lastE20   = ema20[ema20.length - 1]
  const lastE50   = ema50.length > 0 ? ema50[ema50.length - 1] : null
  const lastE200  = ema200.length > 0 ? ema200[ema200.length - 1] : null
  const lastADX   = adxArr.length > 0 ? adxArr[adxArr.length - 1] : null
  const lastPDI   = pdi.length > 0 ? pdi[pdi.length - 1] : null
  const lastMDI   = mdi.length > 0 ? mdi[mdi.length - 1] : null

  let score = 0
  const signals = []

  // ── RSI ajustado por contexto ─────────────────────────────
  // En bull fuerte, sobrecomprado es normal — subimos el umbral
  const rsiBuyThresh  = trend === 'strong_bull' ? 25 : trend === 'bull' ? 28 : 30
  const rsiSellThresh = trend === 'strong_bull' ? 80 : trend === 'bear'  ? 65 : 70

  if (lastRSI < rsiBuyThresh) {
    score += 2
    signals.push({ ind:'RSI (14)', val:`${lastRSI.toFixed(1)}`, msg:`Sobrevendido (<${rsiBuyThresh}) → señal de compra`, type:'buy' })
  } else if (lastRSI > rsiSellThresh) {
    score -= 2
    signals.push({ ind:'RSI (14)', val:`${lastRSI.toFixed(1)}`, msg:`Sobrecomprado (>${rsiSellThresh}) → señal de venta`, type:'sell' })
  } else {
    // RSI en zona media: tendencia importa
    if (lastRSI > 50 && (trend==='bull'||trend==='strong_bull')) {
      score += 1
      signals.push({ ind:'RSI (14)', val:`${lastRSI.toFixed(1)}`, msg:'RSI >50 en tendencia alcista — momentum positivo', type:'buy' })
    } else if (lastRSI < 50 && (trend==='bear'||trend==='strong_bear')) {
      score -= 1
      signals.push({ ind:'RSI (14)', val:`${lastRSI.toFixed(1)}`, msg:'RSI <50 en tendencia bajista — momentum negativo', type:'sell' })
    } else {
      signals.push({ ind:'RSI (14)', val:`${lastRSI.toFixed(1)}`, msg:'Zona neutral — sin señal clara', type:'neutral' })
    }
  }

  // ── Divergencia RSI ────────────────────────────────────────
  if (divergence === 'bullish') {
    score += 2
    signals.push({ ind:'Divergencia RSI', val:'Alcista', msg:'Precio bajando pero RSI subiendo — señal de reversión al alza', type:'buy' })
  } else if (divergence === 'bearish') {
    score -= 2
    signals.push({ ind:'Divergencia RSI', val:'Bajista', msg:'Precio subiendo pero RSI bajando — señal de reversión a la baja', type:'sell' })
  } else {
    signals.push({ ind:'Divergencia RSI', val:'Ninguna', msg:'Sin divergencia detectada', type:'neutral' })
  }

  // ── MACD ──────────────────────────────────────────────────
  if (lastHist > 0 && prevHist <= 0)      { score += 2; signals.push({ ind:'MACD cruce', val:`hist: ${lastHist.toFixed(5)}`, msg:'Cruce alcista → entrada potencial', type:'buy' }) }
  else if (lastHist < 0 && prevHist >= 0) { score -= 2; signals.push({ ind:'MACD cruce', val:`hist: ${lastHist.toFixed(5)}`, msg:'Cruce bajista → salida potencial', type:'sell' }) }
  else if (lastHist > 0)                  { score += 1; signals.push({ ind:'MACD histograma', val:`${lastHist.toFixed(5)}`, msg:'Histograma positivo y creciente', type:'buy' }) }
  else                                     { score -= 1; signals.push({ ind:'MACD histograma', val:`${lastHist.toFixed(5)}`, msg:'Histograma negativo — presión vendedora', type:'sell' }) }

  // ── EMA cruce ─────────────────────────────────────────────
  if (lastE50) {
    if (lastE20 > lastE50) {
      score += 1
      signals.push({ ind:'EMA 20/50', val:`+${((lastE20/lastE50-1)*100).toFixed(2)}%`, msg:'EMA20 sobre EMA50 — tendencia alcista', type:'buy' })
    } else {
      score -= 1
      signals.push({ ind:'EMA 20/50', val:`${((lastE20/lastE50-1)*100).toFixed(2)}%`, msg:'EMA20 bajo EMA50 — tendencia bajista', type:'sell' })
    }
  }

  // ── Golden/Death cross EMA200 ──────────────────────────────
  if (lastE200) {
    if (price > lastE200) {
      score += 1
      signals.push({ ind:'EMA 200 (largo plazo)', val:`precio ${((price/lastE200-1)*100).toFixed(1)}% sobre`, msg:'Precio sobre EMA200 — tendencia largo plazo alcista', type:'buy' })
    } else {
      score -= 1
      signals.push({ ind:'EMA 200 (largo plazo)', val:`precio ${((price/lastE200-1)*100).toFixed(1)}% bajo`, msg:'Precio bajo EMA200 — cuidado en largo plazo', type:'sell' })
    }
  }

  // ── Bollinger con contexto ─────────────────────────────────
  if (lastBoll) {
    const bWidth = (lastBoll.upper - lastBoll.lower) / lastBoll.mid
    if (price < lastBoll.lower) {
      score += 1
      signals.push({ ind:'Bollinger Bands', val:'Bajo banda inf.', msg:`Precio bajo banda inferior → posible rebote (ancho: ${(bWidth*100).toFixed(1)}%)`, type:'buy' })
    } else if (price > lastBoll.upper) {
      score -= 1
      signals.push({ ind:'Bollinger Bands', val:'Sobre banda sup.', msg:`Precio sobre banda superior → posible corrección (ancho: ${(bWidth*100).toFixed(1)}%)`, type:'sell' })
    } else {
      // Posición dentro de la banda
      const pos = (price - lastBoll.lower) / (lastBoll.upper - lastBoll.lower)
      signals.push({ ind:'Bollinger Bands', val:`${(pos*100).toFixed(0)}% de banda`, msg:`Precio en ${pos>0.5?'mitad superior':'mitad inferior'} de la banda`, type:'neutral' })
    }
  }

  // ── Stoch RSI ─────────────────────────────────────────────
  if (lastStoch < 20)      { score += 1; signals.push({ ind:'Stoch RSI', val:`${lastStoch.toFixed(1)}`, msg:'Sobrevendido (<20)', type:'buy' }) }
  else if (lastStoch > 80) { score -= 1; signals.push({ ind:'Stoch RSI', val:`${lastStoch.toFixed(1)}`, msg:'Sobrecomprado (>80)', type:'sell' }) }
  else                      { signals.push({ ind:'Stoch RSI', val:`${lastStoch.toFixed(1)}`, msg:'Zona neutral', type:'neutral' }) }

  // ── ADX — fuerza de tendencia ──────────────────────────────
  if (lastADX != null) {
    const trendStrength = lastADX > 25 ? 'Tendencia fuerte' : lastADX > 20 ? 'Tendencia moderada' : 'Mercado lateral'
    const trendDir = lastPDI > lastMDI ? '(dirección: alcista)' : '(dirección: bajista)'
    const adxType  = lastADX > 25 ? (lastPDI > lastMDI ? 'buy' : 'sell') : 'neutral'
    if (lastADX > 25 && lastPDI > lastMDI) score += 1
    if (lastADX > 25 && lastPDI < lastMDI) score -= 1
    signals.push({ ind:'ADX (fuerza)', val:`${lastADX.toFixed(1)}`, msg:`${trendStrength} ${trendDir}`, type:adxType })
  }

  // ── Volumen ───────────────────────────────────────────────
  if (volAnalysis) {
    if (volAnalysis.signal === 'buy')     score += 1
    if (volAnalysis.signal === 'sell')    score -= 1
    signals.push({ ind:'Volumen', val:`${(volAnalysis.volRatio*100).toFixed(0)}% prom.`, msg:volAnalysis.msg, type:volAnalysis.signal })
    signals.push({ ind:'OBV tendencia', val:volAnalysis.obvTrend==='up'?'Creciente':'Decreciente', msg:volAnalysis.obvTrend==='up'?'Acumulación — compradores dominan':'Distribución — vendedores dominan', type:volAnalysis.obvTrend==='up'?'buy':'sell' })
    if (volAnalysis.obvTrend==='up')  score += 1
    if (volAnalysis.obvTrend==='down') score -= 1
  }

  // ── Soporte/Resistencia ────────────────────────────────────
  const srPos = sr.position
  if (srPos < 0.1) {
    score += 1
    signals.push({ ind:'Soporte/Resistencia', val:`Cerca soporte $${sr.support.toFixed(2)}`, msg:'Precio cerca del soporte del período — posible rebote', type:'buy' })
  } else if (srPos > 0.9) {
    score -= 1
    signals.push({ ind:'Soporte/Resistencia', val:`Cerca resist. $${sr.resistance.toFixed(2)}`, msg:'Precio cerca de resistencia — posible rechazo', type:'sell' })
  } else {
    signals.push({ ind:'Soporte/Resistencia', val:`${(srPos*100).toFixed(0)}% del rango`, msg:`Entre soporte $${sr.support.toFixed(2)} y resistencia $${sr.resistance.toFixed(2)}`, type:'neutral' })
  }

  // ── Señal global con score ajustado por contexto ──────────
  const maxScore = 12  // score máximo posible con todos los indicadores
  let overall, strength, confidence

  // Ajuste: en tendencia fuerte, el score neutro se desplaza
  const adjustedScore = trend === 'strong_bull' ? score - 1 : trend === 'strong_bear' ? score + 1 : score

  if      (adjustedScore >= 5)  { overall = 'COMPRAR'; strength = 'Fuerte';   confidence = Math.min(90, 60 + adjustedScore * 3) }
  else if (adjustedScore >= 3)  { overall = 'COMPRAR'; strength = 'Moderado'; confidence = Math.min(75, 50 + adjustedScore * 3) }
  else if (adjustedScore <= -5) { overall = 'VENDER';  strength = 'Fuerte';   confidence = Math.min(90, 60 + Math.abs(adjustedScore) * 3) }
  else if (adjustedScore <= -3) { overall = 'VENDER';  strength = 'Moderado'; confidence = Math.min(75, 50 + Math.abs(adjustedScore) * 3) }
  else                          { overall = 'NEUTRAL'; strength = '';          confidence = 40 + Math.abs(adjustedScore) * 5 }

  return {
    overall, strength, confidence, score, adjustedScore,
    trend, divergence,
    rsi: lastRSI, rsi7: lastRSI7,
    macd: macdLine[macdLine.length-1],
    macdSignal: signalLine[signalLine.length-1],
    macdHist: lastHist,
    ema20: lastE20, ema50: lastE50, ema200: lastE200,
    bollUpper: lastBoll?.upper, bollLower: lastBoll?.lower, bollMid: lastBoll?.mid,
    stochRsi: lastStoch,
    adx: lastADX, pdi: lastPDI, mdi: lastMDI,
    support: sr.support, resistance: sr.resistance, srPosition: sr.position,
    volRatio: volAnalysis?.volRatio, obvTrend: volAnalysis?.obvTrend,
    currentPrice: price,
    signals,
  }
}
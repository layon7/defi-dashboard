// src/utils/indicators.js — v3.1
// NUEVOS: ATR (stop/target), correlación BTC, Williams %R, ROC
// MEJORADOS: RSI percentílico, divergencias ponderadas, score por régimen ADX

export const calcEMA = (prices, period) => {
  if (prices.length < period) return []
  const k = 2/(period+1)
  const ema = [prices.slice(0,period).reduce((a,b)=>a+b,0)/period]
  for (let i=period; i<prices.length; i++) ema.push(prices[i]*k + ema[ema.length-1]*(1-k))
  return ema
}

export const calcSMA = (prices, period) => {
  const out = []
  for (let i=period-1; i<prices.length; i++)
    out.push(prices.slice(i-period+1,i+1).reduce((a,b)=>a+b,0)/period)
  return out
}

export function calcRSI(prices, period=14) {
  if (prices.length < period+1) return []
  const ch = prices.slice(1).map((p,i)=>p-prices[i])
  let ag = ch.slice(0,period).filter(c=>c>0).reduce((a,b)=>a+b,0)/period
  let al = Math.abs(ch.slice(0,period).filter(c=>c<0).reduce((a,b)=>a+b,0))/period
  const rsi=[]
  for (let i=period; i<ch.length; i++) {
    const g=ch[i]>0?ch[i]:0, l=ch[i]<0?Math.abs(ch[i]):0
    ag=(ag*(period-1)+g)/period; al=(al*(period-1)+l)/period
    rsi.push(100-100/(1+(al===0?9999:ag/al)))
  }
  return rsi
}

export function calcMACD(prices) {
  const e12=calcEMA(prices,12), e26=calcEMA(prices,26)
  const ml=e12.slice(e12.length-e26.length).map((v,i)=>v-e26[i])
  const sl=calcEMA(ml,9)
  const hist=sl.map((s,i)=>ml[ml.length-sl.length+i]-s)
  return { macdLine:ml, signalLine:sl, histogram:hist }
}

export function calcBollinger(prices, period=20, mult=2) {
  const bands=[]
  for (let i=period-1; i<prices.length; i++) {
    const sl=prices.slice(i-period+1,i+1)
    const mean=sl.reduce((a,b)=>a+b,0)/period
    const std=Math.sqrt(sl.reduce((a,b)=>a+(b-mean)**2,0)/period)
    bands.push({ mid:mean, upper:mean+mult*std, lower:mean-mult*std, std })
  }
  return bands
}

export function calcStochRSI(prices, rp=14, sp=14) {
  const rsi=calcRSI(prices,rp), out=[]
  for (let i=sp-1; i<rsi.length; i++) {
    const sl=rsi.slice(i-sp+1,i+1)
    const mn=Math.min(...sl), mx=Math.max(...sl)
    out.push(mx===mn?50:((rsi[i]-mn)/(mx-mn))*100)
  }
  return out
}

export function calcOBV(prices, volumes) {
  if (!volumes||volumes.length!==prices.length) return []
  const obv=[0]
  for (let i=1; i<prices.length; i++) {
    if (prices[i]>prices[i-1]) obv.push(obv[i-1]+volumes[i])
    else if (prices[i]<prices[i-1]) obv.push(obv[i-1]-volumes[i])
    else obv.push(obv[i-1])
  }
  return obv
}

export function calcADX(highs, lows, closes, period=14) {
  if (!highs||highs.length<period+2) return { adx:[], pdi:[], mdi:[] }
  const tr=[], pDM=[], mDM=[]
  for (let i=1; i<closes.length; i++) {
    const h=highs[i]-highs[i-1], l=lows[i-1]-lows[i]
    pDM.push(h>l&&h>0?h:0); mDM.push(l>h&&l>0?l:0)
    tr.push(Math.max(highs[i]-lows[i],Math.abs(highs[i]-closes[i-1]),Math.abs(lows[i]-closes[i-1])))
  }
  const sm = arr => {
    const out=[arr.slice(0,period).reduce((a,b)=>a+b,0)]
    for (let i=period; i<arr.length; i++) out.push(out[out.length-1]-out[out.length-1]/period+arr[i])
    return out
  }
  const sTR=sm(tr), sPDM=sm(pDM), sMDM=sm(mDM)
  const pdi=sPDM.map((v,i)=>sTR[i]?(v/sTR[i])*100:0)
  const mdi=sMDM.map((v,i)=>sTR[i]?(v/sTR[i])*100:0)
  const dx=pdi.map((v,i)=>(v+mdi[i])?Math.abs(v-mdi[i])/(v+mdi[i])*100:0)
  const adx=sm(dx).map(v=>v/period)
  return { adx, pdi, mdi }
}

export function calcWilliamsR(highs, lows, closes, period=14) {
  if (!highs||closes.length<period) return []
  const out=[]
  for (let i=period-1; i<closes.length; i++) {
    const hh=Math.max(...highs.slice(i-period+1,i+1))
    const ll=Math.min(...lows.slice(i-period+1,i+1))
    out.push(hh===ll?-50:((hh-closes[i])/(hh-ll))*-100)
  }
  return out
}

export function calcROC(prices, period=10) {
  const out=[]
  for (let i=period; i<prices.length; i++)
    out.push(((prices[i]-prices[i-period])/prices[i-period])*100)
  return out
}

// ── ATR — volatilidad + stop/target basados en el activo ─────
export function calcATR(prices, period=14) {
  const trs=[]
  for (let i=1; i<prices.length; i++) trs.push(Math.abs(prices[i]-prices[i-1]))
  const atr=[trs.slice(0,period).reduce((a,b)=>a+b,0)/period]
  for (let i=period; i<trs.length; i++) atr.push((atr[atr.length-1]*(period-1)+trs[i])/period)
  const lastATR=atr[atr.length-1]
  const lastPrice=prices[prices.length-1]
  const atrPct=(lastATR/lastPrice)*100
  return {
    atr:lastATR, atrPct,
    stopLoss:  lastPrice-lastATR*1.5,
    takeProfit:lastPrice+lastATR*2.5,
    riskReward:Number((2.5/1.5).toFixed(2)),
    volatility:atrPct>8?'Alta':atrPct>3?'Media':'Baja',
    volColor:  atrPct>8?'#FF4D4D':atrPct>3?'#FFCC00':'#00D26A',
  }
}

// ── Correlación con BTC (Pearson sobre retornos diarios) ──────
export function calcBtcCorrelation(prices, btcPrices, period=30) {
  if (!btcPrices||btcPrices.length<period||prices.length<period) return null
  const pS=prices.slice(-period), bS=btcPrices.slice(-period)
  const pR=pS.slice(1).map((v,i)=>(v-pS[i])/pS[i])
  const bR=bS.slice(1).map((v,i)=>(v-bS[i])/bS[i])
  const n=pR.length
  const mx=pR.reduce((a,b)=>a+b,0)/n, mb=bR.reduce((a,b)=>a+b,0)/n
  const num=pR.reduce((s,v,i)=>s+(v-mx)*(bR[i]-mb),0)
  const dx=Math.sqrt(pR.reduce((s,v)=>s+(v-mx)**2,0))
  const db=Math.sqrt(bR.reduce((s,v)=>s+(v-mb)**2,0))
  if (dx===0||db===0) return null
  const corr=Math.max(-1,Math.min(1,num/(dx*db)))
  return {
    value:corr,
    label:corr>0.75?'Alta — sigue a BTC':corr>0.45?'Moderada':corr>0.1?'Baja — movimiento propio':'Negativa — diverge de BTC',
    color:corr>0.75?'#FF4D4D':corr>0.45?'#FFCC00':'#00D26A',
    note:corr>0.75
      ?'Señales técnicas menos independientes — BTC domina el movimiento'
      :corr>0.45
      ?'Movimiento parcialmente propio — considera el contexto de BTC'
      :'Alta independencia — señales técnicas más fiables en este activo',
  }
}

// ── RSI Percentil histórico ───────────────────────────────────
export function rsiPercentile(rsiSeries) {
  if (rsiSeries.length<2) return 50
  const sorted=[...rsiSeries].sort((a,b)=>a-b)
  const last=rsiSeries[rsiSeries.length-1]
  return (sorted.filter(v=>v<=last).length/sorted.length)*100
}

// ── Divergencias ──────────────────────────────────────────────
export function detectDivergence(prices, rsi, lookback=14) {
  if (prices.length<lookback||rsi.length<lookback) return 'none'
  const rp=prices.slice(-lookback), rr=rsi.slice(-lookback)
  const pDown=rp[rp.length-1]<rp[0], pUp=rp[rp.length-1]>rp[0]
  const rUp=rr[rr.length-1]>rr[0], rDown=rr[rr.length-1]<rr[0]
  if (pDown&&rUp) return 'bullish'
  if (pUp&&rDown) return 'bearish'
  return 'none'
}

// ── Régimen de mercado ────────────────────────────────────────
export function detectRegime(prices, adxVal) {
  if (prices.length<50) return 'unknown'
  if (adxVal!=null&&adxVal<18) return 'lateral'
  const e20=calcEMA(prices,20), e50=calcEMA(prices,50)
  if (!e50.length) return 'unknown'
  const diff=(e20[e20.length-1]-e50[e50.length-1])/e50[e50.length-1]
  if (diff>0.07) return 'strong_bull'
  if (diff>0.02) return 'bull'
  if (diff<-0.07) return 'strong_bear'
  if (diff<-0.02) return 'bear'
  return 'lateral'
}

// ── Soporte / Resistencia ─────────────────────────────────────
export function findSR(prices, lookback=30) {
  const sl=prices.slice(-lookback)
  const support=Math.min(...sl), resistance=Math.max(...sl)
  const price=prices[prices.length-1]
  const range=resistance-support
  return { support, resistance, mid:(support+resistance)/2, position:range>0?(price-support)/range:0.5, range }
}

// ── Análisis de volumen ───────────────────────────────────────
export function analyzeVolume(prices, volumes, period=20) {
  if (!volumes||volumes.length<period) return null
  const recent=volumes.slice(-period)
  const avgVol=recent.reduce((a,b)=>a+b,0)/period
  const lastVol=volumes[volumes.length-1]
  const volRatio=lastVol/avgVol
  const priceDiff=prices[prices.length-1]-prices[prices.length-2]
  let signal='neutral', msg=''
  if (volRatio>2.0&&priceDiff>0) { signal='buy'; msg=`Volumen ${volRatio.toFixed(1)}x — breakout alcista con alto volumen` }
  else if (volRatio>1.5&&priceDiff>0) { signal='buy'; msg=`Volumen ${volRatio.toFixed(1)}x — subida confirmada` }
  else if (volRatio>2.0&&priceDiff<0) { signal='sell'; msg=`Volumen ${volRatio.toFixed(1)}x — sell-off con alto volumen` }
  else if (volRatio>1.5&&priceDiff<0) { signal='sell'; msg=`Volumen ${volRatio.toFixed(1)}x — bajada confirmada` }
  else if (volRatio<0.4) { signal='neutral'; msg=`Volumen muy bajo (${(volRatio*100).toFixed(0)}%) — sin convicción` }
  else { signal='neutral'; msg=`Volumen normal (${(volRatio*100).toFixed(0)}% del promedio 20d)` }
  const obv=calcOBV(prices,volumes)
  const obvEMA=calcEMA(obv,10)
  const obvTrend=obvEMA.length>2?(obvEMA[obvEMA.length-1]>obvEMA[obvEMA.length-3]?'up':'down'):'neutral'
  const upDays=prices.slice(1).map((p,i)=>p>prices[i])
  const upVol=volumes.slice(1).filter((_,i)=>upDays[i]).slice(-10).reduce((a,b)=>a+b,0)/10||0
  const downVol=volumes.slice(1).filter((_,i)=>!upDays[i]).slice(-10).reduce((a,b)=>a+b,0)/10||0
  return { avgVol, lastVol, volRatio, signal, msg, obvTrend, volBias:upVol>downVol?'buy':'sell' }
}

// ── SEÑAL PRINCIPAL v3.1 ──────────────────────────────────────
export function generateSignal(prices, volumes=null, btcPrices=null) {
  if (!prices||prices.length<30) return null

  const highs=prices.map((p,i)=>Math.max(p,i>0?prices[i-1]:p))
  const lows =prices.map((p,i)=>Math.min(p,i>0?prices[i-1]:p))

  const rsi14=calcRSI(prices,14), rsi7=calcRSI(prices,7)
  const {macdLine,signalLine,histogram}=calcMACD(prices)
  const ema20=calcEMA(prices,20), ema50=calcEMA(prices,50), ema200=calcEMA(prices,200)
  const boll=calcBollinger(prices,20), stoch=calcStochRSI(prices,14,14)
  const {adx:adxArr,pdi,mdi}=calcADX(highs,lows,prices)
  const willR=calcWilliamsR(highs,lows,prices,14)
  const roc10=calcROC(prices,10), roc30=calcROC(prices,30)
  const vol=volumes?analyzeVolume(prices,volumes):null
  const sr=findSR(prices,30)
  const diverg=detectDivergence(prices,rsi14)

  const lastADX=adxArr.length>0?adxArr[adxArr.length-1]:null
  const regime=detectRegime(prices,lastADX)
  const lateral=regime==='lateral'
  const bull=regime==='bull'||regime==='strong_bull'
  const bear=regime==='bear'||regime==='strong_bear'

  // Pesos por régimen: osciladores más fiables en lateral, tendencia en bull/bear
  const wO=lateral?1.5:1.0, wT=lateral?0.6:1.3, wV=1.2

  // Umbrales RSI dinámicos
  const rsiBuy =regime==='strong_bull'?22:regime==='bull'?27:regime==='strong_bear'?35:30
  const rsiSell=regime==='strong_bull'?82:regime==='bull'?78:regime==='strong_bear'?62:70

  const price      =prices[prices.length-1]
  const lastRSI    =rsi14[rsi14.length-1]
  const lastRSI7   =rsi7[rsi7.length-1]
  const lastHist   =histogram[histogram.length-1]
  const prevHist   =histogram[histogram.length-2]
  const prev2Hist  =histogram[histogram.length-3]
  const lastBoll   =boll[boll.length-1]
  const lastStoch  =stoch[stoch.length-1]
  const lastE20    =ema20[ema20.length-1]
  const lastE50    =ema50.length>0?ema50[ema50.length-1]:null
  const lastE200   =ema200.length>0?ema200[ema200.length-1]:null
  const lastPDI    =pdi.length>0?pdi[pdi.length-1]:null
  const lastMDI    =mdi.length>0?mdi[mdi.length-1]:null
  const lastWillR  =willR[willR.length-1]
  const lastROC10  =roc10[roc10.length-1]
  const lastROC30  =roc30[roc30.length-1]
  const rsiPct     =rsiPercentile(rsi14)

  let score=0
  const signals=[]

  // 1. RSI
  const rsiCtx=`(percentil ${rsiPct.toFixed(0)}%)`
  if (lastRSI<rsiBuy) { score+=2*wO; signals.push({ind:'RSI 14',val:`${lastRSI.toFixed(1)}`,msg:`Sobrevendido — compra potencial ${rsiCtx}`,type:'buy'}) }
  else if (lastRSI>rsiSell) { score-=2*wO; signals.push({ind:'RSI 14',val:`${lastRSI.toFixed(1)}`,msg:`Sobrecomprado — venta potencial ${rsiCtx}`,type:'sell'}) }
  else if (lastRSI>50&&bull) { score+=0.8*wO; signals.push({ind:'RSI 14',val:`${lastRSI.toFixed(1)}`,msg:`>50 en tendencia alcista ${rsiCtx}`,type:'buy'}) }
  else if (lastRSI<50&&bear) { score-=0.8*wO; signals.push({ind:'RSI 14',val:`${lastRSI.toFixed(1)}`,msg:`<50 en tendencia bajista ${rsiCtx}`,type:'sell'}) }
  else { signals.push({ind:'RSI 14',val:`${lastRSI.toFixed(1)}`,msg:`Zona neutral ${rsiCtx}`,type:'neutral'}) }

  // 2. Divergencia RSI
  if (diverg==='bullish') { score+=2.5*wO; signals.push({ind:'Divergencia RSI',val:'🟢 Alcista',msg:'Precio baja pero RSI sube → reversión probable al alza',type:'buy'}) }
  else if (diverg==='bearish') { score-=2.5*wO; signals.push({ind:'Divergencia RSI',val:'🔴 Bajista',msg:'Precio sube pero RSI baja → reversión probable a la baja',type:'sell'}) }
  else { signals.push({ind:'Divergencia RSI',val:'Sin divergencia',msg:'RSI y precio alineados',type:'neutral'}) }

  // 3. MACD
  const histAccel=prev2Hist!=null?lastHist-prev2Hist:0
  if (lastHist>0&&prevHist<=0) { score+=2.2*wT; signals.push({ind:'MACD cruce',val:`hist ${lastHist.toFixed(5)}`,msg:'Cruce alcista reciente → señal de entrada',type:'buy'}) }
  else if (lastHist<0&&prevHist>=0) { score-=2.2*wT; signals.push({ind:'MACD cruce',val:`hist ${lastHist.toFixed(5)}`,msg:'Cruce bajista reciente → señal de salida',type:'sell'}) }
  else if (lastHist>0&&histAccel>0) { score+=1.0*wT; signals.push({ind:'MACD histograma',val:`${lastHist.toFixed(5)} ↑`,msg:'Positivo y acelerando',type:'buy'}) }
  else if (lastHist<0&&histAccel<0) { score-=1.0*wT; signals.push({ind:'MACD histograma',val:`${lastHist.toFixed(5)} ↓`,msg:'Negativo y empeorando',type:'sell'}) }
  else if (lastHist>0) { score+=0.5*wT; signals.push({ind:'MACD histograma',val:`${lastHist.toFixed(5)}`,msg:'Positivo sin aceleración',type:'buy'}) }
  else { score-=0.5*wT; signals.push({ind:'MACD histograma',val:`${lastHist.toFixed(5)}`,msg:'Negativo sin aceleración',type:'sell'}) }

  // 4. EMA 20/50
  if (lastE50) {
    const d=((lastE20-lastE50)/lastE50*100).toFixed(2)
    if (lastE20>lastE50) { score+=1.2*wT; signals.push({ind:'EMA 20/50',val:`+${d}%`,msg:'EMA20 > EMA50 → tendencia alcista',type:'buy'}) }
    else { score-=1.2*wT; signals.push({ind:'EMA 20/50',val:`${d}%`,msg:'EMA20 < EMA50 → tendencia bajista',type:'sell'}) }
  }

  // 5. EMA 200
  if (lastE200) {
    const d=((price-lastE200)/lastE200*100).toFixed(1)
    if (price>lastE200) { score+=0.8*wT; signals.push({ind:'EMA 200',val:`+${d}% sobre`,msg:'Precio sobre EMA200 → largo plazo alcista',type:'buy'}) }
    else { score-=0.8*wT; signals.push({ind:'EMA 200',val:`${d}% bajo`,msg:'Precio bajo EMA200 — cuidado largo plazo',type:'sell'}) }
  }

  // 6. Bollinger
  if (lastBoll) {
    const pos=(price-lastBoll.lower)/(lastBoll.upper-lastBoll.lower)
    const bw=((lastBoll.upper-lastBoll.lower)/lastBoll.mid*100).toFixed(1)
    if (price<lastBoll.lower) { score+=1.5*wO; signals.push({ind:'Bollinger',val:`Bajo inf · ancho ${bw}%`,msg:'Precio bajo banda inferior → zona de rebote',type:'buy'}) }
    else if (price>lastBoll.upper) { score-=1.5*wO; signals.push({ind:'Bollinger',val:`Sobre sup · ancho ${bw}%`,msg:'Precio sobre banda superior → posible corrección',type:'sell'}) }
    else { signals.push({ind:'Bollinger',val:`${(pos*100).toFixed(0)}% de banda · ancho ${bw}%`,msg:`Precio en ${pos>0.6?'zona alta':pos<0.4?'zona baja':'centro'}`,type:'neutral'}) }
  }

  // 7. Stoch RSI
  if (lastStoch<15) { score+=1.2*wO; signals.push({ind:'Stoch RSI',val:`${lastStoch.toFixed(1)}`,msg:'Sobrevendido extremo (<15)',type:'buy'}) }
  else if (lastStoch<25) { score+=0.8*wO; signals.push({ind:'Stoch RSI',val:`${lastStoch.toFixed(1)}`,msg:'Zona sobrevendido (<25)',type:'buy'}) }
  else if (lastStoch>85) { score-=1.2*wO; signals.push({ind:'Stoch RSI',val:`${lastStoch.toFixed(1)}`,msg:'Sobrecomprado extremo (>85)',type:'sell'}) }
  else if (lastStoch>75) { score-=0.8*wO; signals.push({ind:'Stoch RSI',val:`${lastStoch.toFixed(1)}`,msg:'Zona sobrecomprado (>75)',type:'sell'}) }
  else { signals.push({ind:'Stoch RSI',val:`${lastStoch.toFixed(1)}`,msg:'Zona neutral',type:'neutral'}) }

  // 8. Williams %R
  if (lastWillR!=null) {
    if (lastWillR<-80) { score+=1.0*wO; signals.push({ind:'Williams %R',val:`${lastWillR.toFixed(1)}`,msg:'Sobrevendido extremo (<-80)',type:'buy'}) }
    else if (lastWillR>-20) { score-=1.0*wO; signals.push({ind:'Williams %R',val:`${lastWillR.toFixed(1)}`,msg:'Sobrecomprado (>-20)',type:'sell'}) }
    else { signals.push({ind:'Williams %R',val:`${lastWillR.toFixed(1)}`,msg:'Zona neutral (-80 a -20)',type:'neutral'}) }
  }

  // 9. ADX
  if (lastADX!=null) {
    const str=lastADX>30?'Fuerte':lastADX>20?'Moderada':'Débil/Lateral'
    if (lastADX>25&&lastPDI>lastMDI) { score+=1.0*wT; signals.push({ind:'ADX + DI',val:`${lastADX.toFixed(1)} · ${str}`,msg:`+DI ${lastPDI.toFixed(1)} > -DI ${lastMDI.toFixed(1)} — tendencia alcista`,type:'buy'}) }
    else if (lastADX>25&&lastPDI<lastMDI) { score-=1.0*wT; signals.push({ind:'ADX + DI',val:`${lastADX.toFixed(1)} · ${str}`,msg:`-DI ${lastMDI.toFixed(1)} > +DI ${lastPDI.toFixed(1)} — tendencia bajista`,type:'sell'}) }
    else { signals.push({ind:'ADX + DI',val:`${lastADX.toFixed(1)} · ${str}`,msg:'Mercado lateral — indicadores menos fiables',type:'neutral'}) }
  }

  // 10. ROC
  if (lastROC10!=null) {
    if (lastROC10>5) { score+=0.7*wT; signals.push({ind:'ROC 10d',val:`+${lastROC10.toFixed(2)}%`,msg:'Momentum positivo fuerte',type:'buy'}) }
    else if (lastROC10<-5) { score-=0.7*wT; signals.push({ind:'ROC 10d',val:`${lastROC10.toFixed(2)}%`,msg:'Momentum negativo fuerte',type:'sell'}) }
    else { signals.push({ind:'ROC 10d',val:`${lastROC10.toFixed(2)}%`,msg:'Momentum neutral',type:'neutral'}) }
  }
  if (lastROC30!=null) {
    if (lastROC30>15) { score+=0.5*wT; signals.push({ind:'ROC 30d',val:`+${lastROC30.toFixed(2)}%`,msg:'Tendencia mensual positiva',type:'buy'}) }
    else if (lastROC30<-15) { score-=0.5*wT; signals.push({ind:'ROC 30d',val:`${lastROC30.toFixed(2)}%`,msg:'Tendencia mensual negativa',type:'sell'}) }
    else { signals.push({ind:'ROC 30d',val:`${lastROC30.toFixed(2)}%`,msg:'Tendencia mensual moderada',type:'neutral'}) }
  }

  // 11. Volumen + OBV
  if (vol) {
    if (vol.signal==='buy') score+=1.0*wV
    if (vol.signal==='sell') score-=1.0*wV
    signals.push({ind:'Volumen',val:`${(vol.volRatio*100).toFixed(0)}% prom.`,msg:vol.msg,type:vol.signal})
    if (vol.obvTrend==='up') { score+=0.8*wV; signals.push({ind:'OBV',val:'▲ Acumulación',msg:'Compradores absorbiendo oferta',type:'buy'}) }
    else if (vol.obvTrend==='down') { score-=0.8*wV; signals.push({ind:'OBV',val:'▼ Distribución',msg:'Vendedores presionando precio',type:'sell'}) }
    else { signals.push({ind:'OBV',val:'Neutral',msg:'Sin tendencia clara de volumen',type:'neutral'}) }
    if (vol.volBias==='buy'&&bull) { score+=0.5*wV; signals.push({ind:'Sesgo volumen',val:'Alcista',msg:'Más volumen en días de subida',type:'buy'}) }
    else if (vol.volBias==='sell'&&bear) { score-=0.5*wV; signals.push({ind:'Sesgo volumen',val:'Bajista',msg:'Más volumen en días de bajada',type:'sell'}) }
  }

  // 12. Soporte/Resistencia
  if (sr.position<0.08) { score+=1.0; signals.push({ind:'Soporte/Resist.',val:`Cerca soporte $${sr.support.toFixed(2)}`,msg:'Precio cerca del soporte 30d — posible rebote',type:'buy'}) }
  else if (sr.position>0.92) { score-=1.0; signals.push({ind:'Soporte/Resist.',val:`Cerca resist. $${sr.resistance.toFixed(2)}`,msg:'Precio cerca de resistencia 30d — posible rechazo',type:'sell'}) }
  else { signals.push({ind:'Soporte/Resist.',val:`${(sr.position*100).toFixed(0)}% del rango`,msg:`S: $${sr.support.toFixed(2)} · R: $${sr.resistance.toFixed(2)}`,type:'neutral'}) }

  // ── Score → señal ─────────────────────────────────────────
  const buyCount=signals.filter(s=>s.type==='buy').length
  const sellCount=signals.filter(s=>s.type==='sell').length
  const alignPct=Math.max(buyCount,sellCount)/signals.length
  const adxBoost=lastADX!=null?Math.min(lastADX/30,1):0.5
  const confidence=Math.round(alignPct*70+adxBoost*20+(Math.abs(score)>5?10:0))

  let overall, strength
  if (score>=6)       { overall='COMPRAR'; strength='Fuerte' }
  else if (score>=3)  { overall='COMPRAR'; strength='Moderado' }
  else if (score<=-6) { overall='VENDER';  strength='Fuerte' }
  else if (score<=-3) { overall='VENDER';  strength='Moderado' }
  else                { overall='NEUTRAL'; strength=lateral?'(mercado lateral)':'' }

  // Datos adicionales precisos
  const atrData=calcATR(prices,14)
  const btcCorr=calcBtcCorrelation(prices,btcPrices,30)

  return {
    overall, strength, confidence, score:Math.round(score*10)/10,
    regime, divergence:diverg,
    rsi:lastRSI, rsi7:lastRSI7, rsiPercentile:rsiPct,
    macd:macdLine[macdLine.length-1], macdSignal:signalLine[signalLine.length-1], macdHist:lastHist,
    ema20:lastE20, ema50:lastE50, ema200:lastE200,
    bollUpper:lastBoll?.upper, bollLower:lastBoll?.lower, bollMid:lastBoll?.mid,
    stochRsi:lastStoch, williamsR:lastWillR,
    roc10:lastROC10, roc30:lastROC30,
    adx:lastADX, pdi:lastPDI, mdi:lastMDI,
    support:sr.support, resistance:sr.resistance, srPosition:sr.position,
    volRatio:vol?.volRatio, obvTrend:vol?.obvTrend,
    currentPrice:price,
    buyCount, sellCount, totalSignals:signals.length,
    signals,
    atr:atrData,
    btcCorrelation:btcCorr,
  }
}
import { useState, useEffect, useRef } from 'react'
import {
  usePrices, useGlobalStats, useFearGreed, useWatchlist,
  useWallet, useGlobalSearch, useOHLC, useAnalysis
} from './hooks/useDefiData.js'
import { hasZerionKey } from './services/api.js'

const fmt = n => { if(n==null)return'—'; if(n>=1e12)return`$${(n/1e12).toFixed(2)}T`; if(n>=1e9)return`$${(n/1e9).toFixed(2)}B`; if(n>=1e6)return`$${(n/1e6).toFixed(2)}M`; if(n>=1e3)return`$${(n/1e3).toFixed(1)}K`; return`$${Number(n).toFixed(2)}` }
const pct  = n => n==null?'—':`${n>=0?'▲':'▼'} ${Math.abs(n).toFixed(2)}%`
const pc   = n => n==null?DIM:n>=0?GREEN:RED
const ago  = iso => { const d=Math.floor((Date.now()-new Date(iso).getTime())/60000); return d<1?'ahora':d<60?`${d}m`:d<1440?`${Math.floor(d/60)}h`:`${Math.floor(d/1440)}d` }

const G='#FF8C00', GREEN='#00D26A', RED='#FF4D4D', GOLD='#FFCC00'
const DIM='rgba(255,255,255,0.52)', WHITE='#FFFFFF', BG='#0D0D0D'

// ── Base UI ───────────────────────────────────────────────────
const Dot = ({color=G,size=9}) => (
  <span style={{position:'relative',display:'inline-flex',width:size,height:size}}>
    <span style={{position:'absolute',inset:0,borderRadius:'50%',background:color,opacity:0.4,animation:'ping 1.5s ease infinite'}}/>
    <span style={{borderRadius:'50%',width:size,height:size,background:color,display:'block'}}/>
  </span>
)
const Card = ({children,accent,style={}}) => (
  <div style={{background:accent?'rgba(255,140,0,0.07)':'rgba(255,255,255,0.025)',border:`1px solid ${accent?'rgba(255,140,0,0.38)':'rgba(255,140,0,0.12)'}`,borderRadius:10,padding:15,...style}}>
    {children}
  </div>
)
const CT = ({children,mb=12}) => (
  <div style={{fontSize:10,letterSpacing:'0.18em',color:'rgba(255,140,0,0.6)',marginBottom:mb,fontWeight:700}}>{children}</div>
)
const Badge = ({label,color=G}) => (
  <span style={{fontSize:10,fontWeight:700,color,border:`1px solid ${color}33`,background:`${color}11`,padding:'2px 7px',borderRadius:4}}>{label}</span>
)
const WsInd = ({status,short=false}) => {
  const c=status==='live'?GREEN:status==='error'?RED:GOLD
  const l=status==='live'?(short?'LIVE':'LIVE · BINANCE'):status==='error'?(short?'ERR':'ERROR'):(short?'…':'CONECTANDO…')
  return <div style={{display:'flex',alignItems:'center',gap:5}}><Dot color={c} size={7}/><span style={{fontSize:10,color:c,fontWeight:700}}>{l}</span></div>
}
const SearchBox = ({value,onChange,placeholder,busy}) => (
  <div style={{position:'relative'}}>
    <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'rgba(255,140,0,0.38)',pointerEvents:'none'}}>{busy?'⟳':'⌕'}</span>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||'Buscar…'}
      style={{width:'100%',background:'rgba(255,140,0,0.04)',border:'1px solid rgba(255,140,0,0.18)',borderRadius:7,padding:'10px 32px',color:WHITE,fontFamily:'inherit',fontSize:13,outline:'none'}}/>
    {value&&<button onClick={()=>onChange('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:DIM,fontSize:17}}>×</button>}
  </div>
)

// ── Fear & Greed ──────────────────────────────────────────────
function FearGreedGauge({data}) {
  if (!data) return (
    <Card style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:120}}>
      <div style={{textAlign:'center',color:DIM,fontSize:12}}>Cargando Fear & Greed…</div>
    </Card>
  )
  const val=parseInt(data.value)
  const color=val>=75?GREEN:val>=55?'#AAEE44':val>=45?GOLD:val>=25?'#FF8844':RED
  const r=52,cx=70,cy=68
  const angle=-Math.PI+(val/100)*Math.PI
  return (
    <Card>
      <CT>FEAR & GREED INDEX</CT>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <svg width={140} height={80} style={{overflow:'visible'}}>
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10} strokeLinecap="round"/>
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 ${val>50?1:0} 1 ${cx+r*Math.cos(angle)} ${cy+r*Math.sin(angle)}`} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"/>
          <line x1={cx} y1={cy} x2={cx+46*Math.cos(angle)} y2={cy+46*Math.sin(angle)} stroke={color} strokeWidth={2.5} strokeLinecap="round"/>
          <circle cx={cx} cy={cy} r={4.5} fill={color}/>
          <text x={cx} y={cy-14} textAnchor="middle" fill={color} fontSize={22} fontWeight={700} fontFamily="IBM Plex Mono">{val}</text>
        </svg>
        <div style={{fontSize:13,fontWeight:700,color,marginTop:-8}}>{data.value_classification}</div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontSize:9,color:DIM}}>
        <span style={{color:RED}}>Miedo extremo</span><span>Neutral</span><span style={{color:GREEN}}>Euforia</span>
      </div>
    </Card>
  )
}

// ── Candlestick Chart Modal ───────────────────────────────────
function CandlestickChart({coin,onClose,isMobile}) {
  const [days,setDays]=useState(7)
  const {candles,loading}=useOHLC(coin?.id,days)
  if (!coin) return null
  const W=isMobile?Math.min(window.innerWidth-48,380):580, H=220
  const P={top:18,right:14,bottom:28,left:58}
  const cw=W-P.left-P.right, ch=H-P.top-P.bottom
  let inner=null
  if (loading) {
    inner=<text x={W/2} y={H/2} textAnchor="middle" fill={DIM} fontSize={12} fontFamily="IBM Plex Mono">Cargando…</text>
  } else if (candles.length>0) {
    const allP=candles.flatMap(c=>[c.high,c.low])
    const mx=Math.max(...allP),mn=Math.min(...allP),range=mx-mn||1
    const py=v=>P.top+ch-((v-mn)/range)*ch
    const cw2=Math.max(2,Math.floor(cw/candles.length)-2)
    const xS=cw/candles.length
    const grids=[0,0.25,0.5,0.75,1].map(f=>{
      const v=mn+f*range,y=py(v)
      const lbl=v>=1000?`$${(v/1000).toFixed(0)}k`:v>=1?`$${v.toFixed(0)}`:`$${v.toFixed(4)}`
      return <g key={f}><line x1={P.left} y1={y} x2={P.left+cw} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1}/><text x={P.left-4} y={y+4} textAnchor="end" fill={DIM} fontSize={9} fontFamily="IBM Plex Mono">{lbl}</text></g>
    })
    const step=Math.max(1,Math.floor(candles.length/5))
    const bars=candles.map((c,i)=>{
      const x=P.left+i*xS+xS/2,up=c.close>=c.open,col=up?GREEN:RED
      const top=py(Math.max(c.open,c.close)),bot=py(Math.min(c.open,c.close)),bh=Math.max(1,bot-top)
      return <g key={i}><line x1={x} y1={py(c.high)} x2={x} y2={py(c.low)} stroke={col} strokeWidth={1.2}/><rect x={x-cw2/2} y={top} width={cw2} height={bh} fill={col} rx={1}/>{i%step===0&&<text x={x} y={H-4} textAnchor="middle" fill={DIM} fontSize={8} fontFamily="IBM Plex Mono">{c.date}</text>}</g>
    })
    inner=<>{grids}{bars}</>
  } else {
    inner=<text x={W/2} y={H/2} textAnchor="middle" fill={DIM} fontSize={12} fontFamily="IBM Plex Mono">Sin datos OHLC</text>
  }
  const last=candles[candles.length-1]
  return (
    <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:'#141414',border:'1px solid rgba(255,140,0,0.22)',borderRadius:12,padding:16,maxWidth:640,width:'100%'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div><div style={{fontSize:15,fontWeight:700,color:G}}>{coin.symbol?.toUpperCase()} · OHLC</div><div style={{fontSize:10,color:DIM}}>Gráfico de velas</div></div>
          <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',justifyContent:'flex-end'}}>
            {[1,7,14,30].map(d=><button key={d} onClick={()=>setDays(d)} style={{padding:'4px 9px',fontSize:11,fontFamily:'inherit',background:days===d?'rgba(255,140,0,0.16)':'transparent',color:days===d?G:DIM,border:`1px solid ${days===d?'rgba(255,140,0,0.38)':'rgba(255,255,255,0.08)'}`,borderRadius:5,cursor:'pointer'}}>{d}D</button>)}
            <button onClick={onClose} style={{padding:'4px 9px',background:'transparent',border:'1px solid rgba(255,77,77,0.28)',borderRadius:5,color:RED,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>✕</button>
          </div>
        </div>
        <svg width={W} height={H} style={{display:'block',maxWidth:'100%'}}>{inner}</svg>
        {last&&<div style={{marginTop:10,display:'flex',gap:isMobile?10:16,fontSize:11,flexWrap:'wrap'}}>
          {[['O',last.open],['H',last.high],['L',last.low],['C',last.close]].map(([l,v])=>(
            <div key={l}><div style={{fontSize:9,color:'rgba(255,140,0,0.4)',marginBottom:2}}>{l}</div><div style={{fontWeight:700,color:WHITE}}>${v?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}</div></div>
          ))}
        </div>}
      </div>
    </div>
  )
}

// ── RSI Gauge mini ────────────────────────────────────────────
function RSIGauge({value,size=80}) {
  if (value==null) return null
  const r=size*0.38,cx=size/2,cy=size/2+2,sw=size*0.09
  const angle=-Math.PI+(value/100)*Math.PI
  const color=value<30?GREEN:value>70?RED:GOLD
  return (
    <svg width={size} height={size*0.6}>
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} strokeLinecap="round"/>
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 ${value>50?1:0} 1 ${cx+r*Math.cos(angle)} ${cy+r*Math.sin(angle)}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"/>
      <line x1={cx} y1={cy} x2={cx+r*0.88*Math.cos(angle)} y2={cy+r*0.88*Math.sin(angle)} stroke={color} strokeWidth={2} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={sw*0.5} fill={color}/>
      <text x={cx} y={cy-r*0.3} textAnchor="middle" fill={color} fontSize={size*0.2} fontWeight={700} fontFamily="IBM Plex Mono">{value.toFixed(0)}</text>
    </svg>
  )
}

// ── ANÁLISIS TÉCNICO — totalmente responsive ──────────────────
function AnalysisTab({prices,watchlist,isMobile}) {
  const [selectedId,setSelectedId] = useState('')
  const [searchQ,setSearchQ]       = useState('')
  const {results,searching}        = useGlobalSearch(searchQ,prices)
  const {signal,loading,error}     = useAnalysis(selectedId)
  const coin = prices.find(p=>p.id===selectedId)

  const sc = s => s==='COMPRAR'?GREEN:s==='VENDER'?RED:GOLD
  const tc = t => t==='buy'?GREEN:t==='sell'?RED:DIM

  const quickCoins = ['bitcoin','ethereum','solana','binancecoin','ripple']
  const wlQuick    = watchlist.filter(id=>!quickCoins.includes(id)).slice(0,4)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>

      {/* Info temporalidad */}
      <Card>
        <CT mb={8}>ANÁLISIS TÉCNICO · TIMEFRAME DIARIO (1D)</CT>
        <div style={{fontSize:11,color:DIM,lineHeight:1.8,marginBottom:12}}>
          Datos: <span style={{color:WHITE}}>90 días histórico</span> · Indicadores: <span style={{color:G}}>RSI · MACD · Bollinger · Stoch RSI · EMA 20/50</span><br/>
          Ideal para: <span style={{color:GREEN}}>swing trading (días/semanas)</span> · Eficacia combinada: <span style={{color:GOLD}}>~65-70% en tendencias</span> · ⚠ No es consejo financiero
        </div>

        {/* Selector rápido */}
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
          {quickCoins.map(id=>{
            const p=prices.find(x=>x.id===id); if(!p) return null
            const a=selectedId===id
            return <button key={id} onClick={()=>{setSelectedId(id);setSearchQ('')}} style={{padding:'6px 12px',fontSize:11,fontFamily:'inherit',background:a?'rgba(255,140,0,0.18)':'rgba(255,255,255,0.03)',color:a?G:DIM,border:`1px solid ${a?'rgba(255,140,0,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:6,cursor:'pointer'}}>{p.symbol?.toUpperCase()}</button>
          })}
          {wlQuick.map(id=>{
            const p=prices.find(x=>x.id===id); if(!p) return null
            const a=selectedId===id
            return <button key={id} onClick={()=>{setSelectedId(id);setSearchQ('')}} style={{padding:'6px 12px',fontSize:11,fontFamily:'inherit',background:a?'rgba(255,140,0,0.18)':'rgba(255,255,255,0.03)',color:a?G:DIM,border:`1px solid ${a?'rgba(255,140,0,0.35)':'rgba(255,140,0,0.12)'}`,borderRadius:6,cursor:'pointer'}}>★ {p.symbol?.toUpperCase()}</button>
          })}
        </div>

        {/* Búsqueda */}
        <div style={{position:'relative'}}>
          <SearchBox value={searchQ} onChange={setSearchQ} busy={searching} placeholder="Buscar moneda para analizar — BTC, ETH, SOL, L3…"/>
          {searchQ&&results.length>0&&(
            <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:30,background:'#181818',border:'1px solid rgba(255,140,0,0.2)',borderRadius:8,marginTop:4,overflow:'hidden',maxHeight:200,overflowY:'auto'}}>
              {results.slice(0,8).map(p=>(
                <button key={p.id} onClick={()=>{setSelectedId(p.id);setSearchQ('')}}
                  style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,140,0,0.06)',cursor:'pointer',color:WHITE,fontFamily:'inherit'}}
                  onMouseOver={e=>e.currentTarget.style.background='rgba(255,140,0,0.06)'}
                  onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <img src={p.image} alt="" style={{width:20,height:20,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>
                    <span style={{fontWeight:700,fontSize:13}}>{p.symbol?.toUpperCase()}</span>
                    <span style={{fontSize:11,color:DIM}}>{p.name}</span>
                  </div>
                  <span style={{fontSize:12,color:pc(p.price_change_percentage_24h)}}>{pct(p.price_change_percentage_24h)}</span>
                </button>
              ))}
              {searching&&<div style={{padding:'9px 12px',fontSize:11,color:DIM}}>Buscando…</div>}
            </div>
          )}
        </div>
      </Card>

      {/* Estado vacío */}
      {!selectedId&&(
        <Card>
          <div style={{textAlign:'center',padding:isMobile?'24px 0':'40px 0',color:DIM}}>
            <div style={{fontSize:isMobile?32:40,marginBottom:12}}>📊</div>
            <div style={{fontSize:14,color:WHITE,marginBottom:6}}>Selecciona una moneda arriba</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.3)',lineHeight:1.8}}>
              RSI · MACD · Bollinger Bands · Stoch RSI · EMA 20/50<br/>
              Señal automática: COMPRAR / NEUTRAL / VENDER
            </div>
          </div>
        </Card>
      )}

      {selectedId&&loading&&(
        <Card><div style={{textAlign:'center',padding:'28px 0',color:DIM,fontSize:12}}>⟳ Calculando indicadores con 90 días de histórico…</div></Card>
      )}
      {selectedId&&error&&(
        <Card><div style={{textAlign:'center',padding:'20px 0',color:RED,fontSize:12}}>Error: {error}</div></Card>
      )}

      {signal&&!loading&&(
        <>
          {/* Señal global */}
          <Card accent style={{textAlign:'center',padding:isMobile?'16px 12px':'20px'}}>
            <div style={{fontSize:10,letterSpacing:'0.2em',color:DIM,marginBottom:8}}>
              SEÑAL GLOBAL · {coin?.symbol?.toUpperCase()} · {coin?.name}
            </div>
            <div style={{fontSize:isMobile?28:40,fontWeight:700,color:sc(signal.overall),marginBottom:4}}>
              {signal.strength?`${signal.strength} · `:''}{signal.overall}
            </div>
            <div style={{fontSize:12,color:DIM,marginBottom:10}}>
              Score: {signal.score>0?`+${signal.score}`:signal.score} de ±7 · Timeframe 1D · 90 días
            </div>
            {coin&&(
              <div style={{fontSize:isMobile?16:20,fontWeight:700,color:WHITE}}>
                ${(coin.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}
                {' '}<span style={{fontSize:14,color:pc(coin.price_change_percentage_24h)}}>{pct(coin.price_change_percentage_24h)}</span>
              </div>
            )}
            <div style={{marginTop:10,fontSize:10,color:'rgba(255,255,255,0.25)',lineHeight:1.7}}>
              ⚠ Indicadores matemáticos sobre datos históricos. No garantizan resultados futuros.<br/>
              No es consejo financiero. Siempre investiga antes de operar.
            </div>
          </Card>

          {/* Grid de indicadores — 1 col móvil, 3 col desktop */}
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:12}}>

            {/* RSI */}
            <Card>
              <CT>RSI (14) · Sobrecompra/Venta</CT>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                <RSIGauge value={signal.rsi} size={isMobile?72:88}/>
                <div>
                  <div style={{fontSize:isMobile?20:24,fontWeight:700,color:signal.rsi<30?GREEN:signal.rsi>70?RED:GOLD}}>{signal.rsi?.toFixed(1)}</div>
                  <div style={{fontSize:11,color:DIM,marginTop:2}}>{signal.rsi<30?'Sobrevendido':signal.rsi>70?'Sobrecomprado':'Neutral'}</div>
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <span style={{fontSize:9,color:GREEN,border:'1px solid rgba(0,210,106,0.3)',padding:'2px 6px',borderRadius:3}}>COMPRA &lt;30</span>
                <span style={{fontSize:9,color:RED,border:'1px solid rgba(255,77,77,0.3)',padding:'2px 6px',borderRadius:3}}>VENTA &gt;70</span>
              </div>
            </Card>

            {/* MACD */}
            <Card>
              <CT>MACD (12,26,9) · Momentum</CT>
              <div style={{display:'flex',gap:isMobile?14:20,marginBottom:8}}>
                <div>
                  <div style={{fontSize:9,color:DIM,marginBottom:2}}>MACD</div>
                  <div style={{fontSize:14,fontWeight:700,color:signal.macd>=0?GREEN:RED}}>{signal.macd?.toFixed(4)}</div>
                </div>
                <div>
                  <div style={{fontSize:9,color:DIM,marginBottom:2}}>SEÑAL</div>
                  <div style={{fontSize:14,fontWeight:700,color:WHITE}}>{signal.macdSignal?.toFixed(4)}</div>
                </div>
                <div>
                  <div style={{fontSize:9,color:DIM,marginBottom:2}}>HISTOGRAMA</div>
                  <div style={{fontSize:14,fontWeight:700,color:signal.macdHist>=0?GREEN:RED}}>{signal.macdHist?.toFixed(4)}</div>
                </div>
              </div>
              <div style={{fontSize:11,fontWeight:700,color:signal.macdHist>=0?GREEN:RED,marginBottom:6}}>
                {signal.macdHist>=0?'▲ Momentum positivo':'▼ Momentum negativo'}
              </div>
              <div style={{fontSize:10,color:DIM}}>Cruces de líneas = señales de entrada/salida</div>
            </Card>

            {/* Stoch RSI */}
            <Card>
              <CT>STOCH RSI · Confirmación</CT>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                <RSIGauge value={signal.stochRsi} size={isMobile?72:88}/>
                <div>
                  <div style={{fontSize:isMobile?20:24,fontWeight:700,color:signal.stochRsi<20?GREEN:signal.stochRsi>80?RED:GOLD}}>{signal.stochRsi?.toFixed(1)}</div>
                  <div style={{fontSize:11,color:DIM,marginTop:2}}>{signal.stochRsi<20?'Sobrevendido':signal.stochRsi>80?'Sobrecomprado':'Neutral'}</div>
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <span style={{fontSize:9,color:GREEN,border:'1px solid rgba(0,210,106,0.3)',padding:'2px 6px',borderRadius:3}}>COMPRA &lt;20</span>
                <span style={{fontSize:9,color:RED,border:'1px solid rgba(255,77,77,0.3)',padding:'2px 6px',borderRadius:3}}>VENTA &gt;80</span>
              </div>
            </Card>
          </div>

          {/* Bollinger + EMA + Señales — 1 col móvil, 2 col desktop */}
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:12}}>

            {/* Bollinger + EMA */}
            <Card>
              <CT>BOLLINGER (20,2) + EMA</CT>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {[
                  ['Banda superior', signal.bollUpper, null],
                  ['EMA 50',         signal.ema50,     null],
                  ['EMA 20',         signal.ema20,     null],
                  ['▶ PRECIO',       coin?.current_price, true],
                  ['Banda inferior', signal.bollLower, null],
                ].filter(([,v])=>v!=null).map(([label,val,isCurrent])=>(
                  <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:isCurrent?'5px 8px':'4px 0',background:isCurrent?'rgba(255,140,0,0.08)':undefined,borderRadius:isCurrent?5:undefined,borderBottom:!isCurrent?'1px solid rgba(255,255,255,0.04)':undefined}}>
                    <span style={{fontSize:11,color:isCurrent?G:DIM}}>{label}</span>
                    <span style={{fontSize:isCurrent?13:11,fontWeight:isCurrent?700:400,color:isCurrent?WHITE:DIM}}>
                      ${val?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:8,fontSize:10,color:DIM,lineHeight:1.6}}>
                {coin?.current_price<signal.bollLower?<span style={{color:GREEN}}>▲ Precio bajo banda inf. → posible rebote</span>
                :coin?.current_price>signal.bollUpper?<span style={{color:RED}}>▼ Precio sobre banda sup. → posible corrección</span>
                :<span>Precio dentro de las bandas — zona normal</span>}
              </div>
            </Card>

            {/* Tabla señales */}
            <Card>
              <CT>DETALLE SEÑALES</CT>
              <div style={{display:'flex',flexDirection:'column',gap:0}}>
                {signal.signals.map((s,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',gap:8}}>
                    <div style={{minWidth:isMobile?72:90}}>
                      <div style={{fontSize:11,fontWeight:700,color:G}}>{s.ind}</div>
                      <div style={{fontSize:10,color:WHITE,marginTop:1}}>{s.val}</div>
                    </div>
                    <div style={{fontSize:11,color:tc(s.type),textAlign:'right',lineHeight:1.4}}>{s.msg}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ── MoverRow ──────────────────────────────────────────────────
function MoverRow({p,watched,onToggle,onChart,isMobile}) {
  const chg=p.price_change_percentage_24h
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(255,140,0,0.05)',cursor:'pointer'}} onClick={()=>onChart(p)}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <img src={p.image} alt="" style={{width:21,height:21,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:WHITE}}>{p.symbol?.toUpperCase()}</div>
          {!isMobile&&<div style={{fontSize:10,color:DIM}}>${(p.current_price??0).toLocaleString('en-US',{maximumFractionDigits:4})}</div>}
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:13,fontWeight:700,color:pc(chg)}}>{pct(chg)}</span>
        <button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:watched?G:'rgba(255,255,255,0.13)',padding:0}}>{watched?'★':'☆'}</button>
      </div>
    </div>
  )
}

// ── OVERVIEW ──────────────────────────────────────────────────
function OverviewTab({prices,stats,fearGreed,wsStatus,watchlist,onToggle,onChart,isMobile}) {
  const eth=prices.find(p=>p.id==='ethereum')
  const sorted=prices.filter(p=>p.price_change_percentage_24h!=null).sort((a,b)=>b.price_change_percentage_24h-a.price_change_percentage_24h)
  const gainers=sorted.slice(0,6)
  const losers=sorted.slice(-6).reverse()
  const wlCoins=prices.filter(p=>watchlist.includes(p.id)).sort((a,b)=>Math.abs(b.price_change_percentage_24h??0)-Math.abs(a.price_change_percentage_24h??0)).slice(0,6)
  const kpis=[
    {label:'MARKET CAP',value:fmt(stats?.total_market_cap?.usd),sub:stats?`BTC ${stats.market_cap_percentage?.btc?.toFixed(1)}%`:'…',accent:true},
    {label:'VOLUMEN 24H',value:fmt(stats?.total_volume?.usd),sub:'Global'},
    {label:'ETH',value:eth?`$${(eth.current_price??0).toLocaleString()}`:'…',sub:eth?pct(eth.price_change_percentage_24h):'…',subColor:eth?pc(eth.price_change_percentage_24h):DIM},
    {label:'RASTREADAS',value:prices.length||'…',sub:'Top 500 + búsqueda global'},
  ]
  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:10,marginBottom:12}}>
        {kpis.map((k,i)=>(
          <Card key={i} accent={k.accent}>
            <div style={{fontSize:9,letterSpacing:'0.15em',color:'rgba(255,140,0,0.5)',marginBottom:5}}>{k.label}</div>
            <div style={{fontSize:isMobile?17:20,fontWeight:700,color:G,lineHeight:1,marginBottom:3}}>{k.value}</div>
            <div style={{fontSize:11,color:k.subColor||DIM}}>{k.sub}</div>
          </Card>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'2fr 1fr',gap:12,marginBottom:12}}>
        <FearGreedGauge data={fearGreed}/>
        <Card style={{display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
          <CT>MERCADO</CT>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div><div style={{fontSize:10,color:DIM,marginBottom:3}}>FEED</div><WsInd status={wsStatus}/></div>
            <div><div style={{fontSize:10,color:DIM,marginBottom:3}}>WATCHLIST</div><div style={{fontSize:20,fontWeight:700,color:G}}>{watchlist.length}</div></div>
            <div><div style={{fontSize:10,color:DIM,marginBottom:3}}>DOM. BTC</div><div style={{fontSize:16,fontWeight:700,color:WHITE}}>{stats?.market_cap_percentage?.btc?.toFixed(1)||'—'}%</div></div>
          </div>
        </Card>
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:12}}>
        <Card><CT>🟢 TOP GAINERS 24H</CT>{gainers.map((p,i)=><MoverRow key={i} p={p} watched={watchlist.includes(p.id)} onToggle={onToggle} onChart={onChart} isMobile={isMobile}/>)}</Card>
        <Card><CT>🔴 TOP LOSERS 24H</CT>{losers.map((p,i)=><MoverRow key={i} p={p} watched={watchlist.includes(p.id)} onToggle={onToggle} onChart={onChart} isMobile={isMobile}/>)}</Card>
        <Card><CT>★ WATCHLIST MOVERS</CT>{wlCoins.length===0?(<div style={{textAlign:'center',padding:'20px 0',color:DIM,fontSize:12}}><div style={{fontSize:26,marginBottom:8}}>☆</div>Añade monedas a watchlist</div>):wlCoins.map((p,i)=><MoverRow key={i} p={p} watched={true} onToggle={onToggle} onChart={onChart} isMobile={isMobile}/>)}</Card>
      </div>
    </>
  )
}

// ── PRECIOS ───────────────────────────────────────────────────
function PricesTab({prices,loading,wsStatus,watchlist,onToggle,onChart,isMobile}) {
  const [search,setSearch]=useState('')
  const [page,setPage]=useState(1)
  const PER=isMobile?30:50
  const {results,searching}=useGlobalSearch(search,prices)
  const list=search?results:prices
  const total=Math.ceil(list.length/PER)
  const visible=list.slice((page-1)*PER,page*PER)
  useEffect(()=>{setPage(1)},[search])
  const thS={fontSize:10,letterSpacing:'0.1em',color:'rgba(255,140,0,0.48)',fontWeight:700,fontFamily:'inherit',paddingBottom:9,borderBottom:'1px solid rgba(255,140,0,0.09)'}
  return (
    <Card>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:isMobile?'flex-start':'center',flexDirection:isMobile?'column':'row',gap:8,marginBottom:12}}>
        <CT mb={0}>TOP 500 + BÚSQUEDA GLOBAL · BINANCE WS</CT>
        <WsInd status={wsStatus} short={isMobile}/>
      </div>
      <div style={{marginBottom:10}}>
        <SearchBox value={search} onChange={setSearch} busy={searching} placeholder="Buscar cualquier moneda — L3, layer3, pepe… búsqueda global"/>
      </div>
      {search&&<div style={{fontSize:11,color:DIM,marginBottom:9}}>{searching?'🔍 Buscando…':`${results.length} resultado${results.length!==1?'s':''}`}</div>}
      {loading?(<div style={{textAlign:'center',padding:44,color:DIM}}>Cargando…</div>):visible.length===0&&!searching?(<div style={{textAlign:'center',padding:36,color:DIM}}>Sin resultados</div>):isMobile?(
        visible.map((p,i)=>{
          const chg=p.price_change_percentage_24h,w=watchlist.includes(p.id)
          return (
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:9,padding:'10px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',cursor:'pointer'}} onClick={()=>onChart(p)}>
              <span style={{fontSize:11,color:DIM,minWidth:22}}>{search?(i+1):((page-1)*PER+i+1)}</span>
              <img src={p.image} alt="" style={{width:26,height:26,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:700,fontSize:13}}>{p.symbol?.toUpperCase()}</span><span style={{fontWeight:700,fontSize:13}}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}><span style={{fontSize:10,color:DIM}}>{p.name}</span><span style={{fontSize:12,fontWeight:700,color:pc(chg)}}>{pct(chg)}</span></div>
              </div>
              <button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:w?G:'rgba(255,255,255,0.13)'}}>{w?'★':'☆'}</button>
            </div>
          )
        })
      ):(
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>{['#','TOKEN','PRECIO','24H','MARKET CAP','VOL 24H','★'].map((h,i)=><th key={i} style={{...thS,textAlign:i>1?'right':'left'}}>{h}</th>)}</tr></thead>
          <tbody>
            {visible.map((p,i)=>{
              const chg=p.price_change_percentage_24h,w=watchlist.includes(p.id)
              return (
                <tr key={p.id} style={{cursor:'pointer'}} onClick={()=>onChart(p)}>
                  <td style={{fontSize:11,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',color:DIM,width:28}}>{search?(i+1):((page-1)*PER+i+1)}</td>
                  <td style={{padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}><img src={p.image} alt="" style={{width:22,height:22,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/><div><div style={{fontWeight:700,fontSize:13,color:WHITE}}>{p.symbol?.toUpperCase()}</div><div style={{fontSize:10,color:DIM}}>{p.name}</div></div></div>
                  </td>
                  <td style={{fontSize:13,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',textAlign:'right',fontWeight:700,color:WHITE,fontVariantNumeric:'tabular-nums'}}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}</td>
                  <td style={{fontSize:13,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',textAlign:'right',fontWeight:700,color:pc(chg)}}>{pct(chg)}</td>
                  <td style={{fontSize:11,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',textAlign:'right',color:DIM}}>{fmt(p.market_cap)}</td>
                  <td style={{fontSize:11,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',textAlign:'right',color:DIM}}>{fmt(p.total_volume)}</td>
                  <td style={{padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',textAlign:'center',width:38}}><button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:19,color:w?G:'rgba(255,255,255,0.13)'}}>{w?'★':'☆'}</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {!search&&total>1&&(
        <div style={{display:'flex',justifyContent:'center',gap:5,marginTop:14,flexWrap:'wrap'}}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:'5px 11px',background:'rgba(255,140,0,0.07)',border:'1px solid rgba(255,140,0,0.18)',borderRadius:5,color:page===1?DIM:G,cursor:page===1?'default':'pointer',fontFamily:'inherit',fontSize:11}}>←</button>
          {Array.from({length:total},(_,i)=>i+1).map(n=><button key={n} onClick={()=>setPage(n)} style={{padding:'5px 9px',background:n===page?'rgba(255,140,0,0.18)':'transparent',border:`1px solid ${n===page?'rgba(255,140,0,0.45)':'rgba(255,140,0,0.1)'}`,borderRadius:5,color:n===page?G:DIM,cursor:'pointer',fontFamily:'inherit',fontSize:11}}>{n}</button>)}
          <button onClick={()=>setPage(p=>Math.min(total,p+1))} disabled={page===total} style={{padding:'5px 11px',background:'rgba(255,140,0,0.07)',border:'1px solid rgba(255,140,0,0.18)',borderRadius:5,color:page===total?DIM:G,cursor:page===total?'default':'pointer',fontFamily:'inherit',fontSize:11}}>→</button>
        </div>
      )}
    </Card>
  )
}

// ── WATCHLIST ─────────────────────────────────────────────────
function WatchlistTab({prices,watchlist,extraCoins,onToggle,onClear,onChart,wsStatus,isMobile}) {
  const [addQ,setAddQ]=useState('')
  const {results,searching}=useGlobalSearch(addQ,prices)
  const allCoins=[...prices,...extraCoins.filter(e=>!prices.find(p=>p.id===e.id))]
  const watched=allCoins.filter(p=>watchlist.includes(p.id))
  const avgChg=watched.length?watched.reduce((s,p)=>s+(p.price_change_percentage_24h??0),0)/watched.length:0
  const dd=results.filter(p=>!watchlist.includes(p.id)).slice(0,8)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        <Card accent><div style={{fontSize:9,color:'rgba(255,140,0,0.5)',marginBottom:5,letterSpacing:'0.15em'}}>SEGUIDAS</div><div style={{fontSize:24,fontWeight:700,color:G}}>{watched.length}</div></Card>
        <Card><div style={{fontSize:9,color:'rgba(255,140,0,0.5)',marginBottom:5,letterSpacing:'0.15em'}}>PROMEDIO 24H</div><div style={{fontSize:24,fontWeight:700,color:pc(avgChg)}}>{watched.length?pct(avgChg):'—'}</div></Card>
        <Card><div style={{fontSize:9,color:'rgba(255,140,0,0.5)',marginBottom:5,letterSpacing:'0.15em'}}>FEED</div><div style={{marginTop:4}}><WsInd status={wsStatus} short={isMobile}/></div></Card>
      </div>
      <Card>
        <CT>AÑADIR — búsqueda global (cualquier ranking)</CT>
        <div style={{position:'relative'}}>
          <SearchBox value={addQ} onChange={setAddQ} busy={searching} placeholder="L3, layer3, cualquier moneda…"/>
          {dd.length>0&&(
            <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:30,background:'#181818',border:'1px solid rgba(255,140,0,0.2)',borderRadius:8,marginTop:4,boxShadow:'0 8px 28px rgba(0,0,0,0.6)',overflow:'hidden'}}>
              {dd.map(p=>(
                <button key={p.id} onClick={()=>{onToggle(p.id,p);setAddQ('')}}
                  style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 13px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,140,0,0.06)',cursor:'pointer',color:WHITE,fontFamily:'inherit'}}
                  onMouseOver={e=>e.currentTarget.style.background='rgba(255,140,0,0.06)'}
                  onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{display:'flex',alignItems:'center',gap:9}}><img src={p.image} alt="" style={{width:20,height:20,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/><span style={{fontWeight:700,fontSize:13}}>{p.symbol?.toUpperCase()}</span><span style={{fontSize:11,color:DIM}}>{p.name}</span>{p.market_cap_rank&&<span style={{fontSize:10,color:'rgba(255,140,0,0.4)'}}>#{p.market_cap_rank}</span>}</div>
                  <div style={{display:'flex',alignItems:'center',gap:7}}><span style={{fontSize:12,color:pc(p.price_change_percentage_24h)}}>{pct(p.price_change_percentage_24h)}</span><span style={{fontSize:11,color:G,fontWeight:700}}>★ ADD</span></div>
                </button>
              ))}
              {searching&&<div style={{padding:'9px 13px',fontSize:11,color:DIM}}>Buscando…</div>}
            </div>
          )}
        </div>
        <div style={{marginTop:8,fontSize:11,color:DIM}}>O pulsa ★ en PRECIOS</div>
      </Card>
      {watched.length===0?(
        <Card><div style={{textAlign:'center',padding:isMobile?28:44,color:DIM}}><div style={{fontSize:40,marginBottom:12}}>☆</div><div style={{fontSize:14,color:WHITE,marginBottom:6}}>Watchlist vacía</div></div></Card>
      ):(
        <>
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)',gap:10}}>
            {watched.map(p=>{
              const chg=p.price_change_percentage_24h??0
              return (
                <div key={p.id} style={{background:'rgba(255,255,255,0.02)',border:`1px solid ${chg>=0?'rgba(0,210,106,0.17)':'rgba(255,77,77,0.17)'}`,borderRadius:8,padding:13,position:'relative',cursor:'pointer'}} onClick={()=>onChart(p)}>
                  <button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{position:'absolute',top:8,right:9,background:'none',border:'none',cursor:'pointer',fontSize:16,color:G}}>★</button>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:9}}><img src={p.image} alt="" style={{width:24,height:24,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/><div><div style={{fontWeight:700,fontSize:13,color:WHITE}}>{p.symbol?.toUpperCase()}</div><div style={{fontSize:10,color:DIM}}>{p.name}</div></div></div>
                  <div style={{fontSize:isMobile?15:18,fontWeight:700,color:WHITE,marginBottom:3}}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</div>
                  <div style={{fontSize:13,fontWeight:700,color:pc(chg)}}>{pct(chg)}</div>
                </div>
              )
            })}
          </div>
          {isMobile?<button onClick={onClear} style={{width:'100%',padding:11,background:'rgba(255,77,77,0.07)',border:'1px solid rgba(255,77,77,0.2)',borderRadius:8,color:RED,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700}}>✕ LIMPIAR</button>:(
            <Card>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><CT mb={0}>DETALLE</CT><button onClick={onClear} style={{fontSize:11,padding:'4px 11px',background:'rgba(255,77,77,0.07)',border:'1px solid rgba(255,77,77,0.2)',borderRadius:5,color:RED,cursor:'pointer',fontFamily:'inherit'}}>✕ LIMPIAR</button></div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['TOKEN','PRECIO','24H','MARKET CAP','QUITAR'].map((h,i)=><th key={i} style={{fontSize:10,color:'rgba(255,140,0,0.48)',fontWeight:700,fontFamily:'inherit',paddingBottom:9,borderBottom:'1px solid rgba(255,140,0,0.09)',textAlign:i>0?'right':'left'}}>{h}</th>)}</tr></thead>
                <tbody>{watched.map(p=>{const chg=p.price_change_percentage_24h??0;const td=(r,c,b)=>({fontSize:12,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',textAlign:r?'right':'left',color:c||WHITE,fontWeight:b?700:400});return(
                  <tr key={p.id} style={{cursor:'pointer'}} onClick={()=>onChart(p)}>
                    <td style={td()}><div style={{display:'flex',alignItems:'center',gap:7}}><img src={p.image} alt="" style={{width:18,height:18,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/><span style={{fontWeight:700}}>{p.symbol?.toUpperCase()}</span></div></td>
                    <td style={td(true,WHITE,true)}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}</td>
                    <td style={td(true,pc(chg),true)}>{pct(chg)}</td>
                    <td style={td(true,DIM)}>{fmt(p.market_cap)}</td>
                    <td style={td(true)}><button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{background:'rgba(255,77,77,0.07)',border:'1px solid rgba(255,77,77,0.2)',borderRadius:4,color:RED,cursor:'pointer',fontSize:11,padding:'3px 9px',fontFamily:'inherit'}}>✕</button></td>
                  </tr>
                )})}</tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ── WALLET ────────────────────────────────────────────────────
function WalletTab({isMobile}) {
  const [input,setInput]=useState('')
  const [addr,setAddr]=useState('')
  const [sub,setSub]=useState('positions')
  const ok=hasZerionKey()
  const {portfolio,positions,transactions,loading,error,refresh}=useWallet(addr)

  // Calcula valor total desde posiciones si portfolio no lo da
  const totalFromPositions = positions.reduce((s,p)=>s+(p.value||0),0)
  const totalValue = (portfolio?.totalValue && portfolio.totalValue>0) ? portfolio.totalValue : totalFromPositions

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {ok?(
        <div style={{padding:10,background:'rgba(0,210,106,0.05)',border:'1px solid rgba(0,210,106,0.2)',borderRadius:8,display:'flex',alignItems:'center',gap:8}}>
          <Dot color={GREEN}/><span style={{fontSize:12,color:GREEN,fontWeight:700}}>ZERION CONECTADO ✓ — proxy server-side activo</span>
        </div>
      ):(
        <div style={{padding:15,background:'rgba(255,204,0,0.055)',border:'1px solid rgba(255,204,0,0.22)',borderRadius:8}}>
          <div style={{fontSize:13,color:GOLD,fontWeight:700,marginBottom:9}}>⚠ ZERION API KEY — GRATIS 2000 calls/día</div>
          <div style={{fontSize:12,color:DIM,lineHeight:2}}>
            1. Ve a <span style={{color:G}}>zerion.io</span> → Developer → crea API key<br/>
            2. Vercel → <span style={{color:G}}>Settings → Env Vars</span>: <code style={{color:WHITE,fontSize:11}}>VITE_ZERION_API_KEY = tu_key</code><br/>
            3. Redeploy ✓ — soporta ETH, Polygon, BSC, Arbitrum, Optimism y más
          </div>
        </div>
      )}

      <Card>
        <CT>ANALIZAR WALLET · Zerion multichain</CT>
        <div style={{display:'flex',flexDirection:isMobile?'column':'row',gap:9}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setAddr(input.trim())}
            placeholder="0x… ETH, Polygon, BSC, Arbitrum, Optimism…"
            style={{flex:1,background:'rgba(255,140,0,0.04)',border:'1px solid rgba(255,140,0,0.2)',borderRadius:7,padding:'11px 13px',color:WHITE,fontFamily:'inherit',fontSize:13,outline:'none'}}/>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setAddr(input.trim())} disabled={loading}
              style={{flex:isMobile?1:undefined,padding:'11px 18px',background:loading?'rgba(255,140,0,0.04)':'rgba(255,140,0,0.13)',border:'1px solid rgba(255,140,0,0.35)',borderRadius:7,color:G,cursor:loading?'wait':'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700}}>
              {loading?'CARGANDO…':'ANALIZAR'}
            </button>
            {addr&&<button onClick={refresh} style={{padding:'11px 13px',background:'transparent',border:'1px solid rgba(255,140,0,0.16)',borderRadius:7,color:'rgba(255,140,0,0.5)',cursor:'pointer',fontFamily:'inherit',fontSize:15}}>↻</button>}
          </div>
        </div>
        {error&&<div style={{marginTop:9,fontSize:12,color:RED,lineHeight:1.7}}>Error: {error}</div>}
      </Card>

      {(portfolio||positions.length>0)&&(
        <Card accent>
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:12}}>
            <div>
              <div style={{fontSize:9,color:'rgba(255,140,0,0.48)',marginBottom:4,letterSpacing:'0.15em'}}>WALLET</div>
              <div style={{fontSize:11,color:G}}>{addr.slice(0,8)}…{addr.slice(-6)}</div>
            </div>
            <div>
              <div style={{fontSize:9,color:'rgba(255,140,0,0.48)',marginBottom:4,letterSpacing:'0.15em'}}>VALOR TOTAL</div>
              <div style={{fontSize:isMobile?20:26,color:G,fontWeight:700}}>{fmt(totalValue)}</div>
            </div>
            <div>
              <div style={{fontSize:9,color:'rgba(255,140,0,0.48)',marginBottom:4,letterSpacing:'0.15em'}}>24H</div>
              <div style={{fontSize:16,fontWeight:700,color:pc(portfolio?.pnl24h)}}>
                {portfolio?.pnl24h!=null ? pct(portfolio.pnl24h) : '—'}
              </div>
              {portfolio?.pnlAbs24h!=null&&<div style={{fontSize:11,color:pc(portfolio.pnlAbs24h)}}>{fmt(portfolio.pnlAbs24h)}</div>}
            </div>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}><Dot color={GREEN}/><span style={{fontSize:10,color:GREEN}}>ZERION LIVE</span></div>
              <div style={{fontSize:10,color:DIM}}>{positions.length} posiciones · auto-refresh 2min</div>
            </div>
          </div>
        </Card>
      )}

      {(positions.length>0||transactions.length>0)&&(
        <>
          <div style={{display:'flex',gap:4}}>
            {[['positions',`POSICIONES (${positions.length})`],['transactions','TRANSACCIONES']].map(([id,l])=>(
              <button key={id} onClick={()=>setSub(id)} style={{padding:'7px 14px',fontSize:11,fontWeight:sub===id?700:400,fontFamily:'inherit',background:sub===id?'rgba(255,140,0,0.11)':'transparent',color:sub===id?G:'rgba(255,140,0,0.36)',border:`1px solid ${sub===id?'rgba(255,140,0,0.35)':'rgba(255,140,0,0.09)'}`,borderRadius:5,cursor:'pointer'}}>{l}</button>
            ))}
          </div>

          {sub==='positions'&&positions.length>0&&(
            <Card>
              <CT>TOKENS · todas las chains · ordenados por valor</CT>
              {positions.map((pos,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:9}}>
                    {pos.icon&&<img src={pos.icon} alt="" style={{width:26,height:26,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>}
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontWeight:700,fontSize:13,color:WHITE}}>{pos.symbol}</span>
                        <Badge label={pos.chain?.toUpperCase()||'ETH'} color={'rgba(255,140,0,0.7)'}/>
                      </div>
                      <div style={{fontSize:10,color:DIM,marginTop:1}}>
                        {pos.qty.toFixed(pos.qty<0.001?6:4)} × ${pos.price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}
                      </div>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,fontSize:13,color:G}}>{fmt(pos.value)}</div>
                    {pos.pct1d!=null&&<div style={{fontSize:11,fontWeight:700,color:pc(pos.pct1d)}}>{pct(pos.pct1d)}</div>}
                    {totalValue>0&&<div style={{fontSize:10,color:DIM}}>{((pos.value/totalValue)*100).toFixed(1)}%</div>}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {sub==='transactions'&&(
            <Card>
              <CT>HISTORIAL DE TRANSACCIONES</CT>
              {transactions.length===0?(
                <div style={{textAlign:'center',padding:28,color:DIM,fontSize:12}}>Sin historial</div>
              ):transactions.slice(0,25).map((tx,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.05)',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:9}}>
                    <Badge label={tx.type.toUpperCase().replace(/_/g,' ')} color={tx.status==='confirmed'?GREEN:GOLD}/>
                    <div>
                      <div style={{fontSize:11,color:WHITE,textTransform:'capitalize'}}>{tx.type.replace(/_/g,' ')}</div>
                      <div style={{display:'flex',gap:6,marginTop:2,alignItems:'center'}}>
                        {tx.time&&<span style={{fontSize:10,color:DIM}}>{ago(tx.time)}</span>}
                        <Badge label={tx.chain?.toUpperCase()||'ETH'} color={'rgba(255,140,0,0.6)'}/>
                      </div>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,fontSize:13,color:tx.value>0?G:DIM}}>{tx.value>0?fmt(tx.value):'—'}</div>
                    {tx.fee&&<div style={{fontSize:10,color:DIM}}>Fee: {fmt(tx.fee)}</div>}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ── APP ───────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]         = useState('overview')
  const [time,setTime]       = useState(new Date())
  const [isMobile,setMobile] = useState(window.innerWidth<768)
  const [chartCoin,setChart] = useState(null)

  useEffect(()=>{const h=()=>setMobile(window.innerWidth<768);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h)},[])
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t)},[])

  const {prices,loading,wsStatus}    = usePrices()
  const {stats}                      = useGlobalStats()
  const {fearGreed}                  = useFearGreed()
  const {watchlist,extraCoins,toggle,clear} = useWatchlist()

  const TABS=[
    {id:'overview', icon:'◈', label:'OVERVIEW'},
    {id:'prices',   icon:'◉', label:'PRECIOS'},
    {id:'watchlist',icon:'★', label:`WATCHLIST${watchlist.length>0?` (${watchlist.length})`:''}` },
    {id:'analysis', icon:'📊', label:'ANÁLISIS'},
    {id:'wallet',   icon:'◎', label:'WALLET'},
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:${BG};overflow-x:hidden}
        @keyframes ping{75%,100%{transform:scale(2);opacity:0}}
        tr:hover td{background:rgba(255,140,0,0.018)}
        input::placeholder{color:rgba(255,255,255,0.19)}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:${BG}}
        ::-webkit-scrollbar-thumb{background:rgba(255,140,0,0.2);border-radius:4px}
        button{touch-action:manipulation}
      `}</style>

      <div style={{minHeight:'100vh',background:BG,fontFamily:"'IBM Plex Mono',monospace",color:WHITE}}>
        <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',backgroundImage:`linear-gradient(rgba(255,140,0,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,140,0,0.015) 1px,transparent 1px)`,backgroundSize:'40px 40px'}}/>

        <div style={{position:'relative',zIndex:1,maxWidth:1300,margin:'0 auto',padding:isMobile?'0 12px 80px':'0 24px 56px'}}>

          <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:isMobile?'12px 0 14px':'18px 0 22px',borderBottom:'1px solid rgba(255,140,0,0.13)',marginBottom:isMobile?12:18}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:isMobile?32:37,height:isMobile?32:37,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:isMobile?16:19,fontWeight:900,color:BG,background:`linear-gradient(135deg,${G},#E67A00)`}}>₿</div>
              <div>
                <div style={{fontSize:isMobile?13:15,fontWeight:700,letterSpacing:'0.14em',color:G}}>DEFI PULSE</div>
                <div style={{fontSize:9,color:'rgba(255,140,0,0.38)',letterSpacing:'0.1em'}}>v8.1 · CEREBRO DeFi</div>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:isMobile?9:16}}>
              <WsInd status={wsStatus} short={isMobile}/>
              {!isMobile&&<div style={{fontSize:11,color:'rgba(255,140,0,0.5)'}}>{time.toLocaleTimeString('es-CO')}</div>}
            </div>
          </header>

          {!isMobile&&(
            <div style={{display:'flex',gap:5,marginBottom:18,overflowX:'auto'}}>
              {TABS.map(t=>{const a=tab===t.id;return(
                <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'8px 17px',fontSize:11,letterSpacing:'0.09em',fontWeight:a?700:400,fontFamily:'inherit',background:a?'rgba(255,140,0,0.13)':'transparent',color:a?G:'rgba(255,140,0,0.36)',border:`1px solid ${a?'rgba(255,140,0,0.4)':'rgba(255,140,0,0.09)'}`,borderRadius:5,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap'}}>{t.label}</button>
              )})}
            </div>
          )}

          {tab==='overview'  && <OverviewTab  prices={prices} stats={stats} fearGreed={fearGreed} wsStatus={wsStatus} watchlist={watchlist} onToggle={toggle} onChart={setChart} isMobile={isMobile}/>}
          {tab==='prices'    && <PricesTab    prices={prices} loading={loading} wsStatus={wsStatus} watchlist={watchlist} onToggle={toggle} onChart={setChart} isMobile={isMobile}/>}
          {tab==='watchlist' && <WatchlistTab prices={prices} watchlist={watchlist} extraCoins={extraCoins} onToggle={toggle} onClear={clear} onChart={setChart} wsStatus={wsStatus} isMobile={isMobile}/>}
          {tab==='analysis'  && <AnalysisTab  prices={prices} watchlist={watchlist} isMobile={isMobile}/>}
          {tab==='wallet'    && <WalletTab    isMobile={isMobile}/>}
        </div>

        {isMobile&&(
          <nav style={{position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:'rgba(13,13,13,0.97)',backdropFilter:'blur(12px)',borderTop:'1px solid rgba(255,140,0,0.12)',display:'flex',padding:'7px 0 max(7px,env(safe-area-inset-bottom))'}}>
            {TABS.map(t=>{const a=tab===t.id;return(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'none',border:'none',cursor:'pointer',padding:'5px 0',color:a?G:'rgba(255,140,0,0.3)',fontFamily:'inherit'}}>
                <span style={{fontSize:t.icon==='📊'?15:19}}>{t.icon}</span>
                <span style={{fontSize:9,fontWeight:a?700:400}}>
                  {t.id==='watchlist'&&watchlist.length>0?`★(${watchlist.length})`:t.label.split('(')[0].trim().substring(0,6)}
                </span>
              </button>
            )})}
          </nav>
        )}
      </div>

      {chartCoin&&<CandlestickChart coin={chartCoin} onClose={()=>setChart(null)} isMobile={isMobile}/>}
    </>
  )
}
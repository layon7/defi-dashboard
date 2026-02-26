import { useState, useEffect, useRef } from 'react'
import {
  usePrices, useGlobalStats, useFearGreed, useWatchlist,
  useWallet, useGlobalSearch, useOHLC, useAnalysis
} from './hooks/useDefiData.js'
import { hasZerionKey } from './services/api.js'

// ── Utils ─────────────────────────────────────────────────────
const fmt = n => { if(n==null)return'—'; if(n>=1e12)return`$${(n/1e12).toFixed(2)}T`; if(n>=1e9)return`$${(n/1e9).toFixed(2)}B`; if(n>=1e6)return`$${(n/1e6).toFixed(2)}M`; if(n>=1e3)return`$${(n/1e3).toFixed(1)}K`; return`$${Number(n).toFixed(2)}` }
const pct = n => n==null?'—':`${n>=0?'▲':'▼'} ${Math.abs(n).toFixed(2)}%`
const pc  = n => n==null?DIM:n>=0?GREEN:RED
const ago = iso => { const d=Math.floor((Date.now()-new Date(iso).getTime())/60000); return d<1?'ahora':d<60?`${d}m`:d<1440?`${Math.floor(d/60)}h`:`${Math.floor(d/1440)}d` }

const G='#FF8C00', GREEN='#00D26A', RED='#FF4D4D', GOLD='#FFCC00', BLUE='#4DB8FF'
const DIM='rgba(255,255,255,0.52)', WHITE='#FFFFFF', BG='#0D0D0D'

// ── Base UI ───────────────────────────────────────────────────
const Dot = ({color=G,size=9}) => <span style={{position:'relative',display:'inline-flex',width:size,height:size}}><span style={{position:'absolute',inset:0,borderRadius:'50%',background:color,opacity:0.4,animation:'ping 1.5s ease infinite'}}/><span style={{borderRadius:'50%',width:size,height:size,background:color,display:'block'}}/></span>
const Card = ({children,accent,style={}}) => <div style={{background:accent?'rgba(255,140,0,0.07)':'rgba(255,255,255,0.025)',border:`1px solid ${accent?'rgba(255,140,0,0.38)':'rgba(255,140,0,0.12)'}`,borderRadius:10,padding:15,...style}}>{children}</div>
const CT = ({children,mb=12}) => <div style={{fontSize:10,letterSpacing:'0.18em',color:'rgba(255,140,0,0.6)',marginBottom:mb,fontWeight:700}}>{children}</div>
const Badge = ({label,color=G}) => <span style={{fontSize:10,fontWeight:700,color,border:`1px solid ${color}33`,background:`${color}11`,padding:'2px 7px',borderRadius:4}}>{label}</span>
const WsInd = ({status,short=false}) => {
  const c=status==='live'?GREEN:status==='error'?RED:GOLD
  const l=status==='live'?(short?'LIVE':'LIVE · BINANCE'):status==='error'?(short?'ERR':'ERROR'):(short?'…':'CONECTANDO…')
  return <div style={{display:'flex',alignItems:'center',gap:5}}><Dot color={c} size={7}/><span style={{fontSize:10,color:c,fontWeight:700}}>{l}</span></div>
}
const SearchBox = ({value,onChange,placeholder,busy}) =>
  <div style={{position:'relative'}}>
    <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'rgba(255,140,0,0.38)',pointerEvents:'none'}}>{busy?'⟳':'⌕'}</span>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||'Buscar…'} style={{width:'100%',background:'rgba(255,140,0,0.04)',border:'1px solid rgba(255,140,0,0.18)',borderRadius:7,padding:'10px 32px',color:WHITE,fontFamily:'inherit',fontSize:13,outline:'none'}}/>
    {value&&<button onClick={()=>onChange('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:DIM,fontSize:17}}>×</button>}
  </div>

// ── Fear & Greed ──────────────────────────────────────────────
function FearGreedGauge({data}) {
  if (!data) return <Card style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:120}}><div style={{textAlign:'center',color:DIM,fontSize:12}}>Cargando Fear & Greed…</div></Card>
  const val  = parseInt(data.value)
  const color = val>=75?GREEN:val>=55?'#AAEE44':val>=45?GOLD:val>=25?'#FF8844':RED
  const r=52, cx=70, cy=68
  const angle = -Math.PI + (val/100)*Math.PI
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

// ── Candlestick Chart ─────────────────────────────────────────
function CandlestickChart({coin, onClose, isMobile}) {
  const [days, setDays] = useState(7)
  const { candles, loading } = useOHLC(coin?.id, days)

  if (!coin) return null
  const W=isMobile?window.innerWidth-56:580, H=220
  const P={top:18,right:16,bottom:28,left:58}
  const cw=W-P.left-P.right, ch=H-P.top-P.bottom

  let inner = null
  if (loading) {
    inner = <text x={W/2} y={H/2} textAnchor="middle" fill={DIM} fontSize={12} fontFamily="IBM Plex Mono">Cargando…</text>
  } else if (candles.length > 0) {
    const allP=[...candles.flatMap(c=>[c.high,c.low])]
    const mx=Math.max(...allP), mn=Math.min(...allP), range=mx-mn||1
    const py=v=>P.top+ch-((v-mn)/range)*ch
    const cw2=Math.max(3,Math.floor(cw/candles.length)-2)
    const xS=cw/candles.length
    const grids=[0,0.25,0.5,0.75,1].map(f=>{
      const v=mn+f*range,y=py(v),lbl=v>=1000?`$${(v/1000).toFixed(0)}k`:v>=1?`$${v.toFixed(0)}`:`$${v.toFixed(4)}`
      return <g key={f}><line x1={P.left} y1={y} x2={P.left+cw} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1}/><text x={P.left-4} y={y+4} textAnchor="end" fill={DIM} fontSize={9} fontFamily="IBM Plex Mono">{lbl}</text></g>
    })
    const step=Math.max(1,Math.floor(candles.length/5))
    const bars=candles.map((c,i)=>{
      const x=P.left+i*xS+xS/2, up=c.close>=c.open, col=up?GREEN:RED
      const top=py(Math.max(c.open,c.close)), bot=py(Math.min(c.open,c.close)), bh=Math.max(1,bot-top)
      return <g key={i}>
        <line x1={x} y1={py(c.high)} x2={x} y2={py(c.low)} stroke={col} strokeWidth={1.2}/>
        <rect x={x-cw2/2} y={top} width={cw2} height={bh} fill={col} rx={1}/>
        {i%step===0&&<text x={x} y={H-4} textAnchor="middle" fill={DIM} fontSize={8} fontFamily="IBM Plex Mono">{c.date}</text>}
      </g>
    })
    inner = <>{grids}{bars}</>
  } else {
    inner = <text x={W/2} y={H/2} textAnchor="middle" fill={DIM} fontSize={12} fontFamily="IBM Plex Mono">Sin datos OHLC</text>
  }

  const last = candles[candles.length-1]
  return (
    <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:'#141414',border:'1px solid rgba(255,140,0,0.22)',borderRadius:12,padding:18,maxWidth:640,width:'100%'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div><div style={{fontSize:15,fontWeight:700,color:G}}>{coin.symbol?.toUpperCase()} · OHLC</div><div style={{fontSize:10,color:DIM}}>Gráfico de velas</div></div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            {[1,7,14,30].map(d=><button key={d} onClick={()=>setDays(d)} style={{padding:'4px 9px',fontSize:11,fontFamily:'inherit',background:days===d?'rgba(255,140,0,0.16)':'transparent',color:days===d?G:DIM,border:`1px solid ${days===d?'rgba(255,140,0,0.38)':'rgba(255,255,255,0.08)'}`,borderRadius:5,cursor:'pointer'}}>{d}D</button>)}
            <button onClick={onClose} style={{marginLeft:4,padding:'4px 9px',background:'transparent',border:'1px solid rgba(255,77,77,0.28)',borderRadius:5,color:RED,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>✕</button>
          </div>
        </div>
        <svg width={W} height={H} style={{display:'block',maxWidth:'100%'}}>{inner}</svg>
        {last&&<div style={{marginTop:10,display:'flex',gap:14,fontSize:11}}>
          {[['O',last.open],['H',last.high],['L',last.low],['C',last.close]].map(([l,v])=><div key={l}><div style={{fontSize:9,color:'rgba(255,140,0,0.4)',marginBottom:2}}>{l}</div><div style={{fontWeight:700,color:WHITE}}>${v?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}</div></div>)}
        </div>}
      </div>
    </div>
  )
}

// ── ANÁLISIS TÉCNICO ──────────────────────────────────────────
function AnalysisTab({ prices, watchlist, isMobile }) {
  const [selectedId, setSelectedId]   = useState('')
  const [searchQ,    setSearchQ]      = useState('')
  const { results, searching }        = useGlobalSearch(searchQ, prices)
  const { signal, loading, error }    = useAnalysis(selectedId)

  const allCoins = searchQ ? results : prices.slice(0, 100)

  const signalColor = s => s==='COMPRAR'?GREEN:s==='VENDER'?RED:GOLD
  const typeColor   = t => t==='buy'?GREEN:t==='sell'?RED:DIM

  // Gauge circular para RSI
  function RSIGauge({value}) {
    if (value==null) return null
    const r=34, cx=44, cy=44, sw=7
    const pct=value/100, angle=-Math.PI+(pct*Math.PI)
    const color=value<30?GREEN:value>70?RED:GOLD
    return (
      <svg width={88} height={52}>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} strokeLinecap="round"/>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 ${value>50?1:0} 1 ${cx+r*Math.cos(angle)} ${cy+r*Math.sin(angle)}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"/>
        <text x={cx} y={cy-8} textAnchor="middle" fill={color} fontSize={15} fontWeight={700} fontFamily="IBM Plex Mono">{value.toFixed(0)}</text>
      </svg>
    )
  }

  // Mini bar for MACD histogram
  function MACDBar({hist}) {
    if (!hist) return null
    const bars = hist.slice(-20)
    const mx   = Math.max(...bars.map(Math.abs), 0.0001)
    return (
      <div style={{display:'flex',alignItems:'flex-end',gap:2,height:40}}>
        {bars.map((v,i)=>{
          const h=Math.max(2,(Math.abs(v)/mx)*36)
          return <div key={i} style={{flex:1,background:v>=0?GREEN:RED,height:h,borderRadius:'2px 2px 0 0',opacity:i===bars.length-1?1:0.55}}/>
        })}
      </div>
    )
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <Card>
        <CT>ANÁLISIS TÉCNICO · RSI, MACD, Bollinger, Stoch RSI, EMA</CT>
        <div style={{fontSize:12,color:DIM,marginBottom:14,lineHeight:1.7}}>
          Selecciona una moneda para ver sus indicadores técnicos y una señal de trading calculada automáticamente con 5 indicadores.
        </div>

        {/* Selector de moneda */}
        <SearchBox value={searchQ} onChange={setSearchQ} busy={searching} placeholder="Buscar moneda para analizar — BTC, ETH, SOL, L3…"/>
        <div style={{marginTop:10,display:'flex',flexWrap:'wrap',gap:6}}>
          {/* Accesos rápidos */}
          {['bitcoin','ethereum','solana','binancecoin','ripple'].map(id=>{
            const p=prices.find(x=>x.id===id)
            if(!p) return null
            return <button key={id} onClick={()=>{setSelectedId(id);setSearchQ('')}} style={{padding:'5px 11px',fontSize:11,fontFamily:'inherit',background:selectedId===id?'rgba(255,140,0,0.18)':'rgba(255,255,255,0.03)',color:selectedId===id?G:DIM,border:`1px solid ${selectedId===id?'rgba(255,140,0,0.4)':'rgba(255,255,255,0.09)'}`,borderRadius:5,cursor:'pointer'}}>{p.symbol?.toUpperCase()}</button>
          })}
          {/* Watchlist rápido */}
          {watchlist.slice(0,5).map(id=>{
            const p=prices.find(x=>x.id===id)
            if(!p||['bitcoin','ethereum','solana','binancecoin','ripple'].includes(id)) return null
            return <button key={id} onClick={()=>{setSelectedId(id);setSearchQ('')}} style={{padding:'5px 11px',fontSize:11,fontFamily:'inherit',background:selectedId===id?'rgba(255,140,0,0.18)':'rgba(255,255,255,0.03)',color:selectedId===id?G:DIM,border:`1px solid ${selectedId===id?'rgba(255,140,0,0.4)':'rgba(255,140,0,0.12)'}`,borderRadius:5,cursor:'pointer'}}>★ {p.symbol?.toUpperCase()}</button>
          })}
        </div>

        {/* Dropdown búsqueda */}
        {searchQ&&(allCoins.length>0||searching)&&(
          <div style={{background:'#181818',border:'1px solid rgba(255,140,0,0.2)',borderRadius:8,marginTop:8,overflow:'hidden',maxHeight:220,overflowY:'auto'}}>
            {allCoins.slice(0,10).map(p=>(
              <button key={p.id} onClick={()=>{setSelectedId(p.id);setSearchQ('')}}
                style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 13px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,140,0,0.06)',cursor:'pointer',color:WHITE,fontFamily:'inherit'}}
                onMouseOver={e=>e.currentTarget.style.background='rgba(255,140,0,0.06)'}
                onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                <div style={{display:'flex',alignItems:'center',gap:9}}>
                  <img src={p.image} alt="" style={{width:20,height:20,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>
                  <span style={{fontWeight:700,fontSize:13}}>{p.symbol?.toUpperCase()}</span>
                  <span style={{fontSize:11,color:DIM}}>{p.name}</span>
                </div>
                <span style={{fontSize:12,color:pc(p.price_change_percentage_24h)}}>{pct(p.price_change_percentage_24h)}</span>
              </button>
            ))}
            {searching&&<div style={{padding:'9px 13px',fontSize:11,color:DIM}}>Buscando…</div>}
          </div>
        )}
      </Card>

      {!selectedId&&(
        <Card>
          <div style={{textAlign:'center',padding:'36px 0',color:DIM}}>
            <div style={{fontSize:36,marginBottom:12}}>📊</div>
            <div style={{fontSize:14,color:WHITE,marginBottom:6}}>Selecciona una moneda para analizar</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.3)',lineHeight:1.8}}>
              Verás: RSI · MACD · Bollinger Bands · Stoch RSI · EMA 20/50<br/>
              + señal de trading automática: COMPRAR / NEUTRAL / VENDER
            </div>
          </div>
        </Card>
      )}

      {selectedId&&loading&&(
        <Card>
          <div style={{textAlign:'center',padding:'32px 0',color:DIM}}>
            <div style={{fontSize:12}}>Calculando indicadores (90 días de histórico)…</div>
          </div>
        </Card>
      )}

      {selectedId&&error&&(
        <Card><div style={{padding:'20px 0',textAlign:'center',color:RED,fontSize:12}}>Error: {error}</div></Card>
      )}

      {signal&&!loading&&(()=>{
        const coin = prices.find(p=>p.id===selectedId)
        const sc   = signalColor(signal.overall)
        return (
          <>
            {/* Señal global */}
            <Card accent style={{textAlign:'center'}}>
              <div style={{fontSize:10,letterSpacing:'0.2em',color:DIM,marginBottom:10}}>SEÑAL GLOBAL · {coin?.name?.toUpperCase()}</div>
              <div style={{fontSize:isMobile?32:42,fontWeight:700,color:sc,marginBottom:6,letterSpacing:'0.05em'}}>{signal.strength && `${signal.strength} · `}{signal.overall}</div>
              <div style={{fontSize:13,color:DIM,marginBottom:14}}>Score: {signal.score > 0 ? `+${signal.score}` : signal.score} / ±7</div>
              {coin&&<div style={{fontSize:18,fontWeight:700,color:WHITE}}>${(coin.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})} <span style={{fontSize:14,color:pc(coin.price_change_percentage_24h)}}>{pct(coin.price_change_percentage_24h)}</span></div>}
              <div style={{marginTop:14,fontSize:11,color:'rgba(255,255,255,0.3)',lineHeight:1.7}}>
                ⚠ Esto NO es consejo financiero. Los indicadores son herramientas matemáticas.<br/>Siempre investiga antes de tomar decisiones.
              </div>
            </Card>

            {/* Indicadores numéricos */}
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)',gap:12}}>
              {/* RSI */}
              <Card>
                <CT>RSI (14)</CT>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <RSIGauge value={signal.rsi}/>
                  <div>
                    <div style={{fontSize:22,fontWeight:700,color:signal.rsi<30?GREEN:signal.rsi>70?RED:GOLD}}>{signal.rsi?.toFixed(1)}</div>
                    <div style={{fontSize:11,color:DIM,marginTop:3}}>{signal.rsi<30?'Sobrevendido':signal.rsi>70?'Sobrecomprado':'Neutral'}</div>
                    <div style={{marginTop:6,display:'flex',gap:4}}>
                      <span style={{fontSize:9,color:RED,border:'1px solid rgba(255,77,77,0.3)',padding:'2px 6px',borderRadius:3}}>Venta &gt;70</span>
                      <span style={{fontSize:9,color:GREEN,border:'1px solid rgba(0,210,106,0.3)',padding:'2px 6px',borderRadius:3}}>Compra &lt;30</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* MACD */}
              <Card>
                <CT>MACD (12,26,9)</CT>
                <div style={{marginBottom:8}}>
                  <MACDBar hist={null}/>
                </div>
                <div style={{display:'flex',gap:14,fontSize:11}}>
                  <div><div style={{fontSize:9,color:DIM,marginBottom:2}}>MACD</div><div style={{fontWeight:700,color:signal.macd>=0?GREEN:RED}}>{signal.macd?.toFixed(4)}</div></div>
                  <div><div style={{fontSize:9,color:DIM,marginBottom:2}}>SEÑAL</div><div style={{fontWeight:700,color:WHITE}}>{signal.macdSignal?.toFixed(4)}</div></div>
                  <div><div style={{fontSize:9,color:DIM,marginBottom:2}}>HIST</div><div style={{fontWeight:700,color:signal.macdHist>=0?GREEN:RED}}>{signal.macdHist?.toFixed(4)}</div></div>
                </div>
                <div style={{marginTop:8,fontSize:11,color:signal.macdHist>=0?GREEN:RED}}>{signal.macdHist>=0?'▲ Momentum positivo':'▼ Momentum negativo'}</div>
              </Card>

              {/* Bollinger + EMA */}
              <Card>
                <CT>BOLLINGER + EMA</CT>
                <div style={{display:'flex',flexDirection:'column',gap:8,fontSize:11}}>
                  {[['Banda sup.',signal.bollUpper,null],['Banda mid.',signal.bollMid,null],['Precio',prices.find(p=>p.id===selectedId)?.current_price,null],['Banda inf.',signal.bollLower,null]].map(([l,v],i)=>{
                    const isCurrent=l==='Precio'
                    return <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',background:isCurrent?'rgba(255,140,0,0.06)':undefined,padding:isCurrent?'4px 6px':undefined,borderRadius:isCurrent?4:undefined}}>
                      <span style={{color:isCurrent?G:DIM}}>{l}</span>
                      <span style={{fontWeight:isCurrent?700:400,color:isCurrent?WHITE:DIM}}>${v?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})||'—'}</span>
                    </div>
                  })}
                  <div style={{borderTop:'1px solid rgba(255,140,0,0.1)',paddingTop:8,display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:DIM}}>EMA 20</span><span style={{color:WHITE}}>${signal.ema20?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})||'—'}</span>
                  </div>
                  {signal.ema50&&<div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:DIM}}>EMA 50</span><span style={{color:WHITE}}>${signal.ema50?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</span>
                  </div>}
                </div>
              </Card>
            </div>

            {/* Stoch RSI */}
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 2fr',gap:12}}>
              <Card>
                <CT>STOCH RSI</CT>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <RSIGauge value={signal.stochRsi}/>
                  <div>
                    <div style={{fontSize:22,fontWeight:700,color:signal.stochRsi<20?GREEN:signal.stochRsi>80?RED:GOLD}}>{signal.stochRsi?.toFixed(1)}</div>
                    <div style={{fontSize:11,color:DIM,marginTop:3}}>{signal.stochRsi<20?'Sobrevendido':signal.stochRsi>80?'Sobrecomprado':'Neutral'}</div>
                  </div>
                </div>
              </Card>

              {/* Tabla señales */}
              <Card>
                <CT>DETALLE DE SEÑALES</CT>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>
                    {['INDICADOR','VALOR','SEÑAL'].map((h,i)=><th key={i} style={{fontSize:10,color:'rgba(255,140,0,0.48)',fontWeight:700,fontFamily:'inherit',paddingBottom:8,borderBottom:'1px solid rgba(255,140,0,0.09)',textAlign:i===2?'right':'left'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {signal.signals.map((s,i)=>(
                      <tr key={i}>
                        <td style={{fontSize:12,padding:'8px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',color:G,fontWeight:700}}>{s.ind}</td>
                        <td style={{fontSize:12,padding:'8px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',color:WHITE}}>{s.val}</td>
                        <td style={{fontSize:12,padding:'8px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',color:typeColor(s.type),textAlign:'right'}}>{s.msg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          </>
        )
      })()}
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
        {kpis.map((k,i)=><Card key={i} accent={k.accent}><div style={{fontSize:9,letterSpacing:'0.15em',color:'rgba(255,140,0,0.5)',marginBottom:5}}>{k.label}</div><div style={{fontSize:isMobile?17:20,fontWeight:700,color:G,lineHeight:1,marginBottom:3}}>{k.value}</div><div style={{fontSize:11,color:k.subColor||DIM}}>{k.sub}</div></Card>)}
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
      {search&&<div style={{fontSize:11,color:DIM,marginBottom:9}}>{searching?'🔍 Buscando en CoinGecko completo…':`${results.length} resultado${results.length!==1?'s':''}`}</div>}
      {loading?(<div style={{textAlign:'center',padding:44,color:DIM}}>Cargando…</div>):visible.length===0&&!searching?(<div style={{textAlign:'center',padding:36,color:DIM}}>Sin resultados</div>):isMobile?(
        visible.map((p,i)=>{
          const chg=p.price_change_percentage_24h,w=watchlist.includes(p.id)
          return <div key={p.id} style={{display:'flex',alignItems:'center',gap:9,padding:'10px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',cursor:'pointer'}} onClick={()=>onChart(p)}>
            <span style={{fontSize:11,color:DIM,minWidth:22}}>{search?(i+1):((page-1)*PER+i+1)}</span>
            <img src={p.image} alt="" style={{width:26,height:26,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>
            <div style={{flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:700,fontSize:13}}>{p.symbol?.toUpperCase()}</span><span style={{fontWeight:700,fontSize:13}}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}><span style={{fontSize:10,color:DIM}}>{p.name}</span><span style={{fontSize:12,fontWeight:700,color:pc(chg)}}>{pct(chg)}</span></div>
            </div>
            <button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:w?G:'rgba(255,255,255,0.13)'}}>{w?'★':'☆'}</button>
          </div>
        })
      ):(
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>{['#','TOKEN','PRECIO','24H','MARKET CAP','VOL 24H','★'].map((h,i)=><th key={i} style={{...thS,textAlign:i>1?'right':'left'}}>{h}</th>)}</tr></thead>
          <tbody>
            {visible.map((p,i)=>{
              const chg=p.price_change_percentage_24h,w=watchlist.includes(p.id)
              return <tr key={p.id} style={{cursor:'pointer'}} onClick={()=>onChart(p)}>
                <td style={{fontSize:11,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',color:DIM,width:28}}>{search?(i+1):((page-1)*PER+i+1)}</td>
                <td style={{padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <img src={p.image} alt="" style={{width:22,height:22,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>
                    <div><div style={{fontWeight:700,fontSize:13,color:WHITE}}>{p.symbol?.toUpperCase()}</div><div style={{fontSize:10,color:DIM}}>{p.name}</div></div>
                  </div>
                </td>
                <td style={{fontSize:13,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',textAlign:'right',fontWeight:700,color:WHITE,fontVariantNumeric:'tabular-nums'}}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}</td>
                <td style={{fontSize:13,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',textAlign:'right',fontWeight:700,color:pc(chg)}}>{pct(chg)}</td>
                <td style={{fontSize:11,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',textAlign:'right',color:DIM}}>{fmt(p.market_cap)}</td>
                <td style={{fontSize:11,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',textAlign:'right',color:DIM}}>{fmt(p.total_volume)}</td>
                <td style={{padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',textAlign:'center',width:38}}><button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:19,color:w?G:'rgba(255,255,255,0.13)'}}>{w?'★':'☆'}</button></td>
              </tr>
            })}
          </tbody>
        </table>
      )}
      {!search&&total>1&&<div style={{display:'flex',justifyContent:'center',gap:5,marginTop:14,flexWrap:'wrap'}}>
        <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:'5px 11px',background:'rgba(255,140,0,0.07)',border:'1px solid rgba(255,140,0,0.18)',borderRadius:5,color:page===1?DIM:G,cursor:page===1?'default':'pointer',fontFamily:'inherit',fontSize:11}}>←</button>
        {Array.from({length:total},(_,i)=>i+1).map(n=><button key={n} onClick={()=>setPage(n)} style={{padding:'5px 9px',background:n===page?'rgba(255,140,0,0.18)':'transparent',border:`1px solid ${n===page?'rgba(255,140,0,0.45)':'rgba(255,140,0,0.1)'}`,borderRadius:5,color:n===page?G:DIM,cursor:'pointer',fontFamily:'inherit',fontSize:11}}>{n}</button>)}
        <button onClick={()=>setPage(p=>Math.min(total,p+1))} disabled={page===total} style={{padding:'5px 11px',background:'rgba(255,140,0,0.07)',border:'1px solid rgba(255,140,0,0.18)',borderRadius:5,color:page===total?DIM:G,cursor:page===total?'default':'pointer',fontFamily:'inherit',fontSize:11}}>→</button>
      </div>}
    </Card>
  )
}

// ── WATCHLIST (compacta) ──────────────────────────────────────
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
        <CT>AÑADIR — búsqueda global</CT>
        <div style={{position:'relative'}}>
          <SearchBox value={addQ} onChange={setAddQ} busy={searching} placeholder="L3, layer3, cualquier moneda…"/>
          {dd.length>0&&<div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:30,background:'#181818',border:'1px solid rgba(255,140,0,0.2)',borderRadius:8,marginTop:4,boxShadow:'0 8px 28px rgba(0,0,0,0.6)',overflow:'hidden'}}>
            {dd.map(p=><button key={p.id} onClick={()=>{onToggle(p.id,p);setAddQ('')}} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 13px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,140,0,0.06)',cursor:'pointer',color:WHITE,fontFamily:'inherit'}} onMouseOver={e=>e.currentTarget.style.background='rgba(255,140,0,0.06)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
              <div style={{display:'flex',alignItems:'center',gap:9}}><img src={p.image} alt="" style={{width:20,height:20,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/><span style={{fontWeight:700,fontSize:13}}>{p.symbol?.toUpperCase()}</span><span style={{fontSize:11,color:DIM}}>{p.name}</span>{p.market_cap_rank&&<span style={{fontSize:10,color:'rgba(255,140,0,0.4)'}}>#{p.market_cap_rank}</span>}</div>
              <div style={{display:'flex',alignItems:'center',gap:7}}><span style={{fontSize:12,color:pc(p.price_change_percentage_24h)}}>{pct(p.price_change_percentage_24h)}</span><span style={{fontSize:11,color:G,fontWeight:700}}>★ ADD</span></div>
            </button>)}
            {searching&&<div style={{padding:'9px 13px',fontSize:11,color:DIM}}>Buscando…</div>}
          </div>}
        </div>
        <div style={{marginTop:8,fontSize:11,color:DIM}}>O pulsa ★ en PRECIOS</div>
      </Card>
      {watched.length===0?(<Card><div style={{textAlign:'center',padding:isMobile?28:44,color:DIM}}><div style={{fontSize:40,marginBottom:12}}>☆</div><div style={{fontSize:14,color:WHITE,marginBottom:6}}>Watchlist vacía</div></div></Card>):(
        <>
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)',gap:10}}>
            {watched.map(p=>{const chg=p.price_change_percentage_24h??0;return(
              <div key={p.id} style={{background:'rgba(255,255,255,0.02)',border:`1px solid ${chg>=0?'rgba(0,210,106,0.17)':'rgba(255,77,77,0.17)'}`,borderRadius:8,padding:13,position:'relative',cursor:'pointer'}} onClick={()=>onChart(p)}>
                <button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{position:'absolute',top:8,right:9,background:'none',border:'none',cursor:'pointer',fontSize:16,color:G}}>★</button>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:9}}><img src={p.image} alt="" style={{width:24,height:24,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/><div><div style={{fontWeight:700,fontSize:13,color:WHITE}}>{p.symbol?.toUpperCase()}</div><div style={{fontSize:10,color:DIM}}>{p.name}</div></div></div>
                <div style={{fontSize:isMobile?15:18,fontWeight:700,color:WHITE,marginBottom:3}}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</div>
                <div style={{fontSize:13,fontWeight:700,color:pc(chg)}}>{pct(chg)}</div>
              </div>
            )})}
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
  const [input,setInput]=useState('');const [addr,setAddr]=useState('');const [sub,setSub]=useState('positions')
  const ok=hasZerionKey()
  const {portfolio,positions,transactions,loading,error,refresh}=useWallet(addr)
  const total=portfolio?.total?.value??0
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {ok?(<div style={{padding:10,background:'rgba(0,210,106,0.05)',border:'1px solid rgba(0,210,106,0.2)',borderRadius:8,display:'flex',alignItems:'center',gap:8}}><Dot color={GREEN}/><span style={{fontSize:12,color:GREEN,fontWeight:700}}>ZERION CONECTADO ✓ — las llamadas van por proxy server-side (sin CORS)</span></div>):(
        <div style={{padding:15,background:'rgba(255,204,0,0.055)',border:'1px solid rgba(255,204,0,0.22)',borderRadius:8}}>
          <div style={{fontSize:13,color:GOLD,fontWeight:700,marginBottom:9}}>⚠ ZERION API KEY — GRATIS 2000 calls/día</div>
          <div style={{fontSize:12,color:DIM,lineHeight:2}}>1. Ve a <span style={{color:G}}>zerion.io</span> → Developer → crea API key<br/>2. Vercel → <span style={{color:G}}>Settings → Env Vars</span>: <code style={{color:WHITE}}>VITE_ZERION_API_KEY = tu_key</code><br/>3. Redeploy ✓</div>
        </div>
      )}
      <Card>
        <CT>ANALIZAR WALLET · Zerion multichain</CT>
        <div style={{display:'flex',flexDirection:isMobile?'column':'row',gap:9}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setAddr(input.trim())} placeholder="0x… ETH, Polygon, BSC, Arbitrum, Optimism…" style={{flex:1,background:'rgba(255,140,0,0.04)',border:'1px solid rgba(255,140,0,0.2)',borderRadius:7,padding:'11px 13px',color:WHITE,fontFamily:'inherit',fontSize:13,outline:'none'}}/>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setAddr(input.trim())} disabled={loading} style={{flex:isMobile?1:undefined,padding:'11px 18px',background:loading?'rgba(255,140,0,0.04)':'rgba(255,140,0,0.13)',border:'1px solid rgba(255,140,0,0.35)',borderRadius:7,color:G,cursor:loading?'wait':'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700}}>{loading?'CARGANDO…':'ANALIZAR'}</button>
            {addr&&<button onClick={refresh} style={{padding:'11px 13px',background:'transparent',border:'1px solid rgba(255,140,0,0.16)',borderRadius:7,color:'rgba(255,140,0,0.5)',cursor:'pointer',fontFamily:'inherit',fontSize:15}}>↻</button>}
          </div>
        </div>
        {error&&<div style={{marginTop:9,fontSize:12,color:RED,lineHeight:1.6}}>Error: {error}</div>}
      </Card>
      {portfolio&&<Card accent><div style={{display:'flex',flexDirection:isMobile?'column':'row',justifyContent:'space-between',alignItems:isMobile?'flex-start':'center',gap:12}}>
        <div><div style={{fontSize:9,color:'rgba(255,140,0,0.48)',marginBottom:4,letterSpacing:'0.15em'}}>WALLET</div><div style={{fontSize:12,color:G}}>{addr.slice(0,8)}…{addr.slice(-6)}</div></div>
        <div><div style={{fontSize:9,color:'rgba(255,140,0,0.48)',marginBottom:4,letterSpacing:'0.15em'}}>VALOR TOTAL</div><div style={{fontSize:isMobile?22:28,color:G,fontWeight:700}}>{fmt(total)}</div></div>
        <div><div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}><Dot color={GREEN}/><span style={{fontSize:11,color:GREEN}}>ZERION LIVE</span></div><div style={{fontSize:10,color:DIM}}>{positions.length} posiciones</div></div>
      </div></Card>}
      {(positions.length>0||transactions.length>0)&&<>
        <div style={{display:'flex',gap:4}}>{[['positions','POSICIONES'],['transactions','TRANSACCIONES']].map(([id,l])=><button key={id} onClick={()=>setSub(id)} style={{padding:'7px 14px',fontSize:11,fontWeight:sub===id?700:400,fontFamily:'inherit',background:sub===id?'rgba(255,140,0,0.11)':'transparent',color:sub===id?G:'rgba(255,140,0,0.36)',border:`1px solid ${sub===id?'rgba(255,140,0,0.35)':'rgba(255,140,0,0.09)'}`,borderRadius:5,cursor:'pointer'}}>{l}</button>)}</div>
        {sub==='positions'&&positions.length>0&&<Card><CT>TOKENS · todas las chains</CT>{positions.map((pos,i)=>{const a=pos.attributes,tk=a?.fungible_info,val=a?.value??0,qty=a?.quantity?.float??0,price=a?.price??0,chg=a?.changes?.percent_1d??null;return(<div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.055)',gap:10}}><div style={{display:'flex',alignItems:'center',gap:9}}>{tk?.icon?.url&&<img src={tk.icon.url} alt="" style={{width:24,height:24,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>}<div><div style={{fontWeight:700,fontSize:13}}>{tk?.symbol?.toUpperCase()}</div><div style={{fontSize:10,color:DIM}}>{qty.toFixed(4)} · ${price.toFixed(4)}</div></div></div><div style={{textAlign:'right'}}><div style={{fontWeight:700,fontSize:13,color:G}}>{fmt(val)}</div>{chg!=null&&<div style={{fontSize:11,fontWeight:700,color:pc(chg)}}>{pct(chg)}</div>}</div></div>)})}</Card>}
        {sub==='transactions'&&<Card><CT>HISTORIAL</CT>{transactions.length===0?<div style={{textAlign:'center',padding:28,color:DIM,fontSize:12}}>Sin historial</div>:transactions.slice(0,25).map((tx,i)=>{const a=tx.attributes,type=a?.operation_type||'tx',val=a?.transfers?.reduce((s,t)=>s+(t.value??0),0)??0,time=a?.mined_at||a?.sent_at;return(<div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.05)',gap:10}}><div style={{display:'flex',alignItems:'center',gap:9}}><Badge label={type.toUpperCase()} color={a?.status==='confirmed'?GREEN:GOLD}/><div><div style={{fontSize:12,color:WHITE,textTransform:'capitalize'}}>{type.replace(/_/g,' ')}</div>{time&&<div style={{fontSize:10,color:DIM}}>{ago(time)}</div>}</div></div><div style={{fontWeight:700,fontSize:13,color:val>0?G:DIM}}>{val>0?fmt(val):'—'}</div></div>)})}</Card>}
      </>}
    </div>
  )
}

// ── APP ───────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]=useState('overview')
  const [time,setTime]=useState(new Date())
  const [isMobile,setIsMobile]=useState(window.innerWidth<768)
  const [chartCoin,setChartCoin]=useState(null)

  useEffect(()=>{const h=()=>setIsMobile(window.innerWidth<768);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h)},[])
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t)},[])

  const {prices,loading,lastUpdate,wsStatus}=usePrices()
  const {stats}=useGlobalStats()
  const {fearGreed}=useFearGreed()
  const {watchlist,extraCoins,toggle,clear}=useWatchlist()

  const TABS=[
    {id:'overview', icon:'◈', label:'OVERVIEW'},
    {id:'prices',   icon:'◉', label:'PRECIOS'},
    {id:'watchlist',icon:'★', label:`WATCHLIST${watchlist.length>0?` (${watchlist.length})`:''}` },
    {id:'analysis', icon:'📊', label:'ANÁLISIS'},
    {id:'wallet',   icon:'◎', label:'WALLET'},
  ]

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html,body{background:${BG};overflow-x:hidden}@keyframes ping{75%,100%{transform:scale(2);opacity:0}}tr:hover td{background:rgba(255,140,0,0.018)}input::placeholder{color:rgba(255,255,255,0.19)}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:${BG}}::-webkit-scrollbar-thumb{background:rgba(255,140,0,0.2);border-radius:4px}button{touch-action:manipulation}`}</style>
      <div style={{minHeight:'100vh',background:BG,fontFamily:"'IBM Plex Mono',monospace",color:WHITE}}>
        <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',backgroundImage:`linear-gradient(rgba(255,140,0,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,140,0,0.015) 1px,transparent 1px)`,backgroundSize:'40px 40px'}}/>
        <div style={{position:'relative',zIndex:1,maxWidth:1300,margin:'0 auto',padding:isMobile?'0 12px 80px':'0 24px 56px'}}>
          <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:isMobile?'12px 0 14px':'18px 0 22px',borderBottom:'1px solid rgba(255,140,0,0.13)',marginBottom:isMobile?12:18}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:isMobile?32:37,height:isMobile?32:37,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:isMobile?16:19,fontWeight:900,color:BG,background:`linear-gradient(135deg,${G},#E67A00)`}}>₿</div>
              <div><div style={{fontSize:isMobile?13:15,fontWeight:700,letterSpacing:'0.14em',color:G}}>DEFI PULSE</div><div style={{fontSize:9,color:'rgba(255,140,0,0.38)',letterSpacing:'0.1em'}}>v8.0 · CEREBRO DeFi</div></div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:isMobile?9:16}}>
              <WsInd status={wsStatus} short={isMobile}/>
              {!isMobile&&<div style={{fontSize:11,color:'rgba(255,140,0,0.5)'}}>{time.toLocaleTimeString('es-CO')}</div>}
            </div>
          </header>
          {!isMobile&&<div style={{display:'flex',gap:5,marginBottom:18,overflowX:'auto'}}>{TABS.map(t=>{const a=tab===t.id;return<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'8px 17px',fontSize:11,letterSpacing:'0.09em',fontWeight:a?700:400,fontFamily:'inherit',background:a?'rgba(255,140,0,0.13)':'transparent',color:a?G:'rgba(255,140,0,0.36)',border:`1px solid ${a?'rgba(255,140,0,0.4)':'rgba(255,140,0,0.09)'}`,borderRadius:5,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap'}}>{t.label}</button>})}</div>}
          {tab==='overview'  && <OverviewTab  prices={prices} stats={stats} fearGreed={fearGreed} wsStatus={wsStatus} watchlist={watchlist} onToggle={toggle} onChart={setChartCoin} isMobile={isMobile}/>}
          {tab==='prices'    && <PricesTab    prices={prices} loading={loading} wsStatus={wsStatus} watchlist={watchlist} onToggle={toggle} onChart={setChartCoin} isMobile={isMobile}/>}
          {tab==='watchlist' && <WatchlistTab prices={prices} watchlist={watchlist} extraCoins={extraCoins} onToggle={toggle} onClear={clear} onChart={setChartCoin} wsStatus={wsStatus} isMobile={isMobile}/>}
          {tab==='analysis'  && <AnalysisTab  prices={prices} watchlist={watchlist} isMobile={isMobile}/>}
          {tab==='wallet'    && <WalletTab    isMobile={isMobile}/>}
        </div>
        {isMobile&&<nav style={{position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:'rgba(13,13,13,0.97)',backdropFilter:'blur(12px)',borderTop:'1px solid rgba(255,140,0,0.12)',display:'flex',padding:'7px 0 max(7px,env(safe-area-inset-bottom))'}}>
          {TABS.map(t=>{const a=tab===t.id;return<button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'none',border:'none',cursor:'pointer',padding:'5px 0',color:a?G:'rgba(255,140,0,0.3)',fontFamily:'inherit'}}>
            <span style={{fontSize:t.icon==='📊'?16:19}}>{t.icon}</span>
            <span style={{fontSize:9,fontWeight:a?700:400}}>{t.id==='watchlist'&&watchlist.length>0?`★(${watchlist.length})`:t.label.split('(')[0].trim().split('·')[0].trim().substring(0,7)}</span>
          </button>})}
        </nav>}
      </div>
      {chartCoin&&<CandlestickChart coin={chartCoin} onClose={()=>setChartCoin(null)} isMobile={isMobile}/>}
    </>
  )
}
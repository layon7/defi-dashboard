import { useState, useEffect, useRef } from 'react'
import {
  usePrices, useGlobalStats, useFearGreed, useWatchlist,
  useWallet, useGlobalSearch, useOHLC, useAnalysis,
  CHAIN_COLORS, CHAIN_NAMES
} from './hooks/useDefiData.js'
import { hasZerionKey } from './services/api.js'
import { runBacktest } from './utils/indicators.js'

const fmt = n => { if(n==null||isNaN(n))return'—'; if(n>=1e12)return`$${(n/1e12).toFixed(2)}T`; if(n>=1e9)return`$${(n/1e9).toFixed(2)}B`; if(n>=1e6)return`$${(n/1e6).toFixed(2)}M`; if(n>=1e3)return`$${(n/1e3).toFixed(1)}K`; return`$${Number(n).toFixed(2)}` }
const pct = n => n==null?'—':`${n>=0?'▲':'▼'} ${Math.abs(n).toFixed(2)}%`
const pc  = n => n==null?DIM:n>=0?GREEN:RED
const ago = iso => { const d=Math.floor((Date.now()-new Date(iso).getTime())/60000); return d<1?'ahora':d<60?`${d}m`:d<1440?`${Math.floor(d/60)}h`:`${Math.floor(d/1440)}d` }

const G='#FF8C00',GREEN='#00D26A',RED='#FF4D4D',GOLD='#FFCC00',BLUE='#4DB8FF'
const DIM='rgba(255,255,255,0.48)',WHITE='#FFFFFF',BG='#0D0D0D'

const Dot = ({color=G,size=9}) => (
  <span style={{position:'relative',display:'inline-flex',width:size,height:size}}>
    <span style={{position:'absolute',inset:0,borderRadius:'50%',background:color,opacity:.4,animation:'ping 1.5s ease infinite'}}/>
    <span style={{borderRadius:'50%',width:size,height:size,background:color,display:'block'}}/>
  </span>
)
const Card = ({children,accent,style={}}) => (
  <div style={{background:accent?'rgba(255,140,0,0.07)':'rgba(255,255,255,0.025)',border:`1px solid ${accent?'rgba(255,140,0,0.38)':'rgba(255,140,0,0.12)'}`,borderRadius:10,padding:15,...style}}>{children}</div>
)
const CT = ({children,mb=12}) => (
  <div style={{fontSize:10,letterSpacing:'.18em',color:'rgba(255,140,0,.6)',marginBottom:mb,fontWeight:700}}>{children}</div>
)
const WsInd = ({status,short}) => {
  const c=status==='live'?GREEN:status==='error'?RED:GOLD
  const l=status==='live'?(short?'LIVE':'LIVE · BINANCE'):status==='error'?(short?'ERR':'ERROR'):(short?'…':'CONECTANDO…')
  return <div style={{display:'flex',alignItems:'center',gap:5}}><Dot color={c} size={7}/><span style={{fontSize:10,color:c,fontWeight:700}}>{l}</span></div>
}
const SearchBox = ({value,onChange,placeholder,busy}) => (
  <div style={{position:'relative'}}>
    <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'rgba(255,140,0,.35)',pointerEvents:'none'}}>{busy?'⟳':'⌕'}</span>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||'Buscar…'}
      style={{width:'100%',background:'rgba(255,140,0,.04)',border:'1px solid rgba(255,140,0,.18)',borderRadius:7,padding:'10px 32px',color:WHITE,fontFamily:'inherit',fontSize:13,outline:'none'}}/>
    {value&&<button onClick={()=>onChange('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:DIM,fontSize:17}}>×</button>}
  </div>
)
const ChainBadge = ({chain}) => {
  const color=CHAIN_COLORS[chain?.toLowerCase()]||'rgba(255,255,255,0.3)'
  const name=CHAIN_NAMES[chain?.toLowerCase()]||chain?.toUpperCase()?.slice(0,6)||'?'
  return <span style={{fontSize:9,fontWeight:700,color,border:`1px solid ${color}44`,background:`${color}18`,padding:'2px 6px',borderRadius:3,letterSpacing:'.06em'}}>{name}</span>
}

function RSIGauge({value,size=80}) {
  if (value==null) return null
  const r=size*.38,cx=size/2,cy=size/2+2,sw=size*.09
  const angle=-Math.PI+(value/100)*Math.PI
  const color=value<30?GREEN:value>70?RED:GOLD
  return (
    <svg width={size} height={size*.58}>
      <path d={`M${cx-r} ${cy} A${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={sw} strokeLinecap="round"/>
      <path d={`M${cx-r} ${cy} A${r} ${r} 0 ${value>50?1:0} 1 ${cx+r*Math.cos(angle)} ${cy+r*Math.sin(angle)}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"/>
      <line x1={cx} y1={cy} x2={cx+r*.86*Math.cos(angle)} y2={cy+r*.86*Math.sin(angle)} stroke={color} strokeWidth={2} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={sw*.5} fill={color}/>
      <text x={cx} y={cy-r*.25} textAnchor="middle" fill={color} fontSize={size*.19} fontWeight={700} fontFamily="IBM Plex Mono">{value.toFixed(0)}</text>
    </svg>
  )
}

function HBar({value,min=0,max=100,color,label,sub}) {
  const p=Math.max(0,Math.min(100,((value-min)/(max-min))*100))
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:11,color:DIM}}>{label}</span>
        <span style={{fontSize:11,fontWeight:700,color}}>{typeof value==='number'?value.toFixed(1):value}</span>
      </div>
      <div style={{height:5,background:'rgba(255,255,255,.07)',borderRadius:3,overflow:'hidden'}}>
        <div style={{width:`${p}%`,height:'100%',background:color,borderRadius:3,transition:'width .5s'}}/>
      </div>
      {sub&&<div style={{fontSize:10,color:DIM,marginTop:3}}>{sub}</div>}
    </div>
  )
}

function FearGreedGauge({data}) {
  if (!data) return <Card style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:110}}><div style={{color:DIM,fontSize:12}}>Cargando…</div></Card>
  const val=parseInt(data.value)
  const color=val>=75?GREEN:val>=55?'#AAEE44':val>=45?GOLD:val>=25?'#FF8844':RED
  const r=52,cx=70,cy=68,angle=-Math.PI+(val/100)*Math.PI
  return (
    <Card>
      <CT>FEAR & GREED INDEX</CT>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <svg width={140} height={80} style={{overflow:'visible'}}>
          <path d={`M${cx-r} ${cy} A${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={10} strokeLinecap="round"/>
          <path d={`M${cx-r} ${cy} A${r} ${r} 0 ${val>50?1:0} 1 ${cx+r*Math.cos(angle)} ${cy+r*Math.sin(angle)}`} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"/>
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

function CandlestickChart({coin,onClose,isMobile}) {
  const [days,setDays]=useState(7)
  const {candles,loading}=useOHLC(coin?.id,days)
  if (!coin) return null
  const W=isMobile?Math.min(window.innerWidth-48,360):580,H=220
  const P={top:18,right:14,bottom:28,left:60},cw=W-P.left-P.right,ch=H-P.top-P.bottom
  let inner=null
  if (loading) {
    inner=<text x={W/2} y={H/2} textAnchor="middle" fill={DIM} fontSize={12} fontFamily="IBM Plex Mono">Cargando…</text>
  } else if (candles.length>0) {
    const allP=candles.flatMap(c=>[c.high,c.low]),mx=Math.max(...allP),mn=Math.min(...allP),range=mx-mn||1
    const py=v=>P.top+ch-((v-mn)/range)*ch,cw2=Math.max(2,Math.floor(cw/candles.length)-2),xS=cw/candles.length
    const step=Math.max(1,Math.floor(candles.length/5))
    const grids=[0,.25,.5,.75,1].map(f=>{
      const v=mn+f*range,y=py(v),lbl=v>=1000?`$${(v/1000).toFixed(0)}k`:v>=1?`$${v.toFixed(0)}`:`$${v.toFixed(4)}`
      return <g key={f}><line x1={P.left} y1={y} x2={P.left+cw} y2={y} stroke="rgba(255,255,255,.04)" strokeWidth={1}/><text x={P.left-4} y={y+4} textAnchor="end" fill={DIM} fontSize={9} fontFamily="IBM Plex Mono">{lbl}</text></g>
    })
    const bars=candles.map((c,i)=>{const x=P.left+i*xS+xS/2,up=c.close>=c.open,col=up?GREEN:RED,top=py(Math.max(c.open,c.close)),bot=py(Math.min(c.open,c.close)),bh=Math.max(1,bot-top);return<g key={i}><line x1={x} y1={py(c.high)} x2={x} y2={py(c.low)} stroke={col} strokeWidth={1.2}/><rect x={x-cw2/2} y={top} width={cw2} height={bh} fill={col} rx={1}/>{i%step===0&&<text x={x} y={H-4} textAnchor="middle" fill={DIM} fontSize={8} fontFamily="IBM Plex Mono">{c.date}</text>}</g>})
    inner=<>{grids}{bars}</>
  } else {
    inner=<text x={W/2} y={H/2} textAnchor="middle" fill={DIM} fontSize={12} fontFamily="IBM Plex Mono">Sin datos OHLC</text>
  }
  const last=candles[candles.length-1]
  return (
    <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:'#141414',border:'1px solid rgba(255,140,0,.22)',borderRadius:12,padding:16,maxWidth:640,width:'100%'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div><div style={{fontSize:15,fontWeight:700,color:G}}>{coin.symbol?.toUpperCase()} · OHLC</div><div style={{fontSize:10,color:DIM}}>click fuera para cerrar</div></div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {[1,7,14,30].map(d=><button key={d} onClick={()=>setDays(d)} style={{padding:'4px 9px',fontSize:11,fontFamily:'inherit',background:days===d?'rgba(255,140,0,.16)':'transparent',color:days===d?G:DIM,border:`1px solid ${days===d?'rgba(255,140,0,.38)':'rgba(255,255,255,.08)'}`,borderRadius:5,cursor:'pointer'}}>{d}D</button>)}
            <button onClick={onClose} style={{padding:'4px 9px',background:'transparent',border:'1px solid rgba(255,77,77,.28)',borderRadius:5,color:RED,cursor:'pointer',fontFamily:'inherit'}}>✕</button>
          </div>
        </div>
        <svg width={W} height={H} style={{display:'block',maxWidth:'100%'}}>{inner}</svg>
        {last&&<div style={{marginTop:10,display:'flex',gap:14,flexWrap:'wrap',fontSize:11}}>
          {[['O',last.open],['H',last.high],['L',last.low],['C',last.close]].map(([l,v])=>(
            <div key={l}><div style={{fontSize:9,color:'rgba(255,140,0,.4)',marginBottom:2}}>{l}</div><div style={{fontWeight:700,color:WHITE}}>${v?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}</div></div>
          ))}
        </div>}
      </div>
    </div>
  )
}

// ── ANÁLISIS TAB ──────────────────────────────────────────────
function AnalysisTab({prices,watchlist,isMobile}) {
  const [selectedId,setSelectedId]=useState('')
  const [selectedMeta,setMeta]=useState(null)
  const [searchQ,setSearchQ]=useState('')
  const [showDrop,setDrop]=useState(false)
  const [activeTF,setActiveTF]=useState('1d')
  const [btPeriod,setBtPeriod]=useState('90d')
  const {results,searching}=useGlobalSearch(searchQ,prices)
  const {signal,signal1h,signal4h,confluence,trendChange,backtest,coinData,loading,loadingTF,error}=useAnalysis(selectedId)
  const displayCoin=coinData||selectedMeta
  const sc=s=>s==='COMPRAR'?GREEN:s==='VENDER'?RED:GOLD
  const regimeLabel=r=>({strong_bull:'🟢 Tendencia alcista fuerte',bull:'🟡 Tendencia alcista',lateral:'⚪ Mercado lateral',bear:'🟠 Tendencia bajista',strong_bear:'🔴 Tendencia bajista fuerte',unknown:'⚪ Sin determinar'}[r]||r)

  // Señal activa según el TF seleccionado
  const activeSig = activeTF==='1h' ? signal1h : activeTF==='4h' ? signal4h : signal

  function selectCoin(p) { setSelectedId(p.id); setMeta(p); setSearchQ(''); setDrop(false) }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>

      {/* Buscador */}
      <Card>
        <CT mb={8}>ANÁLISIS TÉCNICO · 14 INDICADORES · TIMEFRAME DIARIO 1D · 90 DÍAS</CT>
        <div style={{fontSize:11,color:DIM,lineHeight:1.9,marginBottom:14}}>
          Escribe cualquier moneda para analizar. Incluye <span style={{color:WHITE}}>correlación con BTC</span>, ATR con stop/target sugeridos,
          divergencias, volumen ponderado y régimen de mercado. Eficacia: <span style={{color:GOLD}}>~68-72% en tendencias · ~50% en laterales</span>
        </div>
        <div style={{position:'relative'}}>
          <SearchBox value={searchQ} onChange={v=>{setSearchQ(v);setDrop(true)}} busy={searching} placeholder="Escribe la moneda a analizar — L3, PEPE, cualquiera…"/>
          {showDrop&&searchQ&&(results.length>0||searching)&&(
            <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:30,background:'#181818',border:'1px solid rgba(255,140,0,.2)',borderRadius:8,marginTop:4,overflow:'hidden',maxHeight:220,overflowY:'auto'}}>
              {results.slice(0,10).map(p=>(
                <button key={p.id} onClick={()=>selectCoin(p)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,140,0,.06)',cursor:'pointer',color:WHITE,fontFamily:'inherit'}}
                  onMouseOver={e=>e.currentTarget.style.background='rgba(255,140,0,.06)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <img src={p.image} alt="" style={{width:20,height:20,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>
                    <span style={{fontWeight:700,fontSize:13}}>{p.symbol?.toUpperCase()}</span>
                    <span style={{fontSize:11,color:DIM}}>{p.name}</span>
                    {p.market_cap_rank&&<span style={{fontSize:10,color:'rgba(255,140,0,.4)'}}>#{p.market_cap_rank}</span>}
                  </div>
                  <span style={{fontSize:12,color:pc(p.price_change_percentage_24h)}}>{pct(p.price_change_percentage_24h)}</span>
                </button>
              ))}
              {searching&&<div style={{padding:'9px 12px',fontSize:11,color:DIM}}>Buscando…</div>}
            </div>
          )}
        </div>
        {watchlist.length>0&&(
          <div style={{marginTop:12}}>
            <div style={{fontSize:10,color:DIM,marginBottom:6}}>Mis watchlist ↓</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {watchlist.slice(0,8).map(id=>{
                const p=prices.find(x=>x.id===id); if(!p) return null
                const a=selectedId===id
                return <button key={id} onClick={()=>selectCoin(p)} style={{padding:'5px 10px',fontSize:11,fontFamily:'inherit',background:a?'rgba(255,140,0,.18)':'rgba(255,255,255,.03)',color:a?G:DIM,border:`1px solid ${a?'rgba(255,140,0,.38)':'rgba(255,140,0,.12)'}`,borderRadius:5,cursor:'pointer'}}>★ {p.symbol?.toUpperCase()}</button>
              })}
            </div>
          </div>
        )}
      </Card>

      {!selectedId&&(
        <Card>
          <div style={{textAlign:'center',padding:isMobile?'24px 0':'40px 0'}}>
            <div style={{fontSize:isMobile?32:40,marginBottom:12}}>📊</div>
            <div style={{fontSize:14,color:WHITE,marginBottom:8}}>Escribe una moneda para analizar</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.3)',lineHeight:2}}>
              RSI percentílico · Divergencias · MACD · Bollinger · Stoch RSI<br/>
              Williams %R · ADX · ROC 10d/30d · Volumen · OBV<br/>
              ATR (stop/target) · Correlación BTC · Soporte/Resistencia
            </div>
          </div>
        </Card>
      )}

      {selectedId&&loading&&<Card><div style={{textAlign:'center',padding:'28px 0',color:DIM,fontSize:12}}>⟳ Cargando análisis 1D…</div></Card>}
      {selectedId&&loadingTF&&signal&&<Card><div style={{textAlign:'center',padding:'10px 0',color:GOLD,fontSize:11}}>⟳ Cargando timeframes 4H y 1H…</div></Card>}
      {selectedId&&error&&<Card><div style={{textAlign:'center',padding:'20px 0',color:RED,fontSize:12}}>⚠ {error} — intenta de nuevo en unos segundos</div></Card>}

      {signal&&!loading&&(()=>{
        const corrColor=signal.btcCorrelation?.color||DIM
        return (
          <>
            {/* ── Confluencia multi-timeframe ── */}
            {confluence&&(
              <Card style={{background:'rgba(255,140,0,.04)',border:`2px solid ${confluence.color}44`}}>
                <CT mb={8}>CONFLUENCIA MULTI-TIMEFRAME</CT>
                <div style={{display:'flex',flexDirection:isMobile?'column':'row',alignItems:isMobile?'flex-start':'center',gap:16,marginBottom:12}}>
                  <div style={{textAlign:'center',minWidth:80}}>
                    <div style={{fontSize:isMobile?22:28,fontWeight:700,color:confluence.color,lineHeight:1}}>{confluence.overall}</div>
                    <div style={{fontSize:12,color:DIM,marginTop:3}}>{confluence.strength}</div>
                    <div style={{fontSize:11,fontWeight:700,color:confluence.color,marginTop:3}}>{confluence.confidence}% confianza</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:WHITE,marginBottom:8,fontWeight:600}}>{confluence.note}</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {confluence.signals.map(s=>(
                        <div key={s.label} style={{padding:'6px 12px',borderRadius:6,background:`rgba(${s.data.overall==='COMPRAR'?'0,210,106':s.data.overall==='VENDER'?'255,77,77':'255,204,0'},.1)`,border:`1px solid rgba(${s.data.overall==='COMPRAR'?'0,210,106':s.data.overall==='VENDER'?'255,77,77':'255,204,0'},.3)`}}>
                          <div style={{fontSize:10,color:DIM,marginBottom:2}}>TF {s.label}</div>
                          <div style={{fontSize:13,fontWeight:700,color:s.data.overall==='COMPRAR'?GREEN:s.data.overall==='VENDER'?RED:GOLD}}>{s.data.overall}</div>
                          <div style={{fontSize:10,color:DIM}}>Score {s.data.score>0?'+':''}{s.data.score} · {s.data.confidence}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{fontSize:10,color:DIM,lineHeight:1.7,borderTop:'1px solid rgba(255,255,255,.05)',paddingTop:8}}>
                  Alineación TF: <span style={{color:confluence.color,fontWeight:700}}>{confluence.alignment}%</span> · Pesos: 1H×1 · 4H×1.5 · 1D×2 (tendencia dominante) · Requiere 2+ TF alineados para señal fuerte
                </div>
              </Card>
            )}

            {/* ── Cambio de tendencia ── */}
            {trendChange&&trendChange.signal!=='none'&&(
              <Card style={{border:`2px solid ${trendChange.color}55`}}>
                <CT mb={8}>⚡ ALERTA CAMBIO DE TENDENCIA</CT>
                <div style={{display:'flex',flexDirection:isMobile?'column':'row',alignItems:isMobile?'flex-start':'center',gap:14,marginBottom:10}}>
                  <div>
                    <div style={{fontSize:isMobile?16:19,fontWeight:700,color:trendChange.color,marginBottom:4}}>{trendChange.label}</div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{fontSize:12,color:DIM}}>Probabilidad:</div>
                      <div style={{flex:1,minWidth:100,height:7,background:'rgba(255,255,255,.07)',borderRadius:4,overflow:'hidden'}}>
                        <div style={{width:`${trendChange.probability}%`,height:'100%',background:trendChange.color,borderRadius:4}}/>
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:trendChange.color}}>{trendChange.probability}%</div>
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {trendChange.reasons.map((r,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:11,color:DIM}}>
                      <span style={{color:r.type==='buy'?GREEN:RED,flexShrink:0}}>{r.type==='buy'?'▲':'▼'}</span>
                      <span>{r.txt}</span>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:DIM,marginTop:8,borderTop:'1px solid rgba(255,255,255,.05)',paddingTop:8}}>
                  ⚠ Señal de alerta temprana — confirmar con volumen y precio cerrando sobre niveles clave antes de operar
                </div>
              </Card>
            )}

            {/* ── Selector de timeframe ── */}
            <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:10,color:DIM,marginRight:4}}>TIMEFRAME:</span>
              {[['1d','1D · Diario'],['4h','4H · Horas'],['1h','1H · Rápido']].map(([tf,label])=>{
                const sig = tf==='1h'?signal1h:tf==='4h'?signal4h:signal
                const a = activeTF===tf
                const c = sig ? (sig.overall==='COMPRAR'?GREEN:sig.overall==='VENDER'?RED:GOLD) : DIM
                return (
                  <button key={tf} onClick={()=>setActiveTF(tf)}
                    style={{padding:'6px 13px',fontSize:11,fontFamily:'inherit',fontWeight:a?700:400,
                      background:a?`${c}18`:'transparent',color:a?c:DIM,
                      border:`1px solid ${a?c+'55':'rgba(255,255,255,.08)'}`,borderRadius:5,cursor:'pointer',
                      display:'flex',alignItems:'center',gap:6}}>
                    {label}
                    {sig&&<span style={{fontSize:10,color:c,fontWeight:700}}>{sig.overall==='NEUTRAL'?'—':sig.score>0?`+${sig.score}`:sig.score}</span>}
                    {!sig&&tf!=='1d'&&loadingTF&&<span style={{fontSize:9,color:GOLD}}>…</span>}
                  </button>
                )
              })}
            </div>

            {/* ── Señal del TF activo (si es distinto a 1D, mostrar mini-card) ── */}
            {activeTF!=='1d'&&activeSig&&(
              <Card style={{border:`1px solid ${sc(activeSig.overall)}33`,background:`rgba(${activeSig.overall==='COMPRAR'?'0,210,106':activeSig.overall==='VENDER'?'255,77,77':'255,204,0'},.03)`}}>
                <CT mb={6}>SEÑAL {activeTF.toUpperCase()} · {displayCoin?.symbol?.toUpperCase()}</CT>
                <div style={{display:'flex',flexWrap:'wrap',gap:16,alignItems:'center'}}>
                  <div><div style={{fontSize:22,fontWeight:700,color:sc(activeSig.overall)}}>{activeSig.strength?`${activeSig.strength} · `:''}{activeSig.overall}</div><div style={{fontSize:11,color:DIM,marginTop:2}}>Score {activeSig.score>0?'+':''}{activeSig.score} · Confianza {activeSig.confidence}%</div></div>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                    {[['RSI',activeSig.rsi?.toFixed(1),activeSig.rsi<30?GREEN:activeSig.rsi>70?RED:GOLD],
                      ['MACD hist',activeSig.macdHist?.toFixed(5),activeSig.macdHist>=0?GREEN:RED],
                      ['ADX',activeSig.adx?.toFixed(1),activeSig.adx>25?GREEN:DIM],
                      ['Stoch',activeSig.stochRsi?.toFixed(1),activeSig.stochRsi<20?GREEN:activeSig.stochRsi>80?RED:GOLD],
                    ].map(([l,v,c])=>v!=null&&<div key={l}><div style={{fontSize:9,color:DIM,marginBottom:2}}>{l}</div><div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div></div>)}
                  </div>
                  {activeSig.divergence!=='none'&&<span style={{fontSize:11,fontWeight:700,color:activeSig.divergence==='bullish'?GREEN:RED}}>📐 Divergencia {activeSig.divergence==='bullish'?'alcista':'bajista'}</span>}
                </div>
              </Card>
            )}

            {/* Señal global */}
            <Card accent style={{padding:isMobile?'16px 14px':'20px 24px'}}>
              <div style={{display:'flex',flexDirection:isMobile?'column':'row',alignItems:isMobile?'flex-start':'center',justifyContent:'space-between',gap:14}}>
                <div>
                  <div style={{fontSize:10,letterSpacing:'.2em',color:DIM,marginBottom:8}}>SEÑAL GLOBAL · {displayCoin?.symbol?.toUpperCase()||selectedId.toUpperCase()} · {displayCoin?.name||''}</div>
                  <div style={{fontSize:isMobile?28:38,fontWeight:700,color:sc(signal.overall),lineHeight:1,marginBottom:6}}>{signal.strength?`${signal.strength} · `:''}{signal.overall}</div>
                  <div style={{fontSize:11,color:DIM,marginBottom:8}}>
                    Score: {signal.score>0?`+${signal.score}`:signal.score} ·{' '}
                    <span style={{color:GREEN}}>{signal.buyCount} compra</span> /
                    <span style={{color:RED}}> {signal.sellCount} venta</span> /
                    <span style={{color:DIM}}> {signal.totalSignals-signal.buyCount-signal.sellCount} neutral</span>
                  </div>
                  {displayCoin&&(
                    <div style={{fontSize:isMobile?16:20,fontWeight:700,color:WHITE}}>
                      ${(displayCoin.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}
                      {' '}<span style={{fontSize:14,color:pc(displayCoin.price_change_percentage_24h)}}>{pct(displayCoin.price_change_percentage_24h)}</span>
                    </div>
                  )}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10,minWidth:isMobile?'100%':220}}>
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:10,color:DIM}}>CONFIANZA</span>
                      <span style={{fontSize:12,fontWeight:700,color:signal.confidence>65?GREEN:signal.confidence>50?GOLD:RED}}>{signal.confidence}%</span>
                    </div>
                    <div style={{height:5,background:'rgba(255,255,255,.07)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{width:`${signal.confidence}%`,height:'100%',background:signal.confidence>65?GREEN:signal.confidence>50?GOLD:RED,borderRadius:3}}/>
                    </div>
                  </div>
                  <div style={{fontSize:11}}>{regimeLabel(signal.regime)}</div>
                  <div style={{fontSize:11,color:signal.divergence==='bullish'?GREEN:signal.divergence==='bearish'?RED:DIM}}>
                    {signal.divergence==='bullish'?'🟢 Divergencia alcista':signal.divergence==='bearish'?'🔴 Divergencia bajista':'Sin divergencia RSI'}
                  </div>
                </div>
              </div>
              <div style={{marginTop:12,display:'flex',flexWrap:'wrap',gap:7}}>
                {signal.adx!=null&&<span style={{fontSize:10,padding:'3px 9px',borderRadius:4,background:'rgba(77,184,255,.08)',border:'1px solid rgba(77,184,255,.18)',color:BLUE}}>ADX {signal.adx.toFixed(1)} · {signal.adx>30?'Fuerte':signal.adx>20?'Moderada':'Lateral'}</span>}
                {signal.obvTrend&&<span style={{fontSize:10,padding:'3px 9px',borderRadius:4,background:`rgba(${signal.obvTrend==='up'?'0,210,106':'255,77,77'},.08)`,border:`1px solid rgba(${signal.obvTrend==='up'?'0,210,106':'255,77,77'},.18)`,color:signal.obvTrend==='up'?GREEN:RED}}>OBV {signal.obvTrend==='up'?'▲ Acumulación':'▼ Distribución'}</span>}
                {signal.roc10!=null&&<span style={{fontSize:10,padding:'3px 9px',borderRadius:4,background:`rgba(${signal.roc10>0?'0,210,106':'255,77,77'},.06)`,border:`1px solid rgba(${signal.roc10>0?'0,210,106':'255,77,77'},.15)`,color:signal.roc10>0?GREEN:RED}}>ROC 10d: {signal.roc10>0?'+':''}{signal.roc10?.toFixed(2)}%</span>}
                {signal.atr&&<span style={{fontSize:10,padding:'3px 9px',borderRadius:4,background:`rgba(${signal.atr.volColor==='#FF4D4D'?'255,77,77':signal.atr.volColor==='#FFCC00'?'255,204,0':'0,210,106'},.06)`,border:`1px solid ${signal.atr.volColor}33`,color:signal.atr.volColor}}>ATR: Volatilidad {signal.atr.volatility}</span>}
                {signal.btcCorrelation&&<span style={{fontSize:10,padding:'3px 9px',borderRadius:4,background:`${corrColor}11`,border:`1px solid ${corrColor}33`,color:corrColor}}>Corr BTC: {signal.btcCorrelation.value.toFixed(2)}</span>}
              </div>
              <div style={{marginTop:10,fontSize:10,color:'rgba(255,255,255,.2)'}}>⚠ Indicadores matemáticos sobre datos históricos · No garantizan resultados · No es consejo financiero</div>
            </Card>

            {/* Fila 1: RSI + Stoch/WilliamsR + MACD/ROC */}
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:12}}>
              <Card>
                <CT>RSI (14) · Percentil: {signal.rsiPercentile?.toFixed(0)}%</CT>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <RSIGauge value={signal.rsi} size={isMobile?70:84}/>
                  <div>
                    <div style={{fontSize:isMobile?20:22,fontWeight:700,color:signal.rsi<30?GREEN:signal.rsi>70?RED:GOLD}}>{signal.rsi?.toFixed(1)}</div>
                    <div style={{fontSize:11,color:DIM,marginTop:2}}>{signal.rsi<30?'Sobrevendido':signal.rsi>70?'Sobrecomprado':'Neutral'}</div>
                    <div style={{fontSize:10,color:DIM,marginTop:3}}>RSI rápido (7): <span style={{color:WHITE}}>{signal.rsi7?.toFixed(1)}</span></div>
                  </div>
                </div>
                <div style={{fontSize:10,padding:'6px 8px',background:'rgba(255,255,255,.03)',borderRadius:5,color:DIM,lineHeight:1.6}}>
                  Umbral compra: <span style={{color:GREEN}}>&lt;{signal.regime==='strong_bull'?22:signal.regime==='bull'?27:30}</span> ·
                  venta: <span style={{color:RED}}>&gt;{signal.regime==='strong_bull'?82:signal.regime==='bull'?78:70}</span><br/>
                  {signal.regime==='strong_bull'||signal.regime==='bull'?'Bull: umbrales ajustados por régimen.':'Umbrales estándar.'}
                </div>
              </Card>

              <Card>
                <CT>STOCH RSI + WILLIAMS %R</CT>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                  <RSIGauge value={signal.stochRsi} size={isMobile?70:84}/>
                  <div>
                    <div style={{fontSize:isMobile?20:22,fontWeight:700,color:signal.stochRsi<20?GREEN:signal.stochRsi>80?RED:GOLD}}>{signal.stochRsi?.toFixed(1)}</div>
                    <div style={{fontSize:11,color:DIM}}>{signal.stochRsi<20?'Sobrevendido extremo':signal.stochRsi>80?'Sobrecomprado extremo':'Neutral'}</div>
                  </div>
                </div>
                {signal.williamsR!=null&&(
                  <div style={{borderTop:'1px solid rgba(255,255,255,.05)',paddingTop:8}}>
                    <div style={{fontSize:9,color:DIM,marginBottom:5,letterSpacing:'.1em'}}>WILLIAMS %R</div>
                    <HBar value={Math.abs(signal.williamsR)} min={0} max={100}
                      color={signal.williamsR<-80?GREEN:signal.williamsR>-20?RED:GOLD}
                      label="" sub={signal.williamsR<-80?'Sobrevendido (<-80)':signal.williamsR>-20?'Sobrecomprado (>-20)':'Neutral (-80 a -20)'}/>
                    <div style={{fontSize:13,fontWeight:700,color:signal.williamsR<-80?GREEN:signal.williamsR>-20?RED:DIM,marginTop:5}}>{signal.williamsR?.toFixed(1)}</div>
                  </div>
                )}
              </Card>

              <Card>
                <CT>MACD · ROC MOMENTUM</CT>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:8}}>
                  {[['MACD',signal.macd,signal.macd>=0?GREEN:RED],['SEÑAL',signal.macdSignal,WHITE],['HIST',signal.macdHist,signal.macdHist>=0?GREEN:RED]].map(([l,v,c])=>(
                    <div key={l}><div style={{fontSize:9,color:DIM,marginBottom:2}}>{l}</div><div style={{fontSize:12,fontWeight:700,color:c}}>{v?.toFixed(5)||'—'}</div></div>
                  ))}
                </div>
                <div style={{fontSize:11,fontWeight:700,color:signal.macdHist>=0?GREEN:RED,marginBottom:8}}>{signal.macdHist>=0?'▲ Momentum positivo':'▼ Momentum negativo'}</div>
                {signal.roc10!=null&&(
                  <div style={{borderTop:'1px solid rgba(255,255,255,.05)',paddingTop:8,display:'flex',gap:16}}>
                    <div><div style={{fontSize:9,color:DIM,marginBottom:2}}>ROC 10d</div><div style={{fontSize:13,fontWeight:700,color:signal.roc10>0?GREEN:RED}}>{signal.roc10>0?'+':''}{signal.roc10?.toFixed(2)}%</div></div>
                    {signal.roc30!=null&&<div><div style={{fontSize:9,color:DIM,marginBottom:2}}>ROC 30d</div><div style={{fontSize:13,fontWeight:700,color:signal.roc30>0?GREEN:RED}}>{signal.roc30>0?'+':''}{signal.roc30?.toFixed(2)}%</div></div>}
                  </div>
                )}
              </Card>
            </div>

            {/* Fila 2: Bollinger+EMAs · ADX+Volumen */}
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:12}}>
              <Card>
                <CT>BOLLINGER (20,2) + EMA 20/50/200</CT>
                <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:10}}>
                  {[
                    ['Resistencia 30d',signal.resistance,null],
                    ['Banda superior',signal.bollUpper,null],
                    signal.ema200?['EMA 200',signal.ema200,null]:null,
                    signal.ema50?['EMA 50',signal.ema50,null]:null,
                    ['EMA 20',signal.ema20,null],
                    ['▶ PRECIO',displayCoin?.current_price,true],
                    ['Banda inferior',signal.bollLower,null],
                    ['Soporte 30d',signal.support,null],
                  ].filter(Boolean).filter(([,v])=>v!=null).map(([label,val,isCurrent])=>(
                    <div key={label} style={{display:'flex',justifyContent:'space-between',padding:isCurrent?'5px 8px':'3px 0',background:isCurrent?'rgba(255,140,0,.08)':undefined,borderRadius:isCurrent?5:undefined,borderBottom:!isCurrent?'1px solid rgba(255,255,255,.04)':undefined}}>
                      <span style={{fontSize:11,color:isCurrent?G:DIM}}>{label}</span>
                      <span style={{fontSize:isCurrent?13:11,fontWeight:isCurrent?700:400,color:isCurrent?WHITE:DIM}}>${val?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</span>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,padding:'6px 9px',background:'rgba(255,255,255,.03)',borderRadius:5,color:DIM}}>
                  {displayCoin?.current_price<signal.bollLower?<span style={{color:GREEN}}>▲ Bajo banda inferior → zona de rebote potencial</span>
                  :displayCoin?.current_price>signal.bollUpper?<span style={{color:RED}}>▼ Sobre banda superior → posible corrección</span>
                  :<span>Precio dentro de bandas · posición: {((signal.srPosition||0)*100).toFixed(0)}% del rango 30d</span>}
                </div>
              </Card>

              <Card>
                <CT>ADX · VOLUMEN · OBV</CT>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  {signal.adx!=null&&(
                    <div>
                      <HBar value={signal.adx} min={0} max={50}
                        color={signal.adx>25?GREEN:signal.adx>20?GOLD:DIM}
                        label="ADX — Fuerza de tendencia"
                        sub={signal.adx>30?`Tendencia fuerte · ${signal.pdi>signal.mdi?'+DI>-DI alcista':'-DI>+DI bajista'}`:signal.adx>20?'Tendencia moderada':'Lateral — señales menos fiables'}/>
                      {signal.pdi!=null&&<div style={{display:'flex',gap:14,marginTop:6}}>
                        <div><div style={{fontSize:9,color:GREEN,marginBottom:2}}>+DI</div><div style={{fontSize:12,fontWeight:700,color:GREEN}}>{signal.pdi.toFixed(1)}</div></div>
                        <div><div style={{fontSize:9,color:RED,marginBottom:2}}>-DI</div><div style={{fontSize:12,fontWeight:700,color:RED}}>{signal.mdi.toFixed(1)}</div></div>
                      </div>}
                    </div>
                  )}
                  {signal.volRatio!=null&&(
                    <HBar value={Math.min(signal.volRatio*100,250)} min={0} max={250}
                      color={signal.volRatio>1.5?GREEN:signal.volRatio<0.5?RED:GOLD}
                      label={`Volumen relativo (${(signal.volRatio*100).toFixed(0)}% promedio 20d)`}
                      sub={signal.volRatio>2?'Muy alto — movimiento confirmado':signal.volRatio>1.5?'Alto — señal más fiable':signal.volRatio<0.4?'Bajo — sin convicción':'Normal'}/>
                  )}
                  {signal.obvTrend&&(
                    <div style={{padding:'8px 10px',background:`rgba(${signal.obvTrend==='up'?'0,210,106':'255,77,77'},.06)`,border:`1px solid rgba(${signal.obvTrend==='up'?'0,210,106':'255,77,77'},.18)`,borderRadius:6}}>
                      <div style={{fontSize:10,fontWeight:700,color:signal.obvTrend==='up'?GREEN:RED,marginBottom:3}}>OBV — ON BALANCE VOLUME</div>
                      <div style={{fontSize:12,color:WHITE,marginBottom:3}}>{signal.obvTrend==='up'?'▲ Acumulación activa':'▼ Distribución en curso'}</div>
                      <div style={{fontSize:10,color:DIM}}>{signal.obvTrend==='up'?'Compradores absorbiendo oferta':'Vendedores liquidando posiciones'}</div>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Fila 3: ATR + Correlación BTC (nuevos) */}
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:12}}>

              {/* ATR — Stop Loss / Take Profit */}
              {signal.atr&&(
                <Card>
                  <CT>ATR (14) — VOLATILIDAD + STOP/TARGET</CT>
                  <div style={{fontSize:10,color:DIM,marginBottom:12,lineHeight:1.7}}>
                    Niveles calculados sobre la volatilidad real del activo (no fijos). Referencia — no son órdenes.
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                    {[
                      ['VOLATILIDAD',signal.atr.volatility.toUpperCase(),signal.atr.volColor],
                      ['ATR 14d',`${signal.atr.atrPct?.toFixed(2)}%`,WHITE],
                      ['STOP LOSS',`$${signal.atr.stopLoss?.toLocaleString('en-US',{maximumFractionDigits:4})}`,RED],
                      ['TAKE PROFIT',`$${signal.atr.takeProfit?.toLocaleString('en-US',{maximumFractionDigits:4})}`,GREEN],
                    ].map(([l,v,c])=>(
                      <div key={l} style={{padding:'10px 12px',background:'rgba(255,255,255,.02)',borderRadius:7,border:'1px solid rgba(255,140,0,.1)'}}>
                        <div style={{fontSize:9,color:DIM,marginBottom:4,letterSpacing:'.1em'}}>{l}</div>
                        <div style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:10,color:DIM}}>
                    Stop: precio − ATR×1.5 · Target: precio + ATR×2.5 · Risk/Reward: 1:{signal.atr.riskReward}
                  </div>
                </Card>
              )}

              {/* Correlación BTC */}
              {signal.btcCorrelation&&(
                <Card>
                  <CT>CORRELACIÓN CON BTC (30 días)</CT>
                  <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:12}}>
                    <svg width={80} height={80}>
                      <circle cx={40} cy={40} r={32} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={8}/>
                      <circle cx={40} cy={40} r={32} fill="none" stroke={signal.btcCorrelation.color}
                        strokeWidth={8} strokeLinecap="round"
                        strokeDasharray={`${Math.abs(signal.btcCorrelation.value)*200} 201`}
                        transform="rotate(-90 40 40)"/>
                      <text x={40} y={45} textAnchor="middle" fill={WHITE} fontSize={15} fontWeight={700} fontFamily="IBM Plex Mono">
                        {signal.btcCorrelation.value?.toFixed(2)}
                      </text>
                    </svg>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:signal.btcCorrelation.color,marginBottom:6}}>{signal.btcCorrelation.label}</div>
                      <div style={{fontSize:11,color:DIM,lineHeight:1.6}}>{signal.btcCorrelation.note}</div>
                    </div>
                  </div>
                  <div style={{fontSize:10,color:DIM,padding:'7px 9px',background:'rgba(255,255,255,.02)',borderRadius:5,lineHeight:1.6}}>
                    Rango: -1.0 (inverso) → 0 (independiente) → 1.0 (idéntico a BTC)<br/>
                    Alta correlación → señales técnicas menos independientes del mercado general.
                  </div>
                </Card>
              )}
            </div>

            {/* Tabla completa de señales */}
            <Card>
              <CT>DETALLE DE LAS {signal.signals.length} SEÑALES</CT>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:isMobile?0:480}}>
                  <thead><tr>
                    {['INDICADOR','VALOR','INTERPRETACIÓN','TIPO'].map((h,i)=>(
                      <th key={i} style={{fontSize:10,color:'rgba(255,140,0,.48)',fontWeight:700,fontFamily:'inherit',paddingBottom:9,borderBottom:'1px solid rgba(255,140,0,.09)',textAlign:i>2?'center':'left',paddingRight:i<3?12:0,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {signal.signals.map((s,i)=>(
                      <tr key={i}>
                        <td style={{fontSize:11,padding:'7px 0',borderBottom:'1px solid rgba(255,140,0,.05)',color:G,fontWeight:700,paddingRight:12,whiteSpace:'nowrap'}}>{s.ind}</td>
                        <td style={{fontSize:11,padding:'7px 0',borderBottom:'1px solid rgba(255,140,0,.05)',color:WHITE,paddingRight:12,whiteSpace:'nowrap'}}>{s.val}</td>
                        <td style={{fontSize:isMobile?10:11,padding:'7px 0',borderBottom:'1px solid rgba(255,140,0,.05)',color:DIM,lineHeight:1.4}}>{s.msg}</td>
                        <td style={{padding:'7px 0',borderBottom:'1px solid rgba(255,140,0,.05)',textAlign:'center',width:68}}>
                          <span style={{fontSize:10,fontWeight:700,color:s.type==='buy'?GREEN:s.type==='sell'?RED:DIM,border:`1px solid ${s.type==='buy'?'rgba(0,210,106,.25)':s.type==='sell'?'rgba(255,77,77,.25)':'rgba(255,255,255,.08)'}`,padding:'2px 6px',borderRadius:3,whiteSpace:'nowrap'}}>
                            {s.type==='buy'?'COMPRA':s.type==='sell'?'VENTA':'NEUTRAL'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── Backtesting ── */}
            {signal.rawPrices&&(()=>{
              const bt = runBacktest(signal.rawPrices, btPeriod) || backtest
              const pfColor=bt.profitFactor>=1.5?GREEN:bt.profitFactor>=1?GOLD:RED
              const wrColor=bt.winRate>=55?GREEN:bt.winRate>=45?GOLD:RED
              return (
                <Card>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
                    <CT mb={0}>BACKTESTING — ESTRATEGIA EMA20/50 + RSI</CT>
                    <div style={{display:'flex',gap:5}}>
                      {['7d','30d','90d'].map(p=>(
                        <button key={p} onClick={()=>setBtPeriod(p)} style={{padding:'4px 10px',fontSize:10,fontFamily:'inherit',background:btPeriod===p?'rgba(255,140,0,.15)':"transparent",color:btPeriod===p?G:DIM,border:`1px solid ${btPeriod===p?'rgba(255,140,0,.4)':"rgba(255,255,255,.08)"}`,borderRadius:4,cursor:'pointer'}}>{p.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{fontSize:10,color:DIM,marginBottom:12,lineHeight:1.7}}>
                    Simula entradas por cruce EMA20/EMA50 con RSI como filtro sobre datos históricos reales de esta moneda. No predice el futuro.
                  </div>
                  {bt.total===0?<div style={{textAlign:'center',padding:'16px 0',color:DIM,fontSize:12}}>Sin operaciones — mercado sin tendencia clara en este período</div>:(
                    <>
                      <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(3,1fr)',gap:10,marginBottom:14}}>
                        {[
                          ['WIN RATE',`${bt.winRate}%`,wrColor,'% de trades ganadores'],
                          ['RETORNO TOTAL',`${bt.totalReturn>0?'+':''}${bt.totalReturn}%`,bt.totalReturn>0?GREEN:RED,'Suma acumulada'],
                          ['PROFIT FACTOR',`${bt.profitFactor}x`,pfColor,'Win avg / Loss avg'],
                          ['MAX DRAWDOWN',`-${bt.maxDrawdown}%`,RED,'Peor racha'],
                          ['AVG WIN',`+${bt.avgWin}%`,GREEN,'Ganancia media'],
                          ['AVG LOSS',`-${bt.avgLoss}%`,RED,'Pérdida media'],
                        ].map(([l,v,c,s])=>(
                          <div key={l} style={{padding:'9px 11px',background:'rgba(255,255,255,.02)',borderRadius:7,border:'1px solid rgba(255,140,0,.09)'}}>
                            <div style={{fontSize:9,color:DIM,marginBottom:3,letterSpacing:'.08em'}}>{l}</div>
                            <div style={{fontSize:15,fontWeight:700,color:c}}>{v}</div>
                            <div style={{fontSize:9,color:'rgba(255,255,255,.2)',marginTop:2}}>{s}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:10,color:DIM,marginBottom:8,letterSpacing:'.1em'}}>ÚLTIMAS {Math.min(bt.trades.length,10)} OPERACIONES</div>
                      <div style={{display:'flex',flexDirection:'column',gap:4}}>
                        {bt.trades.slice(-10).reverse().map((t,i)=>(
                          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 9px',background:t.won?'rgba(0,210,106,.04)':'rgba(255,77,77,.04)',borderRadius:5,border:`1px solid ${t.won?'rgba(0,210,106,.15)':'rgba(255,77,77,.15)'}`}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <span style={{fontSize:10,fontWeight:700,color:t.type==='long'?GREEN:RED,border:`1px solid ${t.type==='long'?'rgba(0,210,106,.3)':'rgba(255,77,77,.3)'}`,padding:'1px 6px',borderRadius:3}}>{t.type==='long'?'LONG':'SHORT'}</span>
                              <span style={{fontSize:10,color:DIM}}>E: ${"{"}t.entry?.toLocaleString('en-US',{maximumFractionDigits:4}){"}"} → S: ${"{"}t.exit?.toLocaleString('en-US',{maximumFractionDigits:4}){"}"}</span>
                            </div>
                            <span style={{fontSize:12,fontWeight:700,color:t.won?GREEN:RED}}>{"{"}t.pnl>0?'+':''}{"{"}{"{"}t.pnl?.toFixed(2){"}"}%</span>
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:10,color:'rgba(255,255,255,.15)',marginTop:10}}>⚠ Datos pasados no garantizan rendimiento futuro. Sin comisiones ni slippage.</div>
                    </>
                  )}
                </Card>
              )
            })()}

          </>
        )
      })()}
    </div>
  )
}

// ── Overview, Prices, Watchlist, Wallet, App ─────────────────
function MoverRow({p,watched,onToggle,onChart,isMobile}) {
  const chg=p.price_change_percentage_24h
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(255,140,0,.05)',cursor:'pointer'}} onClick={()=>onChart(p)}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <img src={p.image} alt="" style={{width:21,height:21,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:WHITE}}>{p.symbol?.toUpperCase()}</div>
          {!isMobile&&<div style={{fontSize:10,color:DIM}}>${(p.current_price??0).toLocaleString('en-US',{maximumFractionDigits:4})}</div>}
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:13,fontWeight:700,color:pc(chg)}}>{pct(chg)}</span>
        <button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:watched?G:'rgba(255,255,255,.13)',padding:0}}>{watched?'★':'☆'}</button>
      </div>
    </div>
  )
}

function OverviewTab({prices,stats,fearGreed,wsStatus,watchlist,onToggle,onChart,isMobile}) {
  const sorted=prices.filter(p=>p.price_change_percentage_24h!=null).sort((a,b)=>b.price_change_percentage_24h-a.price_change_percentage_24h)
  const gainers=sorted.slice(0,6), losers=sorted.slice(-6).reverse()
  const wlCoins=prices.filter(p=>watchlist.includes(p.id)).sort((a,b)=>Math.abs(b.price_change_percentage_24h??0)-Math.abs(a.price_change_percentage_24h??0)).slice(0,6)
  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:10,marginBottom:12}}>
        <Card accent>
          <div style={{fontSize:9,letterSpacing:'.15em',color:'rgba(255,140,0,.5)',marginBottom:5}}>MARKET CAP GLOBAL</div>
          <div style={{fontSize:isMobile?22:28,fontWeight:700,color:G,lineHeight:1,marginBottom:4}}>{fmt(stats?.total_market_cap?.usd)}</div>
          <div style={{fontSize:11,color:DIM}}>BTC {stats?.market_cap_percentage?.btc?.toFixed(1)||'—'}% · ETH {stats?.market_cap_percentage?.eth?.toFixed(1)||'—'}%</div>
        </Card>
        <Card>
          <div style={{fontSize:9,letterSpacing:'.15em',color:'rgba(255,140,0,.5)',marginBottom:5}}>VOLUMEN 24H</div>
          <div style={{fontSize:isMobile?22:28,fontWeight:700,color:G,lineHeight:1,marginBottom:4}}>{fmt(stats?.total_volume?.usd)}</div>
          <div style={{fontSize:11,color:DIM}}>Global · todas las exchanges</div>
        </Card>
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'2fr 1fr',gap:12,marginBottom:12}}>
        <FearGreedGauge data={fearGreed}/>
        <Card style={{display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
          <CT>ESTADO</CT>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div><div style={{fontSize:9,color:DIM,marginBottom:3,letterSpacing:'.1em'}}>FEED EN VIVO</div><WsInd status={wsStatus}/></div>
            <div><div style={{fontSize:9,color:DIM,marginBottom:3,letterSpacing:'.1em'}}>WATCHLIST</div><div style={{fontSize:22,fontWeight:700,color:G}}>{watchlist.length} <span style={{fontSize:12,color:DIM,fontWeight:400}}>monedas</span></div></div>
            <div><div style={{fontSize:9,color:DIM,marginBottom:3,letterSpacing:'.1em'}}>DOM. BTC</div><div style={{fontSize:18,fontWeight:700,color:WHITE}}>{stats?.market_cap_percentage?.btc?.toFixed(1)||'—'}%</div></div>
          </div>
        </Card>
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:12}}>
        <Card><CT>🟢 TOP GAINERS 24H</CT>{gainers.map((p,i)=><MoverRow key={i} p={p} watched={watchlist.includes(p.id)} onToggle={onToggle} onChart={onChart} isMobile={isMobile}/>)}</Card>
        <Card><CT>🔴 TOP LOSERS 24H</CT>{losers.map((p,i)=><MoverRow key={i} p={p} watched={watchlist.includes(p.id)} onToggle={onToggle} onChart={onChart} isMobile={isMobile}/>)}</Card>
        <Card><CT>★ WATCHLIST MOVERS</CT>{wlCoins.length===0?<div style={{textAlign:'center',padding:'20px 0',color:DIM,fontSize:12}}><div style={{fontSize:26,marginBottom:8}}>☆</div>Añade monedas en Precios</div>:wlCoins.map((p,i)=><MoverRow key={i} p={p} watched={true} onToggle={onToggle} onChart={onChart} isMobile={isMobile}/>)}</Card>
      </div>
    </>
  )
}

function PricesTab({prices,loading,wsStatus,watchlist,onToggle,onChart,isMobile}) {
  const [search,setSearch]=useState(''),[page,setPage]=useState(1)
  const PER=isMobile?30:50
  const {results,searching}=useGlobalSearch(search,prices)
  const list=search?results:prices, total=Math.ceil(list.length/PER), visible=list.slice((page-1)*PER,page*PER)
  useEffect(()=>{setPage(1)},[search])
  const thS={fontSize:10,letterSpacing:'.1em',color:'rgba(255,140,0,.48)',fontWeight:700,fontFamily:'inherit',paddingBottom:9,borderBottom:'1px solid rgba(255,140,0,.09)'}
  return (
    <Card>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:isMobile?'flex-start':'center',flexDirection:isMobile?'column':'row',gap:8,marginBottom:12}}>
        <CT mb={0}>TOP 100 · BÚSQUEDA GLOBAL EN LUPA</CT><WsInd status={wsStatus} short={isMobile}/>
      </div>
      <div style={{marginBottom:10}}><SearchBox value={search} onChange={setSearch} busy={searching} placeholder="Buscar cualquier moneda…"/></div>
      {search&&<div style={{fontSize:11,color:DIM,marginBottom:9}}>{searching?'Buscando…':`${results.length} resultado${results.length!==1?'s':''}`}</div>}
      {loading?<div style={{textAlign:'center',padding:44,color:DIM}}>Cargando top 100…</div>:visible.length===0&&!searching?<div style={{textAlign:'center',padding:36,color:DIM}}>Sin resultados</div>:isMobile?(
        visible.map((p,i)=>{const chg=p.price_change_percentage_24h,w=watchlist.includes(p.id);return(
          <div key={p.id} style={{display:'flex',alignItems:'center',gap:9,padding:'10px 0',borderBottom:'1px solid rgba(255,140,0,.055)',cursor:'pointer'}} onClick={()=>onChart(p)}>
            <span style={{fontSize:11,color:DIM,minWidth:22}}>{search?(i+1):((page-1)*PER+i+1)}</span>
            <img src={p.image} alt="" style={{width:26,height:26,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>
            <div style={{flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:700,fontSize:13}}>{p.symbol?.toUpperCase()}</span><span style={{fontWeight:700,fontSize:13}}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}><span style={{fontSize:10,color:DIM}}>{p.name}</span><span style={{fontSize:12,fontWeight:700,color:pc(chg)}}>{pct(chg)}</span></div>
            </div>
            <button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:w?G:'rgba(255,255,255,.13)'}}>{w?'★':'☆'}</button>
          </div>
        )})
      ):(
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>{['#','TOKEN','PRECIO','24H','MARKET CAP','VOL 24H','★'].map((h,i)=><th key={i} style={{...thS,textAlign:i>1?'right':'left'}}>{h}</th>)}</tr></thead>
          <tbody>{visible.map((p,i)=>{const chg=p.price_change_percentage_24h,w=watchlist.includes(p.id);return(
            <tr key={p.id} style={{cursor:'pointer'}} onClick={()=>onChart(p)}>
              <td style={{fontSize:11,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,.055)',color:DIM,width:28}}>{search?(i+1):((page-1)*PER+i+1)}</td>
              <td style={{padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,.055)'}}><div style={{display:'flex',alignItems:'center',gap:8}}><img src={p.image} alt="" style={{width:22,height:22,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/><div><div style={{fontWeight:700,fontSize:13,color:WHITE}}>{p.symbol?.toUpperCase()}</div><div style={{fontSize:10,color:DIM}}>{p.name}</div></div></div></td>
              <td style={{fontSize:13,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,.055)',textAlign:'right',fontWeight:700,color:WHITE}}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}</td>
              <td style={{fontSize:13,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,.055)',textAlign:'right',fontWeight:700,color:pc(chg)}}>{pct(chg)}</td>
              <td style={{fontSize:11,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,.055)',textAlign:'right',color:DIM}}>{fmt(p.market_cap)}</td>
              <td style={{fontSize:11,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,.055)',textAlign:'right',color:DIM}}>{fmt(p.total_volume)}</td>
              <td style={{padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,.055)',textAlign:'center',width:38}}><button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:19,color:w?G:'rgba(255,255,255,.13)'}}>{w?'★':'☆'}</button></td>
            </tr>
          )}}</tbody>
        </table>
      )}
      {!search&&total>1&&<div style={{display:'flex',justifyContent:'center',gap:5,marginTop:14,flexWrap:'wrap'}}>
        <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:'5px 11px',background:'rgba(255,140,0,.07)',border:'1px solid rgba(255,140,0,.18)',borderRadius:5,color:page===1?DIM:G,cursor:page===1?'default':'pointer',fontFamily:'inherit',fontSize:11}}>←</button>
        {Array.from({length:total},(_,i)=>i+1).map(n=><button key={n} onClick={()=>setPage(n)} style={{padding:'5px 9px',background:n===page?'rgba(255,140,0,.18)':'transparent',border:`1px solid ${n===page?'rgba(255,140,0,.45)':'rgba(255,140,0,.1)'}`,borderRadius:5,color:n===page?G:DIM,cursor:'pointer',fontFamily:'inherit',fontSize:11}}>{n}</button>)}
        <button onClick={()=>setPage(p=>Math.min(total,p+1))} disabled={page===total} style={{padding:'5px 11px',background:'rgba(255,140,0,.07)',border:'1px solid rgba(255,140,0,.18)',borderRadius:5,color:page===total?DIM:G,cursor:page===total?'default':'pointer',fontFamily:'inherit',fontSize:11}}>→</button>
      </div>}
    </Card>
  )
}

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
        <Card accent><CT mb={5}>SEGUIDAS</CT><div style={{fontSize:24,fontWeight:700,color:G}}>{watched.length}</div></Card>
        <Card><CT mb={5}>PROMEDIO 24H</CT><div style={{fontSize:22,fontWeight:700,color:pc(avgChg)}}>{watched.length?pct(avgChg):'—'}</div></Card>
        <Card><CT mb={5}>FEED</CT><div style={{marginTop:4}}><WsInd status={wsStatus} short={isMobile}/></div></Card>
      </div>
      <Card>
        <CT>AÑADIR MONEDA</CT>
        <div style={{position:'relative'}}>
          <SearchBox value={addQ} onChange={setAddQ} busy={searching} placeholder="Buscar cualquier moneda…"/>
          {dd.length>0&&<div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:30,background:'#181818',border:'1px solid rgba(255,140,0,.2)',borderRadius:8,marginTop:4,boxShadow:'0 8px 28px rgba(0,0,0,.6)',overflow:'hidden'}}>
            {dd.map(p=>(
              <button key={p.id} onClick={()=>{onToggle(p.id,p);setAddQ('')}} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 13px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,140,0,.06)',cursor:'pointer',color:WHITE,fontFamily:'inherit'}}
                onMouseOver={e=>e.currentTarget.style.background='rgba(255,140,0,.06)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                <div style={{display:'flex',alignItems:'center',gap:9}}><img src={p.image} alt="" style={{width:20,height:20,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/><span style={{fontWeight:700,fontSize:13}}>{p.symbol?.toUpperCase()}</span><span style={{fontSize:11,color:DIM}}>{p.name}</span></div>
                <div style={{display:'flex',alignItems:'center',gap:7}}><span style={{fontSize:12,color:pc(p.price_change_percentage_24h)}}>{pct(p.price_change_percentage_24h)}</span><span style={{fontSize:11,color:G,fontWeight:700}}>+ ADD</span></div>
              </button>
            ))}
            {searching&&<div style={{padding:'9px 13px',fontSize:11,color:DIM}}>Buscando…</div>}
          </div>}
        </div>
      </Card>
      {watched.length===0?<Card><div style={{textAlign:'center',padding:isMobile?28:44,color:DIM}}><div style={{fontSize:40,marginBottom:12}}>☆</div><div style={{fontSize:14,color:WHITE}}>Watchlist vacía</div></div></Card>:(
        <>
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)',gap:10}}>
            {watched.map(p=>{const chg=p.price_change_percentage_24h??0;return(
              <div key={p.id} style={{background:'rgba(255,255,255,.02)',border:`1px solid ${chg>=0?'rgba(0,210,106,.17)':'rgba(255,77,77,.17)'}`,borderRadius:8,padding:13,position:'relative',cursor:'pointer'}} onClick={()=>onChart(p)}>
                <button onClick={e=>{e.stopPropagation();onToggle(p.id,p)}} style={{position:'absolute',top:8,right:9,background:'none',border:'none',cursor:'pointer',fontSize:16,color:G}}>★</button>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:9}}><img src={p.image} alt="" style={{width:24,height:24,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/><div><div style={{fontWeight:700,fontSize:13,color:WHITE}}>{p.symbol?.toUpperCase()}</div><div style={{fontSize:10,color:DIM}}>{p.name}</div></div></div>
                <div style={{fontSize:isMobile?15:18,fontWeight:700,color:WHITE,marginBottom:3}}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</div>
                <div style={{fontSize:13,fontWeight:700,color:pc(chg)}}>{pct(chg)}</div>
              </div>
            )})}
          </div>
          <button onClick={onClear} style={{padding:'10px',background:'rgba(255,77,77,.07)',border:'1px solid rgba(255,77,77,.2)',borderRadius:8,color:RED,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700}}>✕ LIMPIAR WATCHLIST</button>
        </>
      )}
    </div>
  )
}

function WalletTab({isMobile}) {
  const [input,setInput]=useState(''),[addr,setAddr]=useState(''),[sub,setSub]=useState('positions')
  const ok=hasZerionKey()
  const {portfolio,positions,transactions,loading,error,refresh}=useWallet(addr)
  const totalValue=(portfolio?.totalValue&&portfolio.totalValue>0)?portfolio.totalValue:positions.reduce((s,p)=>s+(p.value||0),0)
  const byChain=positions.reduce((acc,p)=>{const c=p.chain||'ethereum';if(!acc[c])acc[c]=[];acc[c].push(p);return acc},{})
  const chains=Object.keys(byChain).sort((a,b)=>byChain[b].reduce((s,p)=>s+p.value,0)-byChain[a].reduce((s,p)=>s+p.value,0))
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {ok?<div style={{padding:10,background:'rgba(0,210,106,.05)',border:'1px solid rgba(0,210,106,.2)',borderRadius:8,display:'flex',alignItems:'center',gap:8}}><Dot color={GREEN}/><span style={{fontSize:12,color:GREEN,fontWeight:700}}>ZERION CONECTADO ✓ · proxy server-side activo</span></div>
        :<div style={{padding:15,background:'rgba(255,204,0,.055)',border:'1px solid rgba(255,204,0,.22)',borderRadius:8}}>
          <div style={{fontSize:13,color:GOLD,fontWeight:700,marginBottom:9}}>⚠ ZERION API KEY — gratis 2000 calls/día</div>
          <div style={{fontSize:12,color:DIM,lineHeight:2}}>1. <span style={{color:G}}>zerion.io</span> → Developer → crea API key<br/>2. Vercel → Settings → Env Vars: <code style={{color:WHITE,fontSize:11}}>VITE_ZERION_API_KEY = tu_key</code><br/>3. Redeploy ✓</div>
        </div>}
      <Card>
        <CT>ANALIZAR WALLET · Zerion multichain</CT>
        <div style={{display:'flex',flexDirection:isMobile?'column':'row',gap:9}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setAddr(input.trim())} placeholder="0x… ETH, Polygon, BSC, Arbitrum, Base, Optimism…" style={{flex:1,background:'rgba(255,140,0,.04)',border:'1px solid rgba(255,140,0,.2)',borderRadius:7,padding:'11px 13px',color:WHITE,fontFamily:'inherit',fontSize:13,outline:'none'}}/>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setAddr(input.trim())} disabled={loading} style={{flex:isMobile?1:undefined,padding:'11px 18px',background:loading?'rgba(255,140,0,.04)':'rgba(255,140,0,.13)',border:'1px solid rgba(255,140,0,.35)',borderRadius:7,color:G,cursor:loading?'wait':'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700}}>{loading?'CARGANDO…':'ANALIZAR'}</button>
            {addr&&<button onClick={refresh} style={{padding:'11px 13px',background:'transparent',border:'1px solid rgba(255,140,0,.16)',borderRadius:7,color:'rgba(255,140,0,.5)',cursor:'pointer',fontFamily:'inherit',fontSize:15}}>↻</button>}
          </div>
        </div>
        {error&&<div style={{marginTop:9,fontSize:12,color:RED}}>Error: {error}</div>}
      </Card>
      {(portfolio||positions.length>0)&&<>
        <Card accent>
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:12}}>
            <div><CT mb={4}>WALLET</CT><div style={{fontSize:11,color:G}}>{addr.slice(0,8)}…{addr.slice(-6)}</div><div style={{fontSize:10,color:DIM,marginTop:3}}>{chains.length} red{chains.length!==1?'es':''}</div></div>
            <div><CT mb={4}>VALOR TOTAL</CT><div style={{fontSize:isMobile?20:24,color:G,fontWeight:700}}>{fmt(totalValue)}</div></div>
            <div><CT mb={4}>CAMBIO 24H</CT><div style={{fontSize:16,fontWeight:700,color:pc(portfolio?.pnl24h)}}>{portfolio?.pnl24h!=null?pct(portfolio.pnl24h):'—'}</div>{portfolio?.pnlAbs24h!=null&&<div style={{fontSize:11,color:pc(portfolio.pnlAbs24h)}}>{fmt(portfolio.pnlAbs24h)}</div>}</div>
            <div><CT mb={4}>REDES</CT><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{chains.map(c=><ChainBadge key={c} chain={c}/>)}</div></div>
          </div>
        </Card>
        {chains.length>1&&<Card><CT>DISTRIBUCIÓN POR RED</CT>
          {chains.map(c=>{const v=byChain[c].reduce((s,p)=>s+p.value,0),pp=totalValue>0?(v/totalValue)*100:0,color=CHAIN_COLORS[c?.toLowerCase()]||'rgba(255,255,255,.4)';return(
            <div key={c} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><div style={{display:'flex',alignItems:'center',gap:7}}><ChainBadge chain={c}/><span style={{fontSize:11,color:DIM}}>{byChain[c].length} tokens</span></div><div style={{display:'flex',gap:10}}><span style={{fontSize:11,fontWeight:700,color:WHITE}}>{fmt(v)}</span><span style={{fontSize:10,color:DIM}}>{pp.toFixed(1)}%</span></div></div>
              <div style={{height:4,background:'rgba(255,255,255,.06)',borderRadius:2,overflow:'hidden'}}><div style={{width:`${pp}%`,height:'100%',background:color,borderRadius:2}}/></div>
            </div>
          )})}
        </Card>}
        <div style={{display:'flex',gap:4}}>
          {[['positions',`POSICIONES (${positions.length})`],['transactions','TRANSACCIONES']].map(([id,l])=>(
            <button key={id} onClick={()=>setSub(id)} style={{padding:'7px 14px',fontSize:11,fontWeight:sub===id?700:400,fontFamily:'inherit',background:sub===id?'rgba(255,140,0,.11)':'transparent',color:sub===id?G:'rgba(255,140,0,.36)',border:`1px solid ${sub===id?'rgba(255,140,0,.35)':'rgba(255,140,0,.09)'}`,borderRadius:5,cursor:'pointer'}}>{l}</button>
          ))}
        </div>
        {sub==='positions'&&<Card><CT>TOKENS POR RED</CT>
          {chains.map(chainId=>(
            <div key={chainId} style={{marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:`1px solid ${CHAIN_COLORS[chainId?.toLowerCase()]||'rgba(255,255,255,.1)'}33`,marginBottom:6}}>
                <ChainBadge chain={chainId}/><span style={{fontSize:11,color:DIM}}>{byChain[chainId].length} tokens · {fmt(byChain[chainId].reduce((s,p)=>s+p.value,0))}</span>
              </div>
              {byChain[chainId].map((pos,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0 8px 8px',borderBottom:'1px solid rgba(255,255,255,.04)',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:9}}>
                    {pos.icon&&<img src={pos.icon} alt="" style={{width:26,height:26,borderRadius:'50%'}} onError={e=>e.target.style.display='none'}/>}
                    <div><div style={{fontWeight:700,fontSize:13,color:WHITE}}>{pos.symbol}</div><div style={{fontSize:10,color:DIM}}>{pos.qty.toFixed(pos.qty<0.001?6:4)} × ${pos.price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</div></div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,fontSize:13,color:G}}>{fmt(pos.value)}</div>
                    {pos.pct1d!=null&&<div style={{fontSize:11,fontWeight:700,color:pc(pos.pct1d)}}>{pct(pos.pct1d)}</div>}
                    {totalValue>0&&<div style={{fontSize:10,color:DIM}}>{((pos.value/totalValue)*100).toFixed(1)}%</div>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </Card>}
        {sub==='transactions'&&<Card><CT>HISTORIAL</CT>
          {transactions.length===0?<div style={{textAlign:'center',padding:28,color:DIM,fontSize:12}}>Sin historial</div>:
          transactions.slice(0,30).map((tx,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,.05)',gap:10}}>
              <div style={{display:'flex',alignItems:'center',gap:9}}>
                <span style={{fontSize:10,fontWeight:700,color:tx.status==='confirmed'?GREEN:GOLD,border:`1px solid ${tx.status==='confirmed'?'rgba(0,210,106,.3)':'rgba(255,204,0,.3)'}`,padding:'2px 7px',borderRadius:3}}>{tx.type.replace(/_/g,' ').toUpperCase()}</span>
                <div style={{display:'flex',alignItems:'center',gap:6}}>{tx.time&&<span style={{fontSize:10,color:DIM}}>{ago(tx.time)}</span>}<ChainBadge chain={tx.chain}/></div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:700,fontSize:13,color:tx.value>0?G:DIM}}>{tx.value>0?fmt(tx.value):'—'}</div>
                {tx.fee&&<div style={{fontSize:10,color:DIM}}>Fee: {fmt(tx.fee)}</div>}
              </div>
            </div>
          ))}
        </Card>}
      </>}
    </div>
  )
}

export default function App() {
  const [tab,setTab]=useState('overview')
  const [time,setTime]=useState(new Date())
  const [isMobile,setMobile]=useState(window.innerWidth<768)
  const [chartCoin,setChart]=useState(null)
  useEffect(()=>{const h=()=>setMobile(window.innerWidth<768);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h)},[])
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t)},[])
  const {prices,loading,wsStatus}=usePrices()
  const {stats}=useGlobalStats()
  const {fearGreed}=useFearGreed()
  const {watchlist,extraCoins,toggle,clear}=useWatchlist()
  const TABS=[{id:'overview',icon:'◈',label:'OVERVIEW'},{id:'prices',icon:'◉',label:'PRECIOS'},{id:'watchlist',icon:'★',label:`WATCHLIST${watchlist.length>0?` (${watchlist.length})`:''}`},{id:'analysis',icon:'📊',label:'ANÁLISIS'},{id:'wallet',icon:'◎',label:'WALLET'}]
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html,body{background:${BG};overflow-x:hidden}@keyframes ping{75%,100%{transform:scale(2);opacity:0}}tr:hover td{background:rgba(255,140,0,.018)}input::placeholder{color:rgba(255,255,255,.19)}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:${BG}}::-webkit-scrollbar-thumb{background:rgba(255,140,0,.2);border-radius:4px}button{touch-action:manipulation}`}</style>
      <div style={{minHeight:'100vh',background:BG,fontFamily:"'IBM Plex Mono',monospace",color:WHITE}}>
        <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',backgroundImage:`linear-gradient(rgba(255,140,0,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,140,0,.015) 1px,transparent 1px)`,backgroundSize:'40px 40px'}}/>
        <div style={{position:'relative',zIndex:1,maxWidth:1300,margin:'0 auto',padding:isMobile?'0 12px 80px':'0 24px 56px'}}>
          <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:isMobile?'12px 0 14px':'18px 0 22px',borderBottom:'1px solid rgba(255,140,0,.13)',marginBottom:isMobile?12:18}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:isMobile?32:37,height:isMobile?32:37,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:isMobile?16:19,fontWeight:900,color:BG,background:`linear-gradient(135deg,${G},#E67A00)`}}>₿</div>
              <div><div style={{fontSize:isMobile?13:15,fontWeight:700,letterSpacing:'.14em',color:G}}>DEFI PULSE</div><div style={{fontSize:9,color:'rgba(255,140,0,.38)',letterSpacing:'.1em'}}>v10.0 · CEREBRO DeFi</div></div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:isMobile?9:16}}>
              <WsInd status={wsStatus} short={isMobile}/>
              {!isMobile&&<div style={{fontSize:11,color:'rgba(255,140,0,.5)'}}>{time.toLocaleTimeString('es-CO')}</div>}
            </div>
          </header>
          {!isMobile&&<div style={{display:'flex',gap:5,marginBottom:18,overflowX:'auto'}}>{TABS.map(t=>{const a=tab===t.id;return<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'8px 17px',fontSize:11,letterSpacing:'.09em',fontWeight:a?700:400,fontFamily:'inherit',background:a?'rgba(255,140,0,.13)':'transparent',color:a?G:'rgba(255,140,0,.36)',border:`1px solid ${a?'rgba(255,140,0,.4)':'rgba(255,140,0,.09)'}`,borderRadius:5,cursor:'pointer',whiteSpace:'nowrap'}}>{t.label}</button>})}</div>}
          {tab==='overview' &&<OverviewTab  prices={prices} stats={stats} fearGreed={fearGreed} wsStatus={wsStatus} watchlist={watchlist} onToggle={toggle} onChart={setChart} isMobile={isMobile}/>}
          {tab==='prices'   &&<PricesTab    prices={prices} loading={loading} wsStatus={wsStatus} watchlist={watchlist} onToggle={toggle} onChart={setChart} isMobile={isMobile}/>}
          {tab==='watchlist'&&<WatchlistTab prices={prices} watchlist={watchlist} extraCoins={extraCoins} onToggle={toggle} onClear={clear} onChart={setChart} wsStatus={wsStatus} isMobile={isMobile}/>}
          {tab==='analysis' &&<AnalysisTab  prices={prices} watchlist={watchlist} isMobile={isMobile}/>}
          {tab==='wallet'   &&<WalletTab    isMobile={isMobile}/>}
        </div>
        {isMobile&&<nav style={{position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:'rgba(13,13,13,.97)',backdropFilter:'blur(12px)',borderTop:'1px solid rgba(255,140,0,.12)',display:'flex',padding:'7px 0 max(7px,env(safe-area-inset-bottom))'}}>
          {TABS.map(t=>{const a=tab===t.id;return<button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'none',border:'none',cursor:'pointer',padding:'5px 0',color:a?G:'rgba(255,140,0,.3)',fontFamily:'inherit'}}>
            <span style={{fontSize:t.icon==='📊'?15:19}}>{t.icon}</span>
            <span style={{fontSize:9,fontWeight:a?700:400}}>{t.id==='watchlist'&&watchlist.length>0?`★(${watchlist.length})`:t.label.split('(')[0].trim().substring(0,6)}</span>
          </button>})}
        </nav>}
      </div>
      {chartCoin&&<CandlestickChart coin={chartCoin} onClose={()=>setChart(null)} isMobile={isMobile}/>}
    </>
  )
}

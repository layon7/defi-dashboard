import { useState, useEffect } from 'react'
import { usePrices, useGlobalStats, useEthHistory, useWatchlist, useWallet, useGlobalSearch } from './hooks/useDefiData.js'
import { hasZerionKey } from './services/api.js'

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n/1e6).toFixed(2)}M`
  if (n >= 1e3)  return `$${(n/1e3).toFixed(1)}K`
  return `$${Number(n).toFixed(2)}`
}
function pct(n, withColor = false) {
  if (n == null) return '—'
  const up  = n >= 0
  const str = `${up ? '▲' : '▼'} ${Math.abs(n).toFixed(2)}%`
  return str
}
function pctColor(n) { return n == null ? DIM : n >= 0 ? GREEN : RED }
function timeAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (d < 1) return 'ahora'; if (d < 60) return `${d}m`
  if (d < 1440) return `${Math.floor(d/60)}h`; return `${Math.floor(d/1440)}d`
}
function shortAddr(a) { return a ? `${a.slice(0,6)}…${a.slice(-4)}` : '' }

const G     = '#FF8C00'   // naranja
const GREEN = '#00D26A'   // verde subidas ← NUEVO
const RED   = '#FF4D4D'   // rojo bajadas
const GOLD  = '#FFCC00'
const DIM   = 'rgba(255,255,255,0.55)'
const WHITE = '#FFFFFF'
const BG    = '#0D0D0D'

// ── Base components ───────────────────────────────────────────
function Dot({ color=G, size=9 }) {
  return (
    <span style={{ position:'relative', display:'inline-flex', width:size, height:size }}>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:color, opacity:0.4, animation:'ping 1.5s ease infinite' }}/>
      <span style={{ borderRadius:'50%', width:size, height:size, background:color, display:'block' }}/>
    </span>
  )
}
function Card({ children, accent, style={} }) {
  return <div style={{ background:accent?'rgba(255,140,0,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${accent?'rgba(255,140,0,0.4)':'rgba(255,140,0,0.13)'}`, borderRadius:10, padding:16, ...style }}>{children}</div>
}
function CT({ children, mb=14 }) {
  return <div style={{ fontSize:10, letterSpacing:'0.18em', color:'rgba(255,140,0,0.65)', marginBottom:mb, fontWeight:700 }}>{children}</div>
}
function Badge({ label, color=G }) {
  return <span style={{ fontSize:10, fontWeight:700, color, border:`1px solid ${color}33`, background:`${color}12`, padding:'2px 7px', borderRadius:4 }}>{label}</span>
}
function WsIndicator({ status, short=false }) {
  const c = status==='live'?GREEN : status==='error'?RED : GOLD
  const l = status==='live'?(short?'LIVE':'LIVE · BINANCE') : status==='error'?(short?'ERR':'WS ERROR') : (short?'…':'CONECTANDO…')
  return <div style={{ display:'flex', alignItems:'center', gap:6 }}><Dot color={c} size={8}/><span style={{ fontSize:10, color:c, fontWeight:700 }}>{l}</span></div>
}
function SearchBox({ value, onChange, placeholder, busy }) {
  return (
    <div style={{ position:'relative' }}>
      <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'rgba(255,140,0,0.4)', pointerEvents:'none' }}>{busy?'⟳':'⌕'}</span>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||'Buscar…'}
        style={{ width:'100%', background:'rgba(255,140,0,0.05)', border:'1px solid rgba(255,140,0,0.2)', borderRadius:7, padding:'11px 34px', color:WHITE, fontFamily:'inherit', fontSize:13, outline:'none' }}/>
      {value && <button onClick={()=>onChange('')} style={{ position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:DIM, fontSize:18 }}>×</button>}
    </div>
  )
}
function SparkBar({ data }) {
  if (!data.length) return <div style={{ height:52, display:'flex', alignItems:'center', justifyContent:'center', color:DIM, fontSize:12 }}>…</div>
  const mx=Math.max(...data.map(d=>d.value)), mn=Math.min(...data.map(d=>d.value))
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:52 }}>
      {data.map((d,i)=>{
        const h=((d.value-mn)/(mx-mn||1))*42+8
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <div style={{ width:'100%', height:h, borderRadius:'3px 3px 0 0', background:i===data.length-1?`linear-gradient(180deg,${G},#E67A00)`:'rgba(255,140,0,0.2)', transition:'height .5s' }}/>
            <span style={{ fontSize:9, color:'rgba(255,140,0,0.4)' }}>{d.day}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Mover card (usado en varios sitios) ───────────────────────
function MoverRow({ p, watched, onToggle, isMobile }) {
  const chg = p.price_change_percentage_24h
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(255,140,0,0.06)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <img src={p.image} alt={p.symbol} style={{ width:22, height:22, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:WHITE }}>{p.symbol?.toUpperCase()}</div>
          {!isMobile && <div style={{ fontSize:10, color:DIM }}>${(p.current_price??0).toLocaleString('en-US',{maximumFractionDigits:4})}</div>}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:13, fontWeight:700, color:pctColor(chg) }}>{pct(chg)}</span>
        <button onClick={()=>onToggle(p.id,p)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:watched?G:'rgba(255,255,255,0.15)', padding:0 }}>
          {watched?'★':'☆'}
        </button>
      </div>
    </div>
  )
}

// ── OVERVIEW ──────────────────────────────────────────────────
function OverviewTab({ prices, stats, history, wsStatus, watchlist, onToggle, isMobile }) {
  const eth = prices.find(p=>p.id==='ethereum')

  const sorted   = [...prices].sort((a,b) => (b.price_change_percentage_24h??-999) - (a.price_change_percentage_24h??-999))
  const movers   = sorted.slice(0, 6)
  const losers   = sorted.slice(-6).reverse()
  const allCoins = prices  // watchlist movers usa estos
  const wlCoins  = prices.filter(p=>watchlist.includes(p.id))
    .sort((a,b)=>Math.abs(b.price_change_percentage_24h??0)-Math.abs(a.price_change_percentage_24h??0))
    .slice(0,6)

  const kpis = [
    { label:'MARKET CAP', value:fmt(stats?.total_market_cap?.usd), sub:stats?`BTC ${stats.market_cap_percentage?.btc?.toFixed(1)}%`:'…', accent:true },
    { label:'VOLUMEN 24H', value:fmt(stats?.total_volume?.usd), sub:'Global' },
    { label:'ETH', value:eth?`$${(eth.current_price??0).toLocaleString()}`:'…', sub:eth?pct(eth.price_change_percentage_24h):'…', subColor:eth?pctColor(eth.price_change_percentage_24h):DIM },
    { label:'RASTREADAS', value:prices.length||'…', sub:'Top 500 CoinGecko' },
  ]

  return (
    <>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        {kpis.map((k,i)=>(
          <Card key={i} accent={k.accent}>
            <div style={{ fontSize:9, letterSpacing:'0.15em', color:'rgba(255,140,0,0.55)', marginBottom:5 }}>{k.label}</div>
            <div style={{ fontSize:isMobile?17:21, fontWeight:700, color:G, lineHeight:1, marginBottom:4 }}>{k.value}</div>
            <div style={{ fontSize:11, color:k.subColor||DIM }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* ETH chart */}
      <Card style={{ marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <CT mb={0}>ETH · 7 DÍAS</CT>
          <WsIndicator status={wsStatus} short={isMobile}/>
        </div>
        <SparkBar data={history}/>
        {history.length>1&&(
          <div style={{ marginTop:10, display:'flex', gap:20 }}>
            {[['INICIO',`$${history[0]?.value.toFixed(0)}`],
              ['ACTUAL',`$${history[history.length-1]?.value.toFixed(0)}`],
              ['VAR.',pct(((history[history.length-1]?.value-history[0]?.value)/history[0]?.value)*100)]].map(([l,v],i)=>(
              <div key={i}>
                <div style={{ fontSize:9, color:'rgba(255,140,0,0.45)', marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:13, color:i===2?pctColor((history[history.length-1]?.value-history[0]?.value)/history[0]?.value*100):G, fontWeight:700 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 3 columnas: Movers | Losers | Watchlist movers */}
      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)', gap:12 }}>
        {/* TOP GAINERS */}
        <Card>
          <CT>🟢 TOP GAINERS 24H</CT>
          {movers.map((p,i)=>(
            <MoverRow key={i} p={p} watched={watchlist.includes(p.id)} onToggle={onToggle} isMobile={isMobile}/>
          ))}
        </Card>

        {/* TOP LOSERS */}
        <Card>
          <CT>🔴 TOP LOSERS 24H</CT>
          {losers.map((p,i)=>(
            <MoverRow key={i} p={p} watched={watchlist.includes(p.id)} onToggle={onToggle} isMobile={isMobile}/>
          ))}
        </Card>

        {/* WATCHLIST MOVERS */}
        <Card>
          <CT>★ WATCHLIST MOVERS</CT>
          {wlCoins.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:DIM, fontSize:12 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>☆</div>
              Añade monedas a tu watchlist<br/>para ver sus movimientos aquí
            </div>
          ) : (
            wlCoins.map((p,i)=>(
              <MoverRow key={i} p={p} watched={true} onToggle={onToggle} isMobile={isMobile}/>
            ))
          )}
        </Card>
      </div>
    </>
  )
}

// ── PRECIOS ───────────────────────────────────────────────────
function PricesTab({ prices, loading, lastUpdate, wsStatus, watchlist, onToggle, isMobile }) {
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const PER = isMobile ? 30 : 50

  const { results, searching } = useGlobalSearch(search, prices)
  const list       = search ? results : prices
  const totalPages = Math.ceil(list.length / PER)
  const visible    = list.slice((page-1)*PER, page*PER)

  useEffect(()=>{ setPage(1) }, [search])

  const thS = { fontSize:10, letterSpacing:'0.1em', color:'rgba(255,140,0,0.5)', fontWeight:700, fontFamily:'inherit', paddingBottom:9, borderBottom:'1px solid rgba(255,140,0,0.1)' }

  return (
    <Card>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:isMobile?'flex-start':'center', flexDirection:isMobile?'column':'row', gap:8, marginBottom:12 }}>
        <CT mb={0}>PRECIOS · TOP 500 + BÚSQUEDA GLOBAL</CT>
        <WsIndicator status={wsStatus} short={isMobile}/>
      </div>

      <div style={{ marginBottom:10 }}>
        <SearchBox value={search} onChange={setSearch} busy={searching}
          placeholder="Buscar cualquier moneda — L3, layer3, pepe… búsqueda global CoinGecko"/>
      </div>
      {search && (
        <div style={{ fontSize:11, color:DIM, marginBottom:10 }}>
          {searching ? '🔍 Buscando fuera del top 500…' : `${results.length} resultado${results.length!==1?'s':''} — incluye monedas de cualquier ranking`}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:44, color:DIM }}>Cargando top 500…</div>
      ) : visible.length===0 && !searching ? (
        <div style={{ textAlign:'center', padding:36, color:DIM }}>Sin resultados para "{search}"</div>
      ) : isMobile ? (
        visible.map((p,i)=>{
          const chg=p.price_change_percentage_24h, watched=watchlist.includes(p.id)
          return (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', borderBottom:'1px solid rgba(255,140,0,0.06)' }}>
              <span style={{ fontSize:11, color:DIM, minWidth:24 }}>{search?(i+1):((page-1)*PER+i+1)}</span>
              <img src={p.image} alt={p.symbol} style={{ width:26,height:26,borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>{p.symbol?.toUpperCase()}</span>
                  <span style={{ fontWeight:700, fontSize:13, fontVariantNumeric:'tabular-nums' }}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                  <span style={{ fontSize:10, color:DIM }}>{p.name}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:pctColor(chg) }}>{pct(chg)}</span>
                </div>
              </div>
              <button onClick={()=>onToggle(p.id,p)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:20,color:watched?G:'rgba(255,255,255,0.15)',padding:'0 2px' }}>{watched?'★':'☆'}</button>
            </div>
          )
        })
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['#','TOKEN','PRECIO','24H','MARKET CAP','VOL 24H','★'].map((h,i)=>(
              <th key={i} style={{ ...thS, textAlign:i>1?'right':'left' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {visible.map((p,i)=>{
              const chg=p.price_change_percentage_24h, watched=watchlist.includes(p.id)
              return (
                <tr key={p.id}>
                  <td style={{ fontSize:11,padding:'10px 0',borderBottom:'1px solid rgba(255,140,0,0.06)',color:DIM,width:30 }}>{search?(i+1):((page-1)*PER+i+1)}</td>
                  <td style={{ padding:'10px 0',borderBottom:'1px solid rgba(255,140,0,0.06)' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:9 }}>
                      <img src={p.image} alt={p.symbol} style={{ width:22,height:22,borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                      <div>
                        <div style={{ fontWeight:700,fontSize:13,color:WHITE }}>{p.symbol?.toUpperCase()}</div>
                        <div style={{ fontSize:10,color:DIM }}>{p.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize:13,padding:'10px 0',borderBottom:'1px solid rgba(255,140,0,0.06)',textAlign:'right',fontWeight:700,color:WHITE,fontVariantNumeric:'tabular-nums' }}>
                    ${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}
                  </td>
                  <td style={{ fontSize:13,padding:'10px 0',borderBottom:'1px solid rgba(255,140,0,0.06)',textAlign:'right',fontWeight:700,color:pctColor(chg) }}>{pct(chg)}</td>
                  <td style={{ fontSize:11,padding:'10px 0',borderBottom:'1px solid rgba(255,140,0,0.06)',textAlign:'right',color:DIM }}>{fmt(p.market_cap)}</td>
                  <td style={{ fontSize:11,padding:'10px 0',borderBottom:'1px solid rgba(255,140,0,0.06)',textAlign:'right',color:DIM }}>{fmt(p.total_volume)}</td>
                  <td style={{ padding:'10px 0',borderBottom:'1px solid rgba(255,140,0,0.06)',textAlign:'center',width:40 }}>
                    <button onClick={()=>onToggle(p.id,p)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:20,color:watched?G:'rgba(255,255,255,0.15)',transition:'all .15s' }}>{watched?'★':'☆'}</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {!search && totalPages>1 && (
        <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:16, flexWrap:'wrap' }}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:'5px 12px',background:'rgba(255,140,0,0.08)',border:'1px solid rgba(255,140,0,0.2)',borderRadius:5,color:page===1?DIM:G,cursor:page===1?'default':'pointer',fontFamily:'inherit',fontSize:11 }}>← ANT</button>
          {Array.from({length:totalPages},(_,i)=>i+1).map(n=>(
            <button key={n} onClick={()=>setPage(n)} style={{ padding:'5px 9px',background:n===page?'rgba(255,140,0,0.2)':'transparent',border:`1px solid ${n===page?'rgba(255,140,0,0.5)':'rgba(255,140,0,0.1)'}`,borderRadius:5,color:n===page?G:DIM,cursor:'pointer',fontFamily:'inherit',fontSize:11 }}>{n}</button>
          ))}
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding:'5px 12px',background:'rgba(255,140,0,0.08)',border:'1px solid rgba(255,140,0,0.2)',borderRadius:5,color:page===totalPages?DIM:G,cursor:page===totalPages?'default':'pointer',fontFamily:'inherit',fontSize:11 }}>SIG →</button>
        </div>
      )}
    </Card>
  )
}

// ── WATCHLIST ─────────────────────────────────────────────────
function WatchlistTab({ prices, watchlist, extraCoins, onToggle, onClear, wsStatus, isMobile }) {
  const [addSearch, setAddSearch] = useState('')
  const { results: suggestions, searching } = useGlobalSearch(addSearch, prices)
  const allCoins  = [...prices, ...extraCoins.filter(e=>!prices.find(p=>p.id===e.id))]
  const watched   = allCoins.filter(p=>watchlist.includes(p.id))
  const avgChg    = watched.length ? watched.reduce((s,p)=>s+(p.price_change_percentage_24h??0),0)/watched.length : 0
  const dropdown  = suggestions.filter(p=>!watchlist.includes(p.id)).slice(0,8)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        <Card accent>
          <div style={{ fontSize:9, color:'rgba(255,140,0,0.55)', marginBottom:5, letterSpacing:'0.15em' }}>SEGUIDAS</div>
          <div style={{ fontSize:26, fontWeight:700, color:G }}>{watched.length}</div>
        </Card>
        <Card>
          <div style={{ fontSize:9, color:'rgba(255,140,0,0.55)', marginBottom:5, letterSpacing:'0.15em' }}>PROMEDIO 24H</div>
          <div style={{ fontSize:26, fontWeight:700, color:pctColor(avgChg) }}>{watched.length?pct(avgChg):'—'}</div>
        </Card>
        <Card>
          <div style={{ fontSize:9, color:'rgba(255,140,0,0.55)', marginBottom:5, letterSpacing:'0.15em' }}>FEED</div>
          <div style={{ marginTop:4 }}><WsIndicator status={wsStatus} short={isMobile}/></div>
        </Card>
      </div>

      <Card>
        <CT>AÑADIR — búsqueda global (cualquier moneda)</CT>
        <div style={{ position:'relative' }}>
          <SearchBox value={addSearch} onChange={setAddSearch} busy={searching}
            placeholder="L3, layer3, pepe, shib… cualquier moneda de CoinGecko"/>
          {dropdown.length>0 && (
            <div style={{ position:'absolute',top:'100%',left:0,right:0,zIndex:30,background:'#181818',border:'1px solid rgba(255,140,0,0.22)',borderRadius:8,marginTop:4,boxShadow:'0 8px 32px rgba(0,0,0,0.6)',overflow:'hidden' }}>
              {dropdown.map(p=>(
                <button key={p.id} onClick={()=>{onToggle(p.id,p);setAddSearch('')}}
                  style={{ width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,140,0,0.06)',cursor:'pointer',color:WHITE,fontFamily:'inherit' }}
                  onMouseOver={e=>e.currentTarget.style.background='rgba(255,140,0,0.07)'}
                  onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                    <img src={p.image} alt={p.symbol} style={{ width:22,height:22,borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                    <span style={{ fontWeight:700,fontSize:13 }}>{p.symbol?.toUpperCase()}</span>
                    <span style={{ fontSize:11,color:DIM }}>{p.name}</span>
                    {p.market_cap_rank && <span style={{ fontSize:10,color:'rgba(255,140,0,0.45)' }}>#{p.market_cap_rank}</span>}
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <span style={{ fontSize:12,color:pctColor(p.price_change_percentage_24h) }}>{pct(p.price_change_percentage_24h)}</span>
                    <span style={{ fontSize:11,color:G,fontWeight:700 }}>★ ADD</span>
                  </div>
                </button>
              ))}
              {searching && <div style={{ padding:'10px 14px',fontSize:11,color:DIM }}>Buscando en CoinGecko completo…</div>}
            </div>
          )}
        </div>
        <div style={{ marginTop:8,fontSize:11,color:DIM }}>También puedes pulsar ★ en PRECIOS</div>
      </Card>

      {watched.length===0 ? (
        <Card>
          <div style={{ textAlign:'center',padding:isMobile?28:48,color:DIM }}>
            <div style={{ fontSize:44,marginBottom:12 }}>☆</div>
            <div style={{ fontSize:14,color:WHITE,marginBottom:8 }}>Watchlist vacía</div>
            <div style={{ fontSize:12,color:'rgba(255,255,255,0.3)',lineHeight:1.9 }}>Busca arriba o pulsa ★ en PRECIOS</div>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)', gap:10 }}>
            {watched.map(p=>{
              const chg=p.price_change_percentage_24h??0
              return (
                <div key={p.id} style={{ background:'rgba(255,255,255,0.02)',border:`1px solid ${chg>=0?'rgba(0,210,106,0.2)':'rgba(255,77,77,0.2)'}`,borderRadius:8,padding:14,position:'relative' }}>
                  <button onClick={()=>onToggle(p.id,p)} style={{ position:'absolute',top:8,right:10,background:'none',border:'none',cursor:'pointer',fontSize:17,color:G }}>★</button>
                  <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
                    <img src={p.image} alt={p.symbol} style={{ width:26,height:26,borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                    <div>
                      <div style={{ fontWeight:700,fontSize:13,color:WHITE }}>{p.symbol?.toUpperCase()}</div>
                      <div style={{ fontSize:10,color:DIM }}>{p.name}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:isMobile?15:19,fontWeight:700,color:WHITE,marginBottom:4,fontVariantNumeric:'tabular-nums' }}>
                    ${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}
                  </div>
                  <div style={{ fontSize:13,fontWeight:700,color:pctColor(chg) }}>{pct(chg)}</div>
                  <div style={{ marginTop:5,fontSize:10,color:DIM }}>Cap: {fmt(p.market_cap)}</div>
                </div>
              )
            })}
          </div>
          {isMobile && (
            <button onClick={onClear} style={{ width:'100%',padding:12,background:'rgba(255,77,77,0.08)',border:'1px solid rgba(255,77,77,0.22)',borderRadius:8,color:RED,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700 }}>✕ LIMPIAR WATCHLIST</button>
          )}
          {!isMobile && (
            <Card>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
                <CT mb={0}>DETALLE COMPLETO</CT>
                <button onClick={onClear} style={{ fontSize:11,padding:'4px 12px',background:'rgba(255,77,77,0.08)',border:'1px solid rgba(255,77,77,0.22)',borderRadius:5,color:RED,cursor:'pointer',fontFamily:'inherit' }}>✕ LIMPIAR</button>
              </div>
              <table style={{ width:'100%',borderCollapse:'collapse' }}>
                <thead><tr>{['TOKEN','PRECIO','24H','MARKET CAP','VOL 24H','QUITAR'].map((h,i)=><th key={i} style={{ fontSize:10,letterSpacing:'0.1em',color:'rgba(255,140,0,0.5)',fontWeight:700,fontFamily:'inherit',paddingBottom:9,borderBottom:'1px solid rgba(255,140,0,0.1)',textAlign:i>0?'right':'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {watched.map(p=>{
                    const chg=p.price_change_percentage_24h??0
                    const td=(right,color,bold)=>({ fontSize:12,padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.06)',textAlign:right?'right':'left',color:color||WHITE,fontWeight:bold?700:400 })
                    return (
                      <tr key={p.id}>
                        <td style={td()}>
                          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                            <img src={p.image} alt={p.symbol} style={{ width:19,height:19,borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                            <span style={{ fontWeight:700 }}>{p.symbol?.toUpperCase()}</span>
                          </div>
                        </td>
                        <td style={td(true,WHITE,true)}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}</td>
                        <td style={td(true,pctColor(chg),true)}>{pct(chg)}</td>
                        <td style={td(true,DIM)}>{fmt(p.market_cap)}</td>
                        <td style={td(true,DIM)}>{fmt(p.total_volume)}</td>
                        <td style={td(true)}><button onClick={()=>onToggle(p.id,p)} style={{ background:'rgba(255,77,77,0.08)',border:'1px solid rgba(255,77,77,0.22)',borderRadius:4,color:RED,cursor:'pointer',fontSize:11,padding:'3px 9px',fontFamily:'inherit' }}>✕</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ── WALLET (Zerion) ───────────────────────────────────────────
function WalletTab({ isMobile }) {
  const [input, setInput]       = useState('')
  const [activeAddr, setActive] = useState('')
  const [subTab, setSubTab]     = useState('positions')
  const zerionActive = hasZerionKey()
  const { portfolio, positions, transactions, loading, error, refresh } = useWallet(activeAddr)

  const totalVal = portfolio?.total?.value ?? 0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {zerionActive ? (
        <div style={{ padding:11,background:'rgba(0,210,106,0.06)',border:'1px solid rgba(0,210,106,0.25)',borderRadius:8,display:'flex',alignItems:'center',gap:9 }}>
          <Dot color={GREEN}/><span style={{ fontSize:12,color:GREEN,fontWeight:700 }}>ZERION API CONECTADA ✓ — key cifrada en Vercel</span>
        </div>
      ) : (
        <div style={{ padding:16,background:'rgba(255,204,0,0.06)',border:'1px solid rgba(255,204,0,0.25)',borderRadius:8 }}>
          <div style={{ fontSize:13,color:GOLD,fontWeight:700,marginBottom:10 }}>⚠ ZERION API KEY REQUERIDA — GRATIS 2000 calls/día</div>
          <div style={{ fontSize:12,color:DIM,lineHeight:2 }}>
            1. Regístrate en <span style={{ color:G }}>zerion.io</span> → Developer Portal<br/>
            2. Crea una API key gratuita<br/>
            3. En Vercel → <span style={{ color:G }}>Settings → Environment Variables</span>:<br/>
            <div style={{ margin:'6px 0',padding:'8px 12px',background:'rgba(0,0,0,0.35)',borderRadius:6 }}>
              <span style={{ color:'rgba(255,140,0,0.55)' }}>Nombre:</span> <span style={{ color:WHITE }}>VITE_ZERION_API_KEY</span><br/>
              <span style={{ color:'rgba(255,140,0,0.55)' }}>Valor:</span> <span style={{ color:WHITE }}>tu_key_aqui</span>
            </div>
            4. <span style={{ color:G }}>Redeploy</span> → listo ✓ — Soporta Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche y más
          </div>
        </div>
      )}

      <Card>
        <CT>ANALIZAR WALLET · Zerion — multichain</CT>
        <div style={{ display:'flex',flexDirection:isMobile?'column':'row',gap:9 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setActive(input.trim())}
            placeholder="0x… Ethereum, Polygon, BSC, Arbitrum, Optimism…"
            style={{ flex:1,background:'rgba(255,140,0,0.05)',border:'1px solid rgba(255,140,0,0.22)',borderRadius:7,padding:'11px 14px',color:WHITE,fontFamily:'inherit',fontSize:13,outline:'none' }}/>
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={()=>setActive(input.trim())} disabled={loading}
              style={{ flex:isMobile?1:undefined,padding:'11px 20px',background:loading?'rgba(255,140,0,0.05)':'rgba(255,140,0,0.14)',border:'1px solid rgba(255,140,0,0.38)',borderRadius:7,color:G,cursor:loading?'wait':'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700 }}>
              {loading?'CARGANDO…':'ANALIZAR'}
            </button>
            {activeAddr && <button onClick={refresh} style={{ padding:'11px 14px',background:'transparent',border:'1px solid rgba(255,140,0,0.18)',borderRadius:7,color:'rgba(255,140,0,0.55)',cursor:'pointer',fontFamily:'inherit',fontSize:16 }}>↻</button>}
          </div>
        </div>
        {error && <div style={{ marginTop:9,fontSize:12,color:RED }}>Error: {error}</div>}
      </Card>

      {portfolio && (
        <Card accent>
          <div style={{ display:'flex',flexDirection:isMobile?'column':'row',justifyContent:'space-between',alignItems:isMobile?'flex-start':'center',gap:14 }}>
            <div>
              <div style={{ fontSize:10,color:'rgba(255,140,0,0.5)',marginBottom:4,letterSpacing:'0.15em' }}>WALLET</div>
              <div style={{ fontSize:13,color:G }}>{shortAddr(activeAddr)}</div>
            </div>
            <div>
              <div style={{ fontSize:10,color:'rgba(255,140,0,0.5)',marginBottom:4,letterSpacing:'0.15em' }}>VALOR TOTAL</div>
              <div style={{ fontSize:isMobile?24:30,color:G,fontWeight:700 }}>{fmt(totalVal)}</div>
            </div>
            <div>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4 }}><Dot color={GREEN}/><span style={{ fontSize:11,color:GREEN }}>ZERION LIVE</span></div>
              <div style={{ fontSize:10,color:DIM }}>{positions.length} posiciones · auto-refresh 2min</div>
            </div>
          </div>
        </Card>
      )}

      {(positions.length>0||transactions.length>0) && (
        <>
          <div style={{ display:'flex',gap:4 }}>
            {[['positions','POSICIONES'],['transactions','TRANSACCIONES']].map(([id,label])=>(
              <button key={id} onClick={()=>setSubTab(id)} style={{ padding:'7px 16px',fontSize:11,fontWeight:subTab===id?700:400,fontFamily:'inherit',background:subTab===id?'rgba(255,140,0,0.12)':'transparent',color:subTab===id?G:'rgba(255,140,0,0.38)',border:`1px solid ${subTab===id?'rgba(255,140,0,0.38)':'rgba(255,140,0,0.1)'}`,borderRadius:5,cursor:'pointer' }}>{label}</button>
            ))}
          </div>

          {subTab==='positions' && positions.length>0 && (
            <Card>
              <CT>TOKENS Y POSICIONES · todas las chains</CT>
              {positions.map((pos,i)=>{
                const attr  = pos.attributes
                const token = attr?.fungible_info
                const val   = attr?.value ?? 0
                const qty   = attr?.quantity?.float ?? 0
                const price = attr?.price ?? 0
                const chg   = attr?.changes?.percent_1d ?? null
                return (
                  <div key={i} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid rgba(255,140,0,0.06)',gap:10 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      {token?.icon?.url && <img src={token.icon.url} alt={token.symbol} style={{ width:26,height:26,borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>}
                      <div>
                        <div style={{ fontWeight:700,fontSize:13,color:WHITE }}>{token?.symbol?.toUpperCase()}</div>
                        <div style={{ fontSize:10,color:DIM }}>{qty.toFixed(4)} · ${price.toFixed(4)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontWeight:700,fontSize:13,color:G }}>{fmt(val)}</div>
                      {chg!=null && <div style={{ fontSize:11,fontWeight:700,color:pctColor(chg) }}>{pct(chg)}</div>}
                    </div>
                  </div>
                )
              })}
            </Card>
          )}

          {subTab==='transactions' && (
            <Card>
              <CT>HISTORIAL DE TRANSACCIONES</CT>
              {transactions.length===0 ? (
                <div style={{ textAlign:'center',padding:28,color:DIM,fontSize:12 }}>Sin historial disponible</div>
              ) : transactions.slice(0,25).map((tx,i)=>{
                const attr  = tx.attributes
                const type  = attr?.operation_type || 'tx'
                const status= attr?.status
                const time  = attr?.mined_at || attr?.sent_at
                const val   = attr?.transfers?.reduce((s,t)=>s+(t.value??0),0) ?? 0
                return (
                  <div key={i} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid rgba(255,140,0,0.05)',gap:10 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      <Badge label={type.toUpperCase()} color={status==='confirmed'?GREEN:GOLD}/>
                      <div>
                        <div style={{ fontSize:12,color:WHITE,textTransform:'capitalize' }}>{type.replace(/_/g,' ')}</div>
                        {time && <div style={{ fontSize:10,color:DIM }}>{timeAgo(time)}</div>}
                      </div>
                    </div>
                    <div style={{ fontWeight:700,fontSize:13,color:val>0?G:DIM }}>{val>0?fmt(val):'—'}</div>
                  </div>
                )
              })}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ── APP ───────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('overview')
  const [time, setTime] = useState(new Date())
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<768)
    window.addEventListener('resize',h); return ()=>window.removeEventListener('resize',h)
  },[])
  useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(t) },[])

  const { prices, loading, lastUpdate, wsStatus } = usePrices()
  const { stats }   = useGlobalStats()
  const { history } = useEthHistory()
  const { watchlist, extraCoins, toggle, clear } = useWatchlist()

  const TABS = [
    { id:'overview',  icon:'◈', label:'OVERVIEW' },
    { id:'prices',    icon:'◉', label:'PRECIOS'  },
    { id:'watchlist', icon:'★', label:`WATCHLIST${watchlist.length>0?` (${watchlist.length})`:''}` },
    { id:'wallet',    icon:'◎', label:'WALLET'   },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:${BG};overflow-x:hidden}
        @keyframes ping{75%,100%{transform:scale(2);opacity:0}}
        tr:hover td{background:rgba(255,140,0,0.02)}
        input::placeholder{color:rgba(255,255,255,0.2)}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:${BG}}
        ::-webkit-scrollbar-thumb{background:rgba(255,140,0,0.22);border-radius:4px}
        button{touch-action:manipulation}
      `}</style>

      <div style={{ minHeight:'100vh', background:BG, fontFamily:"'IBM Plex Mono',monospace", color:WHITE }}>
        <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',backgroundImage:'linear-gradient(rgba(255,140,0,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,140,0,0.018) 1px,transparent 1px)',backgroundSize:'40px 40px' }}/>
        <div style={{ position:'fixed',top:'-180px',left:'50%',transform:'translateX(-50%)',width:'600px',height:'360px',borderRadius:'50%',pointerEvents:'none',zIndex:0,background:'radial-gradient(ellipse,rgba(255,140,0,0.055) 0%,transparent 70%)' }}/>

        <div style={{ position:'relative',zIndex:1,maxWidth:1300,margin:'0 auto',padding:isMobile?'0 12px 80px':'0 24px 56px' }}>

          {/* HEADER */}
          <header style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:isMobile?'13px 0 15px':'20px 0 24px',borderBottom:'1px solid rgba(255,140,0,0.14)',marginBottom:isMobile?13:22 }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ width:isMobile?32:38,height:isMobile?32:38,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:isMobile?17:20,fontWeight:900,color:BG,background:`linear-gradient(135deg,${G},#E67A00)` }}>₿</div>
              <div>
                <div style={{ fontSize:isMobile?13:15,fontWeight:700,letterSpacing:'0.15em',color:G }}>DEFI PULSE</div>
                <div style={{ fontSize:9,color:'rgba(255,140,0,0.4)',letterSpacing:'0.12em' }}>v6.0 · CEREBRO DeFi</div>
              </div>
            </div>
            <div style={{ display:'flex',alignItems:'center',gap:isMobile?10:18 }}>
              <WsIndicator status={wsStatus} short={isMobile}/>
              {!isMobile&&<div style={{ fontSize:11,color:'rgba(255,140,0,0.55)' }}>{time.toLocaleTimeString('es-CO')}</div>}
            </div>
          </header>

          {/* TABS DESKTOP */}
          {!isMobile && (
            <div style={{ display:'flex',gap:5,marginBottom:20 }}>
              {TABS.map(t=>{
                const a=tab===t.id
                return <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'8px 18px',fontSize:11,letterSpacing:'0.1em',fontWeight:a?700:400,fontFamily:'inherit',background:a?'rgba(255,140,0,0.14)':'transparent',color:a?G:'rgba(255,140,0,0.38)',border:`1px solid ${a?'rgba(255,140,0,0.42)':'rgba(255,140,0,0.1)'}`,borderRadius:5,cursor:'pointer',transition:'all .18s' }}>{t.label}</button>
              })}
            </div>
          )}

          {tab==='overview'  && <OverviewTab  prices={prices} stats={stats} history={history} wsStatus={wsStatus} watchlist={watchlist} onToggle={toggle} isMobile={isMobile}/>}
          {tab==='prices'    && <PricesTab    prices={prices} loading={loading} lastUpdate={lastUpdate} wsStatus={wsStatus} watchlist={watchlist} onToggle={toggle} isMobile={isMobile}/>}
          {tab==='watchlist' && <WatchlistTab prices={prices} watchlist={watchlist} extraCoins={extraCoins} onToggle={toggle} onClear={clear} wsStatus={wsStatus} isMobile={isMobile}/>}
          {tab==='wallet'    && <WalletTab    isMobile={isMobile}/>}
        </div>

        {/* BOTTOM NAV MÓVIL */}
        {isMobile && (
          <nav style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:'rgba(13,13,13,0.97)',backdropFilter:'blur(12px)',borderTop:'1px solid rgba(255,140,0,0.13)',display:'flex',padding:'8px 0 max(8px,env(safe-area-inset-bottom))' }}>
            {TABS.map(t=>{
              const a=tab===t.id
              return (
                <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'none',border:'none',cursor:'pointer',padding:'5px 0',color:a?G:'rgba(255,140,0,0.32)',fontFamily:'inherit' }}>
                  <span style={{ fontSize:19 }}>{t.icon}</span>
                  <span style={{ fontSize:9,letterSpacing:'0.06em',fontWeight:a?700:400 }}>{t.id==='watchlist'&&watchlist.length>0?`★(${watchlist.length})`:t.label.split('(')[0].trim()}</span>
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </>
  )
}
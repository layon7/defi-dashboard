import { useState, useEffect } from 'react'
import { usePrices, useGlobalStats, useEthHistory, useWatchlist, useWallet, useGlobalSearch } from './hooks/useDefiData.js'
import { hasDebankKey } from './services/api.js'

// ── Utilidades ────────────────────────────────────────────────
function fmt(n) {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n/1e6).toFixed(2)}M`
  if (n >= 1e3)  return `$${(n/1e3).toFixed(1)}K`
  return `$${Number(n).toFixed(2)}`
}
function pct(n) {
  if (n == null) return '—'
  return n >= 0 ? `▲ ${Math.abs(n).toFixed(2)}%` : `▼ ${Math.abs(n).toFixed(2)}%`
}
function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts*1000)/60000)
  if (d < 1) return 'ahora'; if (d < 60) return `${d}m`
  if (d < 1440) return `${Math.floor(d/60)}h`; return `${Math.floor(d/1440)}d`
}

const G='#FF8C00', G2='#FFA733', R='#FF4D4D', GOLD='#FFCC00'
const DIM='rgba(255,255,255,0.58)', WHITE='#FFFFFF', BG='#0D0D0D'

// ── Componentes base ──────────────────────────────────────────
function Dot({ color=G, size=9 }) {
  return (
    <span style={{ position:'relative', display:'inline-flex', width:size, height:size }}>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:color, opacity:0.4, animation:'ping 1.5s ease infinite' }}/>
      <span style={{ borderRadius:'50%', width:size, height:size, background:color, display:'block' }}/>
    </span>
  )
}
function Card({ children, accent, style={} }) {
  return <div style={{ background:accent?'rgba(255,140,0,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${accent?'rgba(255,140,0,0.45)':'rgba(255,140,0,0.15)'}`, borderRadius:10, padding:'16px', ...style }}>{children}</div>
}
function CT({ children }) {
  return <div style={{ fontSize:10, letterSpacing:'0.18em', color:'rgba(255,140,0,0.7)', marginBottom:14, fontWeight:700 }}>{children}</div>
}
function Badge({ label, color=G }) {
  return <span style={{ fontSize:10, fontWeight:700, color, border:`1px solid ${color}44`, background:`${color}15`, padding:'2px 8px', borderRadius:4 }}>{label}</span>
}
function WsIndicator({ status, short=false }) {
  const map = { live:{color:G,label:short?'LIVE':'LIVE · BINANCE WS'}, connecting:{color:GOLD,label:short?'…':'CONECTANDO…'}, error:{color:R,label:short?'ERR':'WS ERROR'} }
  const { color, label } = map[status]||map.connecting
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <Dot color={color} size={8}/>
      <span style={{ fontSize:10, color, fontWeight:700, letterSpacing:'0.06em' }}>{label}</span>
    </div>
  )
}

// ── Buscador global ───────────────────────────────────────────
function GlobalSearch({ value, onChange, placeholder, isSearching }) {
  return (
    <div style={{ position:'relative' }}>
      <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'rgba(255,140,0,0.4)', pointerEvents:'none' }}>
        {isSearching ? '⟳' : '⌕'}
      </span>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||'Buscar…'}
        style={{ width:'100%', background:'rgba(255,140,0,0.05)', border:'1px solid rgba(255,140,0,0.2)', borderRadius:7, padding:'11px 36px', color:WHITE, fontFamily:'inherit', fontSize:13, outline:'none' }}/>
      {value && <button onClick={()=>onChange('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:DIM, fontSize:18 }}>×</button>}
    </div>
  )
}

function SparkBar({ data }) {
  if (!data.length) return <div style={{ height:56, display:'flex', alignItems:'center', justifyContent:'center', color:DIM, fontSize:12 }}>Cargando…</div>
  const max=Math.max(...data.map(d=>d.value)), min=Math.min(...data.map(d=>d.value))
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:56 }}>
      {data.map((d,i)=>{
        const h=((d.value-min)/(max-min||1))*44+8
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <div title={`$${d.value.toFixed(0)}`} style={{ width:'100%', height:h, borderRadius:'3px 3px 0 0', background:i===data.length-1?`linear-gradient(180deg,${G},${G2})`:'rgba(255,140,0,0.2)', transition:'height 0.6s' }}/>
            <span style={{ fontSize:9, color:'rgba(255,140,0,0.4)' }}>{d.day}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Fila de precio (desktop) ──────────────────────────────────
function PriceRow({ p, rank, watched, onToggle, showRank=true }) {
  const chg = p.price_change_percentage_24h
  return (
    <tr>
      {showRank && <td style={{ fontSize:12, padding:'10px 0', borderBottom:'1px solid rgba(255,140,0,0.06)', color:DIM, width:32 }}>{rank}</td>}
      <td style={{ fontSize:12, padding:'10px 0', borderBottom:'1px solid rgba(255,140,0,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <img src={p.image} alt={p.symbol} style={{ width:22, height:22, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:WHITE }}>{p.symbol?.toUpperCase()}</div>
            <div style={{ fontSize:10, color:DIM }}>{p.name}</div>
          </div>
        </div>
      </td>
      <td style={{ fontSize:13, padding:'10px 0', borderBottom:'1px solid rgba(255,140,0,0.06)', textAlign:'right', fontWeight:700, color:WHITE, fontVariantNumeric:'tabular-nums' }}>
        ${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}
      </td>
      <td style={{ fontSize:13, padding:'10px 0', borderBottom:'1px solid rgba(255,140,0,0.06)', textAlign:'right', fontWeight:700, color:chg>=0?G:R }}>
        {pct(chg)}
      </td>
      <td style={{ fontSize:12, padding:'10px 0', borderBottom:'1px solid rgba(255,140,0,0.06)', textAlign:'right', color:DIM }}>
        {fmt(p.market_cap)}
      </td>
      <td style={{ fontSize:12, padding:'10px 0', borderBottom:'1px solid rgba(255,140,0,0.06)', textAlign:'right', color:DIM }}>
        {fmt(p.total_volume)}
      </td>
      <td style={{ padding:'10px 0', borderBottom:'1px solid rgba(255,140,0,0.06)', textAlign:'center', width:40 }}>
        <button onClick={()=>onToggle(p.id, p)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:watched?G:'rgba(255,255,255,0.15)', transition:'all 0.15s', lineHeight:1 }}>
          {watched?'★':'☆'}
        </button>
      </td>
    </tr>
  )
}

// Tarjeta móvil de precio
function PriceCard({ p, rank, watched, onToggle }) {
  const chg = p.price_change_percentage_24h
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom:'1px solid rgba(255,140,0,0.07)' }}>
      <span style={{ fontSize:11, color:DIM, minWidth:22 }}>{rank}</span>
      <img src={p.image} alt={p.symbol} style={{ width:28, height:28, borderRadius:'50%', flexShrink:0 }} onError={e=>e.target.style.display='none'}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontWeight:700, fontSize:13, color:WHITE }}>{p.symbol?.toUpperCase()}</span>
          <span style={{ fontWeight:700, fontSize:13, color:WHITE, fontVariantNumeric:'tabular-nums' }}>
            ${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}
          </span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:3 }}>
          <span style={{ fontSize:10, color:DIM }}>{p.name}</span>
          <span style={{ fontSize:12, fontWeight:700, color:chg>=0?G:R }}>{pct(chg)}</span>
        </div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:2 }}>Cap: {fmt(p.market_cap)}</div>
      </div>
      <button onClick={()=>onToggle(p.id, p)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:watched?G:'rgba(255,255,255,0.15)', flexShrink:0, padding:'0 4px' }}>
        {watched?'★':'☆'}
      </button>
    </div>
  )
}

// ── OVERVIEW ──────────────────────────────────────────────────
function OverviewTab({ prices, stats, history, wsStatus, isMobile }) {
  const eth = prices.find(p=>p.id==='ethereum')
  const kpis = [
    { label:'MARKET CAP', value:fmt(stats?.total_market_cap?.usd), sub:stats?`BTC dom. ${stats.market_cap_percentage?.btc?.toFixed(1)}%`:'…', accent:true },
    { label:'VOLUMEN 24H', value:fmt(stats?.total_volume?.usd), sub:'Global' },
    { label:'ETH', value:eth?`$${(eth.current_price??0).toLocaleString()}`:'…', sub:eth?pct(eth.price_change_percentage_24h):'…' },
    { label:'MONEDAS', value:prices.length||'…', sub:'Top 500' },
  ]
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {kpis.map((k,i)=>(
          <Card key={i} accent={k.accent}>
            <div style={{ fontSize:9, letterSpacing:'0.15em', color:'rgba(255,140,0,0.6)', marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:isMobile?18:22, fontWeight:700, color:G, lineHeight:1, marginBottom:4 }}>{k.value}</div>
            <div style={{ fontSize:11, color:DIM }}>{k.sub}</div>
          </Card>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'3fr 2fr', gap:12 }}>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <CT>ETH · 7 DÍAS</CT>
            <WsIndicator status={wsStatus} short={isMobile}/>
          </div>
          <SparkBar data={history}/>
          {history.length>1&&(
            <div style={{ marginTop:12, display:'flex', gap:isMobile?12:24 }}>
              {[['INICIO',`$${history[0]?.value.toFixed(0)}`],['ACTUAL',`$${history[history.length-1]?.value.toFixed(0)}`],['VAR.',pct(((history[history.length-1]?.value-history[0]?.value)/history[0]?.value)*100)]].map(([l,v],i)=>(
                <div key={i}>
                  <div style={{ fontSize:9, color:'rgba(255,140,0,0.5)', marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:13, color:G, fontWeight:700 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CT>TOP MOVERS 24H</CT>
          {[...prices].sort((a,b)=>Math.abs(b.price_change_percentage_24h??0)-Math.abs(a.price_change_percentage_24h??0)).slice(0,6).map((p,i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <img src={p.image} alt={p.symbol} style={{ width:18, height:18, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                <span style={{ fontSize:12, fontWeight:700, color:WHITE }}>{p.symbol?.toUpperCase()}</span>
              </div>
              <span style={{ fontSize:12, fontWeight:700, color:p.price_change_percentage_24h>=0?G:R }}>{pct(p.price_change_percentage_24h)}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}

// ── PRECIOS (top500 + búsqueda global ilimitada) ──────────────
function PricesTab({ prices, loading, lastUpdate, wsStatus, watchlist, onToggle, isMobile }) {
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const PER_PAGE = isMobile ? 30 : 50

  // Hook de búsqueda global — busca en TODO CoinGecko si no está en top 500
  const { results: searchResults, loading: searching } = useGlobalSearch(search, prices)

  const displayList = search ? searchResults : prices
  const totalPages  = Math.ceil(displayList.length / PER_PAGE)
  const visible     = displayList.slice((page-1)*PER_PAGE, page*PER_PAGE)

  useEffect(()=>{ setPage(1) }, [search])

  const thS = { fontSize:10, letterSpacing:'0.1em', color:'rgba(255,140,0,0.55)', fontWeight:700, fontFamily:'inherit', paddingBottom:10, borderBottom:'1px solid rgba(255,140,0,0.1)' }

  return (
    <Card>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:isMobile?'flex-start':'center', flexDirection:isMobile?'column':'row', gap:10, marginBottom:14 }}>
        <CT>PRECIOS · BÚSQUEDA GLOBAL · BINANCE WS</CT>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <WsIndicator status={wsStatus} short={isMobile}/>
          {lastUpdate&&!isMobile&&<span style={{ fontSize:10, color:DIM }}>{lastUpdate.toLocaleTimeString('es-CO')}</span>}
        </div>
      </div>

      {/* Buscador */}
      <div style={{ marginBottom:12 }}>
        <GlobalSearch value={search} onChange={setSearch} isSearching={searching}
          placeholder="Buscar cualquier moneda (L3, layer3, pepe, shib…) — búsqueda global"/>
      </div>
      {search && (
        <div style={{ marginBottom:10, fontSize:11, color:DIM }}>
          {searching ? '🔍 Buscando en CoinGecko completo…' : `${searchResults.length} resultado${searchResults.length!==1?'s':''} para "${search}" — incluye monedas fuera del top 500`}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:DIM, fontSize:14 }}>Cargando top 500…</div>
      ) : visible.length === 0 && !searching ? (
        <div style={{ textAlign:'center', padding:40, color:DIM, fontSize:13 }}>No se encontró "{search}"</div>
      ) : isMobile ? (
        // MÓVIL: lista de tarjetas
        <div>
          {visible.map((p,i)=>(
            <PriceCard key={p.id} p={p} rank={search?(i+1):((page-1)*PER_PAGE+i+1)} watched={watchlist.includes(p.id)} onToggle={onToggle}/>
          ))}
        </div>
      ) : (
        // DESKTOP: tabla
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              {['#','TOKEN','PRECIO','24H','MARKET CAP','VOL 24H','★'].map((h,i)=>(
                <th key={i} style={{ ...thS, textAlign:i>1?'right':'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((p,i)=>(
              <PriceRow key={p.id} p={p} rank={search?(i+1):((page-1)*PER_PAGE+i+1)} watched={watchlist.includes(p.id)} onToggle={onToggle}/>
            ))}
          </tbody>
        </table>
      )}

      {/* Paginación */}
      {!search && totalPages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:6, marginTop:18, flexWrap:'wrap' }}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:'6px 14px', background:'rgba(255,140,0,0.08)', border:'1px solid rgba(255,140,0,0.2)', borderRadius:5, color:page===1?DIM:G, cursor:page===1?'default':'pointer', fontFamily:'inherit', fontSize:12 }}>← ANT</button>
          {Array.from({length:totalPages},(_,i)=>i+1).map(n=>(
            <button key={n} onClick={()=>setPage(n)} style={{ padding:'6px 10px', background:n===page?'rgba(255,140,0,0.2)':'transparent', border:`1px solid ${n===page?'rgba(255,140,0,0.5)':'rgba(255,140,0,0.12)'}`, borderRadius:5, color:n===page?G:DIM, cursor:'pointer', fontFamily:'inherit', fontSize:12 }}>{n}</button>
          ))}
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding:'6px 14px', background:'rgba(255,140,0,0.08)', border:'1px solid rgba(255,140,0,0.2)', borderRadius:5, color:page===totalPages?DIM:G, cursor:page===totalPages?'default':'pointer', fontFamily:'inherit', fontSize:12 }}>SIG →</button>
        </div>
      )}
    </Card>
  )
}

// ── WATCHLIST ─────────────────────────────────────────────────
function WatchlistTab({ prices, watchlist, extraCoins, onToggle, onClear, wsStatus, isMobile }) {
  const [addSearch, setAddSearch] = useState('')
  const { results: suggestions, loading: searching } = useGlobalSearch(addSearch, prices)

  // Combina top500 + monedas extra guardadas
  const allCoins   = [...prices, ...extraCoins.filter(e => !prices.find(p=>p.id===e.id))]
  const watched    = allCoins.filter(p=>watchlist.includes(p.id))
  const avgChange  = watched.length ? watched.reduce((s,p)=>s+(p.price_change_percentage_24h??0),0)/watched.length : 0

  // Dropdown de sugerencias (excluye ya añadidas)
  const dropdownItems = suggestions.filter(p=>!watchlist.includes(p.id)).slice(0,7)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        <Card accent>
          <div style={{ fontSize:9, color:'rgba(255,140,0,0.6)', marginBottom:6, letterSpacing:'0.15em' }}>SEGUIDAS</div>
          <div style={{ fontSize:24, fontWeight:700, color:G }}>{watched.length}</div>
        </Card>
        <Card>
          <div style={{ fontSize:9, color:'rgba(255,140,0,0.6)', marginBottom:6, letterSpacing:'0.15em' }}>PROMEDIO 24H</div>
          <div style={{ fontSize:24, fontWeight:700, color:avgChange>=0?G:R }}>{watched.length?pct(avgChange):'—'}</div>
        </Card>
        <Card>
          <div style={{ fontSize:9, color:'rgba(255,140,0,0.6)', marginBottom:6, letterSpacing:'0.15em' }}>FEED</div>
          <div style={{ marginTop:4 }}><WsIndicator status={wsStatus} short={isMobile}/></div>
        </Card>
      </div>

      {/* Buscador global para añadir */}
      <Card>
        <CT>AÑADIR MONEDA — búsqueda global (cualquier ranking)</CT>
        <div style={{ position:'relative' }}>
          <GlobalSearch value={addSearch} onChange={setAddSearch} isSearching={searching}
            placeholder="Buscar cualquier moneda — L3, layer3, pepe, shib, cualquiera…"/>
          {dropdownItems.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:30, background:'#1A1A1A', border:'1px solid rgba(255,140,0,0.25)', borderRadius:8, marginTop:4, boxShadow:'0 8px 32px rgba(0,0,0,0.6)', overflow:'hidden' }}>
              {dropdownItems.map(p=>(
                <button key={p.id} onClick={()=>{ onToggle(p.id, p); setAddSearch('') }}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', background:'transparent', border:'none', borderBottom:'1px solid rgba(255,140,0,0.07)', cursor:'pointer', color:WHITE, fontFamily:'inherit' }}
                  onMouseOver={e=>e.currentTarget.style.background='rgba(255,140,0,0.07)'}
                  onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <img src={p.image} alt={p.symbol} style={{ width:22, height:22, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                    <span style={{ fontWeight:700, fontSize:13 }}>{p.symbol?.toUpperCase()}</span>
                    <span style={{ fontSize:11, color:DIM }}>{p.name}</span>
                    {p.market_cap_rank && <span style={{ fontSize:10, color:'rgba(255,140,0,0.5)' }}>#{p.market_cap_rank}</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:12, color:p.price_change_percentage_24h>=0?G:R }}>{pct(p.price_change_percentage_24h)}</span>
                    <span style={{ fontSize:11, color:G, fontWeight:700 }}>★ ADD</span>
                  </div>
                </button>
              ))}
              {searching && <div style={{ padding:'10px 14px', fontSize:11, color:DIM }}>Buscando en CoinGecko…</div>}
            </div>
          )}
        </div>
        <div style={{ marginTop:10, fontSize:11, color:DIM }}>También puedes pulsar ★ en la tab PRECIOS · Funciona con cualquier moneda de CoinGecko</div>
      </Card>

      {/* Lista vacía */}
      {watched.length === 0 ? (
        <Card>
          <div style={{ textAlign:'center', padding:isMobile?32:52, color:DIM }}>
            <div style={{ fontSize:44, marginBottom:14 }}>☆</div>
            <div style={{ fontSize:14, marginBottom:8, color:WHITE }}>Watchlist vacía</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)', lineHeight:1.9 }}>
              Busca arriba y pulsa ★ ADD<br/>
              o ve a PRECIOS y toca ★ en cualquier moneda
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Grid de cards */}
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)', gap:10 }}>
            {watched.map(p=>{
              const chg=p.price_change_percentage_24h??0
              return (
                <div key={p.id} style={{ background:'rgba(255,140,0,0.04)', border:`1px solid ${chg>=0?'rgba(255,140,0,0.2)':'rgba(255,77,77,0.2)'}`, borderRadius:8, padding:14, position:'relative' }}>
                  <button onClick={()=>onToggle(p.id,p)} style={{ position:'absolute', top:8, right:10, background:'none', border:'none', cursor:'pointer', fontSize:18, color:G }}>★</button>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <img src={p.image} alt={p.symbol} style={{ width:26, height:26, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:WHITE }}>{p.symbol?.toUpperCase()}</div>
                      <div style={{ fontSize:10, color:DIM }}>{p.name}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:isMobile?16:20, fontWeight:700, color:WHITE, marginBottom:4, fontVariantNumeric:'tabular-nums' }}>
                    ${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:chg>=0?G:R }}>{pct(chg)}</div>
                  <div style={{ marginTop:6, fontSize:10, color:DIM }}>Cap: {fmt(p.market_cap)}</div>
                </div>
              )
            })}
          </div>

          {/* Tabla detalle — solo desktop */}
          {!isMobile && (
            <Card>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <CT>TABLA DETALLADA</CT>
                <button onClick={onClear} style={{ fontSize:11, padding:'5px 12px', background:'rgba(255,77,77,0.08)', border:'1px solid rgba(255,77,77,0.25)', borderRadius:5, color:R, cursor:'pointer', fontFamily:'inherit' }}>✕ LIMPIAR TODO</button>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['TOKEN','PRECIO','24H','MARKET CAP','VOL 24H','QUITAR'].map((h,i)=>(
                  <th key={i} style={{ fontSize:10, letterSpacing:'0.1em', color:'rgba(255,140,0,0.55)', fontWeight:700, fontFamily:'inherit', paddingBottom:10, borderBottom:'1px solid rgba(255,140,0,0.1)', textAlign:i>0?'right':'left' }}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {watched.map(p=>{
                    const chg=p.price_change_percentage_24h??0
                    const tdStyle=(right,color,bold)=>({ fontSize:13, padding:'10px 0', borderBottom:'1px solid rgba(255,140,0,0.06)', textAlign:right?'right':'left', color:color||WHITE, fontWeight:bold?700:400 })
                    return (
                      <tr key={p.id}>
                        <td style={tdStyle()}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <img src={p.image} alt={p.symbol} style={{ width:20, height:20, borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
                            <span style={{ fontWeight:700 }}>{p.symbol?.toUpperCase()}</span>
                          </div>
                        </td>
                        <td style={tdStyle(true,WHITE,true)}>${(p.current_price??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})}</td>
                        <td style={tdStyle(true,chg>=0?G:R,true)}>{pct(chg)}</td>
                        <td style={tdStyle(true,DIM)}>{fmt(p.market_cap)}</td>
                        <td style={tdStyle(true,DIM)}>{fmt(p.total_volume)}</td>
                        <td style={tdStyle(true)}>
                          <button onClick={()=>onToggle(p.id,p)} style={{ background:'rgba(255,77,77,0.08)', border:'1px solid rgba(255,77,77,0.25)', borderRadius:4, color:R, cursor:'pointer', fontSize:11, padding:'3px 10px', fontFamily:'inherit' }}>✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {/* Móvil: botón limpiar */}
          {isMobile && (
            <button onClick={onClear} style={{ width:'100%', padding:'12px', background:'rgba(255,77,77,0.08)', border:'1px solid rgba(255,77,77,0.25)', borderRadius:8, color:R, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700 }}>✕ LIMPIAR WATCHLIST</button>
          )}
        </>
      )}
    </div>
  )
}

// ── WALLET ────────────────────────────────────────────────────
function WalletTab({ isMobile }) {
  const [input, setInput]       = useState('')
  const [activeAddr, setActive] = useState('')
  const [walletTab, setWalletTab] = useState('tokens')
  const debankActive = hasDebankKey()
  const { portfolio, tokens, protocols, history, loading, error, refresh } = useWallet(activeAddr)
  const totalVal = tokens.reduce((s,t)=>s+t.amount*t.price,0)

  const tdS = (right,color,bold)=>({ fontSize:12, padding:'10px 0', borderBottom:'1px solid rgba(255,140,0,0.06)', textAlign:right?'right':'left', color:color||WHITE, fontWeight:bold?700:400 })
  const thS = { fontSize:10, letterSpacing:'0.1em', color:'rgba(255,140,0,0.55)', fontWeight:700, fontFamily:'inherit', paddingBottom:10, borderBottom:'1px solid rgba(255,140,0,0.1)' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {debankActive ? (
        <div style={{ padding:12, background:'rgba(255,140,0,0.06)', border:'1px solid rgba(255,140,0,0.25)', borderRadius:8, display:'flex', alignItems:'center', gap:10 }}>
          <Dot/><span style={{ fontSize:12, color:G, fontWeight:700 }}>DEBANK API CONECTADA ✓ — key cifrada en Vercel</span>
        </div>
      ) : (
        <div style={{ padding:16, background:'rgba(255,204,0,0.06)', border:'1px solid rgba(255,204,0,0.28)', borderRadius:8 }}>
          <div style={{ fontSize:13, color:GOLD, fontWeight:700, marginBottom:8 }}>⚠ DEBANK API KEY NO CONFIGURADA</div>
          <div style={{ fontSize:12, color:DIM, lineHeight:2 }}>
            1. Regístrate gratis en <span style={{ color:G }}>cloud.debank.com</span><br/>
            2. Ve a <span style={{ color:G }}>API Keys</span> → crea una key<br/>
            3. Vercel → <span style={{ color:G }}>Settings → Environment Variables</span>:<br/>
            <div style={{ marginTop:6, padding:'8px 12px', background:'rgba(0,0,0,0.4)', borderRadius:6 }}>
              <span style={{ color:'rgba(255,140,0,0.6)' }}>Nombre:</span> <span style={{ color:WHITE }}>VITE_DEBANK_API_KEY</span><br/>
              <span style={{ color:'rgba(255,140,0,0.6)' }}>Valor:</span> <span style={{ color:WHITE }}>tu_key_aqui</span>
            </div>
            4. <span style={{ color:G }}>Redeploy</span> → listo ✓
          </div>
        </div>
      )}

      <Card>
        <CT>ANALIZAR WALLET · DeBank — cualquier EVM chain</CT>
        <div style={{ display:'flex', flexDirection:isMobile?'column':'row', gap:10 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setActive(input.trim())}
            placeholder="0x... Ethereum, Polygon, BSC, Arbitrum…"
            style={{ flex:1, background:'rgba(255,140,0,0.05)', border:'1px solid rgba(255,140,0,0.25)', borderRadius:7, padding:'12px 14px', color:WHITE, fontFamily:'inherit', fontSize:13, outline:'none' }}/>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setActive(input.trim())} disabled={loading}
              style={{ flex:isMobile?1:undefined, padding:'12px 22px', background:loading?'rgba(255,140,0,0.06)':'rgba(255,140,0,0.15)', border:'1px solid rgba(255,140,0,0.4)', borderRadius:7, color:G, cursor:loading?'wait':'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700 }}>
              {loading?'CARGANDO…':'ANALIZAR'}
            </button>
            {activeAddr&&<button onClick={refresh} style={{ padding:'12px 16px', background:'transparent', border:'1px solid rgba(255,140,0,0.2)', borderRadius:7, color:'rgba(255,140,0,0.6)', cursor:'pointer', fontFamily:'inherit', fontSize:16 }}>↻</button>}
          </div>
        </div>
        {error&&<div style={{ marginTop:10, fontSize:12, color:R }}>Error: {error}</div>}
      </Card>

      {portfolio && (
        <Card accent>
          <div style={{ display:'flex', flexDirection:isMobile?'column':'row', justifyContent:'space-between', alignItems:isMobile?'flex-start':'center', gap:14 }}>
            <div>
              <div style={{ fontSize:10, color:'rgba(255,140,0,0.55)', marginBottom:4, letterSpacing:'0.15em' }}>WALLET</div>
              <div style={{ fontSize:12, color:G }}>{activeAddr.slice(0,10)}…{activeAddr.slice(-6)}</div>
            </div>
            <div>
              <div style={{ fontSize:10, color:'rgba(255,140,0,0.55)', marginBottom:4, letterSpacing:'0.15em' }}>VALOR TOTAL</div>
              <div style={{ fontSize:isMobile?26:32, color:G, fontWeight:700 }}>{fmt(portfolio.total_usd_value)}</div>
            </div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}><Dot/><span style={{ fontSize:11, color:'rgba(255,140,0,0.7)' }}>DEBANK LIVE</span></div>
              <div style={{ fontSize:10, color:DIM }}>{tokens.filter(t=>t.amount*t.price>1).length} tokens · {protocols.length} protocolos</div>
            </div>
          </div>
        </Card>
      )}

      {(tokens.length>0||protocols.length>0||history.length>0) && (
        <>
          <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
            {[['tokens','TOKENS'],['protocols','PROTOCOLOS'],['history','HISTORIAL']].map(([id,label])=>(
              <button key={id} onClick={()=>setWalletTab(id)} style={{ padding:'8px 16px', fontSize:11, fontWeight:walletTab===id?700:400, fontFamily:'inherit', background:walletTab===id?'rgba(255,140,0,0.12)':'transparent', color:walletTab===id?G:'rgba(255,140,0,0.4)', border:`1px solid ${walletTab===id?'rgba(255,140,0,0.4)':'rgba(255,140,0,0.1)'}`, borderRadius:5, cursor:'pointer', whiteSpace:'nowrap' }}>
                {label}
              </button>
            ))}
          </div>

          {walletTab==='tokens'&&tokens.length>0&&(
            <Card>
              <CT>TOKENS EN WALLET</CT>
              {isMobile ? (
                tokens.filter(t=>t.amount*t.price>1).sort((a,b)=>b.amount*b.price-a.amount*a.price).map((t,i)=>{
                  const val=t.amount*t.price
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', borderBottom:'1px solid rgba(255,140,0,0.07)' }}>
                      {t.logo_url&&<img src={t.logo_url} alt={t.symbol} style={{ width:26,height:26,borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>}
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <span style={{ fontWeight:700, fontSize:13 }}>{t.symbol}</span>
                          <span style={{ fontWeight:700, fontSize:13, color:G }}>{fmt(val)}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
                          <span style={{ fontSize:10, color:DIM }}>{t.amount.toFixed(4)} · ${t.price.toFixed(2)}</span>
                          <Badge label={t.chain?.toUpperCase()||'ETH'}/>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>{['TOKEN','CHAIN','CANTIDAD','PRECIO','VALOR','%'].map((h,i)=><th key={i} style={{ ...thS, textAlign:i>1?'right':'left' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {tokens.filter(t=>t.amount*t.price>1).sort((a,b)=>b.amount*b.price-a.amount*a.price).map((t,i)=>{
                      const val=t.amount*t.price
                      return (
                        <tr key={i}>
                          <td style={tdS()}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              {t.logo_url&&<img src={t.logo_url} alt={t.symbol} style={{ width:20,height:20,borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>}
                              <span style={{ fontWeight:700 }}>{t.symbol}</span>
                            </div>
                          </td>
                          <td style={tdS()}><Badge label={t.chain?.toUpperCase()||'ETH'}/></td>
                          <td style={tdS(true,DIM)}>{t.amount<0.001?t.amount.toExponential(2):t.amount.toFixed(4)}</td>
                          <td style={tdS(true,DIM)}>${t.price.toFixed(4)}</td>
                          <td style={tdS(true,G,true)}>{fmt(val)}</td>
                          <td style={tdS(true,DIM)}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6 }}>
                              <div style={{ width:40,height:3,background:'rgba(255,255,255,0.08)',borderRadius:2 }}>
                                <div style={{ width:`${Math.min((val/totalVal)*100,100)}%`,height:'100%',background:G,borderRadius:2 }}/>
                              </div>
                              {((val/totalVal)*100).toFixed(1)}%
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {walletTab==='protocols'&&protocols.length>0&&(
            <Card>
              <CT>POSICIONES DeFi</CT>
              {protocols.sort((a,b)=>(b.portfolio_item_list?.reduce((s,x)=>s+(x.stats?.net_usd_value||0),0)||0)-(a.portfolio_item_list?.reduce((s,x)=>s+(x.stats?.net_usd_value||0),0)||0)).map((proto,i)=>{
                const val=proto.portfolio_item_list?.reduce((s,x)=>s+(x.stats?.net_usd_value||0),0)||0
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:'1px solid rgba(255,140,0,0.07)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {proto.logo_url&&<img src={proto.logo_url} alt={proto.name} style={{ width:22,height:22,borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>}
                      <div>
                        <div style={{ fontWeight:700, fontSize:13 }}>{proto.name}</div>
                        <Badge label={proto.chain?.toUpperCase()||'ETH'}/>
                      </div>
                    </div>
                    <div style={{ fontWeight:700, fontSize:14, color:G }}>{fmt(val)}</div>
                  </div>
                )
              })}
            </Card>
          )}

          {walletTab==='history'&&(
            <Card>
              <CT>HISTORIAL DE TRANSACCIONES</CT>
              {history.length===0 ? (
                <div style={{ textAlign:'center', padding:28, color:DIM, fontSize:12 }}>Sin historial disponible</div>
              ) : history.slice(0,25).map((tx,i)=>{
                const val=tx.sends?.reduce((s,x)=>s+(x.amount*x.price||0),0)||0
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,140,0,0.06)', gap:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Badge label={tx.tx?.name||'TX'} color={G}/>
                      <div>
                        <div style={{ fontSize:11, color:WHITE }}>{tx.tx?.name||'Transacción'}</div>
                        <div style={{ fontSize:10, color:DIM }}><Badge label={tx.chain?.toUpperCase()||'ETH'}/></div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:12, fontWeight:700, color:val>0?G:DIM }}>{val>0?fmt(val):'—'}</div>
                      <div style={{ fontSize:10, color:DIM }}>{timeAgo(tx.time_at)}</div>
                    </div>
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

// ── APP PRINCIPAL ─────────────────────────────────────────────
export default function App() {
  const [tab, setTab]   = useState('overview')
  const [time, setTime] = useState(new Date())
  const [menuOpen, setMenuOpen] = useState(false)

  // Detectar móvil
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(()=>{
    const handler = ()=>setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return ()=>window.removeEventListener('resize', handler)
  },[])

  const { prices, loading, lastUpdate, wsStatus } = usePrices()
  const { stats }   = useGlobalStats()
  const { history } = useEthHistory()
  const { watchlist, extraCoins, toggle, clear } = useWatchlist()

  useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(t) },[])

  const TABS = [
    { id:'overview',  label:'OVERVIEW' },
    { id:'prices',    label:'PRECIOS · 500' },
    { id:'watchlist', label:`★ WATCHLIST${watchlist.length>0?` (${watchlist.length})`:''}` },
    { id:'wallet',    label:'WALLET' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body { background:${BG}; overflow-x:hidden; }
        @keyframes ping { 75%,100%{ transform:scale(2); opacity:0; } }
        tr:hover td { background:rgba(255,140,0,0.025); }
        input::placeholder { color:rgba(255,255,255,0.22); }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:${BG}; }
        ::-webkit-scrollbar-thumb { background:rgba(255,140,0,0.25); border-radius:4px; }
        button { touch-action:manipulation; }
      `}</style>

      <div style={{ minHeight:'100vh', background:BG, fontFamily:"'IBM Plex Mono',monospace", color:WHITE, position:'relative' }}>
        {/* Grid BG */}
        <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(255,140,0,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,140,0,0.02) 1px,transparent 1px)', backgroundSize:'40px 40px' }}/>
        <div style={{ position:'fixed', top:'-200px', left:'50%', transform:'translateX(-50%)', width:'600px', height:'400px', borderRadius:'50%', pointerEvents:'none', zIndex:0, background:'radial-gradient(ellipse,rgba(255,140,0,0.06) 0%,transparent 70%)' }}/>

        <div style={{ position:'relative', zIndex:1, maxWidth:1300, margin:'0 auto', padding:isMobile?'0 12px 80px':'0 24px 56px' }}>

          {/* HEADER */}
          <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:isMobile?'14px 0 16px':'22px 0 26px', borderBottom:'1px solid rgba(255,140,0,0.15)', marginBottom:isMobile?14:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:isMobile?34:40, height:isMobile?34:40, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:isMobile?18:20, fontWeight:900, color:BG, background:`linear-gradient(135deg,${G},#E67A00)` }}>₿</div>
              <div>
                <div style={{ fontSize:isMobile?13:16, fontWeight:700, letterSpacing:'0.15em', color:G }}>DEFI PULSE</div>
                <div style={{ fontSize:9, color:'rgba(255,140,0,0.45)', letterSpacing:'0.15em' }}>v5.0 · CEREBRO DeFi</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:isMobile?10:20 }}>
              <WsIndicator status={wsStatus} short={isMobile}/>
              {!isMobile && <div style={{ fontSize:12, color:'rgba(255,140,0,0.6)' }}>{time.toLocaleTimeString('es-CO')}</div>}
            </div>
          </header>

          {/* TABS DESKTOP */}
          {!isMobile && (
            <div style={{ display:'flex', gap:5, marginBottom:22 }}>
              {TABS.map(t=>{
                const active=tab===t.id
                return <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'9px 20px', fontSize:11, letterSpacing:'0.1em', fontWeight:active?700:400, fontFamily:'inherit', background:active?'rgba(255,140,0,0.15)':'transparent', color:active?G:'rgba(255,140,0,0.4)', border:`1px solid ${active?'rgba(255,140,0,0.45)':'rgba(255,140,0,0.12)'}`, borderRadius:5, cursor:'pointer', transition:'all 0.2s' }}>{t.label}</button>
              })}
            </div>
          )}

          {/* CONTENIDO */}
          {tab==='overview'  && <OverviewTab  prices={prices} stats={stats} history={history} wsStatus={wsStatus} isMobile={isMobile}/>}
          {tab==='prices'    && <PricesTab    prices={prices} loading={loading} lastUpdate={lastUpdate} wsStatus={wsStatus} watchlist={watchlist} onToggle={toggle} isMobile={isMobile}/>}
          {tab==='watchlist' && <WatchlistTab prices={prices} watchlist={watchlist} extraCoins={extraCoins} onToggle={toggle} onClear={clear} wsStatus={wsStatus} isMobile={isMobile}/>}
          {tab==='wallet'    && <WalletTab    isMobile={isMobile}/>}
        </div>

        {/* BOTTOM NAV — solo móvil */}
        {isMobile && (
          <nav style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:100, background:'rgba(13,13,13,0.97)', backdropFilter:'blur(12px)', borderTop:'1px solid rgba(255,140,0,0.15)', display:'flex', padding:'8px 0 max(8px, env(safe-area-inset-bottom))' }}>
            {TABS.map(t=>{
              const active=tab===t.id
              const icons = { overview:'◈', prices:'◉', watchlist:'★', wallet:'◎' }
              return (
                <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', padding:'6px 0', color:active?G:'rgba(255,140,0,0.35)', fontFamily:'inherit' }}>
                  <span style={{ fontSize:20 }}>{icons[t.id]}</span>
                  <span style={{ fontSize:9, letterSpacing:'0.08em', fontWeight:active?700:400 }}>
                    {t.id==='watchlist'&&watchlist.length>0?`★(${watchlist.length})`:t.label.split('·')[0].trim()}
                  </span>
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </>
  )
}
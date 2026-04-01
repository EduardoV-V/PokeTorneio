import React, { useState, useEffect, useRef, useCallback } from 'react'
import { TYPE_COLORS, POKEMON_TYPES, GENERATIONS } from '../utils/data.js'
import './PokemonPicker.css'
 
const BASE_URL = 'https://pokeapi.co/api/v2'
const PAGE_SIZE = 24
 
// Cache global para evitar refetch
const cache = {}
 
async function cachedFetch(url, signal) {
  if (cache[url]) return cache[url]
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  cache[url] = data
  return data
}
 
function extractId(url) {
  const parts = url.replace(/\/$/, '').split('/')
  return parseInt(parts[parts.length - 1])
}
 
export function formatName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
 
function formatPokemon(data) {
  return {
    id: data.id,
    name: data.name,
    sprite: data.sprites?.front_default || '',
    types: data.types?.map(t => t.type.name) || [],
  }
}
 
async function fetchBatch(ids, signal) {
  const results = await Promise.allSettled(
    ids.map(id => cachedFetch(`${BASE_URL}/pokemon/${id}`, signal).then(formatPokemon))
  )
  return results.filter(r => r.status === 'fulfilled').map(r => r.value)
}
 
async function checkHasMega(pokemonName) {
  const baseName = pokemonName.split('-')[0]
  const ctrl = new AbortController()
  try {
    await cachedFetch(`${BASE_URL}/pokemon/${baseName}-mega`, ctrl.signal)
    return true
  } catch {
    try {
      await cachedFetch(`${BASE_URL}/pokemon/${baseName}-mega-x`, ctrl.signal)
      return true
    } catch {
      return false
    }
  }
}
 
export default function PokemonPicker({ onSelect, onClose, megaMode = false }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [genFilter, setGenFilter] = useState('')
  const [pokemon, setPokemon] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)
  const [checkingMega, setCheckingMega] = useState(null)
 
  const abortRef = useRef(null)
  const loaderRef = useRef(null)
  const stateRef = useRef({ search: '', typeFilter: '', genFilter: '', page: 0, loading: false, hasMore: true })
 
  const doLoad = useCallback(async ({ search: s, typeFilter: tf, genFilter: gf, page: pg, append }) => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
 
    stateRef.current.loading = true
    setLoading(true)
 
    try {
      let results = []
      let more = false
      let tot = 0

      if (s.trim()) {
        const query = s.trim().toLowerCase()

        // 🔥 busca lista completa (cacheado depois da primeira vez)
        const listData = await cachedFetch(`${BASE_URL}/pokemon?limit=1025`, ctrl.signal)

        let filtered = listData.results.filter(p =>
          p.name.startsWith(query)
        )

        // filtro por geração também
        if (gf !== '') {
          const gen = GENERATIONS[parseInt(gf)]
          filtered = filtered.filter(p => {
            const id = extractId(p.url)
            return id >= gen.min && id <= gen.max
          })
        }

        tot = filtered.length

        const pageSlice = filtered.slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE)
        more = (pg + 1) * PAGE_SIZE < filtered.length

        const ids = pageSlice.map(p => extractId(p.url))
        results = await fetchBatch(ids, ctrl.signal)
 
      } else if (tf) {
        const typeData = await cachedFetch(`${BASE_URL}/type/${tf}`, ctrl.signal)
        let ids = typeData.pokemon.map(p => extractId(p.pokemon.url)).filter(id => id <= 1025)
        if (gf !== '') {
          const gen = GENERATIONS[parseInt(gf)]
          ids = ids.filter(id => id >= gen.min && id <= gen.max)
        }
        tot = ids.length
        const pageIds = ids.slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE)
        more = (pg + 1) * PAGE_SIZE < ids.length
        results = await fetchBatch(pageIds, ctrl.signal)
 
      } else if (gf !== '') {
        const gen = GENERATIONS[parseInt(gf)]
        tot = gen.max - gen.min + 1
        const allIds = Array.from({ length: tot }, (_, i) => gen.min + i)
        const pageIds = allIds.slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE)
        more = (pg + 1) * PAGE_SIZE < tot
        results = await fetchBatch(pageIds, ctrl.signal)
 
      } else {
        const offset = pg * PAGE_SIZE
        const listData = await cachedFetch(`${BASE_URL}/pokemon?limit=${PAGE_SIZE}&offset=${offset}`, ctrl.signal)
        tot = listData.count
        more = offset + PAGE_SIZE < listData.count
        const ids = listData.results.map(p => extractId(p.url))
        results = await fetchBatch(ids, ctrl.signal)
      }
 
      if (!ctrl.signal.aborted) {
        setTotal(tot)
        stateRef.current.hasMore = more
        setHasMore(more)
        setPokemon(prev => append ? [...prev, ...results] : results)
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e)
    } finally {
      if (!ctrl.signal.aborted) {
        stateRef.current.loading = false
        setLoading(false)
      }
    }
  }, [])
 
  // Carga inicial UMA vez
  useEffect(() => {
    doLoad({ search: '', typeFilter: '', genFilter: '', page: 0, append: false })
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
 
  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && stateRef.current.hasMore && !stateRef.current.loading) {
        const s = stateRef.current
        const nextPage = s.page + 1
        stateRef.current.page = nextPage
        doLoad({ search: s.search, typeFilter: s.typeFilter, genFilter: s.genFilter, page: nextPage, append: true })
      }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [doLoad])
 
  const applyFilters = useCallback((patch) => {
    const next = { ...stateRef.current, ...patch, page: 0 }
    stateRef.current = { ...next, loading: false, hasMore: true }
    setHasMore(true)
    setPokemon([])
    doLoad({ ...next, append: false })
  }, [doLoad])
 
  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearch(val)
    applyFilters({ search: val })
  }
 
  const handleTypeChange = (e) => {
    const val = e.target.value
    setTypeFilter(val)
    applyFilters({ typeFilter: val })
  }
 
  const handleGenChange = (e) => {
    const val = e.target.value
    setGenFilter(val)
    applyFilters({ genFilter: val })
  }
 
  const handlePokemonClick = async (p) => {
    if (!megaMode) { onSelect(p); return }
    setCheckingMega(p.id)
    const hasMega = await checkHasMega(p.name)
    setCheckingMega(null)
    if (hasMega) {
      onSelect({ ...p, isMegaCandidate: true })
    } else {
      alert(`${formatName(p.name)} não possui Mega Evolução disponível na PokéAPI.`)
    }
  }
 
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box picker-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="picker-header">
          <h2 className="picker-title">
            {megaMode ? '⚡ Escolher Mega Pokémon' : '🔍 Escolher Pokémon'}
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Fechar</button>
        </div>
 
        {megaMode && (
          <div className="mega-warning">
            ⚡ Apenas Pokémon com Mega Evolução podem ser selecionados. A verificação é feita automaticamente.
          </div>
        )}
 
        {total > 0 && <div className="picker-count">{total} Pokémon encontrados</div>}
 
        <div className="picker-filters">
          <input className="poke-input" placeholder="🔍 Buscar por nome..." value={search} onChange={handleSearchChange} />
          <select className="poke-select" value={typeFilter} onChange={handleTypeChange}>
            <option value="">Todos os tipos</option>
            {POKEMON_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <select className="poke-select" value={genFilter} onChange={handleGenChange}>
            <option value="">Todas as gerações</option>
            {GENERATIONS.map((g, i) => <option key={i} value={i}>{g.label}</option>)}
          </select>
        </div>
 
        <div className="picker-grid">
          {pokemon.map(p => (
            <button key={p.id} className={`poke-card ${checkingMega === p.id ? 'checking' : ''}`}
              onClick={() => handlePokemonClick(p)} disabled={checkingMega !== null}>
              {checkingMega === p.id && <div className="checking-overlay">⚡</div>}
              <img src={p.sprite} alt={p.name} className="poke-card-img" loading="lazy" />
              <div className="poke-card-id">#{String(p.id).padStart(3, '0')}</div>
              <div className="poke-card-name">{formatName(p.name)}</div>
              <div className="poke-card-types">
                {p.types.map(t => (
                  <span key={t} className="type-badge" style={{ background: TYPE_COLORS[t] || '#888' }}>{t}</span>
                ))}
              </div>
            </button>
          ))}
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div key={`sk-${i}`} className="poke-card skeleton-card">
              <div className="skeleton" style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 8px' }} />
              <div className="skeleton" style={{ width: '70%', height: 12, margin: '0 auto 6px' }} />
              <div className="skeleton" style={{ width: '50%', height: 10, margin: '0 auto' }} />
            </div>
          ))}
        </div>
 
        {!loading && pokemon.length === 0 && (
          <div className="picker-empty"><span>😕</span><p>Nenhum Pokémon encontrado</p></div>
        )}
 
        <div ref={loaderRef} style={{ height: 20 }} />
        {!hasMore && pokemon.length > 0 && <div className="picker-end">— Fim da lista —</div>}
      </div>
    </div>
  )
}
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { TYPE_COLORS, POKEMON_TYPES, GENERATIONS } from '../utils/data.js'
import './PokemonPicker.css'

const BASE_URL = 'https://pokeapi.co/api/v2'
const PAGE_SIZE = 24

export default function PokemonPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [genFilter, setGenFilter] = useState('')
  const [pokemon, setPokemon] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)
  const loaderRef = useRef(null)
  const abortRef = useRef(null)

  // Load list of pokemon IDs based on filters
  useEffect(() => {
    setPokemon([])
    setPage(0)
    setHasMore(true)
  }, [search, typeFilter, genFilter])

  useEffect(() => {
    loadPage()
  }, [page, search, typeFilter, genFilter])

  const loadPage = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    try {
      let results = []

      if (search.trim()) {
        // Search by name
        const name = search.trim().toLowerCase()
        try {
          const res = await fetch(`${BASE_URL}/pokemon/${name}`, { signal: ctrl.signal })
          if (res.ok) {
            const data = await res.json()
            results = [formatPokemon(data)]
          }
          setHasMore(false)
          setTotal(results.length)
        } catch { results = []; setHasMore(false); setTotal(0) }
      } else if (typeFilter) {
        // Filter by type
        const res = await fetch(`${BASE_URL}/type/${typeFilter}`, { signal: ctrl.signal })
        const data = await res.json()
        let ids = data.pokemon.map(p => extractId(p.pokemon.url))
        if (genFilter) {
          const gen = GENERATIONS[parseInt(genFilter)]
          ids = ids.filter(id => id >= gen.min && id <= gen.max)
        }
        setTotal(ids.length)
        const pageIds = ids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
        setHasMore((page + 1) * PAGE_SIZE < ids.length)
        results = await fetchBatch(pageIds, ctrl.signal)
      } else if (genFilter) {
        const gen = GENERATIONS[parseInt(genFilter)]
        const count = gen.max - gen.min + 1
        setTotal(count)
        const allIds = Array.from({ length: count }, (_, i) => gen.min + i)
        const pageIds = allIds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
        setHasMore((page + 1) * PAGE_SIZE < count)
        results = await fetchBatch(pageIds, ctrl.signal)
      } else {
        // All pokemon paginated
        const offset = page * PAGE_SIZE
        const res = await fetch(`${BASE_URL}/pokemon?limit=${PAGE_SIZE}&offset=${offset}`, { signal: ctrl.signal })
        const data = await res.json()
        setTotal(data.count)
        setHasMore(offset + PAGE_SIZE < data.count)
        const ids = data.results.map(p => extractId(p.url))
        results = await fetchBatch(ids, ctrl.signal)
      }

      setPokemon(prev => page === 0 ? results : [...prev, ...results])
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, search, typeFilter, genFilter])

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setPage(p => p + 1)
      }
    }, { threshold: 0.1 })
    obs.observe(loaderRef.current)
    return () => obs.disconnect()
  }, [hasMore, loading])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box picker-modal">
        {/* Header */}
        <div className="picker-header">
          <h2 className="picker-title">🔍 Escolher Pokémon</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Fechar</button>
        </div>

        {total > 0 && <div className="picker-count">{total} Pokémon encontrados</div>}

        {/* Filters */}
        <div className="picker-filters">
          <input
            className="poke-input"
            placeholder="🔍 Buscar por nome..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); setPokemon([]); setHasMore(true) }}
          />
          <select
            className="poke-select"
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(0); setPokemon([]); setHasMore(true) }}
          >
            <option value="">Todos os tipos</option>
            {POKEMON_TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <select
            className="poke-select"
            value={genFilter}
            onChange={e => { setGenFilter(e.target.value); setPage(0); setPokemon([]); setHasMore(true) }}
          >
            <option value="">Todas as gerações</option>
            {GENERATIONS.map((g, i) => (
              <option key={i} value={i}>{g.label}</option>
            ))}
          </select>
        </div>

        {/* Grid */}
        <div className="picker-grid">
          {pokemon.map(p => (
            <button key={p.id} className="poke-card" onClick={() => onSelect(p)}>
              <img
                src={p.sprite}
                alt={p.name}
                className="poke-card-img"
                loading="lazy"
              />
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
            <div key={`skel-${i}`} className="poke-card skeleton-card">
              <div className="skeleton" style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 8px' }} />
              <div className="skeleton" style={{ width: '70%', height: 12, margin: '0 auto 6px' }} />
              <div className="skeleton" style={{ width: '50%', height: 10, margin: '0 auto' }} />
            </div>
          ))}
        </div>

        {!loading && pokemon.length === 0 && (
          <div className="picker-empty">
            <span>😕</span>
            <p>Nenhum Pokémon encontrado</p>
          </div>
        )}

        <div ref={loaderRef} style={{ height: 20 }} />

        {!hasMore && pokemon.length > 0 && (
          <div className="picker-end">— Fim da lista —</div>
        )}
      </div>
    </div>
  )
}

// Helpers
function extractId(url) {
  const parts = url.replace(/\/$/, '').split('/')
  return parseInt(parts[parts.length - 1])
}

async function fetchBatch(ids, signal) {
  const results = await Promise.allSettled(
    ids.map(id => fetch(`https://pokeapi.co/api/v2/pokemon/${id}`, { signal }).then(r => r.json()))
  )
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => formatPokemon(r.value))
}

function formatPokemon(data) {
  return {
    id: data.id,
    name: data.name,
    sprite: data.sprites?.front_default || data.sprites?.other?.['official-artwork']?.front_default || '',
    types: data.types?.map(t => t.type.name) || [],
  }
}

function formatName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

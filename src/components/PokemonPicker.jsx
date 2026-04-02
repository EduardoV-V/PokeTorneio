import React, { useState, useEffect, useRef, useCallback } from 'react'
import { TYPE_COLORS, POKEMON_TYPES, GENERATIONS } from '../utils/data.js'
import './PokemonPicker.css'

const BASE_URL = 'https://pokeapi.co/api/v2'
const PAGE_SIZE = 24

// ─── Cache global ────────────────────────────────────────────────────────────
const cache = {}

async function cachedFetch(url, signal) {
  if (cache[url]) return cache[url]
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  cache[url] = data
  return data
}

// Cache separado para resultado de hasMega (true/false por nome)
const megaCache = {}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

async function fetchBatchByName(names, signal) {
  const results = await Promise.allSettled(
    names.map(name => cachedFetch(`${BASE_URL}/pokemon/${name}`, signal).then(formatPokemon))
  )
  return results.filter(r => r.status === 'fulfilled').map(r => r.value)
}

// Lista base para busca por nome e navegação sem filtros (sem formas alternativas de ID > 10000)
async function fetchFullPokemonList(signal) {
  const key = '__full_list__'
  if (cache[key]) return cache[key]
  const data = await cachedFetch(`${BASE_URL}/pokemon?limit=1500`, signal)
  cache[key] = data.results
  return data.results
}

// Lista de um tipo — usa o endpoint /type diretamente, fonte de verdade
// Retorna array de { name, url } ordenado por ID (formas alt têm ID > 10000 e vão pro final)
async function fetchTypeList(type, signal) {
  const key = `__type_${type}__`
  if (cache[key]) return cache[key]
  const data = await cachedFetch(`${BASE_URL}/type/${type}`, signal)
  const list = data.pokemon
    .map(p => ({ name: p.pokemon.name, url: p.pokemon.url }))
    .sort((a, b) => extractId(a.url) - extractId(b.url))
  cache[key] = list
  return list
}

// Verifica se um pokémon tem mega evolução
async function checkHasMega(pokemonName) {
  const baseName = pokemonName.split('-')[0]
  if (megaCache[baseName] !== undefined) return megaCache[baseName]

  const ctrl = new AbortController()
  try {
    await cachedFetch(`${BASE_URL}/pokemon/${baseName}-mega`, ctrl.signal)
    megaCache[baseName] = true
    return true
  } catch {
    try {
      await cachedFetch(`${BASE_URL}/pokemon/${baseName}-mega-x`, ctrl.signal)
      megaCache[baseName] = true
      return true
    } catch {
      megaCache[baseName] = false
      return false
    }
  }
}

// Pré-verifica mega para um lote de pokémon em paralelo
async function prefetchMegaFlags(pokemonList) {
  await Promise.allSettled(pokemonList.map(p => checkHasMega(p.name)))
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function PokemonPicker({ onSelect, onClose, megaMode = false }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [genFilter, setGenFilter] = useState('')
  const [pokemon, setPokemon] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)
  // megaMode: map de name → true/false/undefined(loading)
  const [megaFlags, setMegaFlags] = useState({})
  const [selectingMega, setSelectingMega] = useState(null) // id sendo confirmado

  const abortRef = useRef(null)
  const loaderRef = useRef(null)
  const stateRef = useRef({ search: '', typeFilter: '', genFilter: '', page: 0, loading: false, hasMore: true })

  // Quando carrega novos pokémon em megaMode, pré-verifica as megas em background
  const updateMegaFlags = useCallback(async (list) => {
    if (!megaMode) return
    // Marca como "verificando" (undefined = ainda não sabe)
    const checking = Object.fromEntries(
      list.filter(p => megaCache[p.name.split('-')[0]] === undefined).map(p => [p.name, undefined])
    )
    if (Object.keys(checking).length > 0) {
      setMegaFlags(prev => ({ ...prev, ...checking }))
    }

    await prefetchMegaFlags(list)

    const flags = Object.fromEntries(list.map(p => [p.name, megaCache[p.name.split('-')[0]] ?? false]))
    setMegaFlags(prev => ({ ...prev, ...flags }))
  }, [megaMode])

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
        // ── BUSCA POR NOME ──────────────────────────────────────────────────
        // Usa includes() para pegar formas alternativas (ex: aegislash-sword)
        const query = s.trim().toLowerCase()
        const fullList = await fetchFullPokemonList(ctrl.signal)

        let filtered = fullList.filter(p => p.name.includes(query))

        // Filtro adicional por geração
        if (gf !== '') {
          const gen = GENERATIONS[parseInt(gf)]
          filtered = filtered.filter(p => {
            const id = extractId(p.url)
            return id >= gen.min && id <= gen.max
          })
        }

        // Filtro adicional por tipo: busca os dados reais e verifica
        if (tf) {
          const batchData = await fetchBatchByName(filtered.map(p => p.name), ctrl.signal)
          const withType = batchData.filter(p => p.types.includes(tf))
          tot = withType.length
          results = withType.slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE)
          more = (pg + 1) * PAGE_SIZE < withType.length
        } else {
          tot = filtered.length
          const pageSlice = filtered.slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE)
          more = (pg + 1) * PAGE_SIZE < filtered.length
          results = await fetchBatchByName(pageSlice.map(p => p.name), ctrl.signal)
        }

      } else if (tf) {
        // ── FILTRO POR TIPO ─────────────────────────────────────────────────
        // Usa o endpoint /type diretamente — fonte de verdade completa,
        // inclui formas alternativas com IDs > 10000 que não aparecem na lista base.
        let typeList = await fetchTypeList(tf, ctrl.signal)

        // Filtro adicional por geração (só funciona para IDs normais ≤ 1025)
        if (gf !== '') {
          const gen = GENERATIONS[parseInt(gf)]
          typeList = typeList.filter(p => {
            const id = extractId(p.url)
            // IDs > 10000 são formas alternativas — inclui todas se não há filtro de gen
            return id > 10000 || (id >= gen.min && id <= gen.max)
          })
        }

        tot = typeList.length
        const pageSlice = typeList.slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE)
        more = (pg + 1) * PAGE_SIZE < typeList.length
        // Busca pelos nomes (não IDs) para pegar o sprite e tipos corretos
        results = await fetchBatchByName(pageSlice.map(p => p.name), ctrl.signal)

      } else if (gf !== '') {
        // ── FILTRO SÓ POR GERAÇÃO ───────────────────────────────────────────
        const gen = GENERATIONS[parseInt(gf)]
        tot = gen.max - gen.min + 1
        const allIds = Array.from({ length: tot }, (_, i) => gen.min + i)
        const pageIds = allIds.slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE)
        more = (pg + 1) * PAGE_SIZE < tot
        results = await fetchBatch(pageIds, ctrl.signal)

      } else {
        // ── SEM FILTRO — paginação padrão ───────────────────────────────────
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
        setPokemon(prev => {
          const next = append ? [...prev, ...results] : results
          return next
        })
        // Pré-verifica megas em background sem bloquear o render
        updateMegaFlags(results)
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e)
    } finally {
      if (!ctrl.signal.aborted) {
        stateRef.current.loading = false
        setLoading(false)
      }
    }
  }, [updateMegaFlags])

  // Carga inicial
  useEffect(() => {
    doLoad({ search: '', typeFilter: '', genFilter: '', page: 0, append: false })
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll
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

    // Se já sabe que não tem mega, ignora
    if (megaFlags[p.name] === false) return

    setSelectingMega(p.id)
    const hasMega = await checkHasMega(p.name)
    setMegaFlags(prev => ({ ...prev, [p.name]: hasMega }))
    setSelectingMega(null)

    if (hasMega) {
      onSelect({ ...p, isMegaCandidate: true })
    } else {
      alert(`${formatName(p.name)} não possui Mega Evolução disponível na PokéAPI.`)
    }
  }

  // Em megaMode: determina estado do card
  const getMegaState = (p) => {
    if (!megaMode) return { disabled: false, dimmed: false, checking: false }
    const flag = megaFlags[p.name]
    return {
      disabled: flag === false || selectingMega !== null,
      dimmed: flag === false,
      checking: selectingMega === p.id || flag === undefined,
      hasMega: flag === true,
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
            ⚡ Apenas Pokémon com Mega Evolução podem ser selecionados. Pokémon sem mega aparecem desabilitados.
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
          {pokemon.map(p => {
            const { disabled, dimmed, checking, hasMega } = getMegaState(p)
            return (
              <button
                key={`${p.id}-${p.name}`}
                className={[
                  'poke-card',
                  dimmed ? 'no-mega' : '',
                  checking ? 'checking' : '',
                  hasMega ? 'has-mega' : '',
                ].join(' ')}
                onClick={() => handlePokemonClick(p)}
                disabled={disabled}
                title={megaMode && dimmed ? `${formatName(p.name)} não tem Mega Evolução` : ''}
              >
                {checking && selectingMega === p.id && <div className="checking-overlay">⚡</div>}
                {megaMode && hasMega && <div className="mega-available-badge">⚡ MEGA</div>}
                <img src={p.sprite} alt={p.name} className="poke-card-img" loading="lazy" />
                <div className="poke-card-id">#{String(p.id).padStart(3, '0')}</div>
                <div className="poke-card-name">{formatName(p.name)}</div>
                <div className="poke-card-types">
                  {p.types.map(t => (
                    <span key={t} className="type-badge" style={{ background: TYPE_COLORS[t] || '#888' }}>{t}</span>
                  ))}
                </div>
              </button>
            )
          })}
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
import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { supabase } from '../utils/supabase.js'
import {
  fetchPlayers,
  fetchTeams, fetchMegaSlots,
  upsertSlot, clearTeam as dbClearTeam,
  setMegaSlot as dbSetMegaSlot,
  upsertAllTeams,
} from '../utils/db.js'
import { TYPE_COLORS } from '../utils/data.js'
import PokemonPicker from '../components/PokemonPicker.jsx'
import './TeamsPage.css'

const TEAM_SIZE = 9
const BASE_URL = 'https://pokeapi.co/api/v2'

export function formatName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ─── Cache de formas mega ─────────────────────────────────────────────────────
// base-name → { megaForm: obj|null, baseForm: obj|null }
// baseForm é guardado junto para permitir reverter mesmo após reload
const megaCache = {}
const megaCacheListeners = new Set()
function notifyMegaCache() { megaCacheListeners.forEach(fn => fn()) }

async function loadMegaData(baseName) {
  if (baseName in megaCache) return megaCache[baseName]

  const tryFetch = async (slug) => {
    try {
      const res = await fetch(`${BASE_URL}/pokemon/${slug}`)
      if (!res.ok) return null
      const data = await res.json()
      return { id: data.id, name: data.name, sprite: data.sprites?.front_default || '', types: data.types?.map(t => t.type.name) || [] }
    } catch { return null }
  }

  const [baseForm, megaForm] = await Promise.all([
    tryFetch(baseName),
    tryFetch(`${baseName}-mega`).then(r => r ?? tryFetch(`${baseName}-mega-x`)),
  ])

  megaCache[baseName] = { baseForm, megaForm }
  notifyMegaCache()
  return megaCache[baseName]
}

// Dado um nome de pokémon (pode ser mega ou base), retorna o nome-base
function getBaseName(pokemonName) {
  if (!pokemonName) return null
  const n = pokemonName.toLowerCase()
  // remove sufixos de mega
  return n.replace(/-mega(-[xy])?$/, '')
}

// ─── Hook síncrono ────────────────────────────────────────────────────────────
// Lê o cache de forma síncrona. Nunca retorna undefined quando já tem dados.
// isCurrentlyMega: se true, o pokemon já é mega — sabemos que tem mega, retorna true direto.
function useMegaAvailable(pokemonName, isCurrentlyMega) {
  const base = getBaseName(pokemonName)

  const getSnapshot = useCallback(() => {
    // Se o slot já é mega, obviamente tem mega disponível — sem necessidade de cache
    if (isCurrentlyMega) return true
    if (!base) return false
    if (!(base in megaCache)) return undefined
    return megaCache[base].megaForm !== null
  }, [base, isCurrentlyMega])

  const subscribe = useCallback((cb) => {
    megaCacheListeners.add(cb)
    return () => megaCacheListeners.delete(cb)
  }, [])

  const available = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (!isCurrentlyMega && base && !(base in megaCache)) {
      loadMegaData(base)
    }
  }, [base, isCurrentlyMega])

  return available
}

// ─── PokemonSlot ──────────────────────────────────────────────────────────────

function PokemonSlot({ pokemon, slotIdx, teamMegaIdx, onSelect, onRemove, onSetMega, isLoadingMega }) {
  const isThisMega = teamMegaIdx === slotIdx
  // Passa isThisMega para o hook — se já é mega, retorna true sem checar cache
  const megaAvailable = useMegaAvailable(pokemon?.name, isThisMega)

  if (!pokemon) {
    return (
      <button className="pokemon-slot empty" onClick={onSelect}>
        <span className="slot-plus">+</span>
        <span className="slot-add-label">Adicionar</span>
      </button>
    )
  }

  return (
    <div className={`pokemon-slot filled ${isThisMega ? 'is-mega' : ''}`}>
      {isThisMega && <div className="mega-badge">MEGA ⚡</div>}
      <button className="slot-remove" onClick={onRemove} title="Remover">🗑</button>
      <div className="slot-inner">
        <img src={pokemon.sprite} alt={pokemon.name} className="slot-sprite" />
        <div className="slot-name">{formatName(pokemon.name)}</div>
        <div className="slot-types">
          {pokemon.types.map(t => (
            <span key={t} className="type-badge" style={{ background: TYPE_COLORS[t] || '#888' }}>{t}</span>
          ))}
        </div>
        <div className="slot-actions">
          {isLoadingMega ? (
            <span className="mega-loading-label">⏳ buscando...</span>
          ) : isThisMega ? (
            <button className="slot-action-btn unmega-btn" onClick={onSetMega}>✕ Reverter</button>
          ) : megaAvailable === true ? (
            <button className="slot-action-btn mega-btn" onClick={onSetMega}>⚡ Mega</button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── TeamsPage ────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const [players, setPlayersState] = useState(null)
  const [teams, setTeamsState] = useState(null)
  const [megaSlots, setMegaSlotsState] = useState(null)
  // originalPokemon: { [playerId]: { [slotIdx]: pokemon } }
  // Persiste só na sessão — para reverter após reload buscamos da API
  const [originalPokemon, setOriginalPokemon] = useState({})
  const [loading, setLoading] = useState(true)
  const [picker, setPicker] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [showReset, setShowReset] = useState(false)
  const [megaLoading, setMegaLoading] = useState(null)

  // ── initial load ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetchPlayers().then(async p => {
      if (cancelled) return
      const ids = p.map(x => x.id)
      const [t, m] = await Promise.all([fetchTeams(ids), fetchMegaSlots(ids)])
      if (cancelled) return
      setPlayersState(p)
      setTeamsState(t)
      setMegaSlotsState(m)
      setLoading(false)
    }).catch(err => {
      console.error('TeamsPage load error:', err)
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  // ── realtime: players ─────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel('teams-players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayers().then(setPlayersState).catch(console.error)
      }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ── realtime: teams ───────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel('teams-slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        if (!players) return
        const ids = players.map(x => x.id)
        Promise.all([fetchTeams(ids), fetchMegaSlots(ids)])
          .then(([t, m]) => { setTeamsState(t); setMegaSlotsState(m) })
          .catch(console.error)
      }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [players])

  const getTeam = useCallback((pid) => {
    const t = teams?.[pid]
    return (!t || t.length !== TEAM_SIZE) ? Array(TEAM_SIZE).fill(null) : t
  }, [teams])

  const getMegaSlot = useCallback((pid) => megaSlots?.[pid] ?? null, [megaSlots])

  // ── add pokemon ───────────────────────────────────────────
  const handleSelect = useCallback(async (pokemon) => {
    const { playerId, slotIdx } = picker
    setPicker(null)
    setTeamsState(prev => {
      const team = [...(prev[playerId] ?? Array(TEAM_SIZE).fill(null))]
      team[slotIdx] = pokemon
      return { ...prev, [playerId]: team }
    })
    try { await upsertSlot(playerId, slotIdx, pokemon) }
    catch (err) { console.error('upsertSlot error:', err) }
  }, [picker])

  // ── remove pokemon ────────────────────────────────────────
  const handleRemove = useCallback(async (playerId, slotIdx) => {
    setTeamsState(prev => {
      const team = [...(prev[playerId] ?? Array(TEAM_SIZE).fill(null))]
      team[slotIdx] = null
      return { ...prev, [playerId]: team }
    })
    setOriginalPokemon(prev => {
      if (!prev[playerId]) return prev
      const next = { ...prev, [playerId]: { ...prev[playerId] } }
      delete next[playerId][slotIdx]
      return next
    })
    if (megaSlots?.[playerId] === slotIdx) {
      setMegaSlotsState(prev => ({ ...prev, [playerId]: null }))
      try { await dbSetMegaSlot(playerId, null) } catch (err) { console.error(err) }
    }
    try { await upsertSlot(playerId, slotIdx, null) }
    catch (err) { console.error('upsertSlot (remove) error:', err) }
  }, [megaSlots])

  // ── set / unset mega ──────────────────────────────────────
  const handleSetMega = useCallback(async (playerId, slotIdx) => {
    const currentMega = megaSlots?.[playerId]
    const isUnsetting = currentMega === slotIdx

    // ── Reverter para forma base ──────────────────────────
    if (isUnsetting) {
      const team = getTeam(playerId)
      const currentPokemon = team[slotIdx]

      // Tenta pegar o original da sessão primeiro
      let orig = originalPokemon?.[playerId]?.[slotIdx]

      // Se não tem (após reload), busca da API usando o nome-base
      if (!orig && currentPokemon) {
        const base = getBaseName(currentPokemon.name)
        setMegaLoading({ playerId, slotIdx })
        const data = await loadMegaData(base)
        setMegaLoading(null)
        orig = data?.baseForm ?? null
      }

      if (orig) {
        setTeamsState(prev => {
          const t = [...(prev[playerId] ?? Array(TEAM_SIZE).fill(null))]
          t[slotIdx] = orig
          return { ...prev, [playerId]: t }
        })
        setOriginalPokemon(prev => {
          const next = { ...prev, [playerId]: { ...prev[playerId] } }
          delete next[playerId][slotIdx]
          return next
        })
        try { await upsertSlot(playerId, slotIdx, orig) } catch (err) { console.error(err) }
      }

      setMegaSlotsState(prev => ({ ...prev, [playerId]: null }))
      try { await dbSetMegaSlot(playerId, null) } catch (err) { console.error(err) }
      return
    }

    // ── Ativar mega ───────────────────────────────────────
    const team = getTeam(playerId)
    const basePokemon = team[slotIdx]
    if (!basePokemon) return

    const base = getBaseName(basePokemon.name)

    // Como useMegaAvailable já pré-carregou, loadMegaData retorna do cache
    setMegaLoading({ playerId, slotIdx })
    const data = await loadMegaData(base)
    setMegaLoading(null)

    const megaForm = data?.megaForm
    if (!megaForm) return

    // Guarda original da sessão
    setOriginalPokemon(prev => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? {}), [slotIdx]: basePokemon },
    }))

    // Remove original do mega antigo se havia outro
    if (currentMega !== null && currentMega !== slotIdx) {
      setOriginalPokemon(prev => {
        const next = { ...prev, [playerId]: { ...(prev[playerId] ?? {}) } }
        delete next[playerId][currentMega]
        return next
      })
    }

    // React 18 automatic batching — estes dois setStates viram 1 render
    setTeamsState(prev => {
      const t = [...(prev[playerId] ?? Array(TEAM_SIZE).fill(null))]
      t[slotIdx] = megaForm
      return { ...prev, [playerId]: t }
    })
    setMegaSlotsState(prev => ({ ...prev, [playerId]: slotIdx }))

    try {
      await upsertSlot(playerId, slotIdx, megaForm)
      await dbSetMegaSlot(playerId, slotIdx)
    } catch (err) { console.error('setMega error:', err) }
  }, [megaSlots, originalPokemon, getTeam])

  // ── clear team ────────────────────────────────────────────
  const handleClearTeam = useCallback(async (playerId) => {
    setTeamsState(prev => ({ ...prev, [playerId]: Array(TEAM_SIZE).fill(null) }))
    setMegaSlotsState(prev => ({ ...prev, [playerId]: null }))
    setOriginalPokemon(prev => ({ ...prev, [playerId]: {} }))
    try { await dbClearTeam(playerId) } catch (err) { console.error('clearTeam error:', err) }
  }, [])

  // ── reset all ─────────────────────────────────────────────
  const resetAllTeams = useCallback(async () => {
    const emptyTeams = Object.fromEntries((players ?? []).map(p => [p.id, Array(TEAM_SIZE).fill(null)]))
    const emptyMegas = Object.fromEntries((players ?? []).map(p => [p.id, null]))
    setTeamsState(emptyTeams)
    setMegaSlotsState(emptyMegas)
    setOriginalPokemon({})
    setShowReset(false)
    try { await upsertAllTeams(emptyTeams, emptyMegas) } catch (err) { console.error(err) }
  }, [players])

  if (loading || !players || !teams || !megaSlots) {
    return (
      <div className="teams-page">
        <div className="page-title"><span>👾</span><span>TIMES</span></div>
        <div className="loading-state">
          <div className="loading-pokeball">⚽</div>
          <p>Carregando times...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="teams-page">
      <div className="page-title"><span>👾</span><span>TIMES</span></div>
      <div className="teams-list">
        {players.map(player => {
          const team = getTeam(player.id)
          const count = team.filter(Boolean).length
          const isOpen = expanded === player.id
          const megaSlot = getMegaSlot(player.id)
          const megaPokemon = megaSlot !== null ? team[megaSlot] : null

          return (
            <div key={player.id} className={`player-team-card ${isOpen ? 'open' : ''}`}>
              <button className="player-team-header" onClick={() => setExpanded(isOpen ? null : player.id)}>
                <div className="player-team-info">
                  <div className="player-team-icon">
                    {player.icon
                      ? <img src={player.icon} alt={player.name} />
                      : <div className="team-icon-placeholder">{player.name[0]?.toUpperCase()}</div>
                    }
                  </div>
                  <div className="player-team-text">
                    <div className="player-team-name">{player.name}</div>
                    <div className="player-team-sub">
                      {count}/{TEAM_SIZE} Pokémon
                      {megaPokemon && <span className="header-mega-badge"> · ⚡ {formatName(megaPokemon.name)}</span>}
                    </div>
                  </div>
                </div>
                <div className="team-mini-preview">
                  {team.map((p, i) => (
                    <div key={i} className={`mini-slot ${megaSlot === i ? 'mini-mega' : ''}`}>
                      {p ? <img src={p.sprite} alt={p.name} className="mini-sprite" /> : <div className="mini-empty" />}
                    </div>
                  ))}
                </div>
                <div className="expand-icon">{isOpen ? '▲' : '▼'}</div>
              </button>

              {isOpen && (
                <div className="player-team-body">
                  <div className="mega-info-row">
                    <span className="mega-info-label">⚡ Mega Evolution: </span>
                    {megaPokemon
                      ? <span className="mega-info-value">{formatName(megaPokemon.name)}</span>
                      : <span className="mega-info-none">Não definido — passe o mouse sobre um Pokémon com ⚡ Mega</span>
                    }
                  </div>
                  <div className="team-slots-grid">
                    {team.map((pokemon, slotIdx) => (
                      <PokemonSlot
                        key={slotIdx}
                        pokemon={pokemon}
                        slotIdx={slotIdx}
                        teamMegaIdx={megaSlot}
                        onSelect={() => setPicker({ playerId: player.id, slotIdx })}
                        onRemove={() => handleRemove(player.id, slotIdx)}
                        onSetMega={() => handleSetMega(player.id, slotIdx)}
                        isLoadingMega={megaLoading?.playerId === player.id && megaLoading?.slotIdx === slotIdx}
                      />
                    ))}
                  </div>
                  <div className="team-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleClearTeam(player.id)}>
                      🗑️ Limpar time
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="reset-section" style={{ marginTop: 32, textAlign: 'center' }}>
        {!showReset
          ? <button className="btn btn-ghost btn-sm" onClick={() => setShowReset(true)}>🗑️ Limpar todos os times</button>
          : <div className="reset-confirm">
              <p>⚠️ Isso vai remover todos os Pokémon de todos os times. Continuar?</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <button className="btn btn-danger btn-sm" onClick={resetAllTeams}>Sim, limpar tudo</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowReset(false)}>Cancelar</button>
              </div>
            </div>
        }
      </div>

      {picker && <PokemonPicker onSelect={handleSelect} onClose={() => setPicker(null)} />}
    </div>
  )
}
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase.js'
import {
  fetchPlayers, upsertPlayer,
  fetchTeams, fetchMegaSlots,
  upsertSlot, clearTeam as dbClearTeam,
  setMegaSlot as dbSetMegaSlot,
  upsertAllTeams,
} from '../utils/db.js'
import { DEFAULT_PLAYERS, TYPE_COLORS } from '../utils/data.js'
import PokemonPicker from '../components/PokemonPicker.jsx'
import './TeamsPage.css'

const TEAM_SIZE = 9

function formatName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function PokemonSlot({ pokemon, slotIdx, teamMegaIdx, onSelect, onRemove, onSetMega }) {
  const isThisMega = teamMegaIdx === slotIdx

  if (pokemon) {
    return (
      <div className={`pokemon-slot filled ${isThisMega ? 'is-mega' : ''}`}>
        {isThisMega && <div className="mega-badge">MEGA ⚡</div>}
        <img src={pokemon.sprite} alt={pokemon.name} className="slot-sprite" />
        <div className="slot-name">{formatName(pokemon.name)}</div>
        <div className="slot-types">
          {pokemon.types.map(t => (
            <span key={t} className="type-badge" style={{ background: TYPE_COLORS[t] || '#888' }}>{t}</span>
          ))}
        </div>
        <div className="slot-actions">
          {!isThisMega && (
            <button className="slot-action-btn mega-btn" onClick={onSetMega} title="Definir como Mega">
              ⚡ Mega
            </button>
          )}
          {isThisMega && (
            <button className="slot-action-btn unmega-btn" onClick={onSetMega} title="Remover Mega">
              ✕ Mega
            </button>
          )}
          <button className="slot-remove" onClick={onRemove} title="Remover">🗑</button>
        </div>
      </div>
    )
  }

  return (
    <button className="pokemon-slot empty" onClick={onSelect}>
      <span className="slot-plus">+</span>
      <span className="slot-add-label">Adicionar</span>
    </button>
  )
}

export default function TeamsPage() {
  const [players, setPlayersState] = useState(null)
  const [teams, setTeamsState] = useState(null)       // { [playerId]: Array(9) }
  const [megaSlots, setMegaSlotsState] = useState(null) // { [playerId]: slotIdx | null }
  const [loading, setLoading] = useState(true)
  const [picker, setPicker] = useState(null)           // { playerId, slotIdx, megaMode }
  const [expanded, setExpanded] = useState(null)
  const [showReset, setShowReset] = useState(false)

  // ── initial load ─────────────────────────────────────────
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

  // ── realtime: players ────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('teams-players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayers().then(setPlayersState).catch(console.error)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ── realtime: teams ──────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('teams-slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        if (!players) return
        const ids = players.map(x => x.id)
        Promise.all([fetchTeams(ids), fetchMegaSlots(ids)])
          .then(([t, m]) => { setTeamsState(t); setMegaSlotsState(m) })
          .catch(console.error)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [players])

  // ── helpers ───────────────────────────────────────────────
  const getTeam = useCallback((playerId) => {
    const t = teams?.[playerId]
    if (!t || t.length !== TEAM_SIZE) return Array(TEAM_SIZE).fill(null)
    return t
  }, [teams])

  const getMegaSlot = useCallback((playerId) => megaSlots?.[playerId] ?? null, [megaSlots])

  // ── add pokemon ───────────────────────────────────────────
  const handleSelect = useCallback(async (pokemon) => {
    const { playerId, slotIdx } = picker
    setPicker(null)

    // optimistic update
    setTeamsState(prev => {
      const team = [...(prev[playerId] ?? Array(TEAM_SIZE).fill(null))]
      team[slotIdx] = pokemon
      return { ...prev, [playerId]: team }
    })

    try {
      await upsertSlot(playerId, slotIdx, pokemon)
    } catch (err) {
      console.error('upsertSlot error:', err)
    }
  }, [picker])

  // ── remove pokemon ────────────────────────────────────────
  const handleRemove = useCallback(async (playerId, slotIdx) => {
    // optimistic update
    setTeamsState(prev => {
      const team = [...(prev[playerId] ?? Array(TEAM_SIZE).fill(null))]
      team[slotIdx] = null
      return { ...prev, [playerId]: team }
    })

    // clear mega if it was this slot
    if (megaSlots?.[playerId] === slotIdx) {
      setMegaSlotsState(prev => ({ ...prev, [playerId]: null }))
      try { await dbSetMegaSlot(playerId, null) } catch (err) { console.error(err) }
    }

    try {
      await upsertSlot(playerId, slotIdx, null)
    } catch (err) {
      console.error('upsertSlot (remove) error:', err)
    }
  }, [megaSlots])

  // ── set mega ──────────────────────────────────────────────
  const handleSetMega = useCallback(async (playerId, slotIdx) => {
    const current = megaSlots?.[playerId]
    const next = current === slotIdx ? null : slotIdx

    setMegaSlotsState(prev => ({ ...prev, [playerId]: next }))

    try {
      await dbSetMegaSlot(playerId, next)
    } catch (err) {
      console.error('setMegaSlot error:', err)
    }
  }, [megaSlots])

  // ── clear team ────────────────────────────────────────────
  const handleClearTeam = useCallback(async (playerId) => {
    setTeamsState(prev => ({ ...prev, [playerId]: Array(TEAM_SIZE).fill(null) }))
    setMegaSlotsState(prev => ({ ...prev, [playerId]: null }))

    try {
      await dbClearTeam(playerId)
    } catch (err) {
      console.error('clearTeam error:', err)
    }
  }, [])

  // ── reset all ─────────────────────────────────────────────
  const resetAllTeams = useCallback(async () => {
    const emptyTeams = Object.fromEntries((players ?? []).map(p => [p.id, Array(TEAM_SIZE).fill(null)]))
    const emptyMegas = Object.fromEntries((players ?? []).map(p => [p.id, null]))
    setTeamsState(emptyTeams)
    setMegaSlotsState(emptyMegas)
    setShowReset(false)

    try {
      await upsertAllTeams(emptyTeams, emptyMegas)
    } catch (err) {
      console.error('resetAllTeams error:', err)
    }
  }, [players])

  // ── loading ───────────────────────────────────────────────
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
      <div className="page-title">
        <span>👾</span>
        <span>TIMES</span>
      </div>

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
                  <div>
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
                      : <span className="mega-info-none">Não definido — clique em "⚡ Mega" em um Pokémon</span>
                    }
                  </div>

                  <div className="team-slots-grid">
                    {team.map((pokemon, slotIdx) => (
                      <PokemonSlot
                        key={slotIdx}
                        pokemon={pokemon}
                        slotIdx={slotIdx}
                        teamMegaIdx={megaSlot}
                        onSelect={() => setPicker({ playerId: player.id, slotIdx, megaMode: false })}
                        onRemove={() => handleRemove(player.id, slotIdx)}
                        onSetMega={() => handleSetMega(player.id, slotIdx)}
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
          ? <button className="btn btn-ghost btn-sm" onClick={() => setShowReset(true)}>
              🗑️ Limpar todos os times
            </button>
          : <div className="reset-confirm">
              <p>⚠️ Isso vai remover todos os Pokémon de todos os times. Continuar?</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <button className="btn btn-danger btn-sm" onClick={resetAllTeams}>Sim, limpar tudo</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowReset(false)}>Cancelar</button>
              </div>
            </div>
        }
      </div>

      {picker && (
        <PokemonPicker
          onSelect={handleSelect}
          onClose={() => setPicker(null)}
          megaMode={picker.megaMode}
        />
      )}
    </div>
  )
}

import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { DEFAULT_PLAYERS, TYPE_COLORS } from '../utils/data.js'
import PokemonPicker from '../components/PokemonPicker.jsx'
import './TeamsPage.css'

const TEAM_SIZE = 9

function PokemonSlot({ pokemon, onSelect, onRemove }) {
  if (pokemon) {
    const name = formatName(pokemon.name)
    return (
      <div className="pokemon-slot filled">
        <img
          src={pokemon.sprite}
          alt={pokemon.name}
          className="slot-sprite"
        />
        <div className="slot-name">{name}</div>
        <div className="slot-types">
          {pokemon.types.map(t => (
            <span key={t} className="type-badge" style={{ background: TYPE_COLORS[t] || '#888' }}>{t}</span>
          ))}
        </div>
        <button className="slot-remove" onClick={onRemove} title="Remover">✕</button>
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

function formatName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default function TeamsPage() {
  const [players] = useLocalStorage('poke-players', DEFAULT_PLAYERS)
  const [teams, setTeams] = useLocalStorage('poke-teams', () =>
    Object.fromEntries(DEFAULT_PLAYERS.map(p => [p.id, Array(TEAM_SIZE).fill(null)]))
  )
  const [picker, setPicker] = useState(null) // { playerId, slotIdx }
  const [expanded, setExpanded] = useState(null)
  const [showReset, setShowReset] = useState(false)

  const openPicker = (playerId, slotIdx) => {
    setPicker({ playerId, slotIdx })
  }

  const handleSelect = (pokemon) => {
    const { playerId, slotIdx } = picker
    setTeams(prev => {
      const team = [...(prev[playerId] || Array(TEAM_SIZE).fill(null))]
      team[slotIdx] = pokemon
      return { ...prev, [playerId]: team }
    })
    setPicker(null)
  }

  const handleRemove = (playerId, slotIdx) => {
    setTeams(prev => {
      const team = [...(prev[playerId] || Array(TEAM_SIZE).fill(null))]
      team[slotIdx] = null
      return { ...prev, [playerId]: team }
    })
  }

  const clearTeam = (playerId) => {
    setTeams(prev => ({ ...prev, [playerId]: Array(TEAM_SIZE).fill(null) }))
  }

  const resetAllTeams = () => {
    setTeams(Object.fromEntries(players.map(p => [p.id, Array(TEAM_SIZE).fill(null)])))
    setShowReset(false)
  }

  const getTeam = (playerId) => {
    const t = teams[playerId]
    if (!t || t.length !== TEAM_SIZE) return Array(TEAM_SIZE).fill(null)
    return t
  }

  const countPokemon = (playerId) => getTeam(playerId).filter(Boolean).length

  return (
    <div className="teams-page">
      <div className="page-title">
        <span>👾</span>
        <span>TIMES</span>
      </div>

      <div className="teams-list">
        {players.map(player => {
          const team = getTeam(player.id)
          const count = countPokemon(player.id)
          const isOpen = expanded === player.id

          return (
            <div key={player.id} className={`player-team-card ${isOpen ? 'open' : ''}`}>
              {/* Player header */}
              <button
                className="player-team-header"
                onClick={() => setExpanded(isOpen ? null : player.id)}
              >
                <div className="player-team-info">
                  <div className="player-team-icon">
                    {player.icon
                      ? <img src={player.icon} alt={player.name} />
                      : <div className="team-icon-placeholder">{player.name[0]?.toUpperCase()}</div>
                    }
                  </div>
                  <div>
                    <div className="player-team-name">{player.name}</div>
                    <div className="player-team-sub">{count}/{TEAM_SIZE} Pokémon</div>
                  </div>
                </div>

                {/* Mini preview */}
                <div className="team-mini-preview">
                  {team.map((p, i) => (
                    <div key={i} className="mini-slot">
                      {p
                        ? <img src={p.sprite} alt={p.name} className="mini-sprite" />
                        : <div className="mini-empty" />
                      }
                    </div>
                  ))}
                </div>

                <div className="expand-icon">{isOpen ? '▲' : '▼'}</div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="player-team-body">
                  <div className="team-slots-grid">
                    {team.map((pokemon, slotIdx) => (
                      <PokemonSlot
                        key={slotIdx}
                        pokemon={pokemon}
                        onSelect={() => openPicker(player.id, slotIdx)}
                        onRemove={() => handleRemove(player.id, slotIdx)}
                      />
                    ))}
                  </div>
                  <div className="team-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => clearTeam(player.id)}>
                      🗑️ Limpar time
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Global reset */}
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

      {/* Picker modal */}
      {picker && (
        <PokemonPicker
          onSelect={handleSelect}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}

import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { DEFAULT_PLAYERS, DEFAULT_BRACKET } from '../utils/data.js'
import Standings from '../components/Standings.jsx'
import Bracket from '../components/Bracket.jsx'
import './TournamentPage.css'

export default function TournamentPage() {
  const [tab, setTab] = useState('standings')
  const [players, setPlayers] = useLocalStorage('poke-players', DEFAULT_PLAYERS)
  const [bracket, setBracket] = useLocalStorage('poke-bracket', DEFAULT_BRACKET)
  const [showReset, setShowReset] = useState(false)

  const handleReset = () => {
    setPlayers(DEFAULT_PLAYERS)
    setBracket(DEFAULT_BRACKET)
    setShowReset(false)
  }

  return (
    <div className="tournament-page">
      {/* Title */}
      <div className="page-title">
        <span>🏆</span>
        <span>TORNEIO</span>
      </div>

      {/* Tabs */}
      <div className="tabs-row">
        <button
          className={`tab-btn ${tab === 'standings' ? 'active' : ''}`}
          onClick={() => setTab('standings')}
        >
          📊 Pontos Corridos
        </button>
        <button
          className={`tab-btn ${tab === 'bracket' ? 'active' : ''}`}
          onClick={() => setTab('bracket')}
        >
          ⚡ Fase Eliminatória
        </button>
      </div>

      {/* Content */}
      <div className="tab-content">
        {tab === 'standings' && (
          <Standings players={players} setPlayers={setPlayers} />
        )}
        {tab === 'bracket' && (
          <Bracket players={players} bracket={bracket} setBracket={setBracket} />
        )}
      </div>

      {/* Reset section */}
      <div className="reset-section">
        {!showReset
          ? <button className="btn btn-ghost btn-sm" onClick={() => setShowReset(true)}>
              🗑️ Limpar progresso do torneio
            </button>
          : <div className="reset-confirm">
              <p>⚠️ Isso vai zerar todos os pontos, vitórias e a chave eliminatória. Continuar?</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <button className="btn btn-danger btn-sm" onClick={handleReset}>Sim, limpar tudo</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowReset(false)}>Cancelar</button>
              </div>
            </div>
        }
      </div>
    </div>
  )
}

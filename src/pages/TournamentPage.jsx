import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { DEFAULT_PLAYERS, DEFAULT_BRACKET } from '../utils/data.js'
import Standings from '../components/Standings.jsx'
import BracketVisual from '../components/BracketVisual.jsx'
import './TournamentPage.css'

export default function TournamentPage() {
  const [players, setPlayers] = useLocalStorage('poke-players', DEFAULT_PLAYERS)
  const [bracket, setBracket] = useLocalStorage('poke-bracket', null)
  const [showReset, setShowReset] = useState(false)

  // bracket === null → ainda na fase de pontos corridos
  const inBracket = bracket !== null

  const handleReset = () => {
    // Preserva nomes e ícones, zera apenas pontos e bracket
    setPlayers(prev => prev.map(p => ({ ...p, wins: 0, losses: 0 })))
    setBracket(null)
    setShowReset(false)
  }

  return (
    <div className="tournament-page">
      <div className="page-title">
        <span>🏆</span>
        <span>TORNEIO</span>
      </div>

      {!inBracket && (
        <>
          <div className="phase-label standings-phase">
            📊 Fase de Pontos Corridos
          </div>
          <div className="tab-content">
            <Standings players={players} setPlayers={setPlayers} onStartBracket={() => setBracket('init')} />
          </div>
        </>
      )}

      {inBracket && (
        <>
          <div className="phase-label bracket-phase">
            ⚡ Fase Eliminatória
          </div>
          <BracketVisual players={players} bracket={bracket} setBracket={setBracket} />
        </>
      )}

      <div className="reset-section">
        {!showReset
          ? <button className="btn btn-ghost btn-sm" onClick={() => setShowReset(true)}>
              🗑️ Limpar progresso do torneio
            </button>
          : <div className="reset-confirm">
              <p>⚠️ Isso vai zerar todos os pontos e a chave eliminatória. Os nomes dos jogadores serão mantidos. Continuar?</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <button className="btn btn-danger btn-sm" onClick={handleReset}>Sim, limpar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowReset(false)}>Cancelar</button>
              </div>
            </div>
        }
      </div>
    </div>
  )
}
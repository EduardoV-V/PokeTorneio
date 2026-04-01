import React, { useState } from 'react'
import { getTop4, buildBracketFromTop4 } from '../utils/data.js'
import './Bracket.css'

function PlayerCard({ player, onClick, selected, isWinner, isLoser, clickable }) {
  if (!player) {
    return <div className="bracket-slot empty">A definir...</div>
  }

  return (
    <div
      className={`bracket-slot ${selected ? 'selected' : ''} ${isWinner ? 'winner' : ''} ${isLoser ? 'loser' : ''} ${clickable ? 'clickable' : ''}`}
      onClick={clickable ? onClick : undefined}
      title={clickable ? `Avançar ${player.name}` : ''}
    >
      <div className="bracket-player-icon">
        {player.icon
          ? <img src={player.icon} alt={player.name} />
          : <div className="bracket-icon-placeholder">{player.name[0]?.toUpperCase()}</div>
        }
      </div>
      <span className="bracket-player-name">{player.name}</span>
      {isWinner && <span className="bracket-crown">👑</span>}
      {clickable && !isWinner && <span className="bracket-advance-hint">▶</span>}
    </div>
  )
}

function MatchBox({ match, onSelectWinner, showWinnerPicker, phase }) {
  return (
    <div className="match-box">
      <div className="match-label">{phase}</div>
      <PlayerCard
        player={match.p1}
        isWinner={match.winner?.id === match.p1?.id}
        isLoser={match.winner && match.winner?.id !== match.p1?.id}
        clickable={showWinnerPicker && !match.winner && match.p1}
        onClick={() => onSelectWinner(match.p1)}
      />
      <div className="match-vs">VS</div>
      <PlayerCard
        player={match.p2}
        isWinner={match.winner?.id === match.p2?.id}
        isLoser={match.winner && match.winner?.id !== match.p2?.id}
        clickable={showWinnerPicker && !match.winner && match.p2}
        onClick={() => onSelectWinner(match.p2)}
      />
      {match.winner && (
        <div className="match-winner-label">
          ✓ {match.winner.name} avança
        </div>
      )}
      {showWinnerPicker && !match.winner && match.p1 && match.p2 && (
        <div className="match-pick-hint">Clique no vencedor ▲</div>
      )}
    </div>
  )
}

export default function Bracket({ players, bracket, setBracket }) {
  const top4 = getTop4(players)

  const initBracket = () => {
    const newBracket = buildBracketFromTop4(players)
    setBracket(newBracket)
  }

  const setSemiWinner = (semiIdx, winner) => {
    setBracket(prev => {
      const semis = prev.semis.map((s, i) => i === semiIdx ? { ...s, winner } : s)
      // auto-advance to final if both semis done
      const allDone = semis.every(s => s.winner)
      return {
        ...prev,
        semis,
        final: allDone
          ? { p1: semis[0].winner, p2: semis[1].winner, winner: null }
          : prev.final,
        phase: allDone ? 'finals' : prev.phase,
      }
    })
  }

  const setFinalWinner = (winner) => {
    setBracket(prev => ({
      ...prev,
      final: { ...prev.final, winner },
      champion: winner,
      phase: 'done',
    }))
  }

  const resetBracket = () => {
    setBracket(buildBracketFromTop4(players))
  }

  if (!bracket || !bracket.semis[0].p1) {
    return (
      <div className="bracket-init-wrap">
        <div className="bracket-init-card">
          <div className="bracket-init-icon">🏆</div>
          <h2>Fase de Eliminação</h2>
          <p>Inicie a fase eliminatória com os <strong>4 melhores</strong> jogadores da fase de pontos corridos.</p>
          <div className="top4-preview">
            {top4.map((p, i) => (
              <div key={p.id} className="top4-preview-item">
                <div className="top4-preview-icon">
                  {p.icon ? <img src={p.icon} alt={p.name} /> : <div className="bracket-icon-placeholder sm">{p.name[0]}</div>}
                </div>
                <span>{p.name}</span>
                <span className="top4-pts">{p.wins} pts</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={initBracket}>
            ⚡ Iniciar Fase Eliminatória
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bracket-wrap">
      {/* Header */}
      <div className="bracket-header">
        <h3 className="section-title">🏆 Fase Eliminatória</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost btn-sm" onClick={resetBracket}>🔄 Reiniciar Chave</button>
        </div>
      </div>

      {/* Phase indicator */}
      <div className="phase-track">
        <div className={`phase-step ${bracket.phase === 'semis' ? 'active' : ''} ${bracket.phase !== 'semis' ? 'done' : ''}`}>
          Semifinal
        </div>
        <div className="phase-line" />
        <div className={`phase-step ${bracket.phase === 'finals' ? 'active' : ''} ${bracket.phase === 'done' ? 'done' : ''}`}>
          Final
        </div>
        <div className="phase-line" />
        <div className={`phase-step ${bracket.phase === 'done' ? 'active champion' : ''}`}>
          Campeão
        </div>
      </div>

      {/* Champion banner */}
      {bracket.champion && (
        <div className="champion-banner">
          <div className="champion-shine" />
          <span className="champion-trophy">🏆</span>
          <div className="champion-icon">
            {bracket.champion.icon
              ? <img src={bracket.champion.icon} alt={bracket.champion.name} />
              : <div className="bracket-icon-placeholder lg">{bracket.champion.name[0]}</div>
            }
          </div>
          <div>
            <div className="champion-label">CAMPEÃO</div>
            <div className="champion-name">{bracket.champion.name}</div>
          </div>
        </div>
      )}

      {/* Bracket tree */}
      <div className="bracket-tree">
        {/* Semis */}
        <div className="bracket-col semis-col">
          <div className="bracket-col-title">SEMIFINAL</div>
          <MatchBox
            match={bracket.semis[0]}
            onSelectWinner={(w) => setSemiWinner(0, w)}
            showWinnerPicker={bracket.phase === 'semis'}
            phase="SF 1"
          />
          <MatchBox
            match={bracket.semis[1]}
            onSelectWinner={(w) => setSemiWinner(1, w)}
            showWinnerPicker={bracket.phase === 'semis'}
            phase="SF 2"
          />
        </div>

        {/* Connector lines */}
        <div className="bracket-connectors">
          <div className="connector-line top" />
          <div className="connector-center" />
          <div className="connector-line bottom" />
        </div>

        {/* Final */}
        <div className="bracket-col final-col">
          <div className="bracket-col-title">FINAL</div>
          <MatchBox
            match={bracket.final}
            onSelectWinner={setFinalWinner}
            showWinnerPicker={bracket.phase === 'finals'}
            phase="FINAL"
          />
        </div>

        {/* Champion connector */}
        <div className="bracket-connectors">
          <div className="connector-center" />
        </div>

        {/* Champion slot */}
        <div className="bracket-col champ-col">
          <div className="bracket-col-title">🏆 CAMPEÃO</div>
          {bracket.champion
            ? <PlayerCard player={bracket.champion} isWinner={true} />
            : <div className="bracket-slot empty champ-empty">Aguardando final...</div>
          }
        </div>
      </div>
    </div>
  )
}

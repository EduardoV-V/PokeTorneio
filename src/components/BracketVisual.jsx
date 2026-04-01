import React from 'react'
import { buildBracketFromTop4 } from '../utils/data.js'
import './BracketVisual.css'

function PlayerCard({ player, clickable, isWinner, isLoser, onClick, size = 'md' }) {
  if (!player) return null

  return (
    <div
      className={[
        'bv-card',
        `bv-card--${size}`,
        isWinner ? 'bv-card--winner' : '',
        isLoser ? 'bv-card--loser' : '',
        clickable ? 'bv-card--clickable' : '',
      ].join(' ')}
      onClick={clickable ? onClick : undefined}
    >
      <div className="bv-card-inner">
        {player.icon
          ? <img src={player.icon} alt={player.name} className="bv-card-img" />
          : <div className="bv-card-initials">{player.name[0]}</div>
        }
      </div>
    </div>
  )
}

export default function BracketVisual({ players, bracket, setBracket }) {

  const bk = (!bracket || bracket === 'init' || !bracket.semis)
    ? buildBracketFromTop4(players)
    : bracket

  React.useEffect(() => {
    if (!bracket || bracket === 'init' || !bracket.semis) {
      setBracket(buildBracketFromTop4(players))
    }
  }, [])

  // ===== SEMI =====
  const setSemiWinner = (semiIdx, winner) => {
    setBracket(prev => {
      const b = (!prev || prev === 'init' || !prev.semis)
        ? buildBracketFromTop4(players)
        : prev

      const semis = [...b.semis]
      semis[semiIdx] = { ...semis[semiIdx], winner }

      const allDone = semis.every(s => s.winner)

      return {
        ...b,
        semis,
        final: allDone
          ? { p1: semis[0].winner, p2: semis[1].winner, winner: null }
          : { p1: null, p2: null, winner: null },
        phase: allDone ? 'finals' : 'semis'
      }
    })
  }

  // ===== FINAL =====
  const setFinalWinner = (winner) => {
    setBracket(prev => ({
      ...prev,
      final: { ...prev.final, winner },
      champion: winner,
      phase: 'done'
    }))
  }

  const { semis, champion, phase } = bk

  const semiClickable = phase === 'semis'
  const finalClickable = phase === 'finals'

  return (
  <div className="bv-wrapper">

    {champion && (
      <div className="bv-champion-banner">
        🏆 {champion.name}
      </div>
    )}

    <div className="bv-board">

        {/* SEMIS BASE */}
        <div className="bv-pos bv-s1">
          <PlayerCard
            player={semis[0].p1}
            clickable={semiClickable}
            onClick={() => setSemiWinner(0, semis[0].p1)}
            isWinner={semis[0].winner?.id === semis[0].p1?.id}
            isLoser={semis[0].winner && semis[0].winner.id !== semis[0].p1?.id}
          />
        </div>

        <div className="bv-pos bv-s2">
          <PlayerCard
            player={semis[0].p2}
            clickable={semiClickable}
            onClick={() => setSemiWinner(0, semis[0].p2)}
            isWinner={semis[0].winner?.id === semis[0].p2?.id}
            isLoser={semis[0].winner && semis[0].winner.id !== semis[0].p2?.id}
          />
        </div>

        <div className="bv-pos bv-s3">
          <PlayerCard
            player={semis[1].p1}
            clickable={semiClickable}
            onClick={() => setSemiWinner(1, semis[1].p1)}
            isWinner={semis[1].winner?.id === semis[1].p1?.id}
            isLoser={semis[1].winner && semis[1].winner.id !== semis[1].p1?.id}
          />
        </div>

        <div className="bv-pos bv-s4">
          <PlayerCard
            player={semis[1].p2}
            clickable={semiClickable}
            onClick={() => setSemiWinner(1, semis[1].p2)}
            isWinner={semis[1].winner?.id === semis[1].p2?.id}
            isLoser={semis[1].winner && semis[1].winner.id !== semis[1].p2?.id}
          />
        </div>

        {/* FINAL */}
        <div className="bv-pos bv-f1">
          <PlayerCard
            player={semis[0].winner}
            clickable={finalClickable}
            onClick={() => setFinalWinner(semis[0].winner)}
          />
        </div>

        <div className="bv-pos bv-f2">
          <PlayerCard
            player={semis[1].winner}
            clickable={finalClickable}
            onClick={() => setFinalWinner(semis[1].winner)}
          />
        </div>

        {/* CAMPEÃO */}
        <div className="bv-pos bv-final">
          <PlayerCard player={champion} size="sm" isWinner />
        </div>

      </div>

      <div className="bv-status">
        {phase === 'semis' && <span>Escolha os vencedores das semifinais</span>}
        {phase === 'finals' && <span>Escolha o campeão</span>}
        {phase === 'done' && <span>🏆 Torneio encerrado!</span>}
      </div>

    </div>
  )
}
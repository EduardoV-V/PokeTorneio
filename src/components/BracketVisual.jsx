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
        isLoser  ? 'bv-card--loser'  : '',
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        phase: allDone ? 'finals' : 'semis',
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

  const { semis, champion, phase } = bk
  const semiClickable  = phase === 'semis'
  const finalClickable = phase === 'finals'

  return (
    <div className="bv-wrapper">

      {/* ── Tela de campeão ── */}
      {champion && (
        <div className="bv-champion-screen">
          <div className="bv-champion-confetti" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} className="confetti-piece" style={{ '--i': i }} />
            ))}
          </div>
          <div className="bv-champion-content">
            <div className="bv-champion-trophy">🏆</div>
            <div className="bv-champion-label">CAMPEÃO</div>
            <div className="bv-champion-avatar">
              {champion.icon
                ? <img src={champion.icon} alt={champion.name} />
                : <div className="bv-champion-initials">{champion.name[0]}</div>
              }
            </div>
            <div className="bv-champion-name">{champion.name}</div>
            <div className="bv-champion-sub">Torneio encerrado · Parabéns! 🎉</div>
          </div>
        </div>
      )}

      {/* ── Board com a chave ── */}
      <div className="bv-board">
        <div className="bv-pos bv-s1">
          <PlayerCard player={semis[0].p1} clickable={semiClickable}
            onClick={() => setSemiWinner(0, semis[0].p1)}
            isWinner={semis[0].winner?.id === semis[0].p1?.id}
            isLoser={semis[0].winner && semis[0].winner.id !== semis[0].p1?.id} />
        </div>
        <div className="bv-pos bv-s2">
          <PlayerCard player={semis[0].p2} clickable={semiClickable}
            onClick={() => setSemiWinner(0, semis[0].p2)}
            isWinner={semis[0].winner?.id === semis[0].p2?.id}
            isLoser={semis[0].winner && semis[0].winner.id !== semis[0].p2?.id} />
        </div>
        <div className="bv-pos bv-s3">
          <PlayerCard player={semis[1].p1} clickable={semiClickable}
            onClick={() => setSemiWinner(1, semis[1].p1)}
            isWinner={semis[1].winner?.id === semis[1].p1?.id}
            isLoser={semis[1].winner && semis[1].winner.id !== semis[1].p1?.id} />
        </div>
        <div className="bv-pos bv-s4">
          <PlayerCard player={semis[1].p2} clickable={semiClickable}
            onClick={() => setSemiWinner(1, semis[1].p2)}
            isWinner={semis[1].winner?.id === semis[1].p2?.id}
            isLoser={semis[1].winner && semis[1].winner.id !== semis[1].p2?.id} />
        </div>
        <div className="bv-pos bv-f1">
          <PlayerCard player={semis[0].winner}
            clickable={finalClickable && !!semis[0].winner}
            onClick={() => setFinalWinner(semis[0].winner)}
            isWinner={champion?.id === semis[0].winner?.id}
            isLoser={champion && champion.id !== semis[0].winner?.id} />
        </div>
        <div className="bv-pos bv-f2">
          <PlayerCard player={semis[1].winner}
            clickable={finalClickable && !!semis[1].winner}
            onClick={() => setFinalWinner(semis[1].winner)}
            isWinner={champion?.id === semis[1].winner?.id}
            isLoser={champion && champion.id !== semis[1].winner?.id} />
        </div>
        <div className="bv-pos bv-final">
          <PlayerCard player={champion} size="sm" isWinner />
        </div>
      </div>

      <div className="bv-status">
        {phase === 'semis'  && <span>Clique no vencedor de cada semifinal</span>}
        {phase === 'finals' && <span>Clique no campeão da final</span>}
        {phase === 'done'   && <span>🏆 Torneio encerrado!</span>}
      </div>
    </div>
  )
}
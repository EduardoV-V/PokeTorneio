import React, { useState } from 'react'
import './Matchups.css'

/**
 * matchups: { "minId-maxId": { played: true, winner: id | null } }
 *
 * Ciclo de clique: vazio → jogaram (✓) → linha ganhou (W) → coluna ganhou (L) → vazio
 *
 * Ao mudar resultado com winner definido, recalcula wins/losses de todos os
 * jogadores e chama setPlayers para atualizar o standings automaticamente.
 */

function matchKey(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}` }
function getMatch(matchups, a, b) { return matchups?.[matchKey(a, b)] ?? null }

function computeStats(matchups) {
  const stats = {}
  Object.entries(matchups ?? {}).forEach(([key, m]) => {
    if (!m?.played) return
    const [a, b] = key.split('-').map(Number)
    if (!stats[a]) stats[a] = { w: 0, l: 0, played: 0 }
    if (!stats[b]) stats[b] = { w: 0, l: 0, played: 0 }
    stats[a].played++
    stats[b].played++
    if (m.winner) {
      stats[m.winner].w++
      const loser = m.winner === a ? b : a
      stats[loser].l++
    }
  })
  return stats
}

export default function Matchups({ players, matchups, setMatchups, setPlayers }) {
  const [hoverRow, setHoverRow] = useState(null)
  const [hoverCol, setHoverCol] = useState(null)

  if (!players || players.length === 0) return null

  const handleCell = (rowPlayer, colPlayer) => {
    const key = matchKey(rowPlayer.id, colPlayer.id)
    const current = matchups?.[key] ?? null

    // Determina próximo estado
    let next
    if (!current) {
      next = { played: true, winner: null }
    } else if (!current.winner) {
      next = { played: true, winner: rowPlayer.id }
    } else if (current.winner === rowPlayer.id) {
      next = { played: true, winner: colPlayer.id }
    } else {
      next = null
    }

    // Atualiza matchups
    const newMatchups = { ...(matchups ?? {}) }
    if (next === null) {
      delete newMatchups[key]
    } else {
      newMatchups[key] = next
    }
    setMatchups(newMatchups)

    // Recalcula wins/losses de TODOS os jogadores a partir do estado completo
    // e sincroniza com o standings
    if (setPlayers) {
      const stats = computeStats(newMatchups)
      setPlayers(prev => prev.map(p => ({
        ...p,
        wins: stats[p.id]?.w ?? 0,
        losses: stats[p.id]?.l ?? 0,
      })))
    }
  }

  const stats = computeStats(matchups)

  return (
    <div className="matchups-wrap">
      <div className="matchups-legend">
        <span className="legend-item"><span className="legend-dot played" />Jogaram</span>
        <span className="legend-item"><span className="legend-dot win" />Linha venceu</span>
        <span className="legend-item"><span className="legend-dot loss" />Linha perdeu</span>
        <span className="legend-hint">Clique para ciclar: vazio → jogaram → linha ganhou → coluna ganhou → resetar</span>
      </div>

      <div className="matchups-scroll">
        <table className="matchups-table">
          <thead>
            <tr>
              <th className="corner-cell">
                <span className="corner-label corner-row">LINHA</span>
                <span className="corner-label corner-col">COLUNA</span>
              </th>
              {players.map(p => (
                <th
                  key={p.id}
                  className={`col-header ${hoverCol === p.id ? 'highlighted' : ''}`}
                  onMouseEnter={() => setHoverCol(p.id)}
                  onMouseLeave={() => setHoverCol(null)}
                >
                  <div className="header-player">
                    {p.icon
                      ? <img src={p.icon} alt={p.name} className="header-icon" />
                      : <div className="header-icon-placeholder">{p.name[0]}</div>
                    }
                    <span className="header-name">{p.name}</span>
                  </div>
                </th>
              ))}
              <th className="stats-header">V</th>
              <th className="stats-header">D</th>
              <th className="stats-header">J</th>
            </tr>
          </thead>
          <tbody>
            {players.map(rowP => (
              <tr
                key={rowP.id}
                onMouseEnter={() => setHoverRow(rowP.id)}
                onMouseLeave={() => setHoverRow(null)}
              >
                <td className={`row-header ${hoverRow === rowP.id ? 'highlighted' : ''}`}>
                  <div className="header-player row-player">
                    {rowP.icon
                      ? <img src={rowP.icon} alt={rowP.name} className="header-icon" />
                      : <div className="header-icon-placeholder">{rowP.name[0]}</div>
                    }
                    <span className="header-name">{rowP.name}</span>
                  </div>
                </td>

                {players.map(colP => {
                  if (rowP.id === colP.id) {
                    return (
                      <td key={colP.id} className="cell cell-self">
                        <span className="cell-self-mark">—</span>
                      </td>
                    )
                  }

                  const match = getMatch(matchups, rowP.id, colP.id)
                  const isHighlighted = hoverRow === rowP.id || hoverCol === colP.id

                  let cellClass = 'cell'
                  let cellContent

                  if (!match) {
                    cellClass += ' cell-empty'
                    cellContent = <span className="cell-dot" />
                  } else if (!match.winner) {
                    cellClass += ' cell-played'
                    cellContent = <span className="cell-label">✓</span>
                  } else if (match.winner === rowP.id) {
                    cellClass += ' cell-win'
                    cellContent = <span className="cell-label">W</span>
                  } else {
                    cellClass += ' cell-loss'
                    cellContent = <span className="cell-label">L</span>
                  }

                  if (isHighlighted) cellClass += ' cell-hover'

                  return (
                    <td
                      key={colP.id}
                      className={cellClass}
                      onClick={() => handleCell(rowP, colP)}
                      title={`${rowP.name} vs ${colP.name} — clique para registrar`}
                    >
                      {cellContent}
                    </td>
                  )
                })}

                <td className="stats-cell wins">{stats[rowP.id]?.w ?? 0}</td>
                <td className="stats-cell losses">{stats[rowP.id]?.l ?? 0}</td>
                <td className="stats-cell played-count">{stats[rowP.id]?.played ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="matchups-summary">
        {players.map(p => {
          const s = stats[p.id] ?? { w: 0, l: 0, played: 0 }
          const draws = s.played - s.w - s.l
          const remaining = players.length - 1 - s.played
          return (
            <div key={p.id} className="summary-card">
              <div className="summary-icon">
                {p.icon
                  ? <img src={p.icon} alt={p.name} />
                  : <div className="summary-placeholder">{p.name[0]}</div>
                }
              </div>
              <div className="summary-name">{p.name}</div>
              <div className="summary-stats">
                <span className="summary-w">{s.w}V</span>
                {draws > 0 && <span className="summary-d">{draws}E</span>}
                <span className="summary-l">{s.l}D</span>
              </div>
              <div className="summary-remaining">{remaining} restantes</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
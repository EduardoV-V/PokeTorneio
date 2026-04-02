import React, { useState } from 'react'
import './Matchups.css'

/**
 * Estrutura do estado `matchups`:
 * {
 *   "id_a-id_b": { played: true, winner: id_a | id_b | null }
 *   // a chave usa sempre min(id_a, id_b) + '-' + max(id_a, id_b)
 * }
 */

function matchKey(idA, idB) {
  return idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`
}

function getMatch(matchups, idA, idB) {
  return matchups?.[matchKey(idA, idB)] ?? null
}

// Ciclo de clique em uma célula:
// null (não jogaram) → { played, winner: null } (jogaram, empate/indefinido)
//   → { played, winner: rowPlayer } (linha ganhou)
//   → { played, winner: colPlayer } (coluna ganhou)
//   → null (resetar)
function nextMatchState(current, rowId, colId) {
  if (!current) return { played: true, winner: null }
  if (!current.winner) return { played: true, winner: rowId }
  if (current.winner === rowId) return { played: true, winner: colId }
  return null  // resetar
}

export default function Matchups({ players, matchups, setMatchups }) {
  const [hoverRow, setHoverRow] = useState(null)
  const [hoverCol, setHoverCol] = useState(null)

  if (!players || players.length === 0) return null

  const handleCell = (rowPlayer, colPlayer) => {
    const key = matchKey(rowPlayer.id, colPlayer.id)
    const current = matchups?.[key] ?? null
    const next = nextMatchState(current, rowPlayer.id, colPlayer.id)

    setMatchups(prev => {
      const updated = { ...(prev ?? {}) }
      if (next === null) {
        delete updated[key]
      } else {
        updated[key] = next
      }
      return updated
    })
  }

  // Contagem de vitórias/derrotas na tabela de confrontos (separado do standings)
  const matchupStats = players.reduce((acc, p) => {
    acc[p.id] = { w: 0, l: 0, played: 0 }
    return acc
  }, {})

  Object.values(matchups ?? {}).forEach(m => {
    if (!m?.played) return
    const [idA, idB] = Object.keys(matchups).find(k => matchups[k] === m)?.split('-').map(Number) ?? []
    if (!idA || !idB) return
    if (matchupStats[idA]) matchupStats[idA].played++
    if (matchupStats[idB]) matchupStats[idB].played++
    if (m.winner) {
      if (matchupStats[m.winner]) matchupStats[m.winner].w++
      const loserId = m.winner === idA ? idB : idA
      if (matchupStats[loserId]) matchupStats[loserId].l++
    }
  })

  // Recomputa corretamente iterando pelas chaves
  const stats = players.reduce((acc, p) => { acc[p.id] = { w: 0, l: 0, played: 0 }; return acc }, {})
  Object.entries(matchups ?? {}).forEach(([key, m]) => {
    if (!m?.played) return
    const [a, b] = key.split('-').map(Number)
    if (stats[a]) stats[a].played++
    if (stats[b]) stats[b].played++
    if (m.winner) {
      if (stats[m.winner]) stats[m.winner].w++
      const loser = m.winner === a ? b : a
      if (stats[loser]) stats[loser].l++
    }
  })

  return (
    <div className="matchups-wrap">
      <div className="matchups-legend">
        <span className="legend-item"><span className="legend-dot played" />Jogaram</span>
        <span className="legend-item"><span className="legend-dot win" />Linha venceu</span>
        <span className="legend-item"><span className="legend-dot loss" />Linha perdeu</span>
        <span className="legend-item legend-hint">Clique para ciclar: não jogou → jogou → linha ganhou → coluna ganhou → resetar</span>
      </div>

      <div className="matchups-scroll">
        <table className="matchups-table">
          <thead>
            <tr>
              {/* Canto vazio */}
              <th className="corner-cell">
                <span className="corner-atk">LINHA</span>
                <span className="corner-def">COLUNA</span>
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
                className={hoverRow === rowP.id ? 'row-highlighted' : ''}
                onMouseEnter={() => setHoverRow(rowP.id)}
                onMouseLeave={() => setHoverRow(null)}
              >
                {/* Row header */}
                <td className={`row-header ${hoverRow === rowP.id ? 'highlighted' : ''}`}>
                  <div className="header-player">
                    {rowP.icon
                      ? <img src={rowP.icon} alt={rowP.name} className="header-icon" />
                      : <div className="header-icon-placeholder">{rowP.name[0]}</div>
                    }
                    <span className="header-name">{rowP.name}</span>
                  </div>
                </td>

                {/* Cells */}
                {players.map(colP => {
                  // Diagonal principal — mesmo jogador
                  if (rowP.id === colP.id) {
                    return (
                      <td key={colP.id} className="cell cell-self">
                        <div className="cell-self-mark">—</div>
                      </td>
                    )
                  }

                  const match = getMatch(matchups, rowP.id, colP.id)
                  const isHighlighted = hoverRow === rowP.id || hoverCol === colP.id

                  let cellClass = 'cell'
                  let cellContent = null

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
                      title={`${rowP.name} vs ${colP.name}`}
                    >
                      {cellContent}
                    </td>
                  )
                })}

                {/* Stats */}
                <td className="stats-cell wins">{stats[rowP.id]?.w ?? 0}</td>
                <td className="stats-cell losses">{stats[rowP.id]?.l ?? 0}</td>
                <td className="stats-cell played">{stats[rowP.id]?.played ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="matchups-summary">
        {players.map(p => {
          const s = stats[p.id] ?? { w: 0, l: 0, played: 0 }
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
                <span className="summary-d">{s.played - s.w - s.l}E</span>
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
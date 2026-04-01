import React, { useState } from 'react'
import { getSortedPlayers } from '../utils/data.js'
import './Standings.css'

const MEDAL = ['🥇', '🥈', '🥉']

export default function Standings({ players, setPlayers }) {
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editWins, setEditWins] = useState(0)
  const [editLosses, setEditLosses] = useState(0)

  const sorted = getSortedPlayers(players)

  const openEdit = (p) => {
    setEditId(p.id)
    setEditName(p.name)
    setEditWins(p.wins)
    setEditLosses(p.losses)
  }

  const saveEdit = () => {
    setPlayers(prev => prev.map(p =>
      p.id === editId ? { ...p, name: editName, wins: Number(editWins), losses: Number(editLosses) } : p
    ))
    setEditId(null)
  }

  const adjustWins = (id, delta) => {
    setPlayers(prev => prev.map(p =>
      p.id === id ? { ...p, wins: Math.max(0, p.wins + delta) } : p
    ))
  }

  const adjustLosses = (id, delta) => {
    setPlayers(prev => prev.map(p =>
      p.id === id ? { ...p, losses: Math.max(0, p.losses + delta) } : p
    ))
  }

  const handleIconUpload = (id, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setPlayers(prev => prev.map(p =>
        p.id === id ? { ...p, icon: e.target.result } : p
      ))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="standings-wrap">
      <div className="standings-legend">
        <span>🏆 Top 4 avançam para fase eliminatória</span>
      </div>

      <div className="standings-table-wrap">
        <table className="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Foto</th>
              <th>Jogador</th>
              <th>V</th>
              <th>D</th>
              <th>Pts</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.id} className={`standings-row ${i < 4 ? 'top4' : ''} ${i === 0 ? 'first' : ''}`}>
                <td className="rank-cell">
                  {MEDAL[i] || <span className="rank-num">{i + 1}</span>}
                </td>
                <td className="icon-cell">
                  <label className="icon-upload-label" title="Clique para trocar foto">
                    {p.icon
                      ? <img src={p.icon} alt={p.name} className="player-icon" />
                      : <div className="player-icon-placeholder">{p.name[0]?.toUpperCase()}</div>
                    }
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handleIconUpload(p.id, e.target.files[0])}
                    />
                  </label>
                </td>
                <td className="name-cell">
                  {editId === p.id
                    ? <input
                        className="poke-input name-edit-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        autoFocus
                      />
                    : <span className="player-name-text">{p.name}</span>
                  }
                </td>
                <td className="stat-cell">
                  <div className="stat-control">
                    <button className="stat-btn" onClick={() => adjustWins(p.id, -1)}>−</button>
                    {editId === p.id
                      ? <input className="poke-input stat-edit" type="number" min="0" value={editWins} onChange={e => setEditWins(e.target.value)} />
                      : <span className="stat-value wins">{p.wins}</span>
                    }
                    <button className="stat-btn" onClick={() => adjustWins(p.id, 1)}>+</button>
                  </div>
                </td>
                <td className="stat-cell">
                  <div className="stat-control">
                    <button className="stat-btn loss" onClick={() => adjustLosses(p.id, -1)}>−</button>
                    {editId === p.id
                      ? <input className="poke-input stat-edit" type="number" min="0" value={editLosses} onChange={e => setEditLosses(e.target.value)} />
                      : <span className="stat-value losses">{p.losses}</span>
                    }
                    <button className="stat-btn loss" onClick={() => adjustLosses(p.id, 1)}>+</button>
                  </div>
                </td>
                <td className="pts-cell">
                  <span className="pts-badge">{p.wins}</span>
                </td>
                <td className="actions-cell">
                  {editId === p.id
                    ? <>
                        <button className="btn btn-secondary btn-sm" onClick={saveEdit}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>✕</button>
                      </>
                    : <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️ Editar</button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

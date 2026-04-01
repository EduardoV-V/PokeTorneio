import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase.js'
import { fetchPlayers, upsertPlayers, fetchBracket, upsertBracket } from '../utils/db.js'
import { DEFAULT_PLAYERS } from '../utils/data.js'
import Standings from '../components/Standings.jsx'
import BracketVisual from '../components/BracketVisual.jsx'
import './TournamentPage.css'

export default function TournamentPage() {
  const [players, setPlayersState] = useState(null)
  const [bracket, setBracketState] = useState(undefined) // undefined = loading
  const [showReset, setShowReset] = useState(false)
  const [loading, setLoading] = useState(true)

  // ── initial load ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchPlayers(), fetchBracket()])
      .then(([p, b]) => {
        if (cancelled) return
        setPlayersState(p)
        setBracketState(b)
        setLoading(false)
      })
      .catch(err => {
        console.error('TournamentPage load error:', err)
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // ── realtime: players ───────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('tournament-players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayers().then(setPlayersState).catch(console.error)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ── realtime: bracket ───────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('tournament-bracket')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bracket' }, () => {
        fetchBracket().then(setBracketState).catch(console.error)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ── setters (write to DB + update local state) ──────────
  const setPlayers = useCallback(async (updater) => {
    setPlayersState(prev => {
      const next = updater instanceof Function ? updater(prev) : updater
      upsertPlayers(next).catch(console.error)
      return next
    })
  }, [])

  const setBracket = useCallback(async (updater) => {
    setBracketState(prev => {
      const next = updater instanceof Function ? updater(prev) : updater
      upsertBracket(next).catch(console.error)
      return next
    })
  }, [])

  // ── reset ────────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    const reset = (players ?? []).map(p => ({ ...p, wins: 0, losses: 0 }))
    setPlayersState(reset)
    setBracketState(null)
    setShowReset(false)
    try {
      await upsertPlayers(reset)
      await upsertBracket(null)
    } catch (err) {
      console.error('Reset error:', err)
    }
  }, [players])

  // ── loading / error states ───────────────────────────────
  if (loading || players === null || bracket === undefined) {
    return (
      <div className="tournament-page">
        <div className="page-title"><span>🏆</span><span>TORNEIO</span></div>
        <div className="loading-state">
          <div className="loading-pokeball">⚽</div>
          <p>Carregando dados do torneio...</p>
        </div>
      </div>
    )
  }

  const inBracket = bracket !== null

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
            <Standings
              players={players}
              setPlayers={setPlayers}
              onStartBracket={() => setBracket('init')}
            />
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

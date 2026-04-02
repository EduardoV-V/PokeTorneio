/**
 * db.js — Supabase data-access helpers
 *
 * All functions are pure async utilities (no hooks).
 * Components use useSupabaseState + these helpers together.
 */
import { supabase } from './supabase.js'
import { DEFAULT_PLAYERS } from './data.js'

const TEAM_SIZE = 9

// ─────────────────────────────────────────────
// PLAYERS
// ─────────────────────────────────────────────

export async function fetchPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('id')

  if (error) throw error

  // Map DB rows → app shape
  return data.map(row => ({
    id: row.id,
    name: row.name,
    wins: row.wins,
    losses: row.losses,
    icon: row.icon ?? null,
  }))
}

export async function upsertPlayers(players) {
  const rows = players.map(p => ({
    id: p.id,
    name: p.name,
    wins: p.wins,
    losses: p.losses,
    icon: p.icon ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('players')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw error
}

// Convenience: update a single player
export async function upsertPlayer(player) {
  return upsertPlayers([player])
}

// ─────────────────────────────────────────────
// TEAMS
// ─────────────────────────────────────────────

/**
 * Returns { [playerId]: Array(9) of pokemon|null }
 */
export async function fetchTeams(playerIds) {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .in('player_id', playerIds)
    .order('slot_idx')

  if (error) throw error

  // Build map
  const map = Object.fromEntries(playerIds.map(id => [id, Array(TEAM_SIZE).fill(null)]))
  for (const row of data) {
    map[row.player_id][row.slot_idx] = row.pokemon ?? null
  }
  return map
}

/**
 * Returns { [playerId]: slotIdx | null }
 */
export async function fetchMegaSlots(playerIds) {
  const { data, error } = await supabase
    .from('teams')
    .select('player_id, slot_idx, is_mega')
    .in('player_id', playerIds)
    .eq('is_mega', true)

  if (error) throw error

  const map = Object.fromEntries(playerIds.map(id => [id, null]))
  for (const row of data) {
    map[row.player_id] = row.slot_idx
  }
  return map
}

/**
 * Upsert a single slot (pokemon + mega flag)
 */
export async function upsertSlot(playerId, slotIdx, pokemon) {
  const { error } = await supabase
    .from('teams')
    .upsert({
      player_id: playerId,
      slot_idx: slotIdx,
      pokemon: pokemon ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id,slot_idx' })

  if (error) throw error
}

/**
 * Clear all slots for a player (set pokemon = null, is_mega = false)
 */
export async function clearTeam(playerId) {
  const rows = Array.from({ length: TEAM_SIZE }, (_, i) => ({
    player_id: playerId,
    slot_idx: i,
    pokemon: null,
    is_mega: false,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('teams')
    .upsert(rows, { onConflict: 'player_id,slot_idx' })

  if (error) throw error
}

/**
 * Set mega flag: clear is_mega for all player's slots, then set it for slotIdx
 * Pass slotIdx = null to just clear all megas.
 */
export async function setMegaSlot(playerId, slotIdx) {
  // First clear all
  const { error: e1 } = await supabase
    .from('teams')
    .update({ is_mega: false })
    .eq('player_id', playerId)

  if (e1) throw e1

  if (slotIdx === null) return

  const { error: e2 } = await supabase
    .from('teams')
    .update({ is_mega: true, updated_at: new Date().toISOString() })
    .eq('player_id', playerId)
    .eq('slot_idx', slotIdx)

  if (e2) throw e2
}

/**
 * Upsert ALL teams at once (used for reset)
 */
export async function upsertAllTeams(teams, megaSlots) {
  const rows = []
  for (const [pid, slots] of Object.entries(teams)) {
    const megaIdx = megaSlots?.[pid] ?? null
    slots.forEach((pokemon, idx) => {
      rows.push({
        player_id: parseInt(pid),
        slot_idx: idx,
        pokemon: pokemon ?? null,
        is_mega: megaIdx === idx,
        updated_at: new Date().toISOString(),
      })
    })
  }

  const { error } = await supabase
    .from('teams')
    .upsert(rows, { onConflict: 'player_id,slot_idx' })

  if (error) throw error
}

// ─────────────────────────────────────────────
// BRACKET
// ─────────────────────────────────────────────

export async function fetchBracket() {
  const { data, error } = await supabase
    .from('bracket')
    .select('data')
    .eq('id', 1)
    .single()

  if (error) throw error
  return data?.data ?? null   // null = still in round-robin phase
}

export async function upsertBracket(bracketData) {
  const { error } = await supabase
    .from('bracket')
    .upsert({
      id: 1,
      data: bracketData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  if (error) throw error
}

/**
 * Busca o objeto de confrontos da tabela `matchups` (linha id=1).
 * Retorna {} se ainda não houver dados.
 */
export async function fetchMatchups() {
  const { data, error } = await supabase
    .from('matchups')
    .select('data')
    .eq('id', 1)
    .single()
 
  if (error) throw error
  return data?.data ?? {}
}
 
/**
 * Persiste o objeto de confrontos.
 */
export async function upsertMatchups(matchupsData) {
  const { error } = await supabase
    .from('matchups')
    .upsert({
      id: 1,
      data: matchupsData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
 
  if (error) throw error
}
 
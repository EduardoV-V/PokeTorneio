/**
 * useSupabaseState
 *
 * A hook that keeps a piece of state in sync with a Supabase table,
 * with realtime subscriptions so every connected client sees updates.
 *
 * Usage:
 *   const [value, setValue, loading] = useSupabaseState(fetcher, upserter, deps)
 *
 * fetcher  — async () => T       — reads the current value from Supabase
 * upserter — async (T) => void   — writes a new value to Supabase
 * channel  — string              — unique realtime channel name
 * table    — string              — table to subscribe to
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../utils/supabase.js'

export function useSupabaseState(fetcher, upserter, table, channel) {
  const [value, setValue] = useState(null)
  const [loading, setLoading] = useState(true)
  const skipNextRef = useRef(false)  // avoid re-fetching after our own write

  // ── initial load ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetcher().then(data => {
      if (!cancelled) {
        setValue(data)
        setLoading(false)
      }
    }).catch(err => {
      console.error(`[useSupabaseState] initial fetch error (${table}):`, err)
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── realtime subscription ─────────────────────────────────
  useEffect(() => {
    const sub = supabase
      .channel(channel)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (skipNextRef.current) {
          skipNextRef.current = false
          return
        }
        fetcher().then(data => setValue(data)).catch(console.error)
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── setter (writes to Supabase + updates local state) ─────
  const set = useCallback(async (updater) => {
    setValue(prev => {
      const next = updater instanceof Function ? updater(prev) : updater
      skipNextRef.current = true
      upserter(next).catch(err => {
        console.error(`[useSupabaseState] write error (${table}):`, err)
        skipNextRef.current = false
      })
      return next
    })
  }, [upserter]) // eslint-disable-line react-hooks/exhaustive-deps

  return [value, set, loading]
}

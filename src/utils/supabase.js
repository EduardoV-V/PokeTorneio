import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://btotjfvgyrkhohucdiiz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_CjG4kJzc72YC20FxmKAoFw_t3s0uVp_'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

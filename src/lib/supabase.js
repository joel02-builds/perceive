import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase-Umgebungsvariablen fehlen. Bitte .env auf Basis von .env.example anlegen.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

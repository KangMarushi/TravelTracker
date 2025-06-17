import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kcyrmtkrpjigzaextlef.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJtdGtycGppZ3phZXh0bGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxODAzODEsImV4cCI6MjA2NTc1NjM4MX0.bg1SHvRiRIBdO18I1E8cIE4hQSVIzitdVsZGETm1KHU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
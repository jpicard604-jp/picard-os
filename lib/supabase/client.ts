import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

// Browser-safe client. Uses only NEXT_PUBLIC_ vars — safe to import in 'use client' components.
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

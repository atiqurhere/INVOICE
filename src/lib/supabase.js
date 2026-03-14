import { createClient } from "@supabase/supabase-js"

const url = "YOUR_SUPABASE_URL"
const key = "YOUR_ANON_KEY"

export const supabase = createClient(url, key)

-- =======================================================================================
-- INVOICE GENERATOR - SUPABASE SCHEMA
-- =======================================================================================

-- 1. Create the invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invoice_no TEXT NOT NULL,
    customer TEXT NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    data JSONB NOT NULL, -- The Full JSON payload required to re-populate the editor
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS) on the invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Users can only SELECT (View) their own invoices
CREATE POLICY "Users can view their own invoices"
ON public.invoices FOR SELECT
USING (auth.uid() = user_id);

-- Users can only INSERT (Create) invoices attached to their own specific user ID
CREATE POLICY "Users can insert their own invoices"
ON public.invoices FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only UPDATE their own invoices
CREATE POLICY "Users can update their own invoices"
ON public.invoices FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only DELETE their own invoices
CREATE POLICY "Users can delete their own invoices"
ON public.invoices FOR DELETE
USING (auth.uid() = user_id);


-- =======================================================================================
-- HELPER: Disable Public Signup (Execute these manually in Supabase Dashboard if needed)
-- =======================================================================================
-- Note: It is recommended to disable public signups directly via the 
-- Supabase Dashboard -> Authentication -> Providers -> Email -> "Enable Signups" toggle
-- to ensure accounts can only be created by an Admin.

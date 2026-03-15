-- =======================================================================================
-- INVOICE GENERATOR - SUPABASE SCHEMA (UPDATED)
-- =======================================================================================

-- 1. Create the company_config table
CREATE TABLE IF NOT EXISTS public.company_config (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    company_name TEXT NOT NULL DEFAULT 'Print your vibe',
    phone TEXT NOT NULL DEFAULT '+44 7983 567819',
    address TEXT NOT NULL DEFAULT '270 Teviot St, London E14 6QS, UK',
    email TEXT NOT NULL DEFAULT 'info@printyourvibe.com',
    payment_account_name TEXT,
    payment_account_number TEXT,
    payment_sort_code TEXT,
    logo_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: To update an existing database:
-- ALTER TABLE public.company_config ADD COLUMN IF NOT EXISTS payment_account_name TEXT;
-- ALTER TABLE public.company_config ADD COLUMN IF NOT EXISTS payment_account_number TEXT;
-- ALTER TABLE public.company_config ADD COLUMN IF NOT EXISTS payment_sort_code TEXT;

-- Enable RLS for company_config
ALTER TABLE public.company_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own company config"
ON public.company_config
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Modify or Create the invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invoice_no TEXT NOT NULL UNIQUE, -- Unique invoice number for management
    customer TEXT NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('draft', 'saved')),
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: If you already ran the previous schema.sql, you'll need to run these ALTER commands instead of CREATE TABLE:
-- ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('draft', 'saved'));
-- ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_no_key UNIQUE (invoice_no);

-- Enable RLS for invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own invoices"
ON public.invoices 
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- 3. Create a Supabase Storage Bucket for Company Logos
-- Run this in the SQL Editor. It creates a public bucket named 'logos'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'logos' bucket
-- Allow public viewing of logos
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'logos' );

-- Allow authenticated users to upload their own logos
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'logos' 
    AND auth.role() = 'authenticated'
);

-- Allow users to update/delete their own logo files
CREATE POLICY "Users can update/delete their own logos"
ON storage.objects FOR UPDATE
USING ( auth.uid() = owner )
WITH CHECK ( bucket_id = 'logos' );

CREATE POLICY "Users can delete their own logos"
ON storage.objects FOR DELETE
USING ( auth.uid() = owner );

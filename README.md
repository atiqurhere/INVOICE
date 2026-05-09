# INVOICE

A Vite + React invoice generator with Supabase storage, public invoice/payment pages, Stripe checkout, and Resend email notifications.

## Features

- Create, edit, preview, and export invoices as PDF, JPG, or print.
- Save invoices in Supabase with invoice status tracking.
- Generate public payment links like `/invoice/INV-1001` and `/pay/INV-1001`.
- Send Stripe payment links by email with Resend.
- Handle payment success, failure, and cancellation states.
- Store company profile details and logo in Supabase.

## Tech Stack

- React + Vite
- Supabase
- Stripe Checkout
- Resend
- Vercel serverless API routes

## Project Structure

- `src/` - React app, editor, dashboard, and public invoice page
- `api/` - serverless endpoints for Stripe, Resend, and public invoice data
- `schema.sql` - Supabase tables, policies, and storage bucket setup
- `vercel.json` - SPA rewrites and Vercel cron config

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create or update `.env` with the following values:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

SITE_URL=http://localhost:5173

SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your_verified_from_email
RESEND_FROM_NAME=Invoice Generator

PAYMENT_ADMIN_EMAIL=admin@example.com
```

Notes:

- `SITE_URL` should be your local URL during development and your production domain after deployment.
- `SUPABASE_SERVICE_ROLE_KEY` is only used on the serverless API routes.
- `RESEND_FROM_EMAIL` must be a verified sender in Resend.

### 3. Set up Supabase

Run [`schema.sql`](schema.sql) in the Supabase SQL editor.

That script creates:

- `company_config`
- `invoices`
- RLS policies for both tables
- the public `logos` storage bucket

If you already created the tables earlier, apply the `ALTER TABLE` statements in the file instead of recreating everything.

### 4. Configure Stripe

Create a Stripe webhook that points to:

```text
/api/payments/webhook
```

Subscribe it to at least these events:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `checkout.session.async_payment_failed`

You will also need the Stripe secret key and webhook signing secret in `.env`.

### 5. Configure Resend

Set up a verified sender in Resend and add:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`

The app sends customer and admin notifications for payment link generation and payment status updates.

## Local Development

```bash
npm run dev
```

Open the app at the local Vite URL shown in the terminal.

## Build

```bash
npm run build
```

## Payment Flow

- Save an invoice in the app.
- Generate a payment link from the export/payment actions.
- Share the public invoice link or email the payment link to the customer.
- Stripe checkout updates the invoice status through the webhook.
- Success, failure, and cancellation pages are handled by the SPA routes.

Public routes:

- `/invoice/INV-1001`
- `/pay/INV-1001`
- `/success`
- `/cancelled`

## Deployment

This project is configured for Vercel.

Before deploying:

1. Add all production environment variables in Vercel.
2. Update `SITE_URL` to your production domain.
3. Make sure the Stripe webhook points to your deployed `/api/payments/webhook` URL.
4. Run the Supabase schema in the target project.

## GitHub Push

To push a new change set after editing:

```bash
git status
git add README.md
git commit -m "Update README with payment setup"
git push origin main
```

## Notes

- The checkout flow uses Stripe Checkout Sessions, not static Stripe Payment Links, so invoice totals can stay dynamic.
- Public invoice data is fetched through serverless routes instead of direct client access.
# INVOICE
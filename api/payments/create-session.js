import { createStripeCheckoutSession, getBaseUrl, getSupabaseAdmin } from "../_lib/server.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}
  const invoiceNo = body.invoiceNo || body.invoice_no

  if (!invoiceNo) {
    return res.status(400).json({ error: "Missing invoice number." })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return res.status(500).json({ error: "Supabase admin credentials are missing." })
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("invoice_no", invoiceNo)
    .maybeSingle()

  if (invoiceError) {
    return res.status(500).json({ error: invoiceError.message })
  }

  if (!invoice) {
    return res.status(404).json({ error: "Invoice not found." })
  }

  if (invoice.status === "paid") {
    return res.status(409).json({ error: "This invoice has already been paid." })
  }

  const baseUrl = getBaseUrl(req)

  if (invoice.status === "pending" && invoice.payment_checkout_url && invoice.payment_page_url) {
    return res.status(200).json({
      invoiceNo: invoice.invoice_no,
      status: invoice.status,
      paymentPageUrl: invoice.payment_page_url,
      checkoutUrl: invoice.payment_checkout_url,
      stripeCheckoutSessionId: invoice.stripe_checkout_session_id,
    })
  }

  const session = await createStripeCheckoutSession({ invoice, baseUrl })
  const paymentPageUrl = `${baseUrl}/pay/${encodeURIComponent(invoice.invoice_no)}`
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      status: "pending",
      payment_page_url: paymentPageUrl,
      payment_checkout_url: session.url,
      stripe_checkout_session_id: session.id,
      payment_generated_at: now,
      payment_error: null,
      updated_at: now,
    })
    .eq("id", invoice.id)

  if (updateError) {
    return res.status(500).json({ error: updateError.message })
  }

  return res.status(200).json({
    invoiceNo: invoice.invoice_no,
    status: "pending",
    paymentPageUrl,
    checkoutUrl: session.url,
    stripeCheckoutSessionId: session.id,
  })
}
import { createStripeCheckoutSession, getAdminEmail, getBaseUrl, getSupabaseAdmin, sendInvoiceEmailNotifications } from "../_lib/server.js"

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

  const { data: company, error: companyError } = await supabase
    .from("company_config")
    .select("*")
    .eq("user_id", invoice.user_id)
    .maybeSingle()

  if (companyError) {
    return res.status(500).json({ error: companyError.message })
  }

  const baseUrl = getBaseUrl(req)
  const paymentPageUrl = invoice.payment_page_url || `${baseUrl}/pay/${encodeURIComponent(invoice.invoice_no)}`

  let checkoutUrl = invoice.payment_checkout_url
  let sessionId = invoice.stripe_checkout_session_id

  if (!checkoutUrl || invoice.status !== "pending") {
    const session = await createStripeCheckoutSession({ invoice, baseUrl })
    checkoutUrl = session.url
    sessionId = session.id

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "pending",
        payment_page_url: paymentPageUrl,
        payment_checkout_url: checkoutUrl,
        stripe_checkout_session_id: sessionId,
        payment_generated_at: now,
        payment_error: null,
        updated_at: now,
      })
      .eq("id", invoice.id)

    if (updateError) {
      return res.status(500).json({ error: updateError.message })
    }
  }

  const adminEmail = getAdminEmail(company)

  try {
    await sendInvoiceEmailNotifications({
      invoice: {
        ...invoice,
        status: "pending",
        payment_checkout_url: checkoutUrl,
        stripe_checkout_session_id: sessionId,
        payment_page_url: paymentPageUrl,
      },
      company,
      baseUrl,
      paymentPageUrl,
      status: "pending",
      adminEmail,
    })
  } catch (emailError) {
    return res.status(500).json({ error: emailError.message || "Failed to send payment email." })
  }

  const now = new Date().toISOString()
  const { error: sentError } = await supabase
    .from("invoices")
    .update({
      payment_link_sent_at: now,
      updated_at: now,
    })
    .eq("id", invoice.id)

  if (sentError) {
    return res.status(500).json({ error: sentError.message })
  }

  return res.status(200).json({
    ok: true,
    invoiceNo: invoice.invoice_no,
    paymentPageUrl,
    checkoutUrl,
    stripeCheckoutSessionId: sessionId,
  })
}
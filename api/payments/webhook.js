import { getAdminEmail, getBaseUrl, getSupabaseAdmin, readRequestText, sendInvoiceEmailNotifications, verifyStripeWebhookSignature } from "../_lib/server.js"

function eventToStatus(eventType) {
  if (eventType === "checkout.session.completed") return "paid"
  if (eventType === "checkout.session.expired") return "cancelled"
  if (eventType === "payment_intent.payment_failed" || eventType === "checkout.session.async_payment_failed") return "failed"
  return ""
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return res.status(500).json({ error: "Supabase admin credentials are missing." })
  }

  const payload = await readRequestText(req)
  const signature = req.headers["stripe-signature"]

  try {
    verifyStripeWebhookSignature(payload, signature)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  let event
  try {
    event = JSON.parse(payload)
  } catch (error) {
    return res.status(400).json({ error: "Invalid JSON payload." })
  }

  const status = eventToStatus(event.type)
  if (!status) {
    return res.status(200).json({ received: true, ignored: event.type })
  }

  const session = event.data?.object || {}
  const invoiceNo = session.metadata?.invoice_no || session.client_reference_id

  if (!invoiceNo) {
    return res.status(200).json({ received: true, ignored: "missing invoice number" })
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("invoice_no", invoiceNo)
    .maybeSingle()

  if (invoiceError || !invoice) {
    return res.status(404).json({ error: invoiceError?.message || "Invoice not found." })
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
  const adminEmail = getAdminEmail(company)
  const paymentPageUrl = invoice.payment_page_url || `${baseUrl}/pay/${encodeURIComponent(invoice.invoice_no)}`
  const now = new Date().toISOString()

  const update = {
    status,
    stripe_payment_intent_id: session.payment_intent || invoice.stripe_payment_intent_id || null,
    payment_error: event.type === "payment_intent.payment_failed" ? session.last_payment_error?.message || "Payment failed." : null,
    updated_at: now,
  }

  if (status === "paid") {
    update.paid_at = now
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update(update)
    .eq("id", invoice.id)

  if (updateError) {
    return res.status(500).json({ error: updateError.message })
  }

  try {
    if (status === "paid" && !invoice.payment_success_email_sent_at) {
      await sendInvoiceEmailNotifications({
        invoice: {
          ...invoice,
          ...update,
        },
        company,
        baseUrl,
        paymentPageUrl,
        status: "paid",
        adminEmail,
      })

      await supabase
        .from("invoices")
        .update({ payment_success_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", invoice.id)
    }

    if ((status === "failed" || status === "cancelled") && !invoice.payment_failure_email_sent_at) {
      await sendInvoiceEmailNotifications({
        invoice: {
          ...invoice,
          ...update,
        },
        company,
        baseUrl,
        paymentPageUrl,
        status,
        adminEmail,
      })

      await supabase
        .from("invoices")
        .update({ payment_failure_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", invoice.id)
    }
  } catch (emailError) {
    return res.status(500).json({ error: emailError.message || "Invoice was updated, but email notification failed." })
  }

  return res.status(200).json({ received: true, status })
}
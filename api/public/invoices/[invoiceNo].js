import { getBaseUrl, getSupabaseAdmin } from "../../_lib/server.js"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const invoiceNo = req.query.invoiceNo
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

  const { data: company, error: companyError } = await supabase
    .from("company_config")
    .select("*")
    .eq("user_id", invoice.user_id)
    .maybeSingle()

  if (companyError) {
    return res.status(500).json({ error: companyError.message })
  }

  const baseUrl = getBaseUrl(req)

  return res.status(200).json({
    invoice: {
      id: invoice.id,
      invoice_no: invoice.invoice_no,
      customer: invoice.customer,
      total: invoice.total,
      status: invoice.status,
      payment_page_url: invoice.payment_page_url || `${baseUrl}/pay/${encodeURIComponent(invoice.invoice_no)}`,
      payment_checkout_url: invoice.payment_checkout_url || "",
      paid_at: invoice.paid_at,
      created_at: invoice.created_at,
      updated_at: invoice.updated_at,
      data: invoice.data,
    },
    company: company || null,
  })
}
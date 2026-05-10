import crypto from "crypto"
import { jsPDF } from "jspdf"
import { createClient } from "@supabase/supabase-js"

export function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return value
  }
  return ""
}

export function getBaseUrl(req) {
  const configured = getEnv("SITE_URL", "PUBLIC_SITE_URL", "VITE_SITE_URL")
  if (configured) return configured.replace(/\/$/, "")

  const forwardedProto = req.headers["x-forwarded-proto"] || "https"
  const forwardedHost = req.headers["x-forwarded-host"] || req.headers.host
  return `${forwardedProto}://${forwardedHost}`
}

export function getSupabaseAdmin() {
  const url = getEnv("SUPABASE_URL", "VITE_SUPABASE_URL")
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY")

  if (!url || !key) return null

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function getStripeSecret() {
  return getEnv("STRIPE_SECRET_KEY")
}

export function getStripeWebhookSecret() {
  return getEnv("STRIPE_WEBHOOK_SECRET")
}

export function getResendApiKey() {
  return getEnv("RESEND_API_KEY")
}

export function getFromEmail() {
  return getEnv("RESEND_FROM_EMAIL", "FROM_EMAIL")
}

export function getFromName() {
  return getEnv("RESEND_FROM_NAME", "FROM_NAME", "Invoice Generator")
}

export function getAdminEmail(company) {
  return getEnv("PAYMENT_ADMIN_EMAIL", "ADMIN_EMAIL") || company?.email || ""
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function formatCurrency(value) {
  const amount = Number(value || 0)
  return `£${amount.toFixed(2)}`
}

export function getStripeMinimumAmount() {
  return 0.3
}

export function createStripeMinimumAmountError(total) {
  const minimum = getStripeMinimumAmount()
  const error = new Error(`Stripe Checkout requires a minimum payment of ${formatCurrency(minimum)} for card payments. This invoice total is ${formatCurrency(total)}.`)
  error.code = "STRIPE_MINIMUM_AMOUNT"
  error.statusCode = 400
  error.minimumAmount = minimum
  error.totalAmount = Number(total || 0)
  return error
}

export function validateStripeCheckoutAmount(total) {
  const amount = Number(total || 0)
  const minimum = getStripeMinimumAmount()

  if (amount <= 0) {
    const error = new Error("Invoice total must be greater than zero before creating a payment link.")
    error.statusCode = 400
    error.code = "INVALID_INVOICE_TOTAL"
    throw error
  }

  if (amount < minimum) {
    throw createStripeMinimumAmountError(amount)
  }
}

export function buildInvoiceTotals(invoiceData = {}) {
  const items = Array.isArray(invoiceData.items) ? invoiceData.items : []
  const subtotal = items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0)
  const delivery = Number(invoiceData.totals?.delivery) || 0
  const tax = Number(invoiceData.totals?.tax) || 0
  const total = subtotal + delivery + tax
  const due = Number(invoiceData.totals?.due) > 0 ? Number(invoiceData.totals.due) : total

  return { subtotal, delivery, tax, total, due }
}

function formatPdfCurrency(value) {
  return `£${Number(value || 0).toFixed(2)}`
}

function normalizeInvoiceStatusLabel(status) {
  return {
    pending: "Payment Pending",
    paid: "Paid",
    failed: "Payment Failed",
    cancelled: "Cancelled",
    saved: "Saved",
    draft: "Draft",
  }[status] || "Invoice Update"
}

function buildInvoicePdfBase64(invoice, company) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 40
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ensureSpace = (needed = 24) => {
    if (y + needed > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }
  }

  const writeLine = (label, value, labelWidth = 120) => {
    ensureSpace(22)
    pdf.setFont("helvetica", "bold")
    pdf.text(label, margin, y)
    pdf.setFont("helvetica", "normal")
    const wrapped = pdf.splitTextToSize(String(value ?? ""), contentWidth - labelWidth)
    pdf.text(wrapped, margin + labelWidth, y)
    y += Math.max(18, wrapped.length * 14)
  }

  const invoiceData = invoice?.data || {}
  const items = Array.isArray(invoiceData.items) ? invoiceData.items : []
  const totals = buildInvoiceTotals(invoiceData)
  const invoiceStatus = normalizeInvoiceStatusLabel(invoice?.status)

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(20)
  pdf.text(company?.company_name || "Invoice Generator", margin, y)
  y += 18

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(11)
  if (company?.address) {
    const addressLines = pdf.splitTextToSize(company.address, contentWidth)
    pdf.text(addressLines, margin, y)
    y += addressLines.length * 13
  }
  if (company?.email) {
    pdf.text(company.email, margin, y)
    y += 14
  }
  y += 8

  pdf.setDrawColor(42, 127, 142)
  pdf.setLineWidth(1.5)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 18

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(16)
  pdf.text(`Invoice ${invoice?.invoice_no || ""}`, margin, y)
  y += 22

  pdf.setFontSize(11)
  writeLine("Status", invoiceStatus)
  writeLine("Customer", invoice?.customer || invoiceData?.billTo?.name || "")
  writeLine("Email", invoiceData?.billTo?.email || invoice?.customer_email || "")
  writeLine("Total", formatPdfCurrency(invoice?.total || totals.total))
  y += 8

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(13)
  pdf.text("Items", margin, y)
  y += 14

  pdf.setFontSize(10)
  items.forEach((item, index) => {
    const description = String(item?.description || `Item ${index + 1}`)
    const quantity = Number(item?.qty) || 0
    const price = Number(item?.price) || 0
    const lineTotal = quantity * price
    const rowText = `${index + 1}. ${description}  x${quantity}  ${formatPdfCurrency(price)}  ${formatPdfCurrency(lineTotal)}`
    const wrapped = pdf.splitTextToSize(rowText, contentWidth)
    ensureSpace(wrapped.length * 14 + 4)
    pdf.text(wrapped, margin, y)
    y += wrapped.length * 14 + 4
  })

  y += 8
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(12)
  writeLine("Subtotal", formatPdfCurrency(totals.subtotal))
  writeLine("Delivery", formatPdfCurrency(totals.delivery))
  writeLine("Tax", formatPdfCurrency(totals.tax))
  writeLine("Amount Due", formatPdfCurrency(totals.due))

  const arrayBuffer = pdf.output("arraybuffer")
  return Buffer.from(arrayBuffer).toString("base64")
}

function buildInvoicePdfAttachment(invoice, company) {
  return {
    filename: `invoice-${invoice?.invoice_no || "document"}.pdf`,
    content: buildInvoicePdfBase64(invoice, company),
  }
}

export function buildStripeLineItems(invoiceData = {}) {
  const items = Array.isArray(invoiceData.items) ? invoiceData.items : []
  const lineItems = []

  items.forEach((item, index) => {
    const quantity = Number(item.qty) || 0
    const amount = Number(item.price) || 0
    const unitAmount = Math.max(Math.round(amount * 100), 0)

    if (quantity > 0 && unitAmount > 0) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: item.description?.trim() || `Invoice item ${index + 1}`,
          },
          unit_amount: unitAmount,
        },
        quantity,
      })
    }
  })

  const delivery = Number(invoiceData.totals?.delivery) || 0
  if (delivery > 0) {
    lineItems.push({
      price_data: {
        currency: "gbp",
        product_data: {
          name: "Delivery",
        },
        unit_amount: Math.round(delivery * 100),
      },
      quantity: 1,
    })
  }

  const tax = Number(invoiceData.totals?.tax) || 0
  if (tax > 0) {
    lineItems.push({
      price_data: {
        currency: "gbp",
        product_data: {
          name: "Tax",
        },
        unit_amount: Math.round(tax * 100),
      },
      quantity: 1,
    })
  }

  return lineItems
}

export async function createStripeCheckoutSession({ invoice, baseUrl }) {
  const secret = getStripeSecret()
  if (!secret) {
    throw new Error("Stripe secret key is missing.")
  }

  const lineItems = buildStripeLineItems(invoice.data || {})
  const totals = buildInvoiceTotals(invoice.data || {})

  validateStripeCheckoutAmount(totals.total)

  const body = new URLSearchParams()
  body.set("mode", "payment")
  body.set("client_reference_id", invoice.invoice_no)
  body.set("success_url", `${baseUrl}/success?invoice_no=${encodeURIComponent(invoice.invoice_no)}&session_id={CHECKOUT_SESSION_ID}`)
  body.set("cancel_url", `${baseUrl}/cancelled?invoice_no=${encodeURIComponent(invoice.invoice_no)}&session_id={CHECKOUT_SESSION_ID}`)
  body.set("payment_intent_data[metadata][invoice_no]", invoice.invoice_no)
  body.set("payment_intent_data[metadata][user_id]", invoice.user_id)
  body.set("metadata[invoice_no]", invoice.invoice_no)
  body.set("metadata[user_id]", invoice.user_id)

  const customerEmail = invoice.data?.billTo?.email || invoice.customer_email || ""
  if (customerEmail) {
    body.set("customer_email", customerEmail)
  }

  lineItems.forEach((item, index) => {
    body.set(`line_items[${index}][price_data][currency]`, item.price_data.currency)
    body.set(`line_items[${index}][price_data][product_data][name]`, item.price_data.product_data.name)
    body.set(`line_items[${index}][price_data][unit_amount]`, String(item.price_data.unit_amount))
    body.set(`line_items[${index}][quantity]`, String(item.quantity))
  })

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Failed to create Stripe checkout session.")
  }

  return payload
}

export async function readRequestText(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString("utf8")
}

export function verifyStripeWebhookSignature(payload, signatureHeader) {
  const secret = getStripeWebhookSecret()
  if (!secret) {
    throw new Error("Stripe webhook secret is missing.")
  }

  if (!signatureHeader) {
    throw new Error("Missing Stripe signature header.")
  }

  const parts = signatureHeader.split(",").reduce((acc, part) => {
    const [key, value] = part.split("=")
    if (key && value) acc[key] = value
    return acc
  }, {})

  const timestamp = parts.t
  const signatures = Object.keys(parts)
    .filter((key) => key === "v1")
    .map((key) => parts[key])

  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid Stripe signature header.")
  }

  const signedPayload = `${timestamp}.${payload}`
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex")

  const match = signatures.some((signature) => {
    if (signature.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  })

  if (!match) {
    throw new Error("Stripe webhook signature verification failed.")
  }
}

export function buildEmailHtml({ title, invoice, company, statusLabel, ctaLabel, ctaUrl, note }) {
  const logoUrl = company?.logo_url || invoice?.data?.company?.logo_url || ""
  const companyName = company?.company_name || invoice?.data?.company?.name || "Invoice Generator"
  const primaryText = company?.email || invoice?.data?.company?.email || ""
  const customerName = invoice?.data?.billTo?.name || invoice?.customer || "Customer"

  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
        <div style="background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
          <div style="padding:28px 28px 18px;background:linear-gradient(135deg,#0f766e 0%,#0ea5a4 100%);color:#fff;">
            ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}" style="display:block;height:48px;max-width:180px;object-fit:contain;margin-bottom:16px;filter:brightness(0) invert(1);" />` : ""}
            <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.85;">${escapeHtml(statusLabel)}</div>
            <h1 style="margin:8px 0 0;font-size:30px;line-height:1.15;">${escapeHtml(title)}</h1>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.6;">Hello ${escapeHtml(customerName)},</p>
            <p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:1.7;">${escapeHtml(note || "Here is the latest invoice update.")}</p>

            <div style="border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px;background:#f8fafc;margin-bottom:22px;">
              <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
                <strong style="color:#0f172a;">Invoice ${escapeHtml(invoice?.invoice_no || "")}</strong>
                <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#e0f2fe;color:#075985;font-size:12px;font-weight:700;">${escapeHtml(statusLabel)}</span>
              </div>
              <div style="color:#475569;font-size:14px;line-height:1.8;">
                <div><strong style="color:#0f172a;">Customer:</strong> ${escapeHtml(customerName)}</div>
                <div><strong style="color:#0f172a;">Total:</strong> ${escapeHtml(formatCurrency(invoice?.total || 0))}</div>
                <div><strong style="color:#0f172a;">Company:</strong> ${escapeHtml(companyName)}</div>
                ${primaryText ? `<div><strong style="color:#0f172a;">Reply to:</strong> ${escapeHtml(primaryText)}</div>` : ""}
              </div>
            </div>

            <div style="text-align:center;margin:26px 0;">
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:999px;box-shadow:0 10px 24px rgba(15,118,110,0.22);">${escapeHtml(ctaLabel)}</a>
            </div>

            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;">If the button does not work, copy and paste this link into your browser:</p>
            <p style="margin:6px 0 0;color:#0f766e;font-size:13px;word-break:break-all;">${escapeHtml(ctaUrl)}</p>
          </div>
        </div>
      </div>
    </div>
  `
}

export async function sendResendEmail({ to, subject, html, attachments = [] }) {
  const apiKey = getResendApiKey()
  const fromEmail = getFromEmail()

  if (!apiKey) {
    throw new Error("Resend API key is missing.")
  }

  if (!fromEmail) {
    throw new Error("Resend from email is missing.")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${getFromName()} <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(attachments.length > 0 ? { attachments } : {}),
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "Failed to send email via Resend.")
  }

  return payload
}

function buildInvoiceNotificationEmail({ invoice, company, baseUrl, paymentPageUrl, status, recipientRole }) {
  const invoiceLink = `${baseUrl}/invoice/${encodeURIComponent(invoice.invoice_no)}`
  const checkoutLink = paymentPageUrl || `${baseUrl}/pay/${encodeURIComponent(invoice.invoice_no)}`

  const templates = {
    pending: {
      customer: {
        statusLabel: "Payment Link Ready",
        title: `Your payment link is ready for invoice ${invoice.invoice_no}`,
        ctaLabel: "Pay Invoice",
        ctaUrl: checkoutLink,
        note: "Use the secure checkout link below to complete your payment.",
        subject: `Payment link ready: Invoice ${invoice.invoice_no}`,
      },
      admin: {
        statusLabel: "Payment Link Generated",
        title: `Payment link generated for invoice ${invoice.invoice_no}`,
        ctaLabel: "Review Payment Link",
        ctaUrl: checkoutLink,
        note: "The Stripe checkout session is ready and the customer can now pay online.",
        subject: `Payment link generated - Invoice ${invoice.invoice_no}`,
      },
    },
    paid: {
      customer: {
        statusLabel: "Payment Received",
        title: `Payment received for invoice ${invoice.invoice_no}`,
        ctaLabel: "View Invoice",
        ctaUrl: invoiceLink,
        note: "Thank you. Your payment has been confirmed and the invoice status has been updated.",
        subject: `Payment received: Invoice ${invoice.invoice_no}`,
      },
      admin: {
        statusLabel: "Payment Confirmed",
        title: `Invoice ${invoice.invoice_no} marked as paid`,
        ctaLabel: "Open Invoice",
        ctaUrl: invoiceLink,
        note: "The payment was confirmed and the customer has been notified.",
        subject: `Invoice paid - ${invoice.invoice_no}`,
      },
    },
    cancelled: {
      customer: {
        statusLabel: "Payment Cancelled",
        title: `Payment session cancelled for invoice ${invoice.invoice_no}`,
        ctaLabel: "Try Payment Again",
        ctaUrl: checkoutLink,
        note: "The checkout session was cancelled or expired. You can reopen the payment page using the button below.",
        subject: `Payment cancelled: Invoice ${invoice.invoice_no}`,
      },
      admin: {
        statusLabel: "Payment Cancelled",
        title: `Payment session cancelled for invoice ${invoice.invoice_no}`,
        ctaLabel: "Review Invoice",
        ctaUrl: invoiceLink,
        note: "The payment session was cancelled or expired. The customer can try again from the public invoice page.",
        subject: `Payment cancelled - Invoice ${invoice.invoice_no}`,
      },
    },
    failed: {
      customer: {
        statusLabel: "Payment Failed",
        title: `Payment failed for invoice ${invoice.invoice_no}`,
        ctaLabel: "Try Again",
        ctaUrl: checkoutLink,
        note: "The payment attempt was not completed. You can try again using the payment link below.",
        subject: `Payment failed: Invoice ${invoice.invoice_no}`,
      },
      admin: {
        statusLabel: "Payment Failed",
        title: `Payment failed for invoice ${invoice.invoice_no}`,
        ctaLabel: "Review Invoice",
        ctaUrl: invoiceLink,
        note: "The payment attempt did not complete. The customer can try again using the public payment link.",
        subject: `Payment failed - Invoice ${invoice.invoice_no}`,
      },
    },
  }

  const fallback = {
    statusLabel: "Invoice Update",
    title: `Invoice ${invoice.invoice_no}`,
    ctaLabel: "Open Invoice",
    ctaUrl: invoiceLink,
    note: "Here is the latest invoice update.",
    subject: `Invoice update - ${invoice.invoice_no}`,
  }

  return templates[status]?.[recipientRole] || fallback
}

export async function sendInvoiceEmailNotifications({ invoice, company, baseUrl, paymentPageUrl, status, adminEmail }) {
  const attachment = buildInvoicePdfAttachment(invoice, company)
  const customerEmail = invoice.data?.billTo?.email || invoice.customer_email || ""
  const sendTasks = []

  if (customerEmail) {
    const customerTemplate = buildInvoiceNotificationEmail({ invoice, company, baseUrl, paymentPageUrl, status, recipientRole: "customer" })
    const customerHtml = buildEmailHtml({
      title: customerTemplate.title,
      invoice,
      company,
      statusLabel: customerTemplate.statusLabel,
      ctaLabel: customerTemplate.ctaLabel,
      ctaUrl: customerTemplate.ctaUrl,
      note: customerTemplate.note,
    })

    sendTasks.push(sendResendEmail({
      to: customerEmail,
      subject: customerTemplate.subject,
      html: customerHtml,
      attachments: [attachment],
    }))
  }

  if (adminEmail) {
    const adminTemplate = buildInvoiceNotificationEmail({ invoice, company, baseUrl, paymentPageUrl, status, recipientRole: "admin" })
    const adminHtml = buildEmailHtml({
      title: adminTemplate.title,
      invoice,
      company,
      statusLabel: adminTemplate.statusLabel,
      ctaLabel: adminTemplate.ctaLabel,
      ctaUrl: adminTemplate.ctaUrl,
      note: adminTemplate.note,
    })

    sendTasks.push(sendResendEmail({
      to: adminEmail,
      subject: adminTemplate.subject,
      html: adminHtml,
      attachments: [attachment],
    }))
  }

  await Promise.all(sendTasks)
}
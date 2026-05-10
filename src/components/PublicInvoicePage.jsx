import React, { useEffect, useRef, useState } from "react"
import InvoicePreview from "./InvoicePreview"
import defaultLogo from "../logo/logo.png"
import { downloadPDF } from "../utils/exportPDF"

const MODE_COPY = {
  invoice: {
    eyebrow: "Invoice Ready",
    title: "Review the invoice and pay online",
    copy: "This invoice is available through your branded public link.",
  },
  pay: {
    eyebrow: "Redirecting to Stripe",
    title: "Opening the secure payment session",
    copy: "Please wait while we create or resume the correct Stripe checkout session.",
  },
  success: {
    eyebrow: "Payment Confirmed",
    title: "Your payment was received",
    copy: "The invoice status has been updated and both sides will receive email confirmation.",
  },
  cancelled: {
    eyebrow: "Payment Not Completed",
    title: "The checkout session was cancelled or expired",
    copy: "You can reopen the payment flow using the invoice link below.",
  },
}

const formatMoney = (value) => {
  const amount = Number(value || 0)
  return `£${amount.toFixed(2)}`
}

export default function PublicInvoicePage({ mode, invoiceNo, sessionId }) {
  const previewRef = useRef(null)
  const [invoicePayload, setInvoicePayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(mode === "pay")
  const [error, setError] = useState("")

  useEffect(() => {
    if (typeof document === "undefined") return

    const titleParts = ["Print Your Vibe"]

    if (mode === "pay") {
      titleParts.push("Secure Payment")
    } else if (mode === "success") {
      titleParts.push("Payment Confirmed")
    } else if (mode === "cancelled") {
      titleParts.push("Payment Update")
    } else if (invoiceNo) {
      titleParts.push(`Invoice ${invoiceNo}`)
    } else {
      titleParts.push("Invoice")
    }

    document.title = titleParts.join(" | ")

    return () => {
      document.title = "Print Your Vibe | Invoices"
    }
  }, [mode, invoiceNo])

  useEffect(() => {
    let active = true

    const fetchInvoice = async () => {
      if (!invoiceNo) {
        if (active) {
          setError("Missing invoice number in the URL.")
          setLoading(false)
          setRedirecting(false)
        }
        return null
      }

      const response = await fetch(`/api/public/invoices/${encodeURIComponent(invoiceNo)}`)
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Unable to load the invoice.")
      }

      return data
    }

    const createSession = async () => {
      const response = await fetch("/api/payments/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNo }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Unable to start the payment session.")
      }

      return data
    }

      const confirmSession = async () => {
        if (!sessionId || (mode !== "success" && mode !== "cancelled")) {
          return null
        }

        const response = await fetch("/api/payments/confirm-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceNo,
            sessionId,
            statusHint: mode === "success" ? "paid" : "cancelled",
          }),
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.error || "Unable to confirm the payment session.")
        }

        return data
      }

    const run = async () => {
      try {
        setLoading(true)
        setError("")

          let payload = null
          if (mode === "success" || mode === "cancelled") {
            payload = await confirmSession()
          }

          if (!payload) {
            payload = await fetchInvoice()
          }

          if (!active || !payload) return

        setInvoicePayload(payload)

        if (mode === "pay") {
          setRedirecting(true)
          const session = await createSession()
          if (!active) return
          window.location.replace(session.checkoutUrl)
        }
      } catch (fetchError) {
        if (active) {
          setError(fetchError.message || "Unable to load the invoice.")
        }
      } finally {
        if (active) {
          setLoading(false)
          setRedirecting(false)
        }
      }
    }

    run()

    return () => {
      active = false
    }
  }, [mode, invoiceNo, sessionId])

  const invoice = invoicePayload?.invoice
  const company = invoicePayload?.company
  const logoSrc = company?.logo_url || invoice?.data?.company?.logo_url || defaultLogo
  const isPaidInvoice = mode === "invoice" && invoice?.status === "paid"
  const copy = isPaidInvoice
    ? {
        eyebrow: "Payment Confirmed",
        title: "This invoice has already been paid",
        copy: "A payment has already been confirmed for this invoice. You can review the details below.",
      }
    : MODE_COPY[mode] || MODE_COPY.invoice
  const statusLabel = mode === "success"
    ? "Paid"
    : mode === "cancelled"
      ? "Cancelled"
      : invoice?.status || "saved"
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const paymentPageUrl = invoice?.payment_page_url || (invoiceNo && origin ? `${origin}/pay/${encodeURIComponent(invoiceNo)}` : "")
  const summaryTone = mode === "success" ? "success" : mode === "cancelled" ? "warning" : "info"
  const showPaymentActions = mode === "invoice" && !isPaidInvoice

  const openInvoice = () => {
    if (invoiceNo) {
      window.location.assign(`/invoice/${encodeURIComponent(invoiceNo)}`)
    }
  }

  const openPayment = () => {
    if (invoiceNo) {
      window.location.assign(`/pay/${encodeURIComponent(invoiceNo)}`)
    }
  }

  const downloadInvoice = async () => {
    if (!previewRef.current) return

    await downloadPDF(previewRef.current, invoice?.invoice_no || invoiceNo || "invoice")
  }

  return (
    <div className="public-page-shell">
      <div className="public-page-hero">
        {logoSrc && <img src={logoSrc} alt="Company logo" className="public-page-logo" />}
        <div className="public-page-badge">{copy.eyebrow}</div>
        <h1>{copy.title}</h1>
        <p>{copy.copy}</p>
      </div>

      <div className="public-page-content">
        {error && <div className="public-page-error">{error}</div>}

        {(loading || redirecting) && !error && (
          <div className="public-page-card">
            <div className="public-page-spinner" />
            <h2>{mode === "pay" ? "Preparing secure checkout" : "Loading invoice"}</h2>
            <p>{mode === "pay" ? "We are creating the correct Stripe checkout session now." : "We are fetching the latest invoice details."}</p>
          </div>
        )}

        {!loading && !redirecting && invoice && (
          <>
            <div className={`public-page-card public-page-card-${summaryTone}`} style={{ marginBottom: 16 }}>
              <h2>{copy.title}</h2>
              <p>{copy.copy}</p>
              {mode === "success" && <p style={{ marginTop: 12, color: "#166534", fontWeight: 700 }}>Payment confirmed. The invoice status has been updated.</p>}
              {mode === "cancelled" && <p style={{ marginTop: 12, color: "#b45309", fontWeight: 700 }}>Payment was not completed. You can try again from this page.</p>}
            </div>

            <div className="public-summary-grid">
              <div className="public-summary-card">
                <span>Status</span>
                <strong>{statusLabel}</strong>
              </div>
              <div className="public-summary-card">
                <span>Invoice</span>
                <strong>{invoice.invoice_no}</strong>
              </div>
              <div className="public-summary-card">
                <span>Total</span>
                <strong>{formatMoney(invoice.total)}</strong>
              </div>
            </div>

            <div className="public-actions">
              {mode !== "pay" && invoice && (
                <button type="button" className="action-btn" onClick={downloadInvoice}>
                  Download Invoice
                </button>
              )}

              {showPaymentActions && (
                <button type="button" className="action-btn" onClick={openPayment}>
                  Pay Now
                </button>
              )}

              {mode === "success" && (
                <button type="button" className="action-btn" onClick={openInvoice}>
                  View Invoice
                </button>
              )}

              {mode === "cancelled" && (
                <>
                  <button type="button" className="action-btn" onClick={openPayment}>
                    Try Payment Again
                  </button>
                  <button type="button" className="tab-btn" onClick={openInvoice}>
                    Open Invoice
                  </button>
                </>
              )}

              {showPaymentActions && paymentPageUrl && (
                <button type="button" className="tab-btn" onClick={openInvoice}>
                  Open Public Invoice Link
                </button>
              )}
            </div>

            <div className="public-preview-card">
              <InvoicePreview ref={previewRef} invoiceData={invoice.data} logoSrc={logoSrc} />
            </div>
          </>
        )}

        {!loading && !redirecting && !invoice && !error && (
          <div className="public-page-card">
            <h2>No invoice data available</h2>
            <p>The requested invoice could not be loaded.</p>
          </div>
        )}
      </div>
    </div>
  )
}
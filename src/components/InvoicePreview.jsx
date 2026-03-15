import React, { forwardRef } from "react"
import InvoiceTable from "./InvoiceTable"

const TEAL = "#2a7f8e"

const fmt = (n) => {
  const value = parseFloat(n || 0)
  const fixed = value.toFixed(2)
  return `£${fixed.endsWith(".00") ? String(value) : fixed}`
}

const InvoicePreview = forwardRef(({ invoiceData, logoSrc }, ref) => {
  const { company, invoice, billTo, payment, items, terms, thankYou } = invoiceData

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0), 0)
  const total = subtotal

  return (
    <div ref={ref} className="invoice-preview" id="inv">
      <div className="invoice-watermark" aria-hidden="true">
        <img src={logoSrc} alt="" />
      </div>

      <div className="invoice-bar" />

      <div className="invoice-head">
        <div>{logoSrc && <img src={logoSrc} alt="Logo" className="invoice-logo" />}</div>

        <div className="invoice-card">
          <div className="invoice-card-title">Invoice #{invoice.number}</div>
          <div className="invoice-card-row">
            <span>Issued</span>
            <span>{invoice.issued}</span>
          </div>
          <div className="invoice-card-row alt">
            <span>Delivery</span>
            <span>{invoice.delivery}</span>
          </div>
          <div className="invoice-card-row">
            <span>Due</span>
            <span>{fmt(total)}</span>
          </div>
          <div className="invoice-card-total">
            <span>Total</span>
            <span>{fmt(total)}</span>
          </div>
        </div>
      </div>

      <div className="invoice-two-col">
        <section>
          <h4>Service Provider</h4>
          <p>{company.name}</p>
          <p>{company.phone}</p>
          <p>{company.address}</p>
          <p>{company.email}</p>
        </section>

        <section>
          <h4>Bill To</h4>
          <p>{billTo.name}</p>
          <p>{billTo.phone}</p>
          <p>{billTo.email}</p>
        </section>
      </div>

      <div className="invoice-payment-row">
        <div></div>
        <section>
          <h4>Payment Details</h4>
          <p>Account Name: {payment.accountName}</p>
          <p>Account Number: {payment.accountNumber}</p>
          <p>Sort Code: {payment.sortCode}</p>
        </section>
      </div>

      <div className="service-heading">For Service Rendered</div>
      <InvoiceTable items={items} />

      <div className="totals-wrap">
        <div className="totals-box">
          <div className="totals-row">
            <span>Delivery Cost</span>
            <span>£0.00</span>
          </div>
          <div className="totals-row subtotal">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="totals-row">
            <span>Tax</span>
            <span>£0.00</span>
          </div>
          <div className="totals-grand">
            <span>Total (Inclusive vat)</span>
            <span>{fmt(total)}</span>
          </div>
        </div>
      </div>

      <section className="terms-wrap">
        <h4>Terms &amp; Conditions</h4>
        <ol>
          {terms.map((term, index) => (
            <li key={index}>{term}</li>
          ))}
        </ol>
      </section>

      <footer className="invoice-footer">
        <p>For any questions or assistance, our team is always here to help.</p>
        <strong>{thankYou}</strong>
      </footer>

      <div className="invoice-bar" style={{ background: TEAL }} />
    </div>
  )
})

export default InvoicePreview

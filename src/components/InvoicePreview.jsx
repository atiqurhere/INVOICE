import React, { forwardRef } from "react"
import InvoiceTable from "./InvoiceTable"

const fmt = (n) => {
  const value = parseFloat(n || 0)
  const fixed = value.toFixed(2)
  return `£${fixed.endsWith(".00") ? String(value) : fixed}`
}

const InvoicePreview = forwardRef(({ invoiceData, logoSrc }, ref) => {
  const { company, invoice, billTo, payment, items, terms, thankYou, totals } = invoiceData

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0), 0)
  const delivery = parseFloat(totals?.delivery) || 0
  const tax = parseFloat(totals?.tax) || 0
  const total = subtotal + delivery + tax

  return (
    <div ref={ref} className="invoice-preview" id="inv">
      <div className="invoice-bar-top" />
      <div className="invoice-watermark" aria-hidden="true">
        <img src={logoSrc} alt="" />
      </div>

      <div className="invoice-header-row">
        <div className="header-left">
          {logoSrc && <img src={logoSrc} alt="Logo" className="invoice-logo" />}
          <section className="service-provider">
            <h4>Service Provider</h4>
            <p>{company.name}</p>
            <p>{company.phone}</p>
            <p>{company.address}</p>
            <p>{company.email}</p>
          </section>
        </div>
        
        <div className="header-right">
          <div className="invoice-number-box">
            Invoice #{invoice.number}
          </div>
          <div className="invoice-dates-box">
            <div className="date-row"><span>Issued</span><span>{invoice.issued}</span></div>
            <div className="date-row"><span>Delivery</span><span>{invoice.delivery}</span></div>
            <div className="date-row"><span>Due</span><span>{fmt(total)}</span></div>
          </div>
          <div className="invoice-total-box">
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        </div>
      </div>

      <div className="invoice-two-col meta-row">
        <section>
          <h4>Bill To</h4>
          <p>{billTo.name}</p>
          <p>{billTo.phone}</p>
          <p>{billTo.email}</p>
        </section>
        <section>
          <h4>Payment Details</h4>
          <p>Account Name: {payment.accountName}</p>
          <p>Account Number: {payment.accountNumber}</p>
          <p>Sort Code: {payment.sortCode}</p>
        </section>
      </div>

      <div className="service-heading">For Service Renderd</div>
      <InvoiceTable items={items} />

      <div className="totals-wrap">
        <div className="totals-box">
          <div className="totals-row">
            <span>Delivery Cost</span>
            <span>{fmt(delivery)}</span>
          </div>
          <div className="totals-row subtotal">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="totals-row">
            <span>Tax</span>
            <span>{fmt(tax)}</span>
          </div>
          <div className="totals-grand total-red">
            <span>Total (Inclusive vat)</span>
            <span>{fmt(total)}</span>
          </div>
        </div>
      </div>

      <section className="terms-wrap">
        <h4>Terms &amp; Conditions</h4>
        {terms.map((term, index) => (
          <div key={index} className="term-line">{term}</div>
        ))}
      </section>

      <footer className="invoice-footer">
        <p>For any questions or assistance, our team is always here to help.</p>
        <strong>{thankYou}</strong>
      </footer>

      <div className="invoice-bar-bottom" />
    </div>
  )
})

export default InvoicePreview

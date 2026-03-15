import React from "react"

export default function InvoiceTable({ items = [] }) {
  const fmt = (n) => {
    const value = parseFloat(n || 0)
    const fixed = value.toFixed(2)
    return `£${fixed.endsWith(".00") ? String(value) : fixed}`
  }

  return (
    <table className="invoice-table">
      <thead>
        <tr>
          <th>PRODUCT/SERVICE DETAILS</th>
          <th className="c">QTY.</th>
          <th className="c">PRICE (PER PRODUCT)</th>
          <th className="r">AMOUNT</th>
        </tr>
      </thead>

      <tbody>
        {items.map((item, i) => {
          const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)
          return (
            <tr key={i}>
              <td style={{ fontWeight: 600 }}>{item.description}</td>
              <td className="c" style={{ fontWeight: 600 }}>{item.qty}</td>
              <td className="c" style={{ fontWeight: 600 }}>{fmt(item.price)}</td>
              <td className="r" style={{ fontWeight: 600 }}>{fmt(amount)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

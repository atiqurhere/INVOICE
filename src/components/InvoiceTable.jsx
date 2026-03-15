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
          <th>Product/Service Details</th>
          <th>Qty.</th>
          <th>Price (Per Product)</th>
          <th>Amount</th>
        </tr>
      </thead>

      <tbody>
        {items.map((item, i) => {
          const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)
          return (
            <tr key={i}>
              <td>{item.description}</td>
              <td className="c">{item.qty}</td>
              <td className="r">{fmt(item.price)}</td>
              <td className="r">{fmt(amount)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

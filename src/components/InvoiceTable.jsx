import React from "react"

export default function InvoiceTable({ items = [] }) {

const subtotal = items.reduce(
  (sum, item) => sum + item.qty * item.price,
  0
)

return (

<div>

<table className="w-full mt-6 border-collapse">

<thead className="bg-teal-700 text-white">

<tr>

<th className="text-left p-3">Product / Service Details</th>

<th className="p-3">Qty</th>

<th className="p-3">Price (Per Product)</th>

<th className="p-3">Amount</th>

</tr>

</thead>

<tbody>

{items.map((item, i) => {

const amount = item.qty * item.price

return (

<tr key={i} className="border-b">

<td className="p-3">{item.product}</td>

<td className="p-3 text-center">{item.qty}</td>

<td className="p-3 text-center">£{item.price}</td>

<td className="p-3 text-center font-medium">£{amount}</td>

</tr>

)

})}

</tbody>

</table>

</div>

)

}

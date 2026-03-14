import React, { forwardRef } from "react"
import InvoiceTable from "./InvoiceTable"

const InvoicePreview = forwardRef(({ invoice }, ref) => {

const subtotal = invoice.items?.reduce(
  (sum, item) => sum + item.qty * item.price,
  0
) || 0

const vat = subtotal * 0.2
const total = subtotal + vat

return (

<div ref={ref} className="bg-white p-10 w-[800px] mx-auto shadow">

<div className="border-t-4 border-teal-700 mb-6"></div>

<div className="flex justify-between">

<div>

<h1 className="text-2xl font-bold text-teal-800">
PRINT YOUR VIBE
</h1>

<h3 className="mt-6 font-bold">Bill To</h3>

<p>{invoice.customer}</p>
<p>{invoice.phone}</p>
<p>{invoice.email}</p>

</div>

<div className="bg-teal-700 text-white p-5 rounded">

<h3 className="text-lg font-semibold">
Invoice #{invoice.invoice_no}
</h3>

</div>

</div>

<InvoiceTable items={invoice.items} />

<div className="text-right mt-6">

<p>Subtotal £{subtotal.toFixed(2)}</p>

<p>VAT £{vat.toFixed(2)}</p>

<h2 className="text-red-600 font-bold text-xl">
Total £{total.toFixed(2)}
</h2>

</div>

</div>

)
})

export default InvoicePreview

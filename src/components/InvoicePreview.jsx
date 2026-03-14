import React, {forwardRef} from "react"

const InvoicePreview = forwardRef(({invoice},ref)=>{

const subtotal = invoice.items?.reduce((sum,i)=>sum + i.qty*i.price,0) || 0
const vat = subtotal * 0.2
const total = subtotal + vat

return(

<div ref={ref} className="bg-white p-10 w-[800px] mx-auto">

<div className="border-t-4 border-teal-700 mb-6"></div>

<div className="flex justify-between">

<div>

<h1 className="text-2xl font-bold">PRINT YOUR VIBE</h1>

<h3 className="mt-4 font-bold">Bill To</h3>

<p>{invoice.customer}</p>
<p>{invoice.phone}</p>
<p>{invoice.email}</p>

</div>

<div className="bg-teal-700 text-white p-4">

<h3>Invoice {invoice.invoice_no}</h3>

</div>

</div>

<table className="w-full mt-6">

<thead className="bg-teal-700 text-white">

<tr>
<th>Product</th>
<th>Qty</th>
<th>Price</th>
<th>Amount</th>
</tr>

</thead>

<tbody>

{invoice.items?.map((item,i)=>{

const amount=item.qty*item.price

return(

<tr key={i}>

<td>{item.product}</td>
<td>{item.qty}</td>
<td>£{item.price}</td>
<td>£{amount}</td>

</tr>

)

})}

</tbody>

</table>

<div className="text-right mt-6">

<p>Subtotal £{subtotal}</p>
<p>VAT £{vat}</p>

<h2 className="text-red-600 font-bold">Total £{total}</h2>

</div>

</div>

)
})

export default InvoicePreview

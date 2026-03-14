import { useState } from "react"

export default function InvoiceEditor({setInvoice}){

const [items,setItems] = useState([
{product:"",qty:1,price:0}
])

const updateItem=(i,key,val)=>{

const newItems=[...items]
newItems[i][key]=val

setItems(newItems)

setInvoice(prev=>({...prev,items:newItems}))
}

const addRow=()=>{

setItems([...items,{product:"",qty:1,price:0}])

}

return(

<div className="p-4">

<h2 className="text-xl font-bold mb-4">Invoice Details</h2>

<input placeholder="Customer Name"
className="input"
onChange={e=>setInvoice(p=>({...p,customer:e.target.value}))}
/>

<input placeholder="Phone"
className="input"
onChange={e=>setInvoice(p=>({...p,phone:e.target.value}))}
/>

<input placeholder="Email"
className="input"
onChange={e=>setInvoice(p=>({...p,email:e.target.value}))}
/>

<table className="table-auto w-full mt-4">

<thead>
<tr>
<th>Product</th>
<th>Qty</th>
<th>Price</th>
</tr>
</thead>

<tbody>

{items.map((item,i)=>(
<tr key={i}>

<td>
<input
value={item.product}
onChange={e=>updateItem(i,"product",e.target.value)}
/>
</td>

<td>
<input
type="number"
value={item.qty}
onChange={e=>updateItem(i,"qty",e.target.value)}
/>
</td>

<td>
<input
type="number"
value={item.price}
onChange={e=>updateItem(i,"price",e.target.value)}
/>
</td>

</tr>
))}

</tbody>

</table>

<button onClick={addRow} className="mt-3 bg-blue-500 text-white px-4 py-2">
Add Product
</button>

</div>

)
}

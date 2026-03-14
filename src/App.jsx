import { useRef,useState } from "react"

import InvoiceEditor from "./components/InvoiceEditor"
import InvoicePreview from "./components/InvoicePreview"
import RecentInvoices from "./components/RecentInvoices"

import { downloadPDF,downloadJPG } from "./utils/exportPDF"
import { generateInvoiceNumber } from "./utils/invoiceNumber"

export default function App(){

const ref = useRef()

const [invoice,setInvoice] = useState({

invoice_no:generateInvoiceNumber(),
items:[]

})

return(

<div className="grid grid-cols-2 gap-6 p-6">

<div>

<InvoiceEditor setInvoice={setInvoice}/>

<button onClick={()=>downloadPDF(ref.current)}>
Download PDF
</button>

<button onClick={()=>downloadJPG(ref.current)}>
Download JPG
</button>

<button onClick={()=>window.print()}>
Print
</button>

<RecentInvoices/>

</div>

<InvoicePreview ref={ref} invoice={invoice}/>

</div>

)
}

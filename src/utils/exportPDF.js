import html2canvas from "html2canvas"
import jsPDF from "jspdf"

const CANVAS_OPTIONS = {
  useCORS: true,
  allowTaint: true,
  scale: 2,
  windowWidth: 1024,
  onclone: (doc) => {
    const el = doc.getElementById('inv')
    if (el) { el.style.width = "800px"; el.style.maxWidth = "none"; }
  }
}

export const downloadPDF = async (ref) => {
  const canvas = await html2canvas(ref, CANVAS_OPTIONS)
  const img = canvas.toDataURL("image/png")
  const pdf = new jsPDF()
  pdf.addImage(img, "PNG", 0, 0, 210, 297)
  pdf.save("invoice.pdf")
}

export const downloadJPG = async (ref) => {
  const canvas = await html2canvas(ref, CANVAS_OPTIONS)
  const link = document.createElement("a")
  link.download = "invoice.jpg"
  link.href = canvas.toDataURL()
  link.click()
}

export const printInvoice = async (ref) => {
  const canvas = await html2canvas(ref, CANVAS_OPTIONS)
  const imgData = canvas.toDataURL("image/png")

  const win = window.open("", "_blank")
  if (!win) return

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #fff; }
        img { width: 100%; display: block; }
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0; }
          img { width: 100%; page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <img src="${imgData}" onload="window.print(); window.close();" />
    </body>
    </html>
  `)
  win.document.close()
}

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

  // Create an invisible iframe to handle the print dialogue on mobile & desktop
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Invoice</title>
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
    <body onload="window.focus(); window.print();">
      <img src="${imgData}" />
    </body>
    </html>
  `)
  doc.close()

  // Clean up the iframe after a generous delay assuming the print dialog was opened/closed
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
    }
  }, 10000)
}

import html2canvas from "html2canvas"
import jsPDF from "jspdf"

export const downloadPDF = async (ref)=>{

const canvas = await html2canvas(ref)

const img = canvas.toDataURL("image/png")

const pdf = new jsPDF()

pdf.addImage(img,"PNG",0,0,210,297)

pdf.save("invoice.pdf")

}

export const downloadJPG = async (ref)=>{

const canvas = await html2canvas(ref)

const link = document.createElement("a")

link.download="invoice.jpg"

link.href = canvas.toDataURL()

link.click()

}

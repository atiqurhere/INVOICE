import html2canvas from "html2canvas"
import jsPDF from "jspdf"

export const downloadPDF = async (ref)=>{

const canvas = await html2canvas(ref, { 
    useCORS: true, 
    allowTaint: true, 
    scale: 2, 
    windowWidth: 1024,
    onclone: (doc) => {
      // Force the cloned invoice container to a specific desktop width to guarantee identical rendering logic across all devices
      const el = doc.getElementById('inv')
      if(el) { el.style.width = "800px"; el.style.maxWidth = "none"; }
    }
})

const img = canvas.toDataURL("image/png")

const pdf = new jsPDF()

pdf.addImage(img,"PNG",0,0,210,297)

pdf.save("invoice.pdf")

}

export const downloadJPG = async (ref)=>{

const canvas = await html2canvas(ref, { 
    useCORS: true, 
    allowTaint: true, 
    scale: 2,
    windowWidth: 1024,
    onclone: (doc) => {
      const el = doc.getElementById('inv')
      if(el) { el.style.width = "800px"; el.style.maxWidth = "none"; }
    }
})

const link = document.createElement("a")

link.download="invoice.jpg"

link.href = canvas.toDataURL()

link.click()

}

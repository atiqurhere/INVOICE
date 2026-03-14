export const generateInvoiceNumber = () => {

const now = new Date()

const year = now.getFullYear()

const random = Math.floor(Math.random()*900+100)

return `INV-${year}-${random}`

}

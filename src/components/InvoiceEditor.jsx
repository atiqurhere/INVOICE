import React from "react"

const TEAL = "#2a7f8e"

function Field({ label, value, onChange, type = "text", textarea = false }) {
	return (
		<div className="field-wrap">
			<label className="field-label">{label}</label>
			{textarea ? (
				<textarea className="field-input" value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
			) : (
				<input className="field-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
			)}
		</div>
	)
}

export default function InvoiceEditor({ logoSrc, onLogoChange, data, setData }) {
	const { company, invoice, billTo, payment, items, terms, thankYou } = data

	const setCompany = (patch) => setData((prev) => ({ ...prev, company: { ...prev.company, ...patch } }))
	const setInvoice = (patch) => setData((prev) => ({ ...prev, invoice: { ...prev.invoice, ...patch } }))
	const setBillTo = (patch) => setData((prev) => ({ ...prev, billTo: { ...prev.billTo, ...patch } }))
	const setPayment = (patch) => setData((prev) => ({ ...prev, payment: { ...prev.payment, ...patch } }))

	const updateItem = (index, key, value) => {
		setData((prev) => {
			const nextItems = [...prev.items]
			nextItems[index] = { ...nextItems[index], [key]: value }
			return { ...prev, items: nextItems }
		})
	}

	const removeItem = (index) => {
		setData((prev) => ({
			...prev,
			items: prev.items.filter((_, i) => i !== index),
		}))
	}

	const addItem = () => {
		setData((prev) => ({
			...prev,
			items: [...prev.items, { description: "", qty: 1, price: 0 }],
		}))
	}

	const updateTerm = (index, value) => {
		setData((prev) => {
			const nextTerms = [...prev.terms]
			nextTerms[index] = value
			return { ...prev, terms: nextTerms }
		})
	}

	const removeTerm = (index) => {
		setData((prev) => ({
			...prev,
			terms: prev.terms.filter((_, i) => i !== index),
		}))
	}

	const addTerm = () => {
		setData((prev) => ({ ...prev, terms: [...prev.terms, ""] }))
	}

	return (
		<div>
			<section className="editor-section">
				<h3 className="section-title">Company / Service Provider</h3>
				<div className="logo-row">
					<img src={logoSrc} alt="Current logo" className="logo-preview" />
					<input type="file" accept="image/*" onChange={onLogoChange} className="logo-input" />
				</div>
				<Field label="Company Name" value={company.name} onChange={(v) => setCompany({ name: v })} />
				<Field label="Phone" value={company.phone} onChange={(v) => setCompany({ phone: v })} />
				<Field label="Address" value={company.address} onChange={(v) => setCompany({ address: v })} />
				<Field label="Email" value={company.email} onChange={(v) => setCompany({ email: v })} />
			</section>

			<section className="editor-section">
				<h3 className="section-title">Invoice Details</h3>
				<Field label="Invoice Number" value={invoice.number} onChange={(v) => setInvoice({ number: v })} />
				<Field label="Issue Date" type="date" value={invoice.issued} onChange={(v) => setInvoice({ issued: v })} />
				<Field label="Delivery Date" type="date" value={invoice.delivery} onChange={(v) => setInvoice({ delivery: v })} />
			</section>

			<section className="editor-section">
				<h3 className="section-title">Bill To</h3>
				<Field label="Client Name" value={billTo.name} onChange={(v) => setBillTo({ name: v })} />
				<Field label="Phone" value={billTo.phone} onChange={(v) => setBillTo({ phone: v })} />
				<Field label="Email" value={billTo.email} onChange={(v) => setBillTo({ email: v })} />
			</section>

			<section className="editor-section">
				<h3 className="section-title">Payment Details</h3>
				<Field label="Account Name" value={payment.accountName} onChange={(v) => setPayment({ accountName: v })} />
				<Field label="Account Number" value={payment.accountNumber} onChange={(v) => setPayment({ accountNumber: v })} />
				<Field label="Sort Code" value={payment.sortCode} onChange={(v) => setPayment({ sortCode: v })} />
			</section>

			<section className="editor-section">
				<h3 className="section-title">Line Items</h3>
				<table className="editor-items-table">
					<thead>
						<tr>
							<th>Description</th>
							<th>Qty</th>
							<th>Price (£)</th>
							<th>Amount</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{items.map((item, i) => {
							const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)
							return (
								<tr key={i}>
									<td>
										<input
											className="field-input"
											value={item.description}
											onChange={(e) => updateItem(i, "description", e.target.value)}
										/>
									</td>
									<td>
										<input
											className="field-input"
											type="number"
											value={item.qty}
											onChange={(e) => updateItem(i, "qty", e.target.value)}
										/>
									</td>
									<td>
										<input
											className="field-input"
											type="number"
											step="0.01"
											value={item.price}
											onChange={(e) => updateItem(i, "price", e.target.value)}
										/>
									</td>
									<td className="amount-cell">£{amount.toFixed(2)}</td>
									<td>
										<button type="button" className="danger-btn" onClick={() => removeItem(i)}>
											Remove
										</button>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
				<button type="button" className="add-btn" onClick={addItem} style={{ background: TEAL }}>
					Add Item
				</button>
			</section>

			<section className="editor-section">
				<h3 className="section-title">Additional Totals</h3>
				<Field label="Delivery Cost (£)" type="number" value={data.totals?.delivery || 0} onChange={(v) => setData(prev => ({ ...prev, totals: { ...prev.totals, delivery: parseFloat(v) || 0 } }))} />
				<Field label="Tax (£)" type="number" value={data.totals?.tax || 0} onChange={(v) => setData(prev => ({ ...prev, totals: { ...prev.totals, tax: parseFloat(v) || 0 } }))} />
				<Field label="Amount Paid (£)" type="number" value={data.totals?.paid || 0} onChange={(v) => setData(prev => ({ ...prev, totals: { ...prev.totals, paid: parseFloat(v) || 0 } }))} />
				<Field label="Amount Due (£)" type="number" value={data.totals?.due || 0} onChange={(v) => setData(prev => ({ ...prev, totals: { ...prev.totals, due: parseFloat(v) || 0 } }))} />
			</section>

			<section className="editor-section">
				<h3 className="section-title">Terms &amp; Conditions</h3>
				{terms.map((term, i) => (
					<div className="term-row" key={i}>
						<span className="term-index">{i + 1}.</span>
						<textarea className="field-input" rows={2} value={term} onChange={(e) => updateTerm(i, e.target.value)} />
						<button type="button" className="danger-btn" onClick={() => removeTerm(i)}>
							Remove
						</button>
					</div>
				))}
				<button type="button" className="add-btn" onClick={addTerm} style={{ background: TEAL }}>
					Add Term
				</button>
			</section>

			<section className="editor-section">
				<h3 className="section-title">Footer Message</h3>
				<Field label="Thank You Message" value={thankYou} onChange={(v) => setData((prev) => ({ ...prev, thankYou: v }))} />
			</section>
		</div>
	)
}

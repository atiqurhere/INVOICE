import React, { useEffect, useState, useRef } from "react"
import { supabase } from "../lib/supabase"
import InvoicePreview from "./InvoicePreview"
import { downloadPDF, downloadJPG, printInvoice } from "../utils/exportPDF"
import defaultLogo from "../logo/logo.png"

export default function Dashboard({ session, onEdit }) {
	const modalRef = useRef(null)

	const [invoices, setInvoices] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState("")

	const [viewingInvoice, setViewingInvoice] = useState(null)
	const [isExportOpen, setIsExportOpen] = useState(false)

	const [company, setCompany] = useState({
		company_name: "Print your vibe",
		phone: "+44 7983 567819",
		address: "270 Teviot St, London E14 6QS, UK",
		email: "info@printyourvibe.com",
		payment_account_name: "",
		payment_account_number: "",
		payment_sort_code: "",
		logo_url: ""
	})
	const [isEditingCompany, setIsEditingCompany] = useState(false)
	const [savingCompany, setSavingCompany] = useState(false)
	const [uploadingLogo, setUploadingLogo] = useState(false)

	const [stats, setStats] = useState({
		daily: 0,
		weekly: 0,
		monthly: 0,
		yearly: 0,
		lifetime: 0
	})

	useEffect(() => {
		if (session?.user) {
			fetchCompanyConfig()
			fetchInvoices()
		}
	}, [session])

	const fetchCompanyConfig = async () => {
		const { data, error } = await supabase
			.from("company_config")
			.select("*")
			.eq("user_id", session.user.id)
			.single()

		if (data) {
			setCompany(data)
		}
	}

	const fetchInvoices = async () => {
		setLoading(true)
		setError("")

		const { data, error: qErr } = await supabase
			.from("invoices")
			.select("*")
			.eq("user_id", session.user.id)
			.order("created_at", { ascending: false })

		if (qErr) {
			setError(qErr.message)
		} else {
			setInvoices(data || [])
			calculateStats(data || [])
		}
		
		setLoading(false)
	}

	const calculateStats = (records) => {
		const now = new Date()
		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
		const startOfWeek = new Date(startOfDay - now.getDay() * 24 * 60 * 60 * 1000).getTime()
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
		const startOfYear = new Date(now.getFullYear(), 0, 1).getTime()

		let d = 0, w = 0, m = 0, y = 0, l = 0

		records.forEach((inv) => {
			// Do not calculate Drafts into revenue!
			if (inv.status !== 'saved') return

			const invoiceDate = new Date(inv.created_at).getTime()
			const val = parseFloat(inv.total) || 0

			l += val
			
			if (invoiceDate >= startOfYear) {
				y += val
				if (invoiceDate >= startOfMonth) {
					m += val
					if (invoiceDate >= startOfWeek) {
						w += val
						if (invoiceDate >= startOfDay) {
							d += val
						}
					}
				}
			}
		})

		setStats({
			daily: d,
			weekly: w,
			monthly: m,
			yearly: y,
			lifetime: l
		})
	}

	const handleDelete = async (id) => {
		if (!window.confirm("Are you sure you want to delete this invoice entirely?")) return

		const { error } = await supabase
			.from("invoices")
			.delete()
			.eq("id", id)

		if (error) {
			alert("Error deleting invoice: " + error.message)
		} else {
			if (viewingInvoice?.id === id) setViewingInvoice(null)
			fetchInvoices() // Refresh the list
		}
	}

	const handleEditFromModal = () => {
		onEdit(viewingInvoice.data, viewingInvoice.status)
		setViewingInvoice(null)
	}

	const saveCompanySettings = async () => {
		setSavingCompany(true)
		const { error } = await supabase
			.from("company_config")
			.upsert({
				user_id: session.user.id,
				...company,
				updated_at: new Date()
			})

		setSavingCompany(false)
		if (error) {
			alert("Error saving company settings: " + error.message)
		} else {
			setIsEditingCompany(false)
		}
	}

	const handleLogoUpload = async (e) => {
		const file = e.target.files[0]
		if (!file) return

		setUploadingLogo(true)
		const fileExt = file.name.split('.').pop()
		const fileName = `${session.user.id}-${Math.random()}.${fileExt}`
		const filePath = `public/${fileName}`

		const { error: uploadError } = await supabase.storage
			.from('logos')
			.upload(filePath, file)

		if (uploadError) {
			alert("Error uploading logo: " + uploadError.message)
			setUploadingLogo(false)
			return
		}

		const { data } = supabase.storage.from('logos').getPublicUrl(filePath)
		setCompany({ ...company, logo_url: data.publicUrl })
		setUploadingLogo(false)
	}

	if (loading) {
		return <div style={{ padding: 40, textAlign: "center" }}>Loading dashboard...</div>
	}

	if (error) {
		return <div className="login-error">Error: {error}</div>
	}

	return (
		<div className="dashboard-container">
			<div className="dashboard-settings-card">
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
					<h3 style={{ margin: 0 }}>Company Profile</h3>
					{!isEditingCompany && (
						<button className="dash-action-btn edit-btn" onClick={() => setIsEditingCompany(true)}>
							Edit Profile
						</button>
					)}
				</div>

				{!isEditingCompany ? (
					<div className="company-profile-view">
						{company.logo_url ? (
							<img src={company.logo_url} alt="Company Logo" className="company-logo-preview" />
						) : (
							<div className="company-logo-placeholder">No Logo</div>
						)}
						<div>
							<h4 style={{ margin: "0 0 4px", fontSize: "18px", color: "#0f172a" }}>{company.company_name}</h4>
							<p style={{ margin: "0 0 2px", fontSize: "14px", color: "#64748b" }}>{company.address}</p>
							<p style={{ margin: "0 0 2px", fontSize: "14px", color: "#64748b" }}>{company.email}</p>
							<p style={{ margin: "0 0 12px", fontSize: "14px", color: "#64748b" }}>{company.phone}</p>

							{(company.payment_account_name || company.payment_account_number) && (
								<div style={{ background: "#e2e8f0", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", color: "#475569" }}>
									<strong style={{ display: "block", marginBottom: "4px", color: "#334155" }}>Bank Details</strong>
									{company.payment_account_name && <div>Name: {company.payment_account_name}</div>}
									{company.payment_account_number && <div>Account: {company.payment_account_number}</div>}
									{company.payment_sort_code && <div>Sort Code: {company.payment_sort_code}</div>}
								</div>
							)}
						</div>
					</div>
				) : (
					<>
						<p>These details will be used as the default sender information for all new invoices.</p>
						<div className="config-grid">
							<div className="field-wrap">
								<label className="field-label">Company Name</label>
								<input className="field-input" value={company.company_name} onChange={e => setCompany({...company, company_name: e.target.value})} />
							</div>
							<div className="field-wrap">
								<label className="field-label">Phone Number</label>
								<input className="field-input" value={company.phone} onChange={e => setCompany({...company, phone: e.target.value})} />
							</div>
							<div className="field-wrap">
								<label className="field-label">Email Address</label>
								<input className="field-input" value={company.email} onChange={e => setCompany({...company, email: e.target.value})} />
							</div>
							<div className="field-wrap">
								<label className="field-label">Physical Address</label>
								<input className="field-input" value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
							</div>
							<div className="field-wrap">
								<label className="field-label">Bank Account Name</label>
								<input className="field-input" value={company.payment_account_name} onChange={e => setCompany({...company, payment_account_name: e.target.value})} />
							</div>
							<div className="field-wrap">
								<label className="field-label">Account Number</label>
								<input className="field-input" value={company.payment_account_number} onChange={e => setCompany({...company, payment_account_number: e.target.value})} />
							</div>
							<div className="field-wrap">
								<label className="field-label">Sort Code</label>
								<input className="field-input" value={company.payment_sort_code} onChange={e => setCompany({...company, payment_sort_code: e.target.value})} />
							</div>
							<div className="field-wrap logo-upload-wrap">
								<label className="field-label">Company Logo</label>
								<div className="logo-row" style={{ marginTop: 8 }}>
									{company.logo_url ? (
										<img src={company.logo_url} alt="Company Logo" className="logo-preview" style={{ width: 80, height: 80, objectFit: "contain", background: "#f8f9fa", borderRadius: 8, padding: 4 }} />
									) : (
										<div style={{ width: 80, height: 80, background: "#f1f5f9", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8" }}>No Logo</div>
									)}
									<input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} className="logo-input" />
								</div>
							</div>
						</div>
						<div style={{ display: "flex", gap: "8px", marginTop: 16 }}>
							<button className="action-btn" onClick={saveCompanySettings} disabled={savingCompany || uploadingLogo} style={{ background: "#059669" }}>
								{savingCompany ? "Saving..." : "Save Profile"}
							</button>
							<button className="danger-btn" onClick={() => setIsEditingCompany(false)} disabled={savingCompany || uploadingLogo}>
								Cancel
							</button>
						</div>
					</>
				)}
			</div>

			<div className="dashboard-stats-grid">
				<div className="stat-card">
					<h4>Today's Sales</h4>
					<p>£{stats.daily.toFixed(2)}</p>
				</div>
				<div className="stat-card">
					<h4>This Week</h4>
					<p>£{stats.weekly.toFixed(2)}</p>
				</div>
				<div className="stat-card">
					<h4>This Month</h4>
					<p>£{stats.monthly.toFixed(2)}</p>
				</div>
				<div className="stat-card">
					<h4>This Year</h4>
					<p>£{stats.yearly.toFixed(2)}</p>
				</div>
				<div className="stat-card lifetime-card">
					<h4>Lifetime Total</h4>
					<p>£{stats.lifetime.toFixed(2)}</p>
				</div>
			</div>

			<div className="dashboard-table-wrap">
				<h3>Manage Invoices</h3>
				<div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
				<table className="dashboard-table">
					<thead>
						<tr>
							<th>Date Created</th>
							<th>Invoice #</th>
							<th>Status</th>
							<th>Customer</th>
							<th>Total Amount</th>
							<th className="action-col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{invoices.length === 0 ? (
							<tr>
								<td colSpan="6" style={{ textAlign: "center", padding: 20 }}>No invoices found.</td>
							</tr>
						) : (
							invoices.map((inv) => (
								<tr key={inv.id}>
									<td>{new Date(inv.created_at).toLocaleDateString()}</td>
									<td>{inv.invoice_no}</td>
									<td>
										<span style={{ 
											padding: "4px 8px", 
											borderRadius: "4px", 
											fontSize: "12px", 
											fontWeight: "600",
											backgroundColor: inv.status === 'draft' ? '#fef3c7' : '#dcfce3',
											color: inv.status === 'draft' ? '#92400e' : '#166534'
										}}>
											{inv.status === 'draft' ? "Draft" : "Saved"}
										</span>
									</td>
									<td>{inv.customer}</td>
									<td>£{Number(inv.total).toFixed(2)}</td>
									<td className="action-col">
										<button 
											className="dash-action-btn edit-btn" 
											onClick={() => setViewingInvoice(inv)}
										>
											View
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
				</div>
			</div>

			{/* INVOICE VIEWER MODAL */}
			{viewingInvoice && (
				<div className="modal-overlay" onClick={() => setViewingInvoice(null)}>
					<div className="modal-content" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h2>Viewing {viewingInvoice.invoice_no}</h2>
							
							<div className="modal-actions">
								<button className="dash-action-btn edit-btn" onClick={handleEditFromModal}>
									Edit Details
								</button>
								<button className="dash-action-btn delete-btn" onClick={() => handleDelete(viewingInvoice.id)}>
									Delete
								</button>
								
								<div className="export-dropdown-wrapper" style={{ marginLeft: "8px" }}>
									<button 
										className="dash-action-btn action-btn" 
										style={{ background: "#2a7f8e", color: "#fff" }}
										onClick={() => setIsExportOpen(!isExportOpen)}
									>
										Export ▼
									</button>
									{isExportOpen && (
										<div className="export-dropdown-menu">
											<button onClick={() => { downloadPDF(modalRef.current, viewingInvoice.invoice_no); setIsExportOpen(false) }}>Download PDF</button>
											<button onClick={() => { downloadJPG(modalRef.current, viewingInvoice.invoice_no); setIsExportOpen(false) }}>Download JPG</button>
											<button onClick={() => { printInvoice(modalRef.current); setIsExportOpen(false) }}>Print</button>
										</div>
									)}
								</div>

								<button className="dash-action-btn" style={{ marginLeft: "16px", background: "#f1f5f9" }} onClick={() => setViewingInvoice(null)}>
									Close
								</button>
							</div>
						</div>

						<div className="modal-body-scroll">
							<div className="preview-card" style={{ maxWidth: '800px', margin: '0 auto', flexShrink: 0 }}>
								<InvoicePreview 
									ref={modalRef} 
									invoiceData={viewingInvoice.data} 
									logoSrc={company.logo_url || defaultLogo} 
								/>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

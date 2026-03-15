import React, { useRef, useState, useEffect } from "react"

import InvoiceEditor from "./components/InvoiceEditor"
import InvoicePreview from "./components/InvoicePreview"
import Login from "./components/Login"
import Dashboard from "./components/Dashboard"
import defaultLogo from "./logo/logo.png"

import { supabase } from "./lib/supabase"
import { downloadPDF, downloadJPG, printInvoice } from "./utils/exportPDF"
import { generateInvoiceNumber } from "./utils/invoiceNumber"

const TEAL = "#2a7f8e"

const DEFAULT_INVOICE = {
	company: {
		name: "",
		phone: "",
		address: "",
		email: "",
	},
	invoice: {
		number: "",
		issued: new Date().toISOString().split('T')[0],
		delivery: new Date().toISOString().split('T')[0],
	},
	billTo: { name: "", phone: "", email: "" },
	payment: { accountName: "", accountNumber: "", sortCode: "" },
	items: [{ description: "", qty: 1, price: 0 }],
	totals: { delivery: 0, tax: 0 },
	terms: [
		"1. Please review all artwork carefully before submission: spelling, Pantone colours, placement & sizing.",
		"2. Standard production: 3-7 working days from proof approval & full payment.",
		"3. Urgent orders? Ask about our same-day service!",
		"4. Orders are processed only after full payment.",
	],
	thankYou: "Thank you for your purchase with us",
}

export default function App() {
	const ref = useRef(null)

	const [session, setSession] = useState(null)
	const [authChecking, setAuthChecking] = useState(true)
	const [isSaving, setIsSaving] = useState(false)
	
	const [tab, setTab] = useState(() => {
		const savedTab = localStorage.getItem("inv_current_tab")
		return savedTab || "dashboard"
	})
	const [invoiceStatus, setInvoiceStatus] = useState(() => {
		const savedStatus = localStorage.getItem("inv_status")
		return savedStatus || "unsaved"
	})
	const [isExportOpen, setIsExportOpen] = useState(false)
	
	const [logoSrc, setLogoSrc] = useState(() => {
		const savedLogo = localStorage.getItem("inv_logo")
		return savedLogo || defaultLogo
	})
	const [invoiceData, setInvoiceData] = useState(() => {
		const savedData = localStorage.getItem("inv_data")
		if (savedData) {
			try { return JSON.parse(savedData) } catch (e) { console.error(e) }
		}
		return DEFAULT_INVOICE
	})
	const [menuOpen, setMenuOpen] = useState(false)

	// Auth and Session Check
	useEffect(() => {
		if (!supabase) {
			setAuthChecking(false)
			return
		}

		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session)
			setAuthChecking(false)
		})

		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session)
		})

		return () => subscription.unsubscribe()
	}, [])

	// Sync state to localStorage
	useEffect(() => {
		localStorage.setItem("inv_current_tab", tab)
		localStorage.setItem("inv_status", invoiceStatus)
		localStorage.setItem("inv_data", JSON.stringify(invoiceData))
		localStorage.setItem("inv_logo", logoSrc)
	}, [tab, invoiceStatus, invoiceData, logoSrc])

	// Warn on reload if unsaved
	useEffect(() => {
		const handleBeforeUnload = (e) => {
			if (invoiceStatus === "unsaved" && tab === "create") {
				e.preventDefault()
				e.returnValue = "" // required for Chrome
			}
		}
		window.addEventListener("beforeunload", handleBeforeUnload)
		return () => window.removeEventListener("beforeunload", handleBeforeUnload)
	}, [invoiceStatus, tab])

	const handleLogout = async () => {
		if (supabase) {
			await supabase.auth.signOut()
			setSession(null)
		}
	}

	const fetchNextInvoiceNumber = async () => {
		const { data, error } = await supabase
			.from("invoices")
			.select("invoice_no")
			.eq("user_id", session.user.id)
			.order("created_at", { ascending: false })
			.limit(1)

		if (data && data.length > 0) {
			// Extract number, increment it
			const lastNo = data[0].invoice_no
			const match = lastNo.match(/_(\d{4})$/)
			if (match) {
				const nextNum = parseInt(match[1], 10) + 1
				const now = new Date()
				const d = String(now.getDate()).padStart(2, '0')
				const m = String(now.getMonth() + 1).padStart(2, '0')
				const y = now.getFullYear()
				return `PYV_${d}-${m}-${y}_${String(nextNum).padStart(4, '0')}`
			}
		}
		return generateInvoiceNumber() // fallback
	}

	const handleCreateNew = async () => {
		if (tab !== "dashboard" && (invoiceStatus === "unsaved" || document.isDirty)) {
			if (!window.confirm("You have unsaved changes! Are you sure you want to abandon this invoice?")) {
				return
			}
		}
		
		let nextNum = generateInvoiceNumber()
		let companyData = { name: "", phone: "", address: "", email: "" }
		let paymentData = { accountName: "", accountNumber: "", sortCode: "" }
		let logo = defaultLogo

		if (session) {
			nextNum = await fetchNextInvoiceNumber()
			const { data } = await supabase.from("company_config").select("*").eq("user_id", session.user.id).single()
			if (data) {
				companyData = { name: data.company_name, phone: data.phone, address: data.address, email: data.email }
				paymentData = { 
					accountName: data.payment_account_name || "", 
					accountNumber: data.payment_account_number || "", 
					sortCode: data.payment_sort_code || "" 
				}
				if (data.logo_url) logo = data.logo_url
			}
		}
		
		setLogoSrc(logo)
		setInvoiceData({
			...DEFAULT_INVOICE,
			company: companyData,
			payment: paymentData,
			invoice: { ...DEFAULT_INVOICE.invoice, number: nextNum }
		})
		
		setInvoiceStatus("unsaved")
		setTab("create")
	}

	const handleCancel = () => {
		if (window.confirm("Warning: You will lose any unsaved changes to this invoice. Continue?")) {
			setTab("dashboard")
			setInvoiceData(DEFAULT_INVOICE)
			setInvoiceStatus("unsaved")
			localStorage.removeItem("inv_data")
			localStorage.removeItem("inv_status")
		}
	}

	const navigateToDashboard = () => {
		if (tab !== "dashboard" && invoiceStatus === "unsaved") {
			if (!window.confirm("Warning: Leaving without saving will result in lost progress. Continue to Dashboard?")) {
				return
			}
		}
		setTab("dashboard")
	}

	const handleSave = async (status = "saved") => {
		if (!supabase || !session) return

		// Validation when saving as final invoice
		if (status === "saved") {
			if (!invoiceData.invoice.number.trim()) {
				alert("Invoice number is required to save.")
				return
			}
			if (!invoiceData.billTo.name.trim()) {
				alert("Bill To Name is required to save the invoice. You can save as Draft if you need to finish later.")
				return
			}
			const hasValidItem = invoiceData.items.some(item => item.description.trim() !== "")
			if (!hasValidItem) {
				alert("At least one item with a description is required to save.")
				return
			}
		}

		setIsSaving(true)
		
		const total = invoiceData.items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0), 0)

		// Upsert logic (checking if we are saving an already edited invoice)
		// We use invoice_no as unique key since the user requested managing via invoice number
		const payload = {
			user_id: session.user.id,
			invoice_no: invoiceData.invoice.number,
			customer: invoiceData.billTo.name || "Unknown",
			total: total,
			status: status,
			data: invoiceData
		}

		// Because invoice_no is unique, we must handle Upsert by checking if it exists
		const { data: existing } = await supabase.from("invoices").select("id").eq("invoice_no", invoiceData.invoice.number).maybeSingle()
		
		let err = null
		if (existing) {
			const { error } = await supabase.from("invoices").update(payload).eq("id", existing.id)
			err = error
		} else {
			const { error } = await supabase.from("invoices").insert([payload])
			err = error
		}

		setIsSaving(false)
		
		if (err) {
			alert("Error saving invoice: " + err.message)
		} else {
			setInvoiceStatus("saved")
			if (status === "saved") {
				setTab("preview")
			}
		}
	}

	const handleEditInvoice = (docData, status) => {
		setInvoiceData(docData)
		setInvoiceStatus(status === "draft" ? "unsaved" : "saved")
		setTab("create")
	}

	const handleLogo = (event) => {
		const file = event.target.files?.[0]
		if (!file) return

		const reader = new FileReader()
		reader.onload = (ev) => setLogoSrc(ev.target?.result || defaultLogo)
		reader.readAsDataURL(file)
	}

	const isActionDisabled = !ref.current

	if (authChecking) {
		return <div className="app-shell" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}><p>Loading...</p></div>
	}

	if (!session) {
		return <Login onLoginSuccess={setSession} />
	}

	return (
		<div className="app-shell">
			<header className="topbar">
				<div className="topbar-brand">
					<img src={logoSrc} alt="Logo" className="topbar-logo" />
					<span>Invoice Generator</span>
				</div>

				<button
					className="hamburger-btn"
					onClick={() => setMenuOpen(o => !o)}
					aria-label="Toggle menu"
				>
					{menuOpen ? '✕' : '☰'}
				</button>

				<div className={`topbar-actions${menuOpen ? ' menu-open' : ''}`}
					onClick={() => setMenuOpen(false)}
				>
					{/* DASHBOARD TAB BEHAVIOR */}
					{tab === "dashboard" && (
						<>
							<button type="button" className="tab-btn active">Dashboard</button>
							<button type="button" className="action-btn" onClick={handleCreateNew} style={{ background: TEAL }}>
								+ Create New
							</button>
							<button type="button" className="danger-btn" onClick={handleLogout}>
								Logout
							</button>
						</>
					)}

					{/* CREATE & PREVIEW TABS */}
					{(tab === "create" || tab === "preview") && (
						<>
							<button 
								type="button" 
								className={`tab-btn ${tab === "create" ? "active" : ""}`} 
								onClick={() => setTab("create")}
							>
								{invoiceStatus === "saved" ? "Edit Invoice" : "Create New"}
							</button>
							
							<button 
								type="button" 
								className={`tab-btn ${tab === "preview" ? "active" : ""}`} 
								onClick={() => setTab("preview")}
							>
								Preview
							</button>
							
							{invoiceStatus !== "saved" ? (
								<>
									<button type="button" className="action-btn" onClick={() => handleSave("draft")} disabled={isSaving}>
										Save as Draft
									</button>
									<button type="button" className="action-btn" onClick={() => handleSave("saved")} disabled={isSaving} style={{ background: "#059669" }}>
										Save Invoice
									</button>
									<button type="button" className="danger-btn" onClick={handleCancel}>
										Cancel
									</button>
								</>
							) : (
								<>
									<div className="export-dropdown-wrapper" style={{ position: "relative", display: "inline-block" }}>
										<button 
											type="button" 
											className="action-btn" 
											onClick={() => setIsExportOpen(!isExportOpen)} 
											style={{ background: TEAL }}
										>
											Export ▼
										</button>
										{isExportOpen && (
											<div className="export-dropdown-menu">
												<button disabled={isActionDisabled} onClick={() => { downloadPDF(ref.current, invoiceData.invoice.number); setIsExportOpen(false) }}>Download PDF</button>
												<button disabled={isActionDisabled} onClick={() => { downloadJPG(ref.current, invoiceData.invoice.number); setIsExportOpen(false) }}>Download JPG</button>
												<button disabled={isActionDisabled} onClick={() => { printInvoice(ref.current); setIsExportOpen(false) }}>Print</button>
											</div>
										)}
									</div>
									<button type="button" className="action-btn" onClick={handleCreateNew}>
										+ Create New
									</button>
								</>
							)}

							<button type="button" className="danger-btn" onClick={navigateToDashboard}>
								Dashboard
							</button>
						</>
					)}
				</div>
			</header>

			<main className="app-main">
				{tab === "create" && (
					<div className="edit-layout">
						<div>
							{/* In Create/Edit mode, mark invoice as unsaved when data changes */}
							<InvoiceEditor
								logoSrc={logoSrc}
								onLogoChange={handleLogo}
								data={invoiceData}
								setData={(newData) => {
									setInvoiceData(newData)
									if (invoiceStatus === "saved") setInvoiceStatus("unsaved")
								}}
							/>

							<div className="editor-actions-bottom" style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
								{invoiceStatus !== "saved" ? (
									<>
										<button type="button" className="action-btn" onClick={() => handleSave("draft")} disabled={isSaving} style={{ flex: 1, minWidth: '120px' }}>
											Save as Draft
										</button>
										<button type="button" className="action-btn" onClick={() => handleSave("saved")} disabled={isSaving} style={{ background: "#059669", flex: 1, minWidth: '120px' }}>
											Save Invoice
										</button>
										<button type="button" className="danger-btn" onClick={handleCancel} style={{ flex: 1, minWidth: '120px' }}>
											Cancel
										</button>
									</>
								) : (
									<div className="export-dropdown-wrapper" style={{ position: "relative", display: "inline-block", flex: 1 }}>
										<button 
											type="button" 
											className="action-btn" 
											onClick={() => setIsExportOpen(!isExportOpen)} 
											style={{ background: TEAL, width: '100%' }}
										>
											Export ▼
										</button>
										{isExportOpen && (
											<div className="export-dropdown-menu" style={{ bottom: '100%', top: 'auto', marginBottom: '8px', minWidth: '200px' }}>
												<button disabled={isActionDisabled} onClick={() => { downloadPDF(ref.current, invoiceData.invoice.number); setIsExportOpen(false) }}>Download PDF</button>
												<button disabled={isActionDisabled} onClick={() => { downloadJPG(ref.current, invoiceData.invoice.number); setIsExportOpen(false) }}>Download JPG</button>
												<button disabled={isActionDisabled} onClick={() => { printInvoice(ref.current); setIsExportOpen(false) }}>Print</button>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
						<div className="preview-card">
							<InvoicePreview ref={ref} invoiceData={invoiceData} logoSrc={logoSrc} />
						</div>
					</div>
				)}

				{tab === "preview" && (
					<div className="preview-card preview-only">
						<InvoicePreview ref={ref} invoiceData={invoiceData} logoSrc={logoSrc} />
					</div>
				)}

				{tab === "dashboard" && (
					<Dashboard session={session} onEdit={handleEditInvoice} />
				)}
			</main>
		</div>
	)
}

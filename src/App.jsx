import React, { useRef, useState, useEffect } from "react"

import InvoiceEditor from "./components/InvoiceEditor"
import InvoicePreview from "./components/InvoicePreview"
import Login from "./components/Login"
import Dashboard from "./components/Dashboard"
import PublicInvoicePage from "./components/PublicInvoicePage"
import defaultLogo from "./logo/logo.png"

import { supabase } from "./lib/supabase"
import { downloadPDF, downloadJPG, printInvoice } from "./utils/exportPDF"
import { generateInvoiceNumber } from "./utils/invoiceNumber"

const TEAL = "#2a7f8e"
const STRIPE_CHECKOUT_MINIMUM = 0.3

const formatGBP = (value) => `£${Number(value || 0).toFixed(2)}`

const calculateInvoiceTotals = (invoiceData = {}) => {
	const items = Array.isArray(invoiceData.items) ? invoiceData.items : []
	const subtotal = items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0)
	const delivery = Number(invoiceData.totals?.delivery) || 0
	const tax = Number(invoiceData.totals?.tax) || 0
	const total = subtotal + delivery + tax
	const due = Number(invoiceData.totals?.due) > 0 ? Number(invoiceData.totals.due) : total

	return { subtotal, delivery, tax, total, due }
}

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

const FINAL_INVOICE_STATUSES = new Set(["saved", "pending", "paid", "failed", "cancelled"])

const getCurrentRoute = () => {
	if (typeof window === "undefined") return null

	const pathname = window.location.pathname.replace(/\/+$/, "") || "/"
	const segments = pathname.split("/").filter(Boolean)
	const searchParams = new URLSearchParams(window.location.search)

	if (segments[0] === "invoice" && segments[1]) {
		return { kind: "invoice", invoiceNo: decodeURIComponent(segments[1]) }
	}

	if (segments[0] === "pay" && segments[1]) {
		return { kind: "pay", invoiceNo: decodeURIComponent(segments[1]) }
	}

	if (pathname === "/success") {
		return {
			kind: "success",
			invoiceNo: searchParams.get("invoice_no") || searchParams.get("invoiceNo") || "",
			sessionId: searchParams.get("session_id") || "",
		}
	}

	if (pathname === "/cancelled") {
		return {
			kind: "cancelled",
			invoiceNo: searchParams.get("invoice_no") || searchParams.get("invoiceNo") || "",
			sessionId: searchParams.get("session_id") || "",
		}
	}

	return null
}

export default function App() {
	const ref = useRef(null)

	const [session, setSession] = useState(null)
	const [authChecking, setAuthChecking] = useState(true)
	const [isSaving, setIsSaving] = useState(false)
	const [paymentActionBusy, setPaymentActionBusy] = useState(false)
	const [paymentFeedback, setPaymentFeedback] = useState(null)
	const [routeState, setRouteState] = useState(() => getCurrentRoute())
	const [paymentLinkMeta, setPaymentLinkMeta] = useState(() => {
		const savedMeta = localStorage.getItem("inv_payment_meta")
		if (!savedMeta) return null
		try {
			return JSON.parse(savedMeta)
		} catch (error) {
			console.error(error)
			return null
		}
	})
	
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
		if (paymentLinkMeta) {
			localStorage.setItem("inv_payment_meta", JSON.stringify(paymentLinkMeta))
		} else {
			localStorage.removeItem("inv_payment_meta")
		}
	}, [tab, invoiceStatus, invoiceData, logoSrc, paymentLinkMeta])

	useEffect(() => {
		const syncRoute = () => setRouteState(getCurrentRoute())
		syncRoute()
		window.addEventListener("popstate", syncRoute)
		return () => window.removeEventListener("popstate", syncRoute)
	}, [])

	// Warn before closing/reloading if invoice is unsaved
	useEffect(() => {
		const handleBeforeUnload = (e) => {
			if ((invoiceStatus === "unsaved" || invoiceStatus === "draft") && tab === "create") {
				e.preventDefault()
				e.returnValue = "" // required for Chrome
			}
		}
		window.addEventListener("beforeunload", handleBeforeUnload)
		return () => window.removeEventListener("beforeunload", handleBeforeUnload)
	}, [invoiceStatus, tab])

	if (routeState?.kind) {
		return <PublicInvoicePage mode={routeState.kind} invoiceNo={routeState.invoiceNo} sessionId={routeState.sessionId} />
	}

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
			const match = lastNo.match(/-\s*(\d{4})$/)
			if (match) {
				const nextNum = parseInt(match[1], 10) + 1
				const now = new Date()
				const d = String(now.getDate()).padStart(2, '0')
				const m = String(now.getMonth() + 1).padStart(2, '0')
				const y = now.getFullYear()
				return `#PYV - ${y}${m}${d} - ${String(nextNum).padStart(4, '0')}`
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
		setPaymentFeedback(null)
		setInvoiceData({
			...DEFAULT_INVOICE,
			company: companyData,
			payment: paymentData,
			invoice: { ...DEFAULT_INVOICE.invoice, number: nextNum }
		})
		
		setInvoiceStatus("unsaved")
		setPaymentLinkMeta(null)
		setTab("create")
	}

	const handleCancel = () => {
		if (window.confirm("Warning: You will lose any unsaved changes to this invoice. Continue?")) {
			setTab("dashboard")
			setInvoiceData(DEFAULT_INVOICE)
			setInvoiceStatus("unsaved")
			setPaymentLinkMeta(null)
			setPaymentFeedback(null)
			localStorage.removeItem("inv_data")
			localStorage.removeItem("inv_status")
		}
	}

	const navigateToDashboard = () => {
		if (tab !== "dashboard" && (invoiceStatus === "unsaved" || invoiceStatus === "draft")) {
			if (!window.confirm("Warning: Leaving without saving will result in lost progress. Continue to Dashboard?")) {
				return
			}
		}
		setTab("dashboard")
	}

	const handleSave = async (status = null) => {
		if (!supabase || !session) return

		const effectiveStatus = status || invoiceData.status || (invoiceStatus === "unsaved" ? "saved" : invoiceStatus) || "saved"

		// Validation when saving as final invoice
		if (effectiveStatus !== "draft") {
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
			status: effectiveStatus,
			payment_error: null,
			data: invoiceData
		}

		// Because invoice_no is unique, we must handle Upsert by checking if it exists
		const { data: existing } = await supabase.from("invoices").select("id").eq("invoice_no", invoiceData.invoice.number).maybeSingle()
		
		let err = null
		let savedInvoiceId = existing?.id || null
		if (existing) {
			const { data: updatedRow, error } = await supabase.from("invoices").update(payload).eq("id", existing.id).select("id").single()
			savedInvoiceId = updatedRow?.id || existing.id
			err = error
		} else {
			const { data: insertedRow, error } = await supabase.from("invoices").insert([payload]).select("id").single()
			savedInvoiceId = insertedRow?.id || null
			err = error
		}

		setIsSaving(false)
		
		if (err) {
			alert("Error saving invoice: " + err.message)
		} else {
			setInvoiceStatus(effectiveStatus)
			setPaymentLinkMeta(null)
			setPaymentFeedback(null)
			if (effectiveStatus === "saved") {
				setTab("preview")
			}
		}
	}

	const handleEditInvoice = (docData, status, record = null) => {
		const nextStatus = status || docData?.status || "saved"
		setInvoiceData({ ...docData, status: nextStatus })
		setInvoiceStatus(nextStatus)
		setPaymentFeedback(record?.payment_error ? { type: "error", message: record.payment_error } : null)
		setPaymentLinkMeta(record ? {
			invoiceNo: record.invoice_no,
			status: record.status,
			paymentPageUrl: record.payment_page_url || "",
			checkoutUrl: record.payment_checkout_url || "",
			stripeCheckoutSessionId: record.stripe_checkout_session_id || "",
			paymentGeneratedAt: record.payment_generated_at || "",
			paidAt: record.paid_at || "",
		} : null)
		setTab("create")
	}

	const handleGeneratePaymentLink = async () => {
		if (!invoiceData.invoice.number.trim()) {
			alert("Save the invoice number before generating a payment link.")
			return
		}

		if (!(isFinalizedInvoice || invoiceStatus === "pending")) {
			alert("Please save the invoice before generating a payment link.")
			return
		}

		setPaymentFeedback(null)
		setPaymentActionBusy(true)
		try {
			const response = await fetch("/api/payments/create-session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ invoiceNo: invoiceData.invoice.number }),
			})

			const result = await response.json().catch(() => ({}))
			if (!response.ok) {
				throw new Error(result.error || "Failed to generate the payment link.")
			}

			setInvoiceStatus("pending")
			setPaymentFeedback(null)
			setPaymentLinkMeta({
				invoiceNo: result.invoiceNo,
				status: result.status,
				paymentPageUrl: result.paymentPageUrl,
				checkoutUrl: result.checkoutUrl,
				stripeCheckoutSessionId: result.stripeCheckoutSessionId,
			})
			setInvoiceData((prev) => ({ ...prev, status: "pending" }))
		} catch (error) {
			setPaymentFeedback({ type: "error", message: error.message || "Failed to generate the payment link." })
		} finally {
			setPaymentActionBusy(false)
		}
	}

	const handleCopyPaymentLink = async () => {
		const link = paymentLinkMeta?.paymentPageUrl || ""
		if (!link) {
			alert("Generate a payment link first.")
			return
		}

		try {
			await navigator.clipboard.writeText(link)
			alert("Payment link copied to clipboard.")
		} catch (error) {
			alert("Unable to copy the payment link.")
		}
	}

	const handleSendPaymentLink = async () => {
		if (!invoiceData.invoice.number.trim()) {
			alert("Save the invoice number before sending a payment link.")
			return
		}

		if (!(isFinalizedInvoice || invoiceStatus === "pending")) {
			alert("Please save the invoice before sending a payment link.")
			return
		}

		setPaymentFeedback(null)
		setPaymentActionBusy(true)
		try {
			const response = await fetch("/api/payments/send-link", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ invoiceNo: invoiceData.invoice.number }),
			})

			const result = await response.json().catch(() => ({}))
			if (!response.ok) {
				throw new Error(result.error || "Failed to send the payment link.")
			}

			setInvoiceStatus("pending")
			setPaymentFeedback(null)
			setPaymentLinkMeta({
				invoiceNo: result.invoiceNo,
				status: "pending",
				paymentPageUrl: result.paymentPageUrl,
				checkoutUrl: result.checkoutUrl || paymentLinkMeta?.checkoutUrl || "",
				stripeCheckoutSessionId: result.stripeCheckoutSessionId || paymentLinkMeta?.stripeCheckoutSessionId || "",
			})
			alert("Payment link sent.")
		} catch (error) {
			setPaymentFeedback({ type: "error", message: error.message || "Failed to send the payment link." })
		} finally {
			setPaymentActionBusy(false)
		}
	}

	const handleLogo = (event) => {
		const file = event.target.files?.[0]
		if (!file) return

		const reader = new FileReader()
		reader.onload = (ev) => setLogoSrc(ev.target?.result || defaultLogo)
		reader.readAsDataURL(file)
	}

	const isActionDisabled = !ref.current
	const isFinalizedInvoice = FINAL_INVOICE_STATUSES.has(invoiceStatus)
	const invoiceTotals = calculateInvoiceTotals(invoiceData)
	const paymentChargeTotal = invoiceTotals.total
	const paymentBelowStripeMinimum = paymentChargeTotal > 0 && paymentChargeTotal < STRIPE_CHECKOUT_MINIMUM
	const paymentPageUrl = paymentLinkMeta?.paymentPageUrl || ""
	const hasGeneratedPaymentLink = Boolean(paymentLinkMeta?.paymentPageUrl)
	const canGeneratePaymentLink = !paymentActionBusy && !hasGeneratedPaymentLink && ["saved", "pending", "failed", "cancelled"].includes(invoiceStatus) && !paymentBelowStripeMinimum
	const canCopyPaymentLink = hasGeneratedPaymentLink
	const canSendPaymentLink = hasGeneratedPaymentLink && !paymentActionBusy
	const paymentBannerMessage = paymentFeedback?.message || (paymentBelowStripeMinimum && ["saved", "pending", "failed", "cancelled"].includes(invoiceStatus)
		? `Stripe Checkout requires at least ${formatGBP(STRIPE_CHECKOUT_MINIMUM)} for card payments. This invoice total is ${formatGBP(paymentChargeTotal)}.`
		: "")

	const renderExportMenu = (styleOverrides = {}) => (
		<div className="export-dropdown-menu" style={styleOverrides}>
			<button disabled={isActionDisabled} onClick={() => { downloadPDF(ref.current, invoiceData.invoice.number); setIsExportOpen(false) }}>Download PDF</button>
			<button disabled={isActionDisabled} onClick={() => { downloadJPG(ref.current, invoiceData.invoice.number); setIsExportOpen(false) }}>Download JPG</button>
			<button disabled={isActionDisabled} onClick={() => { printInvoice(ref.current); setIsExportOpen(false) }}>Print</button>
			<div className="export-divider" />
			{paymentBannerMessage && !hasGeneratedPaymentLink ? <div className="export-link-hint export-link-hint-warning">{paymentBannerMessage}</div> : null}
			{!hasGeneratedPaymentLink ? (
				<button disabled={!canGeneratePaymentLink} onClick={() => { handleGeneratePaymentLink(); setIsExportOpen(false) }}>Generate Payment Link</button>
			) : (
				<>
					<div className="export-link-hint">Payment link ready. Copy or send it from here.</div>
					<button disabled={!canCopyPaymentLink} onClick={() => { handleCopyPaymentLink(); setIsExportOpen(false) }}>Copy Payment Link</button>
					<button disabled={!canSendPaymentLink} onClick={() => { handleSendPaymentLink(); setIsExportOpen(false) }}>Send Payment Link</button>
				</>
			)}
		</div>
	)

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
								{isFinalizedInvoice ? "Edit Invoice" : "Create New"}
							</button>
							
							<button 
								type="button" 
								className={`tab-btn ${tab === "preview" ? "active" : ""}`} 
								onClick={() => setTab("preview")}
							>
								Preview
							</button>
							
							{!isFinalizedInvoice ? (
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
											style={{ background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
										>
											Export
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
										</button>
										{isExportOpen && renderExportMenu()}
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
							{tab === "create" && paymentBannerMessage ? (
								<div className={`payment-status-banner ${paymentFeedback?.type || (paymentBelowStripeMinimum ? "warning" : "")}`} role="status" aria-live="polite">
									{paymentBannerMessage}
								</div>
							) : null}
							{/* In Create/Edit mode, mark invoice as unsaved when data changes */}
							<InvoiceEditor
								logoSrc={logoSrc}
								onLogoChange={handleLogo}
								data={invoiceData}
								status={invoiceStatus}
								onStatusChange={(nextStatus) => {
									setInvoiceStatus(nextStatus)
									setInvoiceData((prev) => ({ ...prev, status: nextStatus }))
								}}
								setData={(newData) => {
									setInvoiceData(newData)
									if (invoiceStatus !== "unsaved") {
										setInvoiceStatus("unsaved")
										setPaymentLinkMeta(null)
										setPaymentFeedback(null)
									}
								}}
							/>

							<div className="editor-actions-bottom" style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
								{!isFinalizedInvoice ? (
									<>
										<button type="button" className="action-btn" onClick={() => handleSave("draft")} disabled={isSaving} style={{ flex: 1, minWidth: '120px' }}>
											Save as Draft
										</button>
										<button type="button" className="action-btn" onClick={() => handleSave()} disabled={isSaving} style={{ background: "#059669", flex: 1, minWidth: '120px' }}>
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
											style={{ background: TEAL, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
										>
											Export
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
										</button>
										{isExportOpen && renderExportMenu({ bottom: '100%', top: 'auto', marginBottom: '8px', minWidth: '240px' })}
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

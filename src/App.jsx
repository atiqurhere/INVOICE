import React, { useRef, useState } from "react"

import InvoiceEditor from "./components/InvoiceEditor"
import InvoicePreview from "./components/InvoicePreview"
import RecentInvoices from "./components/RecentInvoices"
import Login from "./components/Login"
import Dashboard from "./components/Dashboard"
import defaultLogo from "./logo/logo.png"

import { supabase } from "./lib/supabase"

import { downloadPDF, downloadJPG } from "./utils/exportPDF"
import { generateInvoiceNumber } from "./utils/invoiceNumber"

const TEAL = "#2a7f8e"

export default function App() {
	const ref = useRef(null)

	const [session, setSession] = useState(null)
	const [authChecking, setAuthChecking] = useState(true)
	const [isSaving, setIsSaving] = useState(false)

	const [tab, setTab] = useState("edit")
	const [logoSrc, setLogoSrc] = useState(defaultLogo)

	const [invoiceData, setInvoiceData] = useState({
		company: {
			name: "Print your vibe",
			phone: "+44 7983 567819",
			address: "270 Teviot St, London E14 6QS, UK",
			email: "info@printyourvibe.com",
		},
		invoice: {
			number: generateInvoiceNumber(),
			issued: "02-03-2026",
			delivery: "04-03-2026",
		},
		billTo: {
			name: "Eirelin Grey",
			phone: "020 7585 1444",
			email: "eirelin@sarahfeatherdesign.com",
		},
		payment: {
			accountName: "Dewan Muntasir Chowdhury",
			accountNumber: "26812698",
			sortCode: "04-06-05",
		},
		items: [{ description: "Tote Bags", qty: 70, price: 10.5 }],
		terms: [
			"Please review all artwork carefully before submission: spelling, Pantone colours, placement and sizing.",
			"Standard production: 3-7 working days from proof approval and full payment.",
			"Urgent orders? Ask about our same-day service.",
			"Orders are processed only after full payment.",
		],
		thankYou: "Thank you for your purchase with us",
	})

	const handleLogo = (event) => {
		const file = event.target.files?.[0]
		if (!file) return

		const reader = new FileReader()
		reader.onload = (ev) => setLogoSrc(ev.target?.result || defaultLogo)
		reader.readAsDataURL(file)
	}

	const actionDisabled = !ref.current

	// Check for existing session on load
	React.useEffect(() => {
		if (!supabase) {
			setAuthChecking(false)
			return
		}

		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session)
			setAuthChecking(false)
		})

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session)
		})

		return () => subscription.unsubscribe()
	}, [])

	const handleLogout = async () => {
		if (supabase) {
			await supabase.auth.signOut()
			setSession(null)
		}
	}

	const handleSave = async () => {
		if (!supabase || !session) return
		setIsSaving(true)
		
		const total = invoiceData.items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0), 0)

		const { error } = await supabase.from("invoices").insert([
			{
				user_id: session.user.id,
				invoice_no: invoiceData.invoice.number,
				customer: invoiceData.billTo.name,
				total: total,
				data: invoiceData // Save full json payload for future editing if needed
			}
		])

		setIsSaving(false)
		
		if (error) {
			alert("Error saving invoice: " + error.message)
		} else {
			alert("Invoice saved successfully!")
		}
	}

	if (authChecking) {
		return <div className="app-shell" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}><p>Loading...</p></div>
	}

	if (!session) {
		return <Login onLoginSuccess={setSession} />
	}

	const handleEditInvoice = (docData) => {
		setInvoiceData(docData)
		setTab("edit")
	}

	return (
		<div className="app-shell">
			<header className="topbar">
				<div className="topbar-brand">
					<img src={logoSrc} alt="Logo" className="topbar-logo" />
					<span>Invoice Generator</span>
				</div>

				<div className="topbar-actions">
					<button
						type="button"
						className={`tab-btn ${tab === "edit" ? "active" : ""}`}
						onClick={() => setTab("edit")}
					>
						Edit
					</button>
					<button
						type="button"
						className={`tab-btn ${tab === "preview" ? "active" : ""}`}
						onClick={() => setTab("preview")}
					>
						Preview
					</button>
					<button
						type="button"
						className={`tab-btn ${tab === "dashboard" ? "active" : ""}`}
						onClick={() => setTab("dashboard")}
					>
						Dashboard
					</button>
					
					{tab !== "dashboard" && (
						<>
							<button type="button" className="action-btn" disabled={actionDisabled} onClick={() => downloadPDF(ref.current)}>
								Download PDF
							</button>
							<button type="button" className="action-btn" disabled={actionDisabled} onClick={() => downloadJPG(ref.current)}>
								Download JPG
							</button>
							<button type="button" className="action-btn" disabled={actionDisabled || isSaving} onClick={handleSave} style={{ background: "#059669" }}>
								{isSaving ? "Saving..." : "Save to Account"}
							</button>
							<button type="button" className="print-btn" onClick={() => window.print()}>
								Print
							</button>
						</>
					)}
					
					<button type="button" className="danger-btn" onClick={handleLogout} style={{ marginLeft: "8px" }}>
						Logout
					</button>
				</div>
			</header>

			<main className="app-main">
				{tab === "edit" && (
					<div className="edit-layout">
						<div>
							<InvoiceEditor
								logoSrc={logoSrc}
								onLogoChange={handleLogo}
								data={invoiceData}
								setData={setInvoiceData}
							/>
							<RecentInvoices session={session} />
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

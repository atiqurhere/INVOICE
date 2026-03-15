import React, { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import dayjs from "dayjs" // Let's use standard Date grouping for simplicity instead of adding new dependencies if we can

export default function Dashboard({ session, onEdit }) {
	const [invoices, setInvoices] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState("")

	const [stats, setStats] = useState({
		daily: 0,
		weekly: 0,
		monthly: 0,
		yearly: 0,
		lifetime: 0
	})

	useEffect(() => {
		if (session?.user) {
			fetchInvoices()
		}
	}, [session])

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
		if (!window.confirm("Are you sure you want to delete this invoice?")) return

		const { error } = await supabase
			.from("invoices")
			.delete()
			.eq("id", id)

		if (error) {
			alert("Error deleting invoice: " + error.message)
		} else {
			fetchInvoices() // Refresh the list
		}
	}

	if (loading) {
		return <div style={{ padding: 40, textAlign: "center" }}>Loading dashboard...</div>
	}

	if (error) {
		return <div className="login-error">Error: {error}</div>
	}

	return (
		<div className="dashboard-container">
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
				<table className="dashboard-table">
					<thead>
						<tr>
							<th>Date Created</th>
							<th>Invoice #</th>
							<th>Customer</th>
							<th>Total Amount</th>
							<th className="action-col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{invoices.length === 0 ? (
							<tr>
								<td colSpan="5" style={{ textAlign: "center", padding: 20 }}>No invoices found.</td>
							</tr>
						) : (
							invoices.map((inv) => (
								<tr key={inv.id}>
									<td>{new Date(inv.created_at).toLocaleDateString()}</td>
									<td>{inv.invoice_no}</td>
									<td>{inv.customer}</td>
									<td>£{Number(inv.total).toFixed(2)}</td>
									<td className="action-col">
										<button 
											className="dash-action-btn edit-btn" 
											onClick={() => onEdit(inv.data)}
										>
											Edit
										</button>
										<button 
											className="dash-action-btn delete-btn" 
											onClick={() => handleDelete(inv.id)}
										>
											Delete
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}

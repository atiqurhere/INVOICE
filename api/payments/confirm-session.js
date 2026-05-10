import { getAdminEmail, getBaseUrl, getSupabaseAdmin, sendInvoiceEmailNotifications } from "../_lib/server.js"

async function fetchStripeSession(sessionId) {
	const secret = process.env.STRIPE_SECRET_KEY
	if (!secret) {
		throw new Error("Stripe secret key is missing.")
	}

	const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`, {
		headers: {
			Authorization: `Bearer ${secret}`,
		},
	})

	const payload = await response.json().catch(() => ({}))
	if (!response.ok) {
		throw new Error(payload?.error?.message || "Unable to load the Stripe checkout session.")
	}

	return payload
}

function toInvoiceResponse(invoice, company, baseUrl) {
	return {
		invoice: {
			id: invoice.id,
			invoice_no: invoice.invoice_no,
			customer: invoice.customer,
			total: invoice.total,
			status: invoice.status,
			payment_page_url: invoice.payment_page_url || `${baseUrl}/pay/${encodeURIComponent(invoice.invoice_no)}`,
			payment_checkout_url: invoice.payment_checkout_url || "",
			paid_at: invoice.paid_at,
			created_at: invoice.created_at,
			updated_at: invoice.updated_at,
			data: invoice.data,
		},
		company: company || null,
	}
}

export default async function handler(req, res) {
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST")
		return res.status(405).json({ error: "Method not allowed" })
	}

	const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}
	const invoiceNo = body.invoiceNo || body.invoice_no
	const sessionId = body.sessionId || body.session_id
	const statusHint = body.statusHint || "paid"

	if (!invoiceNo) {
		return res.status(400).json({ error: "Missing invoice number." })
	}

	const supabase = getSupabaseAdmin()
	if (!supabase) {
		return res.status(500).json({ error: "Supabase admin credentials are missing." })
	}

	const { data: invoice, error: invoiceError } = await supabase
		.from("invoices")
		.select("*")
		.eq("invoice_no", invoiceNo)
		.maybeSingle()

	if (invoiceError) {
		return res.status(500).json({ error: invoiceError.message })
	}

	if (!invoice) {
		return res.status(404).json({ error: "Invoice not found." })
	}

	const { data: company, error: companyError } = await supabase
		.from("company_config")
		.select("*")
		.eq("user_id", invoice.user_id)
		.maybeSingle()

	if (companyError) {
		return res.status(500).json({ error: companyError.message })
	}

	const baseUrl = getBaseUrl(req)
	const adminEmail = getAdminEmail(company)
	const now = new Date().toISOString()
	const paymentPageUrl = invoice.payment_page_url || `${baseUrl}/pay/${encodeURIComponent(invoice.invoice_no)}`

	let nextInvoice = { ...invoice }

	if (sessionId) {
		const session = await fetchStripeSession(sessionId)
		if (session.client_reference_id && session.client_reference_id !== invoice.invoice_no) {
			return res.status(400).json({ error: "Stripe session does not match the invoice number." })
		}

		if ((session.payment_status || "").toLowerCase() === "paid" || session.status === "complete") {
			nextInvoice = {
				...nextInvoice,
				status: "paid",
				stripe_checkout_session_id: session.id,
				stripe_payment_intent_id: session.payment_intent?.id || session.payment_intent || nextInvoice.stripe_payment_intent_id || null,
				payment_error: null,
				paid_at: now,
				updated_at: now,
			}
		} else {
			nextInvoice = {
				...nextInvoice,
				status: statusHint === "cancelled" ? "cancelled" : nextInvoice.status,
				stripe_checkout_session_id: session.id,
				updated_at: now,
			}
		}
	} else if (statusHint === "cancelled") {
		nextInvoice = {
			...nextInvoice,
			status: "cancelled",
			updated_at: now,
		}
	}

	const updatePayload = {
		status: nextInvoice.status,
		stripe_checkout_session_id: nextInvoice.stripe_checkout_session_id || invoice.stripe_checkout_session_id || null,
		stripe_payment_intent_id: nextInvoice.stripe_payment_intent_id || invoice.stripe_payment_intent_id || null,
		payment_error: nextInvoice.payment_error ?? invoice.payment_error ?? null,
		paid_at: nextInvoice.paid_at || invoice.paid_at || null,
		updated_at: now,
	}

	const { error: updateError } = await supabase
		.from("invoices")
		.update(updatePayload)
		.eq("id", invoice.id)

	if (updateError) {
		return res.status(500).json({ error: updateError.message })
	}

	nextInvoice = { ...invoice, ...updatePayload }

	try {
		if (nextInvoice.status === "paid" && !invoice.payment_success_email_sent_at) {
			await sendInvoiceEmailNotifications({
				invoice: nextInvoice,
				company,
				baseUrl,
				paymentPageUrl,
				status: "paid",
				adminEmail,
			})

			await supabase
				.from("invoices")
				.update({ payment_success_email_sent_at: now, updated_at: now })
				.eq("id", invoice.id)
		}

		if (nextInvoice.status === "cancelled" && !invoice.payment_failure_email_sent_at) {
			await sendInvoiceEmailNotifications({
				invoice: nextInvoice,
				company,
				baseUrl,
				paymentPageUrl,
				status: "cancelled",
				adminEmail,
			})

			await supabase
				.from("invoices")
				.update({ payment_failure_email_sent_at: now, updated_at: now })
				.eq("id", invoice.id)
		}
	} catch (emailError) {
		return res.status(500).json({ error: emailError.message || "Invoice was updated, but email notification failed." })
	}

	return res.status(200).json({
		confirmed: true,
		...toInvoiceResponse(nextInvoice, company, baseUrl),
	})
}
import React, { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function RecentInvoices() {
  const [list, setList] = useState([])
  const [error, setError] = useState("")

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    if (!supabase) {
      setError("Supabase env is missing. Add your keys to .rnv/.env.")
      return
    }

    const { data, error: queryError } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8)

    if (queryError) {
      setError(queryError.message)
      return
    }

    setList(data || [])
  }

  return (
    <section className="recent-section">
      <h3 className="section-title">Recent Invoices</h3>

      {error && <p className="recent-note">{error}</p>}

      {!error && list.length === 0 && <p className="recent-note">No recent invoices found.</p>}

      {list.map((item) => (
        <div key={item.id} className="recent-row">
          <span>{item.invoice_no || item.invoice_number || "N/A"}</span>
          <span>{item.customer || item.client_name || "Unknown"}</span>
          <span>£{Number(item.total || 0).toFixed(2)}</span>
        </div>
      ))}
    </section>
  )
}
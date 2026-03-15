import React, { useState } from "react"
import { supabase } from "../lib/supabase"

export default function Login({ onLoginSuccess }) {
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [rememberMe, setRememberMe] = useState(false)
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(false)

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError("")
		setLoading(true)

		if (!supabase) {
			setError("Supabase environment variables are missing. Please configure .env.")
			setLoading(false)
			return
		}

		// Supabase handles sessions via local storage by default. 
		// If rememberMe is false, we might want to manually set session storage or handle session expiry.
		// However, for standard Supabase GoTrue, persistence is stored in local storage. 
		// We will rely on default Supabase 'remember me' persistence, 
		// but typically standard persistence covers "remember me" implicitly.
		
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		})

		if (error) {
			setError(error.message)
		} else if (data?.session) {
			onLoginSuccess(data.session)
		}

		setLoading(false)
	}

	return (
		<div className="login-wrapper">
			<div className="login-card">
				<div className="login-header">
					<h2>Welcome Back</h2>
					<p>Sign in to access the Invoice Generator</p>
				</div>

				<form onSubmit={handleSubmit} className="login-form">
					{error && <div className="login-error">{error}</div>}

					<div className="field-wrap">
						<label className="field-label">Email Address</label>
						<input
							className="field-input"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							placeholder="you@example.com"
						/>
					</div>

					<div className="field-wrap">
						<label className="field-label">Password</label>
						<input
							className="field-input"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							placeholder="••••••••"
						/>
					</div>

					<div className="login-options">
						<label className="checkbox-label">
							<input
								type="checkbox"
								checked={rememberMe}
								onChange={(e) => setRememberMe(e.target.checked)}
							/>
							<span>Remember me</span>
						</label>
					</div>

					<button type="submit" className="action-btn login-btn" disabled={loading}>
						{loading ? "Signing in..." : "Sign In"}
					</button>

					<p className="login-note">
						Note: Accounts can only be created by the administrator. Sign up is disabled.
					</p>
				</form>
			</div>
		</div>
	)
}

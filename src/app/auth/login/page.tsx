"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadCaptcha = async () => {
    try {
      const res = await fetch("/api/auth/captcha");
      const data = await res.json();
      if (res.ok) {
        setCaptchaQuestion(data.question);
        setCaptchaToken(data.token);
        setCaptchaAnswer("");
      }
    } catch (e) {
      console.error("Failed to load CAPTCHA");
    }
  };

  useEffect(() => { loadCaptcha(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, captchaAnswer, captchaToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        loadCaptcha();
        return;
      }

      // All users on the customer site go to the dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
      loadCaptcha();
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      background: "var(--bg-secondary)",
    }}>
      <div className="card" style={{
        maxWidth: "420px",
        width: "100%",
        padding: "40px 36px",
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link href="/" style={{ color: "var(--text-primary)", fontWeight: "700", fontSize: "18px" }}>
            Safari Bois
          </Link>
          <h2 style={{ marginTop: "20px", marginBottom: "8px" }}>Welcome Back</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Log in to your account
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter username"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="login-password">Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter password"
                style={{ paddingRight: "48px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "18px",
                  color: "var(--text-tertiary)",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 0.2s var(--ease)",
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁" : "👁‍🗨"}
              </button>
            </div>
          </div>

          <div className="form-group" style={{
            background: "var(--bg-secondary)",
            padding: "16px",
            borderRadius: "var(--radius-md)",
            marginBottom: 0,
          }}>
            <label className="form-label" htmlFor="login-captcha">Security Verification</label>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}>
              <span style={{
                fontSize: "15px",
                fontWeight: "600",
                color: "var(--text-primary)",
              }}>
                {captchaQuestion || "Loading..."}
              </span>
              <button
                type="button"
                onClick={loadCaptcha}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                Refresh
              </button>
            </div>
            <input
              id="login-captcha"
              type="text"
              className="form-input"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              required
              placeholder="Your answer"
              style={{ background: "var(--bg-primary)" }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", marginTop: "8px", padding: "14px" }}
          >
            {loading ? "Signing In..." : "Log In"}
          </button>
        </form>

        <div style={{
          textAlign: "center",
          fontSize: "14px",
          color: "var(--text-secondary)",
          borderTop: "1px solid var(--border)",
          paddingTop: "20px",
          marginTop: "24px",
        }}>
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" style={{ color: "var(--accent)", fontWeight: "600" }}>
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { getSession } from "@/lib/auth";

export const revalidate = 0;

export default async function Home() {
  const session = await getSession();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <header style={{
        padding: "16px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid var(--border)",
        background: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(20px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <span style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
          Safari Boys
        </span>
        <nav style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {session ? (
            <Link href={session.role === "CUSTOMER" ? "/dashboard" : "/admin"} className="btn btn-primary btn-sm">
              {session.role === "CUSTOMER" ? "Dashboard" : "Admin Panel"}
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="btn btn-ghost btn-sm">Log In</Link>
              <Link href="/auth/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "100px 40px 80px",
        maxWidth: "720px",
        margin: "0 auto",
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "var(--accent-light)",
          color: "var(--accent)",
          padding: "6px 14px",
          borderRadius: "var(--radius-pill)",
          fontSize: "13px",
          fontWeight: "600",
          marginBottom: "24px",
        }}>
          <span>🔒</span> Secure Wallet-Based Platform
        </div>

        <h1 style={{ marginBottom: "20px" }}>
          The smarter way to source compounds.
        </h1>
        <p style={{
          fontSize: "19px",
          color: "var(--text-secondary)",
          lineHeight: "1.6",
          maxWidth: "560px",
          marginBottom: "40px",
        }}>
          Browse, order, and track deliveries — all powered by a secure closed-wallet system with crypto payments and 24/7 Telegram bot access.
        </p>

        <div style={{ display: "flex", gap: "12px" }}>
          {session ? (
            <Link href={session.role === "CUSTOMER" ? "/dashboard" : "/admin"} className="btn btn-primary">
              Open Dashboard
            </Link>
          ) : (
            <>
              <Link href="/auth/register" className="btn btn-primary">Sign Up</Link>
              <Link href="/auth/login" className="btn btn-secondary">Log In</Link>
            </>
          )}
        </div>
      </section>

      {/* Features */}
      <section style={{
        background: "var(--bg-secondary)",
        padding: "80px 40px",
      }}>
        <div style={{
          maxWidth: "960px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "24px",
        }}>
          <div className="card" style={{ textAlign: "center", padding: "40px 28px" }}>
            <div style={{ fontSize: "36px", marginBottom: "16px" }}>💳</div>
            <h3 style={{ marginBottom: "10px" }}>Secure Wallet</h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
              Deposit crypto, spend in-platform. Every transaction is logged in a permanent ledger for full transparency.
            </p>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "40px 28px" }}>
            <div style={{ fontSize: "36px", marginBottom: "16px" }}>📦</div>
            <h3 style={{ marginBottom: "10px" }}>FIFO Delivery</h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
              First-in, first-out allocation ensures fair, ordered delivery of every batch and serial code.
            </p>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "40px 28px" }}>
            <div style={{ fontSize: "36px", marginBottom: "16px" }}>🤖</div>
            <h3 style={{ marginBottom: "10px" }}>24/7 Telegram Bot</h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
              Browse products, check balances, and place orders instantly — right from Telegram, anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "24px 40px",
        textAlign: "center",
        fontSize: "13px",
        color: "var(--text-tertiary)",
        borderTop: "1px solid var(--border)",
      }}>
        © {new Date().getFullYear()} Safari Boys. All rights reserved.
      </footer>
    </div>
  );
}

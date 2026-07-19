"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { formatPrice } from "@/lib/currencies";
import styles from "../app/dashboard/dashboard.module.css";

type Tab = "shop" | "wallet" | "orders" | "disputes" | "profile" | "settings";

interface DashboardNavProps {
  user: any;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onLogout: () => void;
  hasActiveOrders: boolean;
  botUsername: string;
}

export default function DashboardNav({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  hasActiveOrders,
  botUsername,
}: DashboardNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    setMenuOpen(false);
  };

  const username = user?.username || "USER";
  const balance = user?.wallet?.balance || 0;

  return (
    <header className={styles.topnav} style={{ padding: "12px 24px", justifyContent: "space-between" }}>
      {/* Left side: Username / ID (like MASSAKA34) */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <Link 
          href="/dashboard"
          onClick={() => setActiveTab("shop")}
          style={{ 
            fontWeight: "700", 
            fontSize: "16px",
            letterSpacing: "0.03em",
            color: "var(--text-primary)"
          }}
        >
          {username}
        </Link>
      </div>

      {/* Right side: Actions & Profile */}
      <div className={styles.account} style={{ gap: "8px" }}>
        <a
          href={`https://t.me/${botUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", padding: "6px 12px" }}
        >
          <span style={{ fontSize: "16px" }}>🤖</span> Bot
        </a>

        <button
          type="button"
          onClick={() => handleTabClick("wallet")}
          className="btn btn-ghost btn-sm"
          style={{ fontWeight: "700", padding: "6px 12px", fontSize: "16px" }}
          title={`Wallet balance $${balance.toFixed(2)}`}
        >
          $
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px" }}
        >
          <span aria-hidden="true">🇬🇧</span> English
        </button>

        <ThemeToggle compact />

        <div className={styles.menuWrap} ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              width: "36px", height: "36px",
              borderRadius: "50%",
              border: "2px solid var(--border)",
              background: "linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)",
              color: "#fff",
              fontWeight: "700",
              fontSize: "14px",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              padding: 0,
              marginLeft: "8px"
            }}
            aria-label="Open profile menu"
            aria-expanded={menuOpen}
          >
            {username.slice(0, 2).toUpperCase()}
          </button>

          {/* New Dropdown Layout */}
          <nav
            className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ""}`}
            style={{ right: 0, top: "calc(100% + 12px)", minWidth: "220px", padding: "8px 0" }}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", marginBottom: "8px" }}>
              <strong style={{ display: "block", fontSize: "15px", marginBottom: "2px" }}>{username}</strong>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Balance: {formatPrice(balance, "USD")}</span>
            </div>

            <button type="button" onClick={() => handleTabClick("profile")} className={styles.menuItem}>
              <span style={{ width: "20px" }}>👤</span> Profile
            </button>
            <button type="button" onClick={() => {}} className={styles.menuItem}>
              <span style={{ width: "20px" }}>🤍</span> Favorites
            </button>
            <button type="button" onClick={() => handleTabClick("wallet")} className={styles.menuItem}>
              <span style={{ width: "20px" }}>💳</span> Balance
            </button>
            <button type="button" onClick={() => handleTabClick("orders")} className={styles.menuItem} style={{ position: "relative" }}>
              <span style={{ width: "20px" }}>🛍️</span> Orders
              {hasActiveOrders && <i className={styles.dot} style={{ position: "absolute", right: "12px" }} />}
            </button>
            <button type="button" onClick={() => handleTabClick("disputes")} className={styles.menuItem}>
              <span style={{ width: "20px" }}>🔍</span> Disputes
            </button>
            <button type="button" onClick={() => {}} className={styles.menuItem}>
              <span style={{ width: "20px" }}>💬</span> Reviews
            </button>
            <button type="button" onClick={() => handleTabClick("settings")} className={styles.menuItem}>
              <span style={{ width: "20px" }}>⚙️</span> Settings
            </button>
            
            <div style={{ height: "1px", background: "var(--border)", margin: "8px 0" }} />
            
            <button type="button" onClick={onLogout} className={styles.menuItem} style={{ color: "var(--red)" }}>
              <span style={{ width: "20px" }}>↪</span> Sign Out
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Product {
  id: string; name: string; description: string; price: number;
  formula: string | null; casNumber: string | null;
  stockState: string; stockCount: number;
}
interface Category { id: string; name: string; description: string | null; products: Product[]; }
interface WalletLedger { id: string; type: string; amount: number; description: string; createdAt: string; }
interface Order {
  id: string; productId: string; amountPaid: number; status: string;
  cooldownEndAt: string | null; createdAt: string;
  product: Product;
  inventoryItem: { id: string; mediaUrl: string | null; locationData: string | null; data: string } | null;
}
interface Dispute {
  id: string; orderId: string; reason: string; status: string;
  resolutionType: string | null; createdAt: string;
  order: { product: Product };
}

type Tab = "shop" | "wallet" | "orders" | "disputes";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "SafariBoys_bot";

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("shop");
  const [user, setUser] = useState<any>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [ledgers, setLedgers] = useState<WalletLedger[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  const [depositAmount, setDepositAmount] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [selectedOrderIdForDispute, setSelectedOrderIdForDispute] = useState<string | null>(null);
  const [walletMessage, setWalletMessage] = useState("");
  const [shopMsg, setShopMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!data.user) { router.push("/auth/login"); return; }
      if (data.user.role !== "CUSTOMER") {
        if (data.user.role === "STAFF") router.push("/staff");
        else router.push("/admin");
        return;
      }
      setUser(data.user);
    } catch { router.push("/auth/login"); }
  };

  const loadShopData = async () => { try { const r = await fetch("/api/inventory/products"); const d = await r.json(); if (r.ok) setCategories(d.categories); } catch {} };
  const loadWalletData = async () => { try { const r = await fetch("/api/wallet/ledger"); const d = await r.json(); if (r.ok) setLedgers(d.ledgers); } catch {} };
  const loadOrdersData = async () => { try { const r = await fetch("/api/orders/list"); const d = await r.json(); if (r.ok) setOrders(d.orders); } catch {} };
  const loadDisputesData = async () => { try { const r = await fetch("/api/disputes/list"); const d = await r.json(); if (r.ok) setDisputes(d.disputes); } catch {} };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await checkSession();
      await Promise.all([loadShopData(), loadWalletData(), loadOrdersData(), loadDisputesData()]);
      setLoading(false);
    })();
  }, []);

  // Poll cooldowns
  useEffect(() => {
    const hasActive = orders.some(o => o.status === "COOLDOWN_ACTIVE");
    if (!hasActive) return;
    const interval = setInterval(async () => {
      const updated = await Promise.all(
        orders.map(async (order) => {
          if (order.status === "COOLDOWN_ACTIVE") {
            const r = await fetch("/api/orders/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id }) });
            const d = await r.json();
            if (r.ok) return d.order;
          }
          return order;
        })
      );
      setOrders(updated);
      const rMe = await fetch("/api/auth/me");
      const dMe = await rMe.json();
      if (dMe.user) setUser(dMe.user);
    }, 4000);
    return () => clearInterval(interval);
  }, [orders]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/"); router.refresh();
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault(); setWalletMessage("");
    try {
      const r = await fetch("/api/wallet/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: depositAmount }) });
      const d = await r.json();
      if (!r.ok) { setWalletMessage(`Error: ${d.error}`); return; }
      setWalletMessage(`$${parseFloat(depositAmount).toFixed(2)} credited to wallet`);
      setDepositAmount("");
      const rMe = await fetch("/api/auth/me"); const dMe = await rMe.json(); setUser(dMe.user);
      loadWalletData();
    } catch { setWalletMessage("Error processing deposit"); }
  };

  const handleBuy = async (productId: string) => {
    setShopMsg(null);
    try {
      const r = await fetch("/api/orders/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) });
      const d = await r.json();
      if (!r.ok) { setShopMsg({ type: "error", text: d.error || "Purchase failed" }); return; }
      setShopMsg({ type: "success", text: `Order placed! Cooldown active.` });
      const rMe = await fetch("/api/auth/me"); const dMe = await rMe.json(); setUser(dMe.user);
      loadShopData(); loadWalletData(); loadOrdersData();
      setActiveTab("orders");
    } catch { setShopMsg({ type: "error", text: "Error processing purchase" }); }
  };

  const checkOrderStatus = async (orderId: string) => {
    try {
      const r = await fetch("/api/orders/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
      const d = await r.json();
      if (r.ok) setOrders(orders.map(o => o.id === orderId ? d.order : o));
    } catch {}
  };

  const completeOrder = async (orderId: string) => {
    try {
      const r = await fetch("/api/orders/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
      const d = await r.json();
      if (r.ok) setOrders(orders.map(o => o.id === orderId ? d.order : o));
    } catch {}
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderIdForDispute) return;
    try {
      const r = await fetch("/api/disputes/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: selectedOrderIdForDispute, reason: disputeReason }) });
      if (r.ok) { setSelectedOrderIdForDispute(null); setDisputeReason(""); loadDisputesData(); loadOrdersData(); setActiveTab("disputes"); }
    } catch {}
  };

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)" }}>
        <h3 style={{ color: "var(--text-secondary)" }}>Loading...</h3>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "shop", label: "Products", icon: "🛒" },
    { key: "wallet", label: "Wallet", icon: "💳" },
    { key: "orders", label: "Orders", icon: "📦" },
    { key: "disputes", label: "Disputes", icon: "⚖️" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-secondary)" }}>
      {/* Telegram Banner */}
      <div className="telegram-banner">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>🤖</span>
          <span>24/7 Telegram Bot — Instant access to store anytime, anywhere</span>
        </div>
        <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noopener noreferrer">
          Talk to Bot →
        </a>
      </div>

      {/* Header */}
      <header style={{
        padding: "14px 32px", display: "flex", justifyContent: "space-between",
        alignItems: "center", background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "18px", fontWeight: "700" }}>Safari Boys</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
            background: "var(--bg-secondary)", padding: "8px 16px",
            borderRadius: "var(--radius-pill)", display: "flex", alignItems: "center", gap: "8px",
          }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Balance:</span>
            <span style={{ fontWeight: "700", color: "var(--green)", fontSize: "15px" }}>
              ${user.wallet.balance.toFixed(2)}
            </span>
          </div>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{user.username}</span>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm">Log Out</button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "24px 20px", gap: "24px" }}>
        {/* Sidebar */}
        <aside style={{ width: "200px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 14px", border: "none", borderRadius: "var(--radius-md)",
                background: activeTab === tab.key ? "var(--accent-light)" : "transparent",
                color: activeTab === tab.key ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: activeTab === tab.key ? "600" : "400",
                fontSize: "14px", cursor: "pointer", textAlign: "left",
                fontFamily: "inherit", transition: "all 0.15s var(--ease)",
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.key === "orders" && orders.some(o => o.status === "COOLDOWN_ACTIVE") && (
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--orange)", marginLeft: "auto" }} />
              )}
            </button>
          ))}
        </aside>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* SHOP */}
          {activeTab === "shop" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>Browse Products</h2>

              {shopMsg && (
                <div className={`alert ${shopMsg.type === "error" ? "alert-error" : "alert-success"}`}>
                  {shopMsg.text}
                </div>
              )}

              {categories.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "60px" }}>
                  <p style={{ color: "var(--text-secondary)" }}>No products available yet. Check back soon!</p>
                </div>
              ) : (
                categories.map(category => (
                  <div key={category.id}>
                    <h3 style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>{category.name}</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                      {category.products.map(product => (
                        <div key={product.id} className="card card-interactive" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                          <div>
                            <h4 style={{ marginBottom: "6px" }}>{product.name}</h4>
                            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                              {product.formula && <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: "500" }}>{product.formula}</span>}
                              {product.casNumber && <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>CAS: {product.casNumber}</span>}
                            </div>
                            <span className={`badge badge-${product.stockState.toLowerCase()}`} style={{ marginBottom: "8px" }}>
                              {product.stockState.replace("_", " ")} ({product.stockCount})
                            </span>
                            {product.description && (
                              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px", lineHeight: "1.5" }}>
                                {product.description}
                              </p>
                            )}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "14px" }}>
                            <span style={{ fontSize: "20px", fontWeight: "700" }}>${product.price.toFixed(2)}</span>
                            <button
                              onClick={() => handleBuy(product.id)}
                              disabled={product.stockCount === 0}
                              className="btn btn-primary btn-sm"
                              style={{ opacity: product.stockCount === 0 ? 0.4 : 1 }}
                            >
                              {product.stockCount === 0 ? "Out of Stock" : "Buy with Crypto"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* WALLET */}
          {activeTab === "wallet" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>Wallet</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div className="card">
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "4px" }}>Available Balance</p>
                  <h1 style={{ color: "var(--green)", marginBottom: "24px" }}>${user.wallet.balance.toFixed(2)}</h1>

                  {walletMessage && (
                    <div className={walletMessage.startsWith("Error") ? "alert alert-error" : "alert alert-success"}>
                      {walletMessage}
                    </div>
                  )}

                  <form onSubmit={handleDeposit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Deposit Amount ($)</label>
                      <input className="form-input" type="number" step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} required placeholder="100.00" />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                      Deposit via Crypto
                    </button>
                  </form>
                  <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "12px", textAlign: "center" }}>
                    Crypto payments only • Closed-loop wallet • No withdrawals
                  </p>
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: "16px" }}>Wallet Rules</h3>
                  <ul style={{ paddingLeft: "20px", color: "var(--text-secondary)", fontSize: "14px", lineHeight: "2" }}>
                    <li>This is a <strong>closed-loop wallet</strong>. No external withdrawals.</li>
                    <li>Deposits are made via crypto transfer.</li>
                    <li>Every transaction is logged in a permanent ledger.</li>
                    <li>Refunds are credited directly to your balance.</li>
                  </ul>
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: "16px" }}>Transaction History</h3>
                {ledgers.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>No transactions yet.</p>
                ) : (
                  <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Description</th></tr></thead>
                    <tbody>
                      {ledgers.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>{new Date(log.createdAt).toLocaleString()}</td>
                          <td><span className={`badge ${log.type === "DEPOSIT" || log.type === "REFUND" ? "badge-green" : "badge-red"}`}>{log.type}</span></td>
                          <td style={{ fontWeight: "600", color: log.amount > 0 ? "var(--green)" : "var(--red)" }}>
                            {log.amount > 0 ? `+$${log.amount.toFixed(2)}` : `-$${Math.abs(log.amount).toFixed(2)}`}
                          </td>
                          <td style={{ color: "var(--text-secondary)" }}>{log.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ORDERS */}
          {activeTab === "orders" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>My Orders</h2>
              {orders.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "60px" }}>
                  <p style={{ color: "var(--text-secondary)" }}>No orders yet. Visit Products to make your first purchase.</p>
                </div>
              ) : (
                orders.map(order => {
                  const isCooldown = order.status === "COOLDOWN_ACTIVE";
                  const secondsLeft = order.cooldownEndAt ? Math.max(0, Math.ceil((new Date(order.cooldownEndAt).getTime() - Date.now()) / 1000)) : 0;

                  return (
                    <div key={order.id} className="card" style={{
                      borderLeft: `4px solid ${
                        order.status === "READY" ? "var(--green)" :
                        order.status === "COOLDOWN_ACTIVE" ? "var(--orange)" :
                        order.status === "COMPLETED" ? "var(--accent)" : "var(--border)"
                      }`
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div>
                          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "monospace" }}>#{order.id.slice(0, 8)}</p>
                          <h4>{order.product.name}</h4>
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span className={`badge ${
                            order.status === "READY" ? "badge-green" :
                            order.status === "COOLDOWN_ACTIVE" ? "badge-orange" :
                            order.status === "COMPLETED" ? "badge-blue" : ""
                          }`}>{order.status.replace("_", " ")}</span>
                          <span style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {isCooldown && (
                        <div style={{
                          background: "var(--orange-bg)", padding: "14px",
                          borderRadius: "var(--radius-md)", marginBottom: "12px",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}>
                          <div>
                            <p style={{ color: "var(--orange)", fontWeight: "600", fontSize: "14px" }}>Processing</p>
                            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Preparing your FIFO batch allocation...</p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontWeight: "700", color: "var(--orange)", fontFamily: "monospace" }}>
                              {secondsLeft > 0 ? `${secondsLeft}s` : "Ready"}
                            </span>
                            <button onClick={() => checkOrderStatus(order.id)} className="btn btn-secondary btn-sm">Check</button>
                          </div>
                        </div>
                      )}

                      {order.inventoryItem && (
                        <div style={{
                          background: "var(--green-bg)", padding: "14px",
                          borderRadius: "var(--radius-md)", marginBottom: "12px",
                        }}>
                          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "6px" }}>ALLOCATED BATCH DATA</p>
                          <p style={{
                            background: "var(--bg-primary)", padding: "8px 12px",
                            borderRadius: "var(--radius-sm)", fontFamily: "monospace",
                            fontSize: "13px", color: "var(--green)", marginBottom: "6px",
                            border: "1px solid var(--border)",
                          }}>
                            {order.inventoryItem.data}
                          </p>
                          {order.inventoryItem.locationData && (
                            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                              📍 <strong>Location:</strong> {order.inventoryItem.locationData}
                            </p>
                          )}
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                        <span style={{ fontWeight: "600" }}>${order.amountPaid.toFixed(2)}</span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {order.status === "READY" && (
                            <button onClick={() => completeOrder(order.id)} className="btn btn-primary btn-sm">Confirm Received</button>
                          )}
                          {(order.status === "READY" || order.status === "COMPLETED") && (
                            <button
                              onClick={() => { setSelectedOrderIdForDispute(order.id); setActiveTab("disputes"); }}
                              className="btn btn-ghost btn-sm"
                              style={{ color: "var(--orange)" }}
                            >
                              File Dispute
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* DISPUTES */}
          {activeTab === "disputes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>Disputes</h2>

              {selectedOrderIdForDispute && (
                <div className="card">
                  <h3 style={{ marginBottom: "12px" }}>File a Dispute</h3>
                  <form onSubmit={handleDisputeSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Reason</label>
                      <textarea className="form-input" rows={3} value={disputeReason} onChange={e => setDisputeReason(e.target.value)} required placeholder="Describe your issue..." />
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="submit" className="btn btn-primary btn-sm">Submit Dispute</button>
                      <button type="button" onClick={() => setSelectedOrderIdForDispute(null)} className="btn btn-ghost btn-sm">Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              {disputes.length === 0 && !selectedOrderIdForDispute ? (
                <div className="card" style={{ textAlign: "center", padding: "60px" }}>
                  <p style={{ color: "var(--text-secondary)" }}>No disputes filed.</p>
                </div>
              ) : (
                disputes.map(d => (
                  <div key={d.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h4>{d.order.product.name}</h4>
                      <span className={`badge ${d.status === "RESOLVED" ? "badge-green" : "badge-orange"}`}>{d.status}</span>
                    </div>
                    <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      &quot;{d.reason}&quot;
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                      Filed {new Date(d.createdAt).toLocaleString()}
                    </p>
                    {d.status === "RESOLVED" && (
                      <div className={d.resolutionType === "REJECTED" ? "alert alert-error" : "alert alert-success"} style={{ marginTop: "10px", marginBottom: 0 }}>
                        Resolution: <strong>{d.resolutionType}</strong>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

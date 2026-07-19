"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import SiteFooter from "@/components/SiteFooter";
import DashboardNav from "@/components/DashboardNav";
import { formatPrice } from "@/lib/currencies";
import styles from "./dashboard.module.css";

interface Product {
  id: string; name: string; description: string; price: number;
  currency: string;
  formula: string | null; casNumber: string | null; imageUrl: string | null;
  stockState: string; stockCount: number;
}
interface Category { id: string; name: string; description: string | null; products: Product[]; }
interface WalletLedger { id: string; type: string; amount: number; description: string; createdAt: string; }
interface Order {
  id: string; productId: string; amountPaid: number; status: string;
  cooldownEndAt: string | null; createdAt: string;
  paymentMethod?: string; cryptoCurrency?: string | null; coinbaseChargeUrl?: string | null;
  product: Product;
  inventoryItem: { id: string; mediaUrl: string | null; locationData: string | null; data: string } | null;
}
interface Dispute {
  id: string; orderId: string; reason: string; status: string;
  resolutionType: string | null; createdAt: string;
  order: { product: Product };
}

type Tab = "shop" | "wallet" | "orders" | "disputes" | "profile" | "settings";

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
  const [menuOpen, setMenuOpen] = useState(false);

  // Deposit gateway state
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [cryptoWalletAddress, setCryptoWalletAddress] = useState("");
  const [pendingDeposit, setPendingDeposit] = useState<any | null>(null);
  const [showDepositInstructions, setShowDepositInstructions] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Telegram settings state
  const [tgIdInput, setTgIdInput] = useState("");
  const [tgUsernameInput, setTgUsernameInput] = useState("");
  const [tgMsg, setTgMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [tgLoading, setTgLoading] = useState(false);
  const tgInputsSeeded = useRef(false);

  // Crypto Modal State
  const [cryptoModalOpen, setCryptoModalOpen] = useState(false);
  const [selectedProductForCrypto, setSelectedProductForCrypto] = useState<string | null>(null);
  const [cryptoCurrency, setCryptoCurrency] = useState("BTC");
  const [cryptoPaymentInfo, setCryptoPaymentInfo] = useState<any>(null);
  const [cryptoStep, setCryptoStep] = useState<"select" | "pay">("select");

  const cryptoOptions = [
    { code: "BTC", label: "Bitcoin (BTC)", icon: "₿" },
    { code: "ETH", label: "Ethereum (ETH)", icon: "Ξ" },
    { code: "USDT_ERC20", label: "USDT (ERC-20)", icon: "₮" },
    { code: "USDT_TRC20", label: "USDT (TRC-20)", icon: "₮" },
    { code: "SOL", label: "Solana (SOL)", icon: "◎" },
    { code: "TRX", label: "Tron (TRX)", icon: "⟐" },
  ];

  const checkSession = async (opts?: { seedTelegram?: boolean }) => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!data.user) { router.push("/auth/login"); return; }
      setUser(data.user);
      if (opts?.seedTelegram || !tgInputsSeeded.current) {
        setTgIdInput(data.user.telegramId || "");
        setTgUsernameInput(data.user.telegramUsername || "");
        tgInputsSeeded.current = true;
      }
    } catch { router.push("/auth/login"); }
  };

  const loadShopData = async () => { try { const r = await fetch("/api/inventory/products"); const d = await r.json(); if (r.ok) setCategories(d.categories); } catch {} };
  const loadWalletData = async () => { try { const r = await fetch("/api/wallet/ledger"); const d = await r.json(); if (r.ok) setLedgers(d.ledgers); } catch {} };
  const loadOrdersData = async () => { try { const r = await fetch("/api/orders/list"); const d = await r.json(); if (r.ok) setOrders(d.orders); } catch {} };
  const loadDisputesData = async () => { try { const r = await fetch("/api/disputes/list"); const d = await r.json(); if (r.ok) setDisputes(d.disputes); } catch {} };
  const loadDepositRequests = async () => { try { const r = await fetch("/api/wallet/deposit"); const d = await r.json(); if (r.ok) { setDepositRequests(d.requests); setCryptoWalletAddress(d.cryptoAddress); } } catch {} };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await checkSession({ seedTelegram: true });
      await Promise.all([loadShopData(), loadWalletData(), loadOrdersData(), loadDisputesData(), loadDepositRequests()]);
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword.length < 6) {
      setPwMsg({ type: "error", text: "New password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "error", text: "New passwords do not match" });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMsg({ type: "error", text: data.error || "Failed to change password" });
      } else {
        setPwMsg({ type: "success", text: "Password changed successfully!" });
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      }
    } catch {
      setPwMsg({ type: "error", text: "An error occurred" });
    }
    setPwLoading(false);
  };

  const handleTelegramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTgMsg(null);
    setTgLoading(true);
    try {
      const trimmedId = tgIdInput.trim();
      const trimmedUsername = tgUsernameInput.trim();
      // Empty ID means "leave unchanged" — do not accidentally unlink a bot-linked account
      const payload: { telegramId?: string | null; telegramUsername?: string | null } = {
        telegramUsername: trimmedUsername || null,
      };
      if (trimmedId) {
        payload.telegramId = trimmedId;
      } else if (user?.telegramId) {
        payload.telegramId = user.telegramId;
      } else {
        payload.telegramId = null;
      }

      const res = await fetch("/api/auth/update-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setTgMsg({ type: "error", text: data.error || "Failed to update Telegram details" });
      } else {
        setTgMsg({ type: "success", text: "Telegram settings updated successfully!" });
        tgInputsSeeded.current = false;
        await checkSession({ seedTelegram: true });
      }
    } catch {
      setTgMsg({ type: "error", text: "An error occurred" });
    }
    setTgLoading(false);
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault(); setWalletMessage("");
    try {
      const r = await fetch("/api/wallet/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: depositAmount }) });
      const d = await r.json();
      if (!r.ok) { setWalletMessage(`Error: ${d.error}`); return; }
      setPendingDeposit(d.depositRequest);
      setShowDepositInstructions(true);
      setWalletMessage(`Deposit request for $${parseFloat(depositAmount).toFixed(2)} submitted successfully!`);
      setDepositAmount("");
      loadDepositRequests();
    } catch { setWalletMessage("Error processing deposit"); }
  };

  const handleWalletBuy = async (productId: string) => {
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

  const handleCryptoBuy = async () => {
    if (!selectedProductForCrypto) return;
    setShopMsg(null);
    try {
      const r = await fetch("/api/orders/crypto-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: selectedProductForCrypto, cryptoCurrency }) });
      const d = await r.json();
      if (!r.ok) { setShopMsg({ type: "error", text: d.error || "Purchase failed" }); setCryptoModalOpen(false); return; }
      setCryptoPaymentInfo(d.order);
      setCryptoStep("pay");
      loadShopData(); loadOrdersData();
    } catch { setShopMsg({ type: "error", text: "Error processing crypto purchase" }); }
  };

  const handleCryptoModalClose = () => {
    setCryptoModalOpen(false);
    setCryptoStep("select");
    setCryptoPaymentInfo(null);
    setSelectedProductForCrypto(null);
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
    { key: "profile", label: "Profile", icon: "👤" },
    { key: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className={styles.shell}>
      {/* Header */}
      <DashboardNav
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        hasActiveOrders={orders.some(o => o.status === "COOLDOWN_ACTIVE")}
        botUsername={BOT_USERNAME}
      />

      <div className={styles.content}>
        <main className={styles.section}>
          {/* SHOP */}
          {activeTab === "shop" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <section className={styles.dashboardHero}>
                <div>
                  <p className={styles.heroKicker}>SAFARIBOYZ marketplace</p>
                  <h1>Browse with confidence.</h1>
                  <p>Choose a city to tailor what you see, then explore products from one streamlined dashboard.</p>
                </div>
                <label>
                  <span className="form-label">Delivery city</span>
                  <select className={styles.citySelect} defaultValue="any" aria-label="Select delivery city">
                    <option value="any">Any city</option>
                    <option value="dubai">Dubai</option>
                    <option value="abu-dhabi">Abu Dhabi</option>
                    <option value="sharjah">Sharjah</option>
                  </select>
                </label>
              </section>
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
                            {product.imageUrl && (
                              <div style={{ width: "100%", height: "160px", overflow: "hidden", borderRadius: "var(--radius-md)", marginBottom: "12px", border: "1px solid var(--border)" }}>
                                <img src={product.imageUrl} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            )}
                            <h4 style={{ marginBottom: "6px" }}>{product.name}</h4>
                            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                              {product.formula && <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: "500" }}>{product.formula}</span>}
                              {product.casNumber && <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>CAS: {product.casNumber}</span>}
                            </div>
                            <span className={`badge badge-${product.stockState.toLowerCase()}`} style={{ marginBottom: "8px" }}>
                              {product.stockState.replace(/_/g, " ")} ({product.stockCount})
                            </span>
                            {product.description && (
                              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px", lineHeight: "1.5" }}>
                                {product.description}
                              </p>
                            )}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "14px" }}>
                            <span style={{ fontSize: "20px", fontWeight: "700" }}>{formatPrice(product.price, product.currency)}</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                              <Link
                                href={`/dashboard/product/${product.id}`}
                                className="btn btn-primary btn-sm"
                                style={{ width: "100%" }}
                              >
                                View Product
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {/* Crypto Payment Modal */}
              {cryptoModalOpen && (
                <div style={{
                  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                  background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
                  backdropFilter: "blur(4px)"
                }}>
                  <div className="card" style={{ width: "100%", maxWidth: "480px", background: "var(--bg-primary)" }}>
                    {cryptoStep === "select" ? (
                      <>
                        <h3 style={{ marginBottom: "8px" }}>Select Cryptocurrency</h3>
                        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                          Choose which cryptocurrency to pay with. Network fees are borne by the sender.
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
                          {cryptoOptions.map(opt => (
                            <button
                              key={opt.code}
                              onClick={() => setCryptoCurrency(opt.code)}
                              className={`btn ${cryptoCurrency === opt.code ? "btn-primary" : "btn-secondary"}`}
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", padding: "12px 8px" }}
                            >
                              <span style={{ fontSize: "16px" }}>{opt.icon}</span> {opt.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: "12px" }}>
                          <button onClick={handleCryptoBuy} className="btn btn-primary" style={{ flex: 1 }}>Proceed</button>
                          <button onClick={handleCryptoModalClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                        </div>
                      </>
                    ) : cryptoPaymentInfo ? (
                      <>
                        <h3 style={{ marginBottom: "8px" }}>💰 Send Payment</h3>
                        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                          Send the exact amount to the address below. Your order will be confirmed once the admin verifies the transaction on-chain.
                        </p>

                        <div style={{ background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "16px", border: "1px solid var(--border)" }}>
                          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", fontWeight: "600" }}>Product</p>
                          <p style={{ fontWeight: "600", marginBottom: "12px" }}>{cryptoPaymentInfo.productName}</p>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                            <div>
                              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "2px" }}>Order Amount</p>
                              <p style={{ fontWeight: "600", color: "var(--green)" }}>${cryptoPaymentInfo.amountPaid.toFixed(2)}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "2px" }}>Network Fee (est.)</p>
                              <p style={{ fontWeight: "600", color: "var(--orange)" }}>${cryptoPaymentInfo.networkFee.toFixed(2)}</p>
                            </div>
                          </div>

                          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "2px" }}>Total Payable ({cryptoPaymentInfo.cryptoName})</p>
                            <p style={{ fontWeight: "800", fontSize: "20px", color: "var(--accent)" }}>${cryptoPaymentInfo.totalDue.toFixed(2)} <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: "400" }}>in {cryptoPaymentInfo.cryptoName}</span></p>
                          </div>
                        </div>

                        <div style={{ marginBottom: "20px" }}>
                          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "6px", textTransform: "uppercase", fontWeight: "600" }}>
                            Send {cryptoPaymentInfo.cryptoName} to this address ({cryptoPaymentInfo.network} network)
                          </p>
                          <div style={{
                            background: "var(--bg-secondary)", padding: "12px", borderRadius: "var(--radius-sm)",
                            fontFamily: "monospace", fontSize: "13px", border: "1px solid var(--border)",
                            wordBreak: "break-all", userSelect: "all",
                          }}>
                            {cryptoPaymentInfo.walletAddress}
                          </div>
                        </div>

                        <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "16px" }}>
                          ⚠️ Send the exact amount in {cryptoPaymentInfo.cryptoName}. Network fees are your responsibility. Once you send payment, the admin will verify the blockchain transaction and process your order.
                        </p>

                        <div style={{ display: "flex", gap: "12px" }}>
                          <button onClick={() => { handleCryptoModalClose(); setActiveTab("orders"); }} className="btn btn-primary" style={{ flex: 1 }}>I Have Paid</button>
                          <button onClick={handleCryptoModalClose} className="btn btn-ghost" style={{ flex: 1 }}>Close</button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* WALLET */}
          {activeTab === "wallet" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>Wallet</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {showDepositInstructions && pendingDeposit ? (
                  <div className="card" style={{ border: "1px solid var(--accent)", background: "rgba(0, 113, 227, 0.05)" }}>
                    <h3 style={{ marginBottom: "12px", color: "var(--accent)" }}>💵 Send Crypto Payment</h3>
                    <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                      Your deposit of <strong>${pendingDeposit.amount.toFixed(2)}</strong> is currently <strong>PENDING verification</strong>. Please transfer the amount to the address below:
                    </p>
                    
                    <div style={{ marginBottom: "16px" }}>
                      <label className="form-label" style={{ fontSize: "11px", fontWeight: "bold" }}>Receiving Address</label>
                      <div style={{
                        background: "var(--bg-secondary)", padding: "12px", borderRadius: "var(--radius-sm)",
                        fontFamily: "monospace", fontSize: "14px", border: "1px solid var(--border)",
                        wordBreak: "break-all", userSelect: "all", display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}>
                        <span>{cryptoWalletAddress}</span>
                      </div>
                    </div>

                    <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "20px" }}>
                      ⚠️ Once payment is completed, the admin will verify the ledger and update your wallet balance.
                    </p>
                    
                    <button onClick={() => { setShowDepositInstructions(false); setPendingDeposit(null); }} className="btn btn-primary btn-sm" style={{ width: "100%" }}>
                      I Have Paid
                    </button>
                  </div>
                ) : (
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
                )}

                <div className="card">
                  <h3 style={{ marginBottom: "16px" }}>Wallet Rules</h3>
                  <ul style={{ paddingLeft: "20px", color: "var(--text-secondary)", fontSize: "14px", lineHeight: "2" }}>
                    <li>This is a <strong>closed-loop wallet</strong>. No external withdrawals.</li>
                    <li>Deposits are made via crypto transfer and must be approved by the admin.</li>
                    <li>Every transaction is logged in a permanent ledger.</li>
                    <li>Refunds are credited directly to your balance.</li>
                  </ul>
                </div>
              </div>

              {/* Deposit Requests */}
              <div className="card">
                <h3 style={{ marginBottom: "16px" }}>Deposit Requests</h3>
                {depositRequests.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>No deposit requests yet.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depositRequests.map(req => (
                        <tr key={req.id}>
                          <td style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>{new Date(req.createdAt).toLocaleString()}</td>
                          <td style={{ fontWeight: "600" }}>${req.amount.toFixed(2)}</td>
                          <td>
                            <span className={`badge ${
                              req.status === "APPROVED" ? "badge-green" :
                              req.status === "PENDING" ? "badge-orange" : "badge-red"
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-secondary)" }}>
                            {cryptoWalletAddress.slice(0, 10)}...{cryptoWalletAddress.slice(-6)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
                        order.status === "PENDING_PAYMENT" ? "var(--red)" :
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
                            order.status === "PENDING_PAYMENT" ? "badge-red" :
                            order.status === "COMPLETED" ? "badge-blue" : ""
                          }`}>{order.status.replace(/_/g, " ")}</span>
                          <span style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {order.status === "PENDING_PAYMENT" && order.coinbaseChargeUrl && (
                        <div style={{
                          background: "var(--red-bg)", padding: "14px",
                          borderRadius: "var(--radius-md)", marginBottom: "12px",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          border: "1px solid rgba(255, 59, 48, 0.2)"
                        }}>
                          <div>
                            <p style={{ color: "var(--red)", fontWeight: "600", fontSize: "14px" }}>Awaiting Crypto Payment</p>
                            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Please complete your {order.cryptoCurrency} payment to confirm this order.</p>
                          </div>
                          <a href={order.coinbaseChargeUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ background: "var(--red)", border: "none" }}>
                            Pay Now
                          </a>
                        </div>
                      )}

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

                      {(order as any).adminMessage && (
                        <div style={{
                          background: "var(--blue-bg)", padding: "14px",
                          borderRadius: "var(--radius-md)", marginBottom: "12px",
                          border: "1px solid rgba(0, 122, 255, 0.2)"
                        }}>
                          <p style={{ fontSize: "12px", color: "var(--blue)", marginBottom: "6px", fontWeight: "600", textTransform: "uppercase" }}>
                            📍 Delivery Coordinates
                          </p>
                          <p style={{ fontSize: "14px", color: "var(--text-primary)", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                            {(order as any).adminMessage}
                          </p>
                          {(order as any).adminMessageSentAt && (
                            <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "8px", textAlign: "right" }}>
                              Sent at {new Date((order as any).adminMessageSentAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontWeight: "600" }}>${order.amountPaid.toFixed(2)}</span>
                          {order.paymentMethod === "DIRECT_CRYPTO" ? (
                            <span className="badge badge-purple" style={{ fontSize: "10px" }}>Paid via {order.cryptoCurrency}</span>
                          ) : (
                            <span className="badge badge-green" style={{ fontSize: "10px" }}>Paid via Wallet</span>
                          )}
                        </div>
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

          {/* PROFILE */}
          {activeTab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>User Profile</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "-16px" }}>Manage your account</p>

              {/* Profile Info Card */}
              <div className="card">
                <h3 style={{ marginBottom: "4px" }}>Information</h3>
                <p style={{ fontSize: "13px", color: "var(--text-tertiary)", marginBottom: "24px" }}>Basic information about your account</p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{
                      width: "64px", height: "64px", borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: "800", fontSize: "22px",
                      boxShadow: "0 4px 12px rgba(0,113,227,0.3)",
                    }}>
                      {user.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ marginBottom: "4px" }}>{user.username}</h3>
                      <p style={{ fontSize: "13px", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        📅 Registration date: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                <div className="card stat-card" style={{ borderTop: "3px solid var(--accent)" }}>
                  <p style={{ fontSize: "24px", marginBottom: "4px" }}>🛒</p>
                  <p className="stat-value">{user.totalOrders || 0}</p>
                  <p className="stat-label">Total Orders</p>
                </div>
                <div className="card stat-card" style={{ borderTop: "3px solid var(--green)" }}>
                  <p style={{ fontSize: "24px", marginBottom: "4px" }}>📈</p>
                  <p className="stat-value" style={{ color: "var(--green)" }}>${(user.totalSpent || 0).toFixed(2)}</p>
                  <p className="stat-label">Total Spent</p>
                </div>
                <div className="card stat-card" style={{ borderTop: "3px solid var(--purple)" }}>
                  <p style={{ fontSize: "24px", marginBottom: "4px" }}>💰</p>
                  <p className="stat-value" style={{ color: "var(--purple)" }}>${user.wallet.balance.toFixed(2)}</p>
                  <p className="stat-label">Current Balance</p>
                </div>
              </div>

              {/* Account Details */}
              <div className="card">
                <h3 style={{ marginBottom: "16px" }}>Account Details</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>Username</p>
                    <p style={{ fontWeight: "500" }}>{user.username}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>Role</p>
                    <span className="badge badge-blue">{user.role}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>Telegram</p>
                    <p style={{ fontWeight: "500", color: user.telegramUsername ? "var(--text-primary)" : "var(--text-tertiary)" }}>{user.telegramUsername || "Not linked"}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>Member Since</p>
                    <p style={{ fontWeight: "500" }}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>Settings</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "-16px" }}>Manage your account settings</p>

              {/* Change Password */}
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "24px" }}>🔒</span>
                  <div>
                    <h3 style={{ marginBottom: "2px" }}>Change Password</h3>
                    <p style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>Update your password to keep your account secure</p>
                  </div>
                </div>

                {pwMsg && (
                  <div className={`alert ${pwMsg.type === "error" ? "alert-error" : "alert-success"}`}>
                    {pwMsg.text}
                  </div>
                )}

                <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "480px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="current-password">Current Password</label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="current-password"
                        type={showCurrentPw ? "text" : "password"}
                        className="form-input"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        placeholder="Enter current password"
                        style={{ paddingRight: "48px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        style={{
                          position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                          background: "transparent", border: "none", cursor: "pointer",
                          fontSize: "18px", color: "var(--text-tertiary)", padding: "4px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        title={showCurrentPw ? "Hide password" : "Show password"}
                      >
                        {showCurrentPw ? "👁" : "👁‍🗨"}
                      </button>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="new-password">New Password</label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="new-password"
                        type={showNewPw ? "text" : "password"}
                        className="form-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        placeholder="Min. 6 characters"
                        style={{ paddingRight: "48px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        style={{
                          position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                          background: "transparent", border: "none", cursor: "pointer",
                          fontSize: "18px", color: "var(--text-tertiary)", padding: "4px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        title={showNewPw ? "Hide password" : "Show password"}
                      >
                        {showNewPw ? "👁" : "👁‍🗨"}
                      </button>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="confirm-password">Confirm New Password</label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="confirm-password"
                        type={showConfirmPw ? "text" : "password"}
                        className="form-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="Re-enter new password"
                        style={{ paddingRight: "48px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        style={{
                          position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                          background: "transparent", border: "none", cursor: "pointer",
                          fontSize: "18px", color: "var(--text-tertiary)", padding: "4px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        title={showConfirmPw ? "Hide password" : "Show password"}
                      >
                        {showConfirmPw ? "👁" : "👁‍🗨"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={pwLoading}
                    style={{ width: "fit-content", marginTop: "8px" }}
                  >
                    {pwLoading ? "Changing..." : "Change Password"}
                  </button>
                </form>
              </div>

              {/* Telegram Settings */}
              <div className="card" style={{ marginTop: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "24px" }}>🤖</span>
                  <div>
                    <h3 style={{ marginBottom: "2px" }}>Telegram Integration</h3>
                    <p style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>Link your Telegram account to access the 24/7 shop bot and receive order updates</p>
                  </div>
                </div>

                {tgMsg && (
                  <div className={`alert ${tgMsg.type === "error" ? "alert-error" : "alert-success"}`} style={{ marginBottom: "20px" }}>
                    {tgMsg.text}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
                  <form onSubmit={handleTelegramSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="telegram-username">Telegram Username</label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}>@</span>
                        <input
                          id="telegram-username"
                          type="text"
                          className="form-input"
                          value={tgUsernameInput}
                          onChange={(e) => setTgUsernameInput(e.target.value)}
                          placeholder="username"
                          style={{ paddingLeft: "28px" }}
                        />
                      </div>
                      <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>Your public Telegram handle (without @)</p>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="telegram-id">Telegram User ID</label>
                      <input
                        id="telegram-id"
                        type="text"
                        className="form-input"
                        value={tgIdInput}
                        onChange={(e) => setTgIdInput(e.target.value)}
                        placeholder="e.g. 123456789"
                      />
                      <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                        Numeric Telegram ID. Get it by sending a message to <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>@userinfobot</a>
                      </p>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={tgLoading}
                      style={{ width: "fit-content", marginTop: "8px" }}
                    >
                      {tgLoading ? "Saving..." : "Save Telegram Settings"}
                    </button>
                  </form>

                  <div style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                    <h4 style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>🚀</span> How to Connect
                    </h4>
                    <ol style={{ fontSize: "13px", color: "var(--text-secondary)", paddingLeft: "20px", margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                      <li>
                        Open the Telegram app and search for <strong>@{BOT_USERNAME}</strong> or click the button below.
                      </li>
                      <li>
                        Start a chat with the bot by clicking the <strong>Start</strong> button or sending <code>/start</code>.
                      </li>
                      <li>
                        Enter your Telegram details on the left and save them.
                      </li>
                      <li>
                        Use the bot menu to browse categories, buy compounds, and check your order history directly from Telegram!
                      </li>
                    </ol>
                    <a
                      href={`https://t.me/${BOT_USERNAME}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary"
                      style={{ width: "100%", marginTop: "20px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
                    >
                      💬 Open Telegram Bot
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

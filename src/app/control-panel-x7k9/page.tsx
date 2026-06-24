"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Tab = "dashboard" | "products" | "active-orders" | "all-orders" | "users" | "payments" | "disputes";

export default function ClientAdminPanel() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [msg, setMsg] = useState<{ type: "success" | "error", text: string } | null>(null);

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [disputes, setDisputes] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  
  // Product states
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Local UI states
  const [adminMessages, setAdminMessages] = useState<Record<string, string>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Product management UI states
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", description: "", price: "", formula: "", casNumber: "", categoryId: "", imageUrl: "" });
  const [newInventory, setNewInventory] = useState({ productId: "", data: "", locationData: "" });

  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!data.user) { router.push("/control-panel-x7k9/login"); return; }
      if (!["ADMIN", "SUPERADMIN"].includes(data.user.role)) { router.push("/dashboard"); return; }
      setUser(data.user);
    } catch { router.push("/control-panel-x7k9/login"); }
  };

  const fetchAll = async () => {
    try {
      const [statsRes, ordersRes, usersRes, settingsRes, disputesRes, depositsRes, categoriesRes, productsRes] = await Promise.all([
        fetch("/api/client-admin/stats"),
        fetch("/api/client-admin/orders"),
        fetch("/api/client-admin/users"),
        fetch("/api/client-admin/settings"),
        fetch("/api/disputes/list"),
        fetch("/api/client-admin/deposits"),
        fetch("/api/admin/categories"),
        fetch("/api/admin/products")
      ]);
      const [statsData, ordersData, usersData, settingsData, disputesData, depositsData, catData, prodData] = await Promise.all([
        statsRes.json(), ordersRes.json(), usersRes.json(), settingsRes.json(), disputesRes.json(), depositsRes.json(), categoriesRes.json(), productsRes.json()
      ]);
      if (statsData.stats) setStats(statsData.stats);
      if (ordersData.orders) setOrders(ordersData.orders);
      if (usersData.users) setUsers(usersData.users);
      if (settingsData.settings) {
        setSettings(settingsData.settings);
        setCryptoAddress(settingsData.settings["CRYPTO_WALLET_ADDRESS"] || "");
      }
      if (disputesData.disputes) setDisputes(disputesData.disputes);
      if (depositsData.deposits) setDeposits(depositsData.deposits);
      if (catData.categories) setCategories(catData.categories);
      if (prodData.products) setProducts(prodData.products);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await checkSession();
      await fetchAll();
      setLoading(false);
    })();
  }, []);

  const handleSendMessage = async (orderId: string) => {
    const message = adminMessages[orderId];
    if (!message) return;
    
    setMsg(null);
    try {
      const res = await fetch("/api/client-admin/orders/send-message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, message })
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "error", text: data.error }); return; }
      setMsg({ type: "success", text: "Message sent and coordinates updated!" });
      fetchAll();
      setAdminMessages(prev => ({ ...prev, [orderId]: "" }));
    } catch (e) {
      setMsg({ type: "error", text: "Failed to send message" });
    }
  };

  const handleProcessDeposit = async (depositRequestId: string, action: "APPROVE" | "REJECT") => {
    setMsg(null);
    try {
      const res = await fetch("/api/client-admin/deposits", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositRequestId, action })
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "error", text: data.error || "Failed to process deposit" }); return; }
      setMsg({ type: "success", text: `Deposit successfully ${action === "APPROVE" ? "approved" : "rejected"}!` });
      fetchAll();
    } catch (e) {
      setMsg({ type: "error", text: "Failed to process deposit" });
    }
  };

  const handleUpdateCrypto = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const res = await fetch("/api/client-admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "CRYPTO_WALLET_ADDRESS", value: cryptoAddress })
      });
      if (!res.ok) { setMsg({ type: "error", text: "Failed to update address" }); return; }
      setMsg({ type: "success", text: "Crypto wallet address updated successfully!" });
      fetchAll();
    } catch (e) {
      setMsg({ type: "error", text: "Failed to update address" });
    }
  };

  // --- Product Management ---
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName, description: newCategoryDesc })
      });
      if (res.ok) {
        setMsg({ type: "success", text: "Category added!" });
        setNewCategoryName(""); setNewCategoryDesc("");
        fetchAll();
      } else {
        const d = await res.json(); setMsg({ type: "error", text: d.error });
      }
    } catch (e) { setMsg({ type: "error", text: "Error adding category" }); }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Delete category?")) return;
    try {
      const res = await fetch("/api/admin/categories", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId })
      });
      if (res.ok) { setMsg({ type: "success", text: "Category deleted!" }); fetchAll(); }
    } catch (e) { setMsg({ type: "error", text: "Error deleting category" }); }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newProduct, price: parseFloat(newProduct.price) })
      });
      if (res.ok) {
        setMsg({ type: "success", text: "Product added!" });
        setNewProduct({ name: "", description: "", price: "", formula: "", casNumber: "", categoryId: "", imageUrl: "" });
        fetchAll();
      } else {
        const d = await res.json(); setMsg({ type: "error", text: d.error });
      }
    } catch (e) { setMsg({ type: "error", text: "Error adding product" }); }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Delete product?")) return;
    try {
      const res = await fetch("/api/admin/products", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId })
      });
      if (res.ok) { setMsg({ type: "success", text: "Product deleted!" }); fetchAll(); }
    } catch (e) { setMsg({ type: "error", text: "Error deleting product" }); }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: newInventory.productId,
          items: [{ data: newInventory.data, locationData: newInventory.locationData }]
        })
      });
      if (res.ok) {
        setMsg({ type: "success", text: "Inventory item added!" });
        setNewInventory({ productId: "", data: "", locationData: "" });
        fetchAll();
      } else {
        const d = await res.json(); setMsg({ type: "error", text: d.error });
      }
    } catch (e) { setMsg({ type: "error", text: "Error adding inventory" }); }
  };

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)" }}>
        <h3 style={{ color: "var(--text-secondary)" }}>Loading Control Panel...</h3>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "products", label: "Products", icon: "📦" },
    { key: "active-orders", label: "Active Orders", icon: "🚚" },
    { key: "all-orders", label: "All Orders", icon: "📋" },
    { key: "users", label: "Users", icon: "👥" },
    { key: "payments", label: "Payments", icon: "💰" },
    { key: "disputes", label: "Disputes", icon: "⚖️" },
  ];

  const activeOrders = orders.filter(o => !["COMPLETED", "REFUNDED", "FAILED"].includes(o.status));

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-secondary)" }}>
      {/* Header */}
      <header style={{
        padding: "16px 32px", display: "flex", justifyContent: "space-between",
        alignItems: "center", background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100,
        boxShadow: "var(--shadow-sm)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px" }}>Control Panel</span>
          <span className="badge badge-red" style={{ fontSize: "11px", letterSpacing: "0.5px" }}>ROOT</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Admin: <strong style={{ color: "var(--text-primary)" }}>{user.username}</strong>
          </span>
          <button onClick={() => { fetch("/api/auth/logout", { method: "POST" }); router.push("/control-panel-x7k9/login"); }} className="btn btn-ghost btn-sm">Log Out</button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, maxWidth: "1400px", width: "100%", margin: "0 auto", padding: "32px 24px", gap: "32px" }}>
        {/* Sidebar */}
        <aside style={{ width: "240px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setMsg(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 16px", border: "none", borderRadius: "var(--radius-md)",
                background: activeTab === tab.key ? "var(--bg-primary)" : "transparent",
                color: activeTab === tab.key ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: activeTab === tab.key ? "600" : "500",
                fontSize: "15px", cursor: "pointer", textAlign: "left",
                fontFamily: "inherit", transition: "all 0.2s var(--ease)",
                boxShadow: activeTab === tab.key ? "var(--shadow-sm)" : "none",
              }}
            >
              <span style={{ fontSize: "18px" }}>{tab.icon}</span> {tab.label}
              {tab.key === "active-orders" && activeOrders.length > 0 && (
                <span style={{ marginLeft: "auto", background: "var(--red)", color: "white", padding: "2px 8px", borderRadius: "100px", fontSize: "12px", fontWeight: "bold" }}>
                  {activeOrders.length}
                </span>
              )}
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "24px" }}>
          {msg && (
            <div className={`alert ${msg.type === "error" ? "alert-error" : "alert-success"}`} style={{ animation: "fadeIn 0.3s ease" }}>
              {msg.text}
            </div>
          )}

          {/* DASHBOARD */}
          {activeTab === "dashboard" && stats && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "fadeIn 0.4s ease" }}>
              <h2 style={{ fontSize: "28px" }}>Dashboard Overview</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
                <div className="card stat-card" style={{ padding: "32px 24px" }}>
                  <p className="stat-label" style={{ fontSize: "14px", textTransform: "uppercase" }}>Net Sales Revenue</p>
                  <p className="stat-value" style={{ color: "var(--green)", fontSize: "40px", marginTop: "8px" }}>${stats.totalSales.toFixed(2)}</p>
                </div>
                <div className="card stat-card" style={{ padding: "32px 24px" }}>
                  <p className="stat-label" style={{ fontSize: "14px", textTransform: "uppercase" }}>Active Orders</p>
                  <p className="stat-value" style={{ fontSize: "40px", marginTop: "8px" }}>{stats.activeOrders}</p>
                </div>
                <div className="card stat-card" style={{ padding: "32px 24px" }}>
                  <p className="stat-label" style={{ fontSize: "14px", textTransform: "uppercase" }}>Registered Users</p>
                  <p className="stat-value" style={{ fontSize: "40px", marginTop: "8px" }}>{stats.totalUsers}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div className="card">
                  <h3 style={{ marginBottom: "16px", fontSize: "18px" }}>Order Sources</h3>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>🌐 Website Checkout</span>
                    <span style={{ fontWeight: "600" }}>{stats.websiteOrdersCount}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>📱 Telegram Bot</span>
                    <span style={{ fontWeight: "600" }}>{stats.telegramOrdersCount}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRODUCTS TAB */}
          {activeTab === "products" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "fadeIn 0.4s ease" }}>
              <h2 style={{ fontSize: "28px" }}>Product Management</h2>
              
              {/* Category & Inventory Forms */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div className="card">
                  <h3 style={{ marginBottom: "16px", fontSize: "18px" }}>Add Category</h3>
                  <form onSubmit={handleAddCategory} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input className="form-input" placeholder="Category Name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input className="form-input" placeholder="Description (Optional)" value={newCategoryDesc} onChange={e => setNewCategoryDesc(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm">Add Category</button>
                  </form>
                  
                  <h4 style={{ marginTop: "24px", marginBottom: "12px" }}>Existing Categories</h4>
                  <ul style={{ listStyle: "none", padding: 0 }}>
                    {categories.map(c => (
                      <li key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                        <span>{c.name} ({c.productCount})</span>
                        <button onClick={() => handleDeleteCategory(c.id)} className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }}>Del</button>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="card">
                  <h3 style={{ marginBottom: "16px", fontSize: "18px" }}>Add Inventory Item</h3>
                  <form onSubmit={handleAddInventory} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <select className="form-input" value={newInventory.productId} onChange={e => setNewInventory({...newInventory, productId: e.target.value})} required>
                        <option value="">Select Product...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input className="form-input" placeholder="Batch Code / Key Data" value={newInventory.data} onChange={e => setNewInventory({...newInventory, data: e.target.value})} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input className="form-input" placeholder="Location Data (Optional)" value={newInventory.locationData} onChange={e => setNewInventory({...newInventory, locationData: e.target.value})} />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm">Add Item</button>
                  </form>
                </div>
              </div>
              
              {/* Product Form */}
              <div className="card">
                <h3 style={{ marginBottom: "16px", fontSize: "18px" }}>Add New Product</h3>
                <form onSubmit={handleAddProduct} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input className="form-input" placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input className="form-input" placeholder="Price (USD)" type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <select className="form-input" value={newProduct.categoryId} onChange={e => setNewProduct({...newProduct, categoryId: e.target.value})} required>
                      <option value="">Select Category...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input className="form-input" placeholder="Formula (Optional)" value={newProduct.formula} onChange={e => setNewProduct({...newProduct, formula: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input className="form-input" placeholder="CAS Number (Optional)" value={newProduct.casNumber} onChange={e => setNewProduct({...newProduct, casNumber: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input className="form-input" placeholder="Image URL (Optional)" value={newProduct.imageUrl} onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ gridColumn: "span 2", marginBottom: 0 }}>
                    <textarea className="form-input" placeholder="Description" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} rows={3}></textarea>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <button type="submit" className="btn btn-primary">Create Product</button>
                  </div>
                </form>
              </div>

              {/* Products List */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Available / Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.categoryName}</td>
                        <td style={{ fontWeight: "600", color: "var(--green)" }}>${p.price.toFixed(2)}</td>
                        <td><span className={`badge badge-${p.stockState.toLowerCase()}`}>{p.stockState}</span></td>
                        <td>{p.availableItems} / {p.totalItems}</td>
                        <td>
                          <button onClick={() => handleDeleteProduct(p.id)} className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ACTIVE ORDERS */}
          {activeTab === "active-orders" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "fadeIn 0.4s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: "28px" }}>Active Orders ({activeOrders.length})</h2>
                <button onClick={fetchAll} className="btn btn-secondary btn-sm">🔄 Refresh</button>
              </div>
              
              {activeOrders.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-secondary)" }}>
                  <span style={{ fontSize: "48px", display: "block", marginBottom: "16px" }}>🎉</span>
                  <h3 style={{ color: "var(--text-primary)", marginBottom: "8px" }}>All Caught Up!</h3>
                  <p>There are no active orders waiting for coordinates.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {activeOrders.map(order => (
                    <div key={order.id} className="card" style={{ padding: "0", overflow: "hidden", border: expandedOrderId === order.id ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
                      {/* Order Row Header */}
                      <div 
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                        style={{ display: "flex", alignItems: "center", padding: "20px 24px", cursor: "pointer", background: expandedOrderId === order.id ? "var(--bg-tertiary)" : "var(--bg-primary)" }}
                      >
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontWeight: "600", fontSize: "16px" }}>{order.user.username}</span>
                            <span className={`badge ${order.status === "COOLDOWN_ACTIVE" ? "badge-orange" : order.status === "READY" ? "badge-blue" : "badge-in_stock"}`}>{order.status}</span>
                            <span className="badge" style={{ background: order.orderSource === "TELEGRAM" ? "#0088cc" : "var(--bg-secondary)", color: order.orderSource === "TELEGRAM" ? "white" : "var(--text-secondary)" }}>
                              {order.orderSource === "TELEGRAM" ? "📱 Telegram" : "🌐 Website"}
                            </span>
                            {order.paymentMethod === "DIRECT_CRYPTO" ? (
                              <span className="badge badge-purple">₿ Crypto ({order.cryptoCurrency})</span>
                            ) : (
                              <span className="badge badge-green">💳 Wallet</span>
                            )}
                          </div>
                          <span style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Ordered {order.product.name} • ${order.amountPaid.toFixed(2)} • {new Date(order.createdAt).toLocaleString()}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: "20px", color: "var(--text-tertiary)", transform: expandedOrderId === order.id ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.2s ease" }}>↓</span>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedOrderId === order.id && (
                        <div style={{ padding: "24px", borderTop: "1px solid var(--border)", background: "var(--bg-primary)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
                            <div>
                              <h4 style={{ marginBottom: "12px", color: "var(--text-secondary)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Customer Details</h4>
                              <p style={{ marginBottom: "8px" }}><strong>Username:</strong> {order.user.username}</p>
                              <p style={{ marginBottom: "8px" }}>
                                <strong>Telegram:</strong> {order.user.telegramUsername ? `@${order.user.telegramUsername}` : "Not linked"} 
                                {order.user.telegramId && <span style={{ color: "var(--green)", marginLeft: "8px", fontSize: "12px" }}>(Bot Connected)</span>}
                              </p>
                              <p style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <strong>Password:</strong> 
                                <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                                  {visiblePasswords[order.user.id] ? (order.user.passwordPlain || "N/A") : "••••••••"}
                                </span>
                                {order.user.passwordPlain && (
                                  <button onClick={(e) => { e.stopPropagation(); setVisiblePasswords(prev => ({ ...prev, [order.user.id]: !prev[order.user.id] })) }} className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }}>
                                    {visiblePasswords[order.user.id] ? "Hide" : "Show"}
                                  </button>
                                )}
                              </p>
                              <p style={{ marginBottom: "8px", marginTop: "12px" }}>
                                <strong>Payment Method:</strong> {order.paymentMethod === "DIRECT_CRYPTO" ? `Coinbase (${order.cryptoCurrency})` : "Wallet Balance"}
                              </p>
                              {order.coinbaseChargeUrl && (
                                <p style={{ fontSize: "12px" }}>
                                  <a href={order.coinbaseChargeUrl} target="_blank" rel="noreferrer">View Charge</a>
                                </p>
                              )}
                            </div>
                            <div>
                              <h4 style={{ marginBottom: "12px", color: "var(--text-secondary)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Send Coordinates</h4>
                              <textarea 
                                className="form-input" 
                                rows={4} 
                                placeholder="Enter locker code, GPS coordinates, or pickup instructions..."
                                value={adminMessages[order.id] !== undefined ? adminMessages[order.id] : (order.adminMessage || "")}
                                onChange={(e) => setAdminMessages(prev => ({ ...prev, [order.id]: e.target.value }))}
                                style={{ marginBottom: "12px" }}
                              />
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                                  {order.orderSource === "TELEGRAM" && order.user.telegramId 
                                    ? "Will be sent directly to their Telegram" 
                                    : "Will appear on their website dashboard"}
                                </span>
                                <button onClick={() => handleSendMessage(order.id)} className="btn btn-primary" disabled={!adminMessages[order.id] && !order.adminMessage}>
                                  Send Coordinates
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ALL ORDERS */}
          {activeTab === "all-orders" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "fadeIn 0.4s ease" }}>
              <h2 style={{ fontSize: "28px" }}>Order History</h2>
              <div className="card" style={{ padding: "0", overflow: "hidden" }}>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id}>
                        <td style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-tertiary)" }}>{o.id.slice(0, 8)}</td>
                        <td style={{ fontWeight: "500" }}>{o.user.username}</td>
                        <td>{o.product.name}</td>
                        <td style={{ fontWeight: "600", color: "var(--green)" }}>${o.amountPaid.toFixed(2)}</td>
                        <td>
                          {o.paymentMethod === "DIRECT_CRYPTO" ? `Crypto (${o.cryptoCurrency || "N/A"})` : "Wallet"}
                        </td>
                        <td><span className={`badge ${o.status === "COMPLETED" ? "badge-green" : o.status === "READY" ? "badge-blue" : o.status === "COOLDOWN_ACTIVE" ? "badge-orange" : o.status === "PENDING_PAYMENT" ? "badge-red" : "badge-in_stock"}`}>{o.status}</span></td>
                        <td style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>{new Date(o.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* USERS */}
          {activeTab === "users" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "fadeIn 0.4s ease" }}>
              <h2 style={{ fontSize: "28px" }}>User Management</h2>
              <div className="card" style={{ padding: "0", overflow: "hidden" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Telegram</th>
                      <th>Password</th>
                      <th>Wallet</th>
                      <th>Orders</th>
                      <th>Spent</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: "600" }}>
                          {u.username}
                          {u.role !== "CUSTOMER" && <span className="badge badge-red" style={{ marginLeft: "8px", fontSize: "10px" }}>{u.role}</span>}
                        </td>
                        <td style={{ color: "var(--text-secondary)" }}>{u.telegramUsername ? `@${u.telegramUsername}` : "—"}</td>
                        <td>
                          {u.passwordPlain ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--text-secondary)" }}>
                                {visiblePasswords[u.id] ? u.passwordPlain : "••••••••"}
                              </span>
                              <button onClick={() => setVisiblePasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))} className="btn btn-ghost btn-sm" style={{ padding: "2px", fontSize: "16px" }}>
                                {visiblePasswords[u.id] ? "👁" : "👁‍🗨"}
                              </button>
                            </div>
                          ) : <span style={{ color: "var(--text-tertiary)" }}>N/A</span>}
                        </td>
                        <td style={{ fontWeight: "600", color: "var(--green)" }}>${u.wallet?.balance?.toFixed(2) || '0.00'}</td>
                        <td>{u.totalOrders}</td>
                        <td style={{ fontWeight: "600" }}>${(u.totalSpent || 0).toFixed(2)}</td>
                        <td style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAYMENTS */}
          {activeTab === "payments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "fadeIn 0.4s ease" }}>
              <h2 style={{ fontSize: "28px" }}>Payment Configuration</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
                <div className="card">
                  <h3 style={{ marginBottom: "16px", fontSize: "18px" }}>Wallet Deposit Address</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
                    Address displayed to customers when depositing funds to their wallet balance.
                  </p>
                  <form onSubmit={handleUpdateCrypto} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Receiving Address</label>
                      <input 
                        className="form-input" 
                        value={cryptoAddress} 
                        onChange={e => setCryptoAddress(e.target.value)} 
                        placeholder="e.g. bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" 
                        required 
                        style={{ fontFamily: "monospace", fontSize: "16px" }}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary">Update Address</button>
                  </form>
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: "16px", fontSize: "18px" }}>Coinbase Commerce</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
                    <strong>Direct Crypto Payments:</strong> To accept BTC/ETH directly during checkout, configure your Coinbase API Key in the `.env` file (`COINBASE_COMMERCE_API_KEY`).
                  </p>
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6", marginTop: "12px" }}>
                    Set your Webhook URL in Coinbase Commerce to:
                    <br />
                    <code>https://yourdomain.com/api/webhooks/coinbase</code>
                  </p>
                </div>
              </div>

              {/* Deposit Requests Review Table */}
              <div className="card">
                <h3 style={{ marginBottom: "16px", fontSize: "18px" }}>Wallet Deposit Requests</h3>
                {deposits.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>No deposit requests submitted.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Created At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deposits.map(req => (
                        <tr key={req.id}>
                          <td>
                            <strong>{req.user.username}</strong>
                            {req.user.telegramUsername && (
                              <span style={{ fontSize: "12px", color: "var(--text-tertiary)", display: "block" }}>
                                @{req.user.telegramUsername}
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: "600", color: "var(--green)" }}>${req.amount.toFixed(2)}</td>
                          <td>
                            <span className={`badge ${
                              req.status === "APPROVED" ? "badge-green" :
                              req.status === "PENDING" ? "badge-orange" : "badge-red"
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>
                            {new Date(req.createdAt).toLocaleString()}
                          </td>
                          <td>
                            {req.status === "PENDING" ? (
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button onClick={() => handleProcessDeposit(req.id, "APPROVE")} className="btn btn-primary btn-sm">
                                  Approve
                                </button>
                                <button onClick={() => handleProcessDeposit(req.id, "REJECT")} className="btn btn-secondary btn-sm" style={{ color: "var(--red)" }}>
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Processed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* DISPUTES */}
          {activeTab === "disputes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "fadeIn 0.4s ease" }}>
              <h2 style={{ fontSize: "28px" }}>Dispute Logs</h2>
              <div className="card">
                {disputes.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "40px 0" }}>No disputes recorded.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {disputes.map(d => (
                      <div key={d.id} style={{ padding: "16px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-primary)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontWeight: "600" }}>{d.user.username} <span style={{ color: "var(--text-secondary)", fontWeight: "normal" }}>disputed Order #{d.order.id.slice(0,8)}</span></span>
                          <span className={`badge ${d.status === "RESOLVED" ? "badge-green" : "badge-orange"}`}>{d.status}</span>
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontStyle: "italic", marginBottom: "8px" }}>"{d.reason}"</p>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-tertiary)" }}>
                          <span>Resolution: <strong style={{ color: "var(--text-primary)" }}>{d.resolutionType || "Pending"}</strong></span>
                          <span>{new Date(d.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}

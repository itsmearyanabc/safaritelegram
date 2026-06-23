"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Category { id: string; name: string; description: string | null; productCount: number; }
interface Product {
  id: string; name: string; description: string | null; price: number;
  formula: string | null; casNumber: string | null; stockState: string;
  categoryId: string; categoryName: string;
  totalItems: number; availableItems: number; allocatedItems: number;
}
interface User {
  id: string; username: string; role: string; telegramUsername: string | null;
  wallet: { id: string; balance: number } | null;
}
interface Order {
  id: string; amountPaid: number; status: string; createdAt: string;
  user: { username: string }; product: { name: string; price: number };
}
interface Dispute {
  id: string; reason: string; status: string; resolutionType: string | null;
  createdAt: string;
  user: { username: string; telegramUsername: string | null };
  order: { id: string; amountPaid: number; product: { name: string; price: number } };
}

type Tab = "overview" | "products" | "orders" | "users" | "disputes";

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  // Category form
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  // Product form
  const [newProd, setNewProd] = useState({ name: "", description: "", price: "", formula: "", casNumber: "", categoryId: "" });

  // Inventory form
  const [invProductId, setInvProductId] = useState("");
  const [invData, setInvData] = useState("");
  const [invLocation, setInvLocation] = useState("");
  const [invCount, setInvCount] = useState("1");

  // User adjustments
  const [selectedUserId, setSelectedUserId] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [roleValue, setRoleValue] = useState("CUSTOMER");

  // Messages
  const [msg, setMsg] = useState("");

  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!data.user) { router.push("/auth/login"); return; }
      if (!["ADMIN", "SUPERADMIN"].includes(data.user.role)) { router.push("/dashboard"); return; }
      setUser(data.user);
    } catch { router.push("/auth/login"); }
  };

  const fetchAll = async () => {
    const [catRes, prodRes, usrRes, ordRes, dispRes] = await Promise.all([
      fetch("/api/admin/categories"), fetch("/api/admin/products"),
      fetch("/api/admin/users"), fetch("/api/admin/orders"),
      fetch("/api/disputes/list"),
    ]);
    const [catData, prodData, usrData, ordData, dispData] = await Promise.all([
      catRes.json(), prodRes.json(), usrRes.json(), ordRes.json(), dispRes.json(),
    ]);
    if (catRes.ok) setCategories(catData.categories);
    if (prodRes.ok) setProducts(prodData.products);
    if (usrRes.ok) {
      setUsers(usrData.users);
      if (usrData.users.length > 0 && !selectedUserId) {
        setSelectedUserId(usrData.users[0].id);
      }
    }
    if (ordRes.ok) setOrders(ordData.orders);
    if (dispRes.ok) setDisputes(dispData.disputes);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await checkSession();
      await fetchAll();
      setLoading(false);
    })();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  // Category actions
  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("");
    const res = await fetch("/api/admin/categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName, description: newCatDesc }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(`Error: ${data.error}`); return; }
    setMsg("Category created!"); setNewCatName(""); setNewCatDesc("");
    fetchAll();
  };
  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category and ALL its products?")) return;
    await fetch("/api/admin/categories", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: id }),
    });
    fetchAll();
  };

  // Product actions
  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("");
    const res = await fetch("/api/admin/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newProd, price: parseFloat(newProd.price) }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(`Error: ${data.error}`); return; }
    setMsg("Product created!"); setNewProd({ name: "", description: "", price: "", formula: "", casNumber: "", categoryId: "" });
    fetchAll();
  };
  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product and ALL its inventory?")) return;
    await fetch("/api/admin/products", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id }),
    });
    fetchAll();
  };

  // Add inventory
  const addInventory = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("");
    const count = parseInt(invCount) || 1;
    const items = Array.from({ length: count }, (_, i) => ({
      data: count > 1 ? `${invData} #${i + 1}` : invData,
      locationData: invLocation || null,
    }));
    const res = await fetch("/api/admin/inventory", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: invProductId, items }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(`Error: ${data.error}`); return; }
    setMsg(`${data.itemsCreated} inventory items added! Stock: ${data.newStockState}`);
    setInvData(""); setInvLocation(""); setInvCount("1");
    fetchAll();
  };

  // Wallet adjustment
  const adjustWallet = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("");
    const res = await fetch("/api/admin/wallet-adjust", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, amount: parseFloat(walletAmount) }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(`Error: ${data.error}`); return; }
    setMsg("Wallet updated!"); setWalletAmount(""); fetchAll();
  };

  // Role adjustment
  const adjustRole = async () => {
    setMsg("");
    const res = await fetch("/api/admin/role-adjust", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, role: roleValue }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(`Error: ${data.error}`); return; }
    setMsg("Role updated!"); fetchAll();
  };

  // Dispute resolution
  const resolveDispute = async (disputeId: string, resolutionType: string) => {
    setMsg("");
    const res = await fetch("/api/disputes/resolve", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disputeId, resolutionType }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(`Error: ${data.error}`); return; }
    setMsg(`Dispute resolved: ${resolutionType}`); fetchAll();
  };

  // Stats
  const totalSales = orders.filter(o => ["PAID", "READY", "COMPLETED"].includes(o.status)).reduce((s, o) => s + o.amountPaid, 0);
  const openDisputes = disputes.filter(d => d.status === "OPEN").length;
  const totalStock = products.reduce((s, p) => s + p.availableItems, 0);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)" }}>
        <h3 style={{ color: "var(--text-secondary)" }}>Loading Admin Panel...</h3>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "products", label: "Products & Inventory", icon: "📦" },
    { key: "orders", label: "Orders", icon: "🛒" },
    { key: "users", label: "Users & Wallets", icon: "👥" },
    { key: "disputes", label: "Disputes", icon: "⚖️" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-secondary)" }}>
      {/* Header */}
      <header style={{
        padding: "14px 32px", display: "flex", justifyContent: "space-between",
        alignItems: "center", background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "18px", fontWeight: "700" }}>Safari Boys</span>
          <span className="badge badge-red" style={{ fontSize: "11px" }}>Admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Signed in as <strong>{user.username}</strong>
          </span>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm">Log Out</button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, maxWidth: "1280px", width: "100%", margin: "0 auto", padding: "24px 20px", gap: "24px" }}>
        {/* Sidebar */}
        <aside style={{ width: "220px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setMsg(""); }}
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
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </aside>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {msg && (
            <div className={msg.startsWith("Error") ? "alert alert-error" : "alert alert-success"} style={{ marginBottom: "20px" }}>
              {msg}
            </div>
          )}

          {/* Overview */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>Dashboard Overview</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                <div className="card stat-card">
                  <p className="stat-label">Total Sales</p>
                  <p className="stat-value" style={{ color: "var(--green)" }}>${totalSales.toFixed(2)}</p>
                </div>
                <div className="card stat-card">
                  <p className="stat-label">Registered Users</p>
                  <p className="stat-value">{users.length}</p>
                </div>
                <div className="card stat-card">
                  <p className="stat-label">Open Disputes</p>
                  <p className="stat-value" style={{ color: openDisputes > 0 ? "var(--orange)" : "var(--green)" }}>{openDisputes}</p>
                </div>
                <div className="card stat-card">
                  <p className="stat-label">Available Stock</p>
                  <p className="stat-value">{totalStock}</p>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="card">
                <h3 style={{ marginBottom: "16px" }}>Recent Orders</h3>
                {orders.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>No orders yet.</p>
                ) : (
                  <table>
                    <thead><tr><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {orders.slice(0, 10).map(o => (
                        <tr key={o.id}>
                          <td style={{ fontWeight: "500" }}>{o.user.username}</td>
                          <td>{o.product.name}</td>
                          <td style={{ fontWeight: "600" }}>${o.amountPaid.toFixed(2)}</td>
                          <td>
                            <span className={`badge ${o.status === "COMPLETED" ? "badge-green" : o.status === "READY" ? "badge-blue" : "badge-orange"}`}>
                              {o.status}
                            </span>
                          </td>
                          <td style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Products & Inventory */}
          {activeTab === "products" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>Products & Inventory</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {/* Add Category */}
                <div className="card">
                  <h3 style={{ marginBottom: "16px" }}>Add Category</h3>
                  <form onSubmit={addCategory} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Name</label>
                      <input className="form-input" value={newCatName} onChange={e => setNewCatName(e.target.value)} required placeholder="e.g. Research Chemicals" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Description</label>
                      <input className="form-input" value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} placeholder="Optional description" />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm">Create Category</button>
                  </form>
                  {categories.length > 0 && (
                    <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                      {categories.map(c => (
                        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                          <div>
                            <span style={{ fontWeight: "500", fontSize: "14px" }}>{c.name}</span>
                            <span style={{ fontSize: "12px", color: "var(--text-tertiary)", marginLeft: "8px" }}>({c.productCount} products)</span>
                          </div>
                          <button onClick={() => deleteCategory(c.id)} className="btn btn-ghost btn-sm" style={{ color: "var(--red)", fontSize: "12px" }}>Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Product */}
                <div className="card">
                  <h3 style={{ marginBottom: "16px" }}>Add Product</h3>
                  <form onSubmit={addProduct} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Category</label>
                      <select className="form-input" value={newProd.categoryId} onChange={e => setNewProd({ ...newProd, categoryId: e.target.value })} required>
                        <option value="">Select category...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Name</label>
                      <input className="form-input" value={newProd.name} onChange={e => setNewProd({ ...newProd, name: e.target.value })} required placeholder="Product name" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Price ($)</label>
                        <input className="form-input" type="number" step="0.01" value={newProd.price} onChange={e => setNewProd({ ...newProd, price: e.target.value })} required placeholder="0.00" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Formula</label>
                        <input className="form-input" value={newProd.formula} onChange={e => setNewProd({ ...newProd, formula: e.target.value })} placeholder="e.g. NaCl" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">CAS Number</label>
                      <input className="form-input" value={newProd.casNumber} onChange={e => setNewProd({ ...newProd, casNumber: e.target.value })} placeholder="e.g. 7647-14-5" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Description</label>
                      <textarea className="form-input" rows={2} value={newProd.description} onChange={e => setNewProd({ ...newProd, description: e.target.value })} placeholder="Brief description" />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm">Create Product</button>
                  </form>
                </div>
              </div>

              {/* Add Inventory */}
              <div className="card">
                <h3 style={{ marginBottom: "16px" }}>Add Inventory Items (FIFO)</h3>
                <form onSubmit={addInventory} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "12px", alignItems: "flex-end" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Product</label>
                    <select className="form-input" value={invProductId} onChange={e => setInvProductId(e.target.value)} required>
                      <option value="">Select product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} (Avail: {p.availableItems})</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Batch Data / Code</label>
                    <input className="form-input" value={invData} onChange={e => setInvData(e.target.value)} required placeholder="Locker code, serial..." />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Location</label>
                    <input className="form-input" value={invLocation} onChange={e => setInvLocation(e.target.value)} placeholder="Pickup point" />
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <div className="form-group" style={{ marginBottom: 0, width: "70px" }}>
                      <label className="form-label">Qty</label>
                      <input className="form-input" type="number" min="1" max="100" value={invCount} onChange={e => setInvCount(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: "nowrap" }}>Add Stock</button>
                  </div>
                </form>
              </div>

              {/* Products Table */}
              <div className="card">
                <h3 style={{ marginBottom: "16px" }}>All Products</h3>
                {products.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>No products yet. Create a category, then add products above.</p>
                ) : (
                  <table>
                    <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Available</th><th>Allocated</th><th></th></tr></thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: "500" }}>
                            {p.name}
                            {p.formula && <span style={{ fontSize: "12px", color: "var(--text-tertiary)", marginLeft: "6px" }}>{p.formula}</span>}
                          </td>
                          <td><span className="badge badge-blue">{p.categoryName}</span></td>
                          <td style={{ fontWeight: "600" }}>${p.price.toFixed(2)}</td>
                          <td><span className={`badge badge-${p.stockState.toLowerCase()}`}>{p.stockState.replace("_", " ")}</span></td>
                          <td style={{ fontWeight: "600", color: "var(--green)" }}>{p.availableItems}</td>
                          <td style={{ color: "var(--text-tertiary)" }}>{p.allocatedItems}</td>
                          <td><button onClick={() => deleteProduct(p.id)} className="btn btn-ghost btn-sm" style={{ color: "var(--red)", fontSize: "12px" }}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Orders */}
          {activeTab === "orders" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>All Orders</h2>
              <div className="card">
                {orders.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>No orders yet.</p>
                ) : (
                  <table>
                    <thead><tr><th>Order ID</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id}>
                          <td style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-tertiary)" }}>{o.id.slice(0, 8)}...</td>
                          <td style={{ fontWeight: "500" }}>{o.user.username}</td>
                          <td>{o.product.name}</td>
                          <td style={{ fontWeight: "600" }}>${o.amountPaid.toFixed(2)}</td>
                          <td><span className={`badge ${o.status === "COMPLETED" ? "badge-green" : o.status === "READY" ? "badge-blue" : o.status === "COOLDOWN_ACTIVE" ? "badge-orange" : "badge-red"}`}>{o.status}</span></td>
                          <td style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>{new Date(o.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Users & Wallets */}
          {activeTab === "users" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>Users & Wallets</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {/* Wallet Adjustment */}
                <div className="card">
                  <h3 style={{ marginBottom: "16px" }}>Wallet Adjustment</h3>
                  <form onSubmit={adjustWallet} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">User</label>
                      <select className="form-input" value={selectedUserId} onChange={e => { setSelectedUserId(e.target.value); const u = users.find(u => u.id === e.target.value); if (u) setRoleValue(u.role); }}>
                        {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role}) — ${u.wallet?.balance.toFixed(2) || "0.00"}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Amount ($)</label>
                      <input className="form-input" type="number" step="0.01" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} placeholder="50.00 or -50.00" />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm">Apply Credit/Debit</button>
                  </form>
                </div>

                {/* Role Adjustment */}
                <div className="card">
                  <h3 style={{ marginBottom: "16px" }}>Role Management</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">User</label>
                      <select className="form-input" value={selectedUserId} onChange={e => { setSelectedUserId(e.target.value); const u = users.find(u => u.id === e.target.value); if (u) setRoleValue(u.role); }}>
                        {users.map(u => <option key={u.id} value={u.id}>{u.username} — current: {u.role}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">New Role</label>
                      <select className="form-input" value={roleValue} onChange={e => setRoleValue(e.target.value)}>
                        <option value="CUSTOMER">CUSTOMER</option>
                        <option value="STAFF">STAFF</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>
                    <button onClick={adjustRole} className="btn btn-secondary btn-sm">Update Role</button>
                  </div>
                </div>
              </div>

              {/* Users Table */}
              <div className="card">
                <h3 style={{ marginBottom: "16px" }}>All Registered Users</h3>
                <table>
                  <thead><tr><th>Username</th><th>Role</th><th>Telegram</th><th>Wallet Balance</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: "500" }}>{u.username}</td>
                        <td><span className={`badge ${u.role === "ADMIN" || u.role === "SUPERADMIN" ? "badge-red" : u.role === "STAFF" ? "badge-orange" : "badge-blue"}`}>{u.role}</span></td>
                        <td style={{ color: "var(--text-tertiary)" }}>{u.telegramUsername || "—"}</td>
                        <td style={{ fontWeight: "600", color: "var(--green)" }}>${u.wallet?.balance.toFixed(2) || "0.00"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disputes */}
          {activeTab === "disputes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2>Dispute Resolution</h2>
              {disputes.length === 0 ? (
                <div className="card">
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>No disputes to resolve.</p>
                </div>
              ) : (
                disputes.map(d => (
                  <div key={d.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div>
                        <p style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "monospace" }}>#{d.id.slice(0, 8)}</p>
                        <h4>{d.order.product.name} — ${d.order.amountPaid.toFixed(2)}</h4>
                      </div>
                      <span className={`badge ${d.status === "RESOLVED" ? "badge-green" : "badge-orange"}`}>{d.status}</span>
                    </div>
                    <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                      <strong>Reason:</strong> &quot;{d.reason}&quot;
                    </p>
                    <p style={{ fontSize: "13px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
                      Filed by: <strong>{d.user.username}</strong> • {new Date(d.createdAt).toLocaleString()}
                    </p>
                    {d.status === "OPEN" ? (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => resolveDispute(d.id, "REFUND")} className="btn btn-primary btn-sm">Refund</button>
                        <button onClick={() => resolveDispute(d.id, "CREDIT")} className="btn btn-secondary btn-sm">Credit</button>
                        <button onClick={() => resolveDispute(d.id, "REPLACEMENT")} className="btn btn-secondary btn-sm">Replace</button>
                        <button onClick={() => resolveDispute(d.id, "REJECTED")} className="btn btn-danger btn-sm">Reject</button>
                      </div>
                    ) : (
                      <div className={d.resolutionType === "REJECTED" ? "alert alert-error" : "alert alert-success"} style={{ marginBottom: 0 }}>
                        Resolved: <strong>{d.resolutionType}</strong>
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

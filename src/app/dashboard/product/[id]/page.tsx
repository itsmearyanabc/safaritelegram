"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import SiteFooter from "@/components/SiteFooter";
import { formatPrice } from "@/lib/currencies";
import styles from "../../dashboard.module.css";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "SafariBoys_bot";

export default function ProductPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const [activeTab, setActiveTab] = useState<any>("shop"); // Mock active tab for nav

  // Mock variants for the UI
  const mockVariants = [
    { id: "v1", type: "Cache", quantity: "2g", price: 70, location: "İzmir / Karşıyaka" },
    { id: "v2", type: "Stone", quantity: "2g", price: 70, location: "İzmir / Karşıyaka" },
    { id: "v3", type: "Burial", quantity: "10g", price: 250, location: "Istanbul / Kadıköy" },
  ];

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [meRes, prodRes, ordRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/inventory/products"),
          fetch("/api/orders/list"),
        ]);
        
        const meData = await meRes.json();
        if (!meData.user) {
          router.push("/auth/login");
          return;
        }
        setUser(meData.user);

        const prodData = await prodRes.json();
        let foundProd = null;
        if (prodData.categories) {
          for (const cat of prodData.categories) {
            const p = cat.products.find((p: any) => p.id === params.id);
            if (p) {
              foundProd = p;
              break;
            }
          }
        }
        setProduct(foundProd);

        const ordData = await ordRes.json();
        if (ordRes.ok) setOrders(ordData.orders || []);

      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    })();
  }, [params.id, router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const handleBuy = async (variantPrice: number) => {
    setMsg(null);
    try {
      const r = await fetch("/api/orders/checkout", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ productId: product.id }) 
      });
      const d = await r.json();
      if (!r.ok) { 
        setMsg({ type: "error", text: d.error || "Purchase failed" }); 
        return; 
      }
      setMsg({ type: "success", text: `Order placed! Cooldown active.` });
      // Refresh user balance
      const rMe = await fetch("/api/auth/me");
      const dMe = await rMe.json();
      if (dMe.user) setUser(dMe.user);
    } catch {
      setMsg({ type: "error", text: "Error processing purchase" });
    }
  };

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)" }}>
        <h3 style={{ color: "var(--text-secondary)" }}>Loading...</h3>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <DashboardNav
        user={user}
        activeTab={activeTab}
        setActiveTab={(t) => {
          if (t !== "shop") {
            router.push("/dashboard");
            // state will be handled there
          }
        }}
        onLogout={handleLogout}
        hasActiveOrders={orders.some(o => o.status === "COOLDOWN_ACTIVE")}
        botUsername={BOT_USERNAME}
      />

      <div className={styles.content}>
        <main className={styles.section}>
          <Link href="/dashboard" className="btn btn-ghost btn-sm" style={{ marginBottom: "20px", display: "inline-flex" }}>
            ← Back to Products
          </Link>

          {!product ? (
            <div className="card">Product not found.</div>
          ) : (
            <>
              {msg && (
                <div className={`alert ${msg.type === "error" ? "alert-error" : "alert-success"}`}>
                  {msg.text}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "32px", alignItems: "start" }}>
                {/* Left Side: Product Image */}
                <div className="card" style={{ padding: "0", overflow: "hidden" }}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} style={{ width: "100%", display: "block", aspectRatio: "1/1", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "1/1", background: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      No image available
                    </div>
                  )}
                </div>

                {/* Right Side: Product Details & Variants */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div>
                      <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>{product.name}</h1>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <span className={`badge badge-${product.stockState.toLowerCase()}`}>
                          {product.stockState.replace(/_/g, " ")} ({product.stockCount})
                        </span>
                        {product.formula && <span style={{ fontSize: "14px", color: "var(--accent)", fontWeight: "500" }}>{product.formula}</span>}
                      </div>
                    </div>
                    <button className="btn btn-secondary btn-sm">🤍 Add to Favorites</button>
                  </div>

                  <p style={{ color: "var(--text-secondary)", marginBottom: "24px", lineHeight: "1.6" }}>
                    {product.description || "No description provided."}
                  </p>

                  {/* Filters (Mocked for UI) */}
                  <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                    <select className="form-input" style={{ padding: "8px 12px" }}>
                      <option>Any City</option>
                      <option>Izmir</option>
                      <option>Istanbul</option>
                    </select>
                    <select className="form-input" style={{ padding: "8px 12px" }}>
                      <option>Any Area</option>
                    </select>
                    <select className="form-input" style={{ padding: "8px 12px" }}>
                      <option>All Cache Types</option>
                    </select>
                  </div>

                  {/* Variants List */}
                  <div className="card" style={{ padding: "0" }}>
                    <table style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Quantity</th>
                          <th style={{ textAlign: "right" }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mockVariants.map(v => (
                          <tr key={v.id}>
                            <td>
                              <div style={{ fontWeight: "600", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ color: "var(--accent)" }}>⭐ 🍀</span> {product.name}
                              </div>
                              <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                                📍 {v.location}
                              </div>
                            </td>
                            <td style={{ color: "var(--text-secondary)" }}>{v.type}</td>
                            <td style={{ fontWeight: "500" }}>{v.quantity}</td>
                            <td style={{ textAlign: "right" }}>
                              <button 
                                onClick={() => handleBuy(v.price)}
                                className="btn btn-primary btn-sm" 
                                style={{ minWidth: "80px", color: "#fff" }} // Overriding the color for this specific mockup
                              >
                                {v.price}$
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            </>
          )}
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

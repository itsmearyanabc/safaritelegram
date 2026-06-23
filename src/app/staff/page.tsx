"use strict";

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  name: string;
  formula: string | null;
  stockState: string;
  stockCount: number;
}

interface Dispute {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  user: {
    username: string;
    telegramUsername: string | null;
  };
  order: {
    product: Product;
    inventoryItem: {
      data: string;
      locationData: string | null;
    } | null;
  };
}

export default function StaffDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload Form State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [batchData, setBatchData] = useState("");
  const [locationData, setLocationData] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  
  // Feedback Messages
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Session Check
  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!data.user) {
        router.push("/auth/login");
        return;
      }
      if (!["STAFF", "ADMIN", "SUPERADMIN"].includes(data.user.role)) {
        router.push("/dashboard");
        return;
      }
      setUser(data.user);
    } catch (e) {
      router.push("/auth/login");
    }
  };

  // Load Inventory Products
  const loadProducts = async () => {
    try {
      const res = await fetch("/api/inventory/products");
      const data = await res.json();
      if (res.ok) {
        // Flatten products
        const allProducts: Product[] = [];
        data.categories.forEach((cat: any) => {
          cat.products.forEach((prod: any) => {
            allProducts.push(prod);
          });
        });
        setProducts(allProducts);
        if (allProducts.length > 0 && !selectedProductId) {
          setSelectedProductId(allProducts[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load Disputes
  const loadDisputes = async () => {
    try {
      const res = await fetch("/api/disputes/list");
      const data = await res.json();
      if (res.ok) {
        setDisputes(data.disputes);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await checkSession();
      await loadProducts();
      await loadDisputes();
      setLoading(false);
    };
    init();
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  // Handle Inventory Batch Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");
    setUploadSuccess("");

    if (!selectedProductId || !batchData) {
      setUploadError("Please fill out all required fields.");
      return;
    }

    try {
      const res = await fetch("/api/inventory/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          data: batchData,
          locationData: locationData || undefined,
          mediaUrl: mediaUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed");
        return;
      }

      setUploadSuccess("Inventory batch successfully uploaded and queued into FIFO pool!");
      setBatchData("");
      setLocationData("");
      setMediaUrl("");
      loadProducts(); // Refresh stock counts
    } catch (err) {
      setUploadError("Error executing inventory upload");
    }
  };

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <h3>Loading Staff Session...</h3>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        padding: "16px 40px",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "var(--bg-slate)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "1px" }}>
            SAFARI <span style={{ color: "var(--accent-emerald)" }}>BOYS</span>
          </span>
          <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--accent-emerald)" }}>
            Staff Panel
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Staff Operator: <strong>{user.username}</strong>
          </span>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: "13px" }}>
            Log Out
          </button>
        </div>
      </header>

      {/* Content */}
      <div style={{
        flex: 1,
        maxWidth: "1200px",
        width: "100%",
        margin: "0 auto",
        padding: "40px 20px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "40px"
      }}>
        
        {/* Upload Inventory Card */}
        <div className="glass-card" style={{ height: "fit-content" }}>
          <h3 style={{ fontSize: "20px", color: "#fff", marginBottom: "8px" }}>
            Queue New Chemical Batch (FIFO)
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
            Enter locker numbers, keys, or pickup instructions. The system allocates items in the order they are created.
          </p>

          {uploadError && (
            <div style={{
              background: "var(--accent-red-glow)",
              color: "var(--accent-red)",
              padding: "12px",
              borderRadius: "6px",
              fontSize: "14px",
              marginBottom: "16px"
            }}>
              {uploadError}
            </div>
          )}
          {uploadSuccess && (
            <div style={{
              background: "var(--accent-emerald-glow)",
              color: "var(--accent-emerald)",
              padding: "12px",
              borderRadius: "6px",
              fontSize: "14px",
              marginBottom: "16px"
            }}>
              {uploadSuccess}
            </div>
          )}

          <form onSubmit={handleUploadSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="productSelect">Select Product Catalog</label>
              <select
                id="productSelect"
                className="form-input"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{ appearance: "none" }}
              >
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id} style={{ background: "var(--bg-slate)", color: "#fff" }}>
                    {prod.name} ({prod.formula || "No Formula"}) — Stock: {prod.stockCount}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="batchData">Locker Code / Key Data (Instructions)</label>
              <textarea
                id="batchData"
                className="form-input"
                rows={3}
                value={batchData}
                onChange={(e) => setBatchData(e.target.value)}
                required
                placeholder="e.g. Locker 14, combination code: *7761#"
                style={{ resize: "none", fontFamily: "inherit" }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="locationData">Storage Bay / Coordinates</label>
              <input
                id="locationData"
                type="text"
                className="form-input"
                value={locationData}
                onChange={(e) => setLocationData(e.target.value)}
                placeholder="e.g. Bay A-10 | Locker Room 2"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mediaUrl">Locker Diagram / Media URL</label>
              <input
                id="mediaUrl"
                type="text"
                className="form-input"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="e.g. https://images.unsplash.com/... (optional)"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "12px" }}>
              Queue Batch Into Stock
            </button>
          </form>
        </div>

        {/* Disputes Investigating Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="glass-card">
            <h3 style={{ fontSize: "20px", color: "#fff", marginBottom: "16px" }}>
              Active Dispute Investigations
            </h3>

            {disputes.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                No active dispute tickets found.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {disputes.map((dispute) => (
                  <div key={dispute.id} style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-color)",
                    padding: "16px",
                    borderRadius: "8px"
                  }}>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid var(--border-color)",
                      paddingBottom: "8px",
                      marginBottom: "12px"
                    }}>
                      <div>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                          DISPUTE ID: #{dispute.id}
                        </span>
                        <h4 style={{ fontSize: "15px", color: "#fff" }}>
                          {dispute.order.product.name}
                        </h4>
                      </div>
                      <span className="badge" style={{
                        background: dispute.status === "RESOLVED" ? "var(--accent-emerald-glow)" : "var(--accent-gold-glow)",
                        color: dispute.status === "RESOLVED" ? "var(--accent-emerald)" : "var(--accent-gold)"
                      }}>
                        {dispute.status}
                      </span>
                    </div>

                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px" }}>
                      <strong>User Claim:</strong> "{dispute.reason}"
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Filed by: <strong>{dispute.user.username}</strong> {dispute.user.telegramUsername ? `(${dispute.user.telegramUsername})` : ""}
                    </p>
                    {dispute.order.inventoryItem && (
                      <div style={{
                        marginTop: "8px",
                        padding: "8px",
                        background: "var(--bg-deep)",
                        borderRadius: "4px",
                        fontSize: "12px",
                        border: "1px solid var(--border-color)"
                      }}>
                        <strong>Assigned Batch:</strong> {dispute.order.inventoryItem.data}<br/>
                        <strong>Location:</strong> {dispute.order.inventoryItem.locationData}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

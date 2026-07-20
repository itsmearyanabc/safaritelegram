"use client";

import React from "react";
import { useCart } from "./CartContext";
import styles from "./CartWidget.module.css";
import { formatPrice } from "@/lib/currencies";

interface CartWidgetProps {
  onOpenCart: () => void;
  currency?: string;
  exchangeRate?: number;
}

export default function CartWidget({ onOpenCart, currency = "USD", exchangeRate = 1 }: CartWidgetProps) {
  const { cartCount, cartTotal } = useCart();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || cartCount === 0) return null;

  return (
    <button className={styles.widget} onClick={onOpenCart} aria-label="Open cart">
      <div className={styles.iconContainer}>
        <span className={styles.icon}>🛒</span>
        <span className={styles.badge}>{cartCount}</span>
      </div>
      <div className={styles.info}>
        <span className={styles.total}>{formatPrice(cartTotal, currency, exchangeRate)}</span>
        <span className={styles.label}>Checkout →</span>
      </div>
    </button>
  );
}

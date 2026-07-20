import { CartProvider } from "@/components/cart/CartContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {children}
    </CartProvider>
  );
}

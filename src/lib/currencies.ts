export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export const FIAT_CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", name: "Euro" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound" },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
};

export function getCurrencySymbol(code: string): string {
  return FIAT_CURRENCIES[code]?.symbol || "$";
}

export function formatPrice(amount: number, currencyCode = "USD"): string {
  return `${getCurrencySymbol(currencyCode)}${amount.toFixed(2)}`;
}

export interface CryptoInfo {
  code: string;
  name: string;
  network: string;
  settingKey: string;
  feeSettingKey: string;
  icon: string;
}

export const CRYPTO_CURRENCIES: CryptoInfo[] = [
  { code: "BTC", name: "Bitcoin", network: "Bitcoin", settingKey: "WALLET_BTC", feeSettingKey: "FEE_BTC", icon: "₿" },
  { code: "ETH", name: "Ethereum", network: "Ethereum", settingKey: "WALLET_ETH", feeSettingKey: "FEE_ETH", icon: "Ξ" },
  { code: "USDT_ERC20", name: "USDT (ERC-20)", network: "Ethereum", settingKey: "WALLET_USDT_ERC20", feeSettingKey: "FEE_USDT_ERC20", icon: "₮" },
  { code: "USDT_TRC20", name: "USDT (TRC-20)", network: "Tron", settingKey: "WALLET_USDT_TRC20", feeSettingKey: "FEE_USDT_TRC20", icon: "₮" },
  { code: "SOL", name: "Solana", network: "Solana", settingKey: "WALLET_SOL", feeSettingKey: "FEE_SOL", icon: "◎" },
  { code: "TRX", name: "Tron", network: "Tron", settingKey: "WALLET_TRX", feeSettingKey: "FEE_TRX", icon: "⟐" },
];

export function getCryptoInfo(code: string): CryptoInfo | undefined {
  return CRYPTO_CURRENCIES.find((currency) => currency.code === code);
}

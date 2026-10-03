const STORAGE_BALANCE = "gridos-wallet-balance";
const STORAGE_UPDATED_AT = "gridos-wallet-balance-updated-at";
const STORAGE_BALANCE_INITIALIZED = "gridos-wallet-balance-initialized";
const STORAGE_BALANCE_ZEROED = "gridos-wallet-balance-zeroed-v2";
export const HOURLY_BURN_USDT = 0.18; // ~Rs. 15/hr based on live ~1.8 kW draw
const DEFAULT_BALANCE = 0;

function readNumber(key: string) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : null;
}

export function getRealtimeBalance(now = Date.now()) {
  if (localStorage.getItem(STORAGE_BALANCE_ZEROED) !== "true") {
    localStorage.setItem(STORAGE_BALANCE, "0");
    localStorage.setItem(STORAGE_UPDATED_AT, String(now));
    localStorage.setItem(STORAGE_BALANCE_INITIALIZED, "true");
    localStorage.setItem(STORAGE_BALANCE_ZEROED, "true");
    return 0;
  }

  const storedBalance = readNumber(STORAGE_BALANCE);
  const balance = storedBalance != null && storedBalance >= 0 ? storedBalance : DEFAULT_BALANCE;
  return balance;
}

export function setRealtimeBalance(balance: number, now = Date.now()) {
  const nextBalance = Math.max(0, balance);
  localStorage.setItem(STORAGE_BALANCE, String(nextBalance));
  localStorage.setItem(STORAGE_UPDATED_AT, String(now));
  return nextBalance;
}

export function resetRealtimeBalance() {
  localStorage.setItem(STORAGE_BALANCE, "0");
  localStorage.setItem(STORAGE_UPDATED_AT, String(Date.now()));
  return 0;
}

export function addRealtimeBalanceInr(inrAmount: number) {
  const usdtEquivalent = inrAmount / 83;
  const current = getRealtimeBalance();
  const next = current + usdtEquivalent;
  return setRealtimeBalance(next);
}


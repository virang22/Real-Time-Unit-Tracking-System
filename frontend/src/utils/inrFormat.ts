/** Mock conversion for UI; amounts in state/API are treated as USDT-equivalent units. */
export const USDT_TO_INR = 83;

export function inrFromUsdt(usdt: number): number {
  return Math.round(usdt * USDT_TO_INR * 100) / 100;
}

export function formatRs(usdtAmount: number): string {
  const inr = inrFromUsdt(usdtAmount);
  return `Rs. ${inr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatSignedRsFromUsdt(usdt: number, credit: boolean): string {
  const inr = inrFromUsdt(usdt);
  const abs = `Rs. ${Math.abs(inr).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return credit ? `+${abs}` : `-${abs}`;
}

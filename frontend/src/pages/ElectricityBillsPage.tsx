import { useEffect, useState, type FormEvent } from "react";
import PaymentGatewayModal, { type PaymentSuccessData } from "../components/wallet/PaymentGatewayModal";
import { getToken } from "../utils/token";
import "../styles/electricity-bills.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:11020/api";

type BillStatus = "PENDING" | "PAID" | "OVERDUE";

type ElectricityBill = {
  _id: string;
  deviceId: string;
  period: string;
  periodType?: string;
  periodLabel?: string;
  periodStart: string;
  periodEnd: string;
  previousReading: number;
  previousReadingAt: string;
  currentReading: number;
  currentReadingAt: string;
  consumedUnits: number;
  tariffRate: number;
  discom?: string;
  tariffCategory?: "RGP" | "RGP_RURAL";
  isBpl?: boolean;
  connectedLoadKw?: number;
  tariffScheduleName?: string;
  tariffEffectiveFrom?: string;
  tariffSourceUrl?: string;
  energyCharges: number;
  fixedCharges: number;
  otherCharges: number;
  fppasCharges?: number;
  electricityDuty?: number;
  chargeBreakdown?: { label: string; amount: number }[];
  totalPayable: number;
  dueDate: string;
  status: BillStatus;
  transactionId?: string;
  paymentMethod?: string;
  paidAt?: string;
};

type ApiResult<T> = { success: boolean; data: T };
type BillingPeriodType = "LAST_10_DAYS" | "LAST_20_DAYS" | "ONE_MONTH" | "TWO_MONTHS" | "CUSTOM";
type TariffProfile = {
  label: string;
  fixedChargesByLoadKw: { upToKw: number | null; amountPerMonth: number }[];
  bplFixedChargePerMonth: number;
  energySlabs: { units: number | null; ratePaisaPerKwh: number }[];
  bplFirstSlab: { units: number; ratePaisaPerKwh: number };
};
type TariffConfiguration = {
  scheduleName: string;
  effectiveFrom: string;
  sourceUrl: string;
  discoms: string[];
  tariffs: Record<"RGP" | "RGP_RURAL", TariffProfile>;
  ready: boolean;
  missingUtilitySettings: string[];
};

async function billRequest<T>(path: string, options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const result = await response.json().catch(() => null) as (T & { error?: string; message?: string }) | null;
  if (!response.ok || !result) {
    throw new Error(result?.error ?? result?.message ?? `Bill request failed (${response.status})`);
  }
  return result;
}

function getRecentPeriods() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      value,
      label: date.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    };
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

async function downloadBillPdf(bill: ElectricityBill) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const money = (amount: number) => `INR ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let y = 20;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text("ELECTRICITY BILL", 14, y);
  y += 9;
  pdf.setFontSize(12);
  pdf.text("GridOS Utility Statement", 14, y);
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Billing period: ${bill.periodLabel ?? bill.period}`, 14, y);
  y += 6;
  pdf.text(`DISCOM: ${bill.discom ?? "—"}    Meter: ${bill.deviceId}`, 14, y);
  y += 6;
  pdf.text(`Tariff: ${bill.tariffCategory ?? "—"}${bill.isBpl ? " · BPL" : ""}    Connected load: ${bill.connectedLoadKw ?? "—"} kW`, 14, y);
  y += 6;
  pdf.text(`Status: ${bill.status}    Due date: ${formatDate(bill.dueDate)}`, 14, y);
  y += 11;

  pdf.setFont("helvetica", "bold");
  pdf.text("Meter readings", 14, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.text(`Opening: ${bill.previousReading.toFixed(4)} kWh (${formatDateTime(bill.previousReadingAt)})`, 14, y);
  y += 6;
  pdf.text(`Closing: ${bill.currentReading.toFixed(4)} kWh (${formatDateTime(bill.currentReadingAt)})`, 14, y);
  y += 6;
  pdf.text(`Units consumed: ${bill.consumedUnits.toFixed(4)} kWh`, 14, y);
  y += 11;

  pdf.setFont("helvetica", "bold");
  pdf.text("Charges", 14, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  for (const item of bill.chargeBreakdown ?? [
    { label: "Energy charges", amount: bill.energyCharges },
    { label: "Fixed charges", amount: bill.fixedCharges },
    { label: "Other charges", amount: bill.otherCharges },
  ]) {
    pdf.text(item.label, 14, y);
    pdf.text(money(item.amount), pageWidth - 14, y, { align: "right" });
    y += 7;
  }
  y += 2;
  pdf.setFont("helvetica", "bold");
  pdf.text("Total payable", 14, y);
  pdf.text(money(bill.totalPayable), pageWidth - 14, y, { align: "right" });
  y += 10;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  if (bill.tariffScheduleName) pdf.text(`Tariff source: ${bill.tariffScheduleName} (effective ${formatDate(bill.tariffEffectiveFrom ?? "")})`, 14, y);

  pdf.save(`electricity-bill-${bill._id}.pdf`);
}

export default function ElectricityBillsPage() {
  const periods = getRecentPeriods();
  const [periodType, setPeriodType] = useState<BillingPeriodType>("LAST_10_DAYS");
  const [month, setMonth] = useState(periods[0].value);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [discom, setDiscom] = useState("");
  const [tariffCategory, setTariffCategory] = useState<"RGP" | "RGP_RURAL">("RGP");
  const [isBpl, setIsBpl] = useState(false);
  const [connectedLoadKw, setConnectedLoadKw] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [bills, setBills] = useState<ElectricityBill[]>([]);
  const [tariffConfiguration, setTariffConfiguration] = useState<TariffConfiguration | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [activeBillId, setActiveBillId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [paymentBill, setPaymentBill] = useState<ElectricityBill | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    const loadBills = async () => {
      try {
        const [billResult, configResult, telemetry] = await Promise.all([
          billRequest<ApiResult<ElectricityBill[]>>("/bills"),
          billRequest<ApiResult<TariffConfiguration>>("/bills/config"),
          fetch(`${API_BASE_URL}/live-data`).then(async (response) => {
            if (!response.ok) throw new Error("Could not read meter identity");
            return response.json() as Promise<{ deviceId?: string }>;
          }),
        ]);
        if (isMounted) {
          setBills(billResult.data);
          setDeviceId(telemetry.deviceId ?? "");
          setTariffConfiguration(configResult.data);
          setDiscom(configResult.data.discoms[0] ?? "");
        }
      } catch (error) {
        if (isMounted) setErrorMessage(error instanceof Error ? error.message : "Could not load bills");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void loadBills();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeBill = bills.find((bill) => bill._id === activeBillId) ?? null;

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setIsGenerating(true);
    try {
      const result = await billRequest<ApiResult<ElectricityBill>>("/bills", {
        method: "POST",
        body: {
          deviceId,
          periodType,
          ...(periodType === "ONE_MONTH" || periodType === "TWO_MONTHS" ? { month } : {}),
          ...(periodType === "CUSTOM" ? { fromDate, toDate } : {}),
          discom,
          tariffCategory,
          isBpl,
          connectedLoadKw: Number(connectedLoadKw),
          dueDate,
        },
      });
      setBills((current) => [result.data, ...current.filter((bill) => bill._id !== result.data._id)]);
      setActiveBillId(result.data._id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not generate bill");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePaymentSuccess = async (payment: PaymentSuccessData) => {
    if (!paymentBill) return;
    const result = await billRequest<ApiResult<ElectricityBill>>(`/bills/${paymentBill._id}/pay`, {
      method: "PATCH",
      body: { transactionId: payment.transactionId, paymentMethod: payment.paymentMethod },
    });
    setBills((current) => current.map((bill) => bill._id === result.data._id ? result.data : bill));
  };

  return (
    <main className="ebill-page">
      <header className="gridos-page-head">
        <h1 className="gridos-page-title">Electricity Bills</h1>
        <p className="gridos-page-desc">Generate and review bills from your stored meter readings.</p>
      </header>

      {errorMessage && <div className="ebill-error" role="alert">{errorMessage}</div>}

      <form className="ebill-generator" onSubmit={handleGenerate}>
        <div className="ebill-section-head">
          <div>
            <h2>Generate Bill</h2>
            <p>Charges are calculated from stored meter readings and the configured Gujarat DISCOM tariff.</p>
          </div>
          {deviceId && <span className="ebill-meter-id">Meter {deviceId}</span>}
        </div>

        <div className="ebill-form-grid">
          <label className="ebill-field">
            <span>Billing period</span>
            <select value={periodType} onChange={(event) => { setPeriodType(event.target.value as BillingPeriodType); setActiveBillId(null); }}>
              <option value="LAST_10_DAYS">Last 10 Days</option>
              <option value="LAST_20_DAYS">Last 20 Days</option>
              <option value="ONE_MONTH">1 Month</option>
              <option value="TWO_MONTHS">2 Months</option>
              <option value="CUSTOM">Custom Period</option>
            </select>
          </label>
          {(periodType === "ONE_MONTH" || periodType === "TWO_MONTHS") && (
            <label className="ebill-field">
              <span>{periodType === "TWO_MONTHS" ? "Ending month / year" : "Month / year"}</span>
              <select value={month} onChange={(event) => setMonth(event.target.value)}>
                {periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          )}
          {periodType === "CUSTOM" && <>
            <label className="ebill-field"><span>From</span><input required type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label className="ebill-field"><span>Through</span><input required type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
          </>}
          <label className="ebill-field">
            <span>Gujarat DISCOM</span>
            <select required value={discom} onChange={(event) => setDiscom(event.target.value)}>
              {(tariffConfiguration?.discoms ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="ebill-field">
            <span>Consumer tariff</span>
            <select value={tariffCategory} onChange={(event) => setTariffCategory(event.target.value as "RGP" | "RGP_RURAL")}>
              <option value="RGP">RGP</option>
              <option value="RGP_RURAL">RGP Rural</option>
            </select>
          </label>
          <label className="ebill-field">
            <span>Connected load (kW)</span>
            <input required min="0.1" step="0.1" type="number" inputMode="decimal" value={connectedLoadKw} onChange={(event) => setConnectedLoadKw(event.target.value)} placeholder="Enter contracted load" />
          </label>
          <label className="ebill-field ebill-checkbox-field">
            <span>BPL household</span>
            <input type="checkbox" checked={isBpl} onChange={(event) => setIsBpl(event.target.checked)} />
          </label>
          <label className="ebill-field">
            <span>Due date</span>
            <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
        </div>

        {tariffConfiguration && (
          <div className="ebill-tariff-note">
            <span>{tariffConfiguration.scheduleName} · effective {formatDate(tariffConfiguration.effectiveFrom)}</span>
            <a href={tariffConfiguration.sourceUrl} target="_blank" rel="noreferrer">Official tariff schedule</a>
          </div>
        )}
        {tariffConfiguration && !tariffConfiguration.ready && (
          <div className="ebill-config-warning" role="alert">
            Bill generation is disabled until these current charges are configured in <code>backend/config/gujarat-discom-tariffs.json</code>: {tariffConfiguration.missingUtilitySettings.join(", ")}.
          </div>
        )}

        <div className="ebill-form-footer">
          <span>Generation requires opening and closing readings from stored telemetry.</span>
          <button className="ebill-primary" type="submit" disabled={isGenerating || isLoading || !deviceId || !tariffConfiguration?.ready}>
            {isGenerating ? "Generating…" : "Generate bill"}
          </button>
        </div>
      </form>

      {activeBill && (
        <article className="ebill-document">
          <div className="ebill-document-head">
            <div>
              <p className="ebill-eyebrow">ELECTRICITY BILL</p>
              <h2>GridOS Utility Statement</h2>
              <p>Meter {activeBill.deviceId} · {activeBill.periodLabel ?? activeBill.period}</p>
            </div>
            <span className={`ebill-status ebill-status--${activeBill.status.toLowerCase()}`}>{activeBill.status}</span>
          </div>

          <div className="ebill-reading-grid">
            <div><span>Previous reading</span><strong>{activeBill.previousReading.toFixed(4)} kWh</strong><small>{formatDateTime(activeBill.previousReadingAt)}</small></div>
            <div><span>Current reading</span><strong>{activeBill.currentReading.toFixed(4)} kWh</strong><small>{formatDateTime(activeBill.currentReadingAt)}</small></div>
            <div><span>Units consumed</span><strong>{activeBill.consumedUnits.toFixed(4)} kWh</strong><small>Metered for this period</small></div>
          </div>

          <div className="ebill-charges">
            {(activeBill.chargeBreakdown ?? [
              { label: `Energy charges · ${activeBill.consumedUnits.toFixed(4)} kWh`, amount: activeBill.energyCharges },
              { label: "Fixed charges", amount: activeBill.fixedCharges },
              { label: "Other charges", amount: activeBill.otherCharges },
            ]).map((charge) => (
              <div key={charge.label}><span>{charge.label}</span><strong>{formatMoney(charge.amount)}</strong></div>
            ))}
            <div className="ebill-total"><span>Total payable</span><strong>{formatMoney(activeBill.totalPayable)}</strong></div>
          </div>

          <div className="ebill-document-footer">
            <span>Due {formatDate(activeBill.dueDate)}</span>
            <div className="ebill-document-actions">
              <button className="ebill-secondary" type="button" onClick={() => void downloadBillPdf(activeBill)}>Download PDF</button>
              {activeBill.status !== "PAID" ? (
                <button className="ebill-primary" type="button" disabled={activeBill.totalPayable <= 0} onClick={() => setPaymentBill(activeBill)}>
                  Pay {formatMoney(activeBill.totalPayable)}
                </button>
              ) : (
                <span className="ebill-paid-detail">Paid {activeBill.paidAt ? `on ${formatDate(activeBill.paidAt)}` : ""}</span>
              )}
            </div>
          </div>
          {activeBill.transactionId && <p className="ebill-transaction">Payment reference: {activeBill.transactionId} · {activeBill.paymentMethod}</p>}
          <p className="ebill-demo-note">Payment uses the project’s demo gateway; no real funds are transferred.</p>
        </article>
      )}

      <section className="ebill-history">
        <div className="ebill-section-head">
          <div><h2>Bill History</h2><p>Generated statements and current payment status.</p></div>
        </div>
        {isLoading ? <p className="ebill-empty">Loading bill history…</p> : bills.length === 0 ? <p className="ebill-empty">No bills generated yet.</p> : (
          <div className="ebill-table-wrap">
            <table>
              <thead><tr><th>Period</th><th>Units</th><th>Amount</th><th>Due date</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill._id}>
                    <td>{bill.periodLabel ?? periods.find((option) => option.value === bill.period)?.label ?? bill.period}</td>
                    <td>{bill.consumedUnits.toFixed(4)} kWh</td>
                    <td>{formatMoney(bill.totalPayable)}</td>
                    <td>{formatDate(bill.dueDate)}</td>
                    <td><span className={`ebill-status ebill-status--${bill.status.toLowerCase()}`}>{bill.status}</span></td>
                    <td><button className="ebill-view-button" type="button" onClick={() => setActiveBillId(bill._id)}>View bill</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {paymentBill && (
        <PaymentGatewayModal
          key={paymentBill._id}
          isOpen
          onClose={() => setPaymentBill(null)}
          onSuccess={handlePaymentSuccess}
          purpose="bill"
          initialAmount={paymentBill.totalPayable}
          lockAmount
        />
      )}
    </main>
  );
}
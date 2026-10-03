import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "../components/dashboard/Card";
import TransactionRow from "../components/dashboard/TransactionRow";
import PaymentGatewayModal, { type PaymentSuccessData } from "../components/wallet/PaymentGatewayModal";
import { formatRs } from "../utils/inrFormat";
import { apiRequest } from "../api/axios";
import {
  getRealtimeBalance,
  resetRealtimeBalance,
} from "../utils/realtimeBalance";

const STORAGE_MODE = "gridos-wallet-billing";
const STORAGE_TXS = "gridos-wallet-activity-txs";

/** Tariff rate: ₹6 per kWh (1 Unit = ₹6.00) */
const RATE_PER_UNIT_INR = 6.0;

/** Low balance threshold in USDT (~Rs. 415) */
const LOW_BALANCE_USDT = 5.0;

type BillingMode = "prepaid" | "postpaid";

type TxItem = {
  id: string;
  type: string;
  hash: string;
  amount: string;
  credit?: boolean;
  time: string;
};

const INITIAL_TXS: TxItem[] = [
  {
    id: "tx-1",
    type: "Top-up (UPI Instant)",
    hash: "0xfeed…a901",
    amount: "+Rs. 2,000.00",
    credit: true,
    time: "1d ago",
  },
  {
    id: "tx-2",
    type: "Grid consumption",
    hash: "0x88aa…3c10",
    amount: "-Rs. 340.50",
    time: "3h ago",
  },
  {
    id: "tx-3",
    type: "Validator reward",
    hash: "0x91be…8f04",
    amount: "+Rs. 150.00",
    credit: true,
    time: "6h ago",
  },
  {
    id: "tx-4",
    type: "P2P settlement",
    hash: "0x7a3f…c21d",
    amount: "-Rs. 85.00",
    time: "2d ago",
  },
];

function readStoredTxs(): TxItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_TXS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: TxItem) => {
          if (item.amount === "+Rs. 0.00" || item.amount === "-Rs. 0.00") {
            return { ...item, amount: "+Rs. 2,000.00" };
          }
          return item;
        });
      }
    }
  } catch {
    /* ignore */
  }
  return INITIAL_TXS;
}

function readMode(): BillingMode {
  try {
    const v = localStorage.getItem(STORAGE_MODE);
    if (v === "postpaid" || v === "prepaid") return v;
  } catch {
    /* ignore */
  }
  return "prepaid";
}

export default function WalletPage() {
  const [billingMode, setBillingMode] = useState<BillingMode>(readMode);
  const [prepaidBalance, setPrepaidBalance] = useState(getRealtimeBalance);
  const [isGatewayOpen, setIsGatewayOpen] = useState(false);
  const [transactions, setTransactions] = useState<TxItem[]>(readStoredTxs);
  const [liveEnergy, setLiveEnergy] = useState<number>(0);
  const [livePower, setLivePower] = useState<number>(0);

  // Poll live telemetry for real energy and power draw
  useEffect(() => {
    let isMounted = true;
    const fetchTelemetry = async () => {
      try {
        const data = await apiRequest<{ energy?: number; power?: number }>("/live-data");
        if (isMounted && data) {
          setLiveEnergy(Number(data.energy) || 0);
          setLivePower(Number(data.power) || 0);
        }
      } catch {
        /* ignore */
      }
    };
    void fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Postpaid total bill = consumed kWh * ₹6.00 / Unit
  const postpaidBillInr = useMemo(() => {
    return Number((liveEnergy * RATE_PER_UNIT_INR).toFixed(2));
  }, [liveEnergy]);

  // Hourly burn in INR = (power / 1000) * 6.0, defaults to ~11.10/h
  const hourlyBurnInr = useMemo(() => {
    if (livePower > 0) {
      return Number(((livePower / 1000) * RATE_PER_UNIT_INR).toFixed(2));
    }
    return 11.10;
  }, [livePower]);

  const runtime = useMemo(() => {
    const balanceInr = prepaidBalance * 83; // USDT to INR
    const hours = hourlyBurnInr > 0 ? balanceInr / hourlyBurnInr : 0;
    if (!Number.isFinite(hours) || hours <= 0) {
      return { label: "No runtime left", sub: "Top up to restore power credit." };
    }
    const totalMinutes = Math.floor(hours * 60);
    const days = Math.floor(totalMinutes / (60 * 24));
    const h = Math.floor((totalMinutes % (60 * 24)) / 60);
    const m = totalMinutes % 60;
    let label: string;
    if (days >= 1) {
      label = `${days} day${days === 1 ? "" : "s"} ${h} hr`;
    } else if (h >= 1) {
      label = `${h} hr ${m} min`;
    } else {
      label = `${m} min`;
    }
    return {
      label: `~${label}`,
      sub: `At Rs. ${hourlyBurnInr.toFixed(2)}/h (@ ₹6.00/unit live draw).`,
    };
  }, [prepaidBalance, hourlyBurnInr]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MODE, billingMode);
    } catch {
      /* ignore */
    }
  }, [billingMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TXS, JSON.stringify(transactions));
    } catch {
      /* ignore */
    }
  }, [transactions]);

  useEffect(() => {
    const refreshBalance = () => setPrepaidBalance(getRealtimeBalance());
    const interval = setInterval(refreshBalance, 1000);
    window.addEventListener("storage", refreshBalance);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", refreshBalance);
    };
  }, []);

  const isPrepaidLow = billingMode === "prepaid" && prepaidBalance < LOW_BALANCE_USDT;

  const onOpenGateway = useCallback(() => {
    setIsGatewayOpen(true);
  }, []);

  const handlePaymentSuccess = useCallback((data: PaymentSuccessData) => {
    setPrepaidBalance(getRealtimeBalance());
    const newTx: TxItem = {
      id: data.transactionId,
      type: `Top-up (${data.paymentMethod})`,
      hash: `0x${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}`,
      amount: `+Rs. ${data.amountInr.toLocaleString("en-IN")}.00`,
      credit: true,
      time: "Just now",
    };
    setTransactions((prev) => [newTx, ...prev]);
  }, []);

  const onResetBalance = useCallback(() => {
    const zeroed = resetRealtimeBalance();
    setPrepaidBalance(zeroed);
  }, []);

  return (
    <>
      <header className="gridos-page-head">
        <h1 className="gridos-page-title">Wallet</h1>
        <p className="gridos-page-desc">
          Prepaid draws down your balance (shown in Rs.) as the node runs. Postpaid bills your linked
          account each cycle. Runtime uses your current average cost per hour.
        </p>
      </header>

      {isPrepaidLow ? (
        <div className="gridos-wallet-alert" role="alert">
          <div className="gridos-wallet-alert__icon" aria-hidden>
            !
          </div>
          <div>
            <p className="gridos-wallet-alert__title">Low balance</p>
            <p className="gridos-wallet-alert__body">
              Your prepaid balance is below {formatRs(LOW_BALANCE_USDT)}. Top up to avoid
              service interruption. Push notification sent <strong>10 min ago</strong>.
            </p>
          </div>
        </div>
      ) : null}

      <div className="gridos-wallet-segment" role="tablist" aria-label="Billing mode">
        <button
          type="button"
          role="tab"
          aria-selected={billingMode === "prepaid"}
          className={`gridos-wallet-segment__btn${billingMode === "prepaid" ? " is-active" : ""}`}
          onClick={() => setBillingMode("prepaid")}
        >
          Prepaid
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={billingMode === "postpaid"}
          className={`gridos-wallet-segment__btn${billingMode === "postpaid" ? " is-active" : ""}`}
          onClick={() => setBillingMode("postpaid")}
        >
          Postpaid
        </button>
      </div>

      <div className="gridos-wallet-grid">
        {billingMode === "prepaid" ? (
          <Card
            className={`gridos-card--balance gridos-wallet-balance-card${isPrepaidLow ? " gridos-card--balance-low" : ""}`}
          >
            <div>
              <p className="gridos-balance-label">Prepaid balance</p>
              <p className="gridos-balance-value">{formatRs(prepaidBalance)}</p>
              <p className="gridos-balance-meta">Est. time to stay powered on: {runtime.label}</p>
              <p className="gridos-wallet-runtime-hint">{runtime.sub}</p>
            </div>
            <button type="button" className="gridos-topup" onClick={onOpenGateway}>
              Top up
            </button>
          </Card>
        ) : (
          <Card className="gridos-wallet-postpaid-card">
            <p className="gridos-wallet-postpaid-label">Postpaid account (Monthly)</p>
            <p className="gridos-wallet-postpaid-outstanding">
              Cycle to date: <strong>Rs. {postpaidBillInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </p>
            <p className="gridos-wallet-postpaid-meta">
              Tariff: <strong>₹6.00 / Unit (kWh)</strong> · Total used: <strong>{liveEnergy.toFixed(2)} kWh</strong>
            </p>
            <p className="gridos-wallet-postpaid-meta" style={{ marginTop: "3px" }}>
              Credit limit <strong>Rs. 5,000.00</strong> · Next statement in <strong>21 days</strong>
            </p>
            <p className="gridos-wallet-postpaid-power">
              Power-on: <span>active &amp; continuous</span> (meter running on postpaid grid credit).
            </p>
            <p className="gridos-wallet-runtime-hint gridos-wallet-runtime-hint--dark">
              Energy usage ({liveEnergy.toFixed(2)} kWh) billed at ₹6.00/kWh. Usage accrues monthly; autopay settles on due date.
            </p>
          </Card>
        )}

        <Card className="gridos-wallet-side-card">
          <h3 className="gridos-section-title">Billing details</h3>
          {billingMode === "prepaid" ? (
            <ul className="gridos-wallet-facts">
              <li>
                <span>Tariff rate</span>
                <strong style={{ color: "#0284c7" }}>₹6.00 / kWh</strong>
              </li>
              <li>
                <span>Hourly burn (est.)</span>
                <strong>Rs. {hourlyBurnInr.toFixed(2)}/h</strong>
              </li>
              <li>
                <span>Low-balance threshold</span>
                <strong>{formatRs(LOW_BALANCE_USDT)}</strong>
              </li>
              <li>
                <span>Alert channel</span>
                <strong>In-app + push</strong>
              </li>
            </ul>
          ) : (
            <ul className="gridos-wallet-facts">
              <li>
                <span>Tariff rate</span>
                <strong style={{ color: "#0284c7" }}>₹6.00 / kWh</strong>
              </li>
              <li>
                <span>Energy consumed</span>
                <strong>{liveEnergy.toFixed(2)} kWh</strong>
              </li>
              <li>
                <span>Cycle to date bill</span>
                <strong>Rs. {postpaidBillInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </li>
              <li>
                <span>Payment method</span>
                <strong>Linked account (Autopay)</strong>
              </li>
              <li>
                <span>Billing cycle</span>
                <strong>Monthly (Net-30)</strong>
              </li>
              <li>
                <span>Credit limit</span>
                <strong>Rs. 5,000.00</strong>
              </li>
            </ul>
          )}
          {billingMode === "prepaid" ? (
            <button
              type="button"
              className="gridos-wallet-demo-btn"
              onClick={onResetBalance}
            >
              Reset balance to 0
            </button>
          ) : null}
        </Card>
      </div>

      <section className="gridos-settlements-card">
        <h3 className="gridos-section-title">Wallet activity</h3>
        <div className="gridos-tx-list">
          {transactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              type={tx.type}
              hash={tx.hash}
              amount={tx.amount}
              credit={tx.credit}
              time={tx.time}
            />
          ))}
        </div>
      </section>

      {/* GridOS Secure Payment Gateway Modal */}
      <PaymentGatewayModal
        isOpen={isGatewayOpen}
        onClose={() => setIsGatewayOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </>
  );
}


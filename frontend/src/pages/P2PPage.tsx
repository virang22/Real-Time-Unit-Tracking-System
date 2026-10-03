import { useState } from "react";
import Card from "../components/dashboard/Card";
import TransactionRow from "../components/dashboard/TransactionRow";

type Listing = {
  id: string;
  node: string;
  role: "sell" | "buy";
  energyKwh: number;
  pricePerKwh: number;
  window: string;
  matched?: boolean;
};

const INITIAL_LISTINGS: Listing[] = [
  { id: "1", node: "NODE-BETA-04", role: "sell", energyKwh: 120, pricePerKwh: 4.85, window: "Today 14:00–18:00" },
  { id: "2", node: "GRID-EAST-12", role: "sell", energyKwh: 250, pricePerKwh: 5.10, window: "Tomorrow 08:00–12:00" },
  { id: "3", node: "ALPHA-01 (you)", role: "buy", energyKwh: 80, pricePerKwh: 4.90, window: "Open offer" },
  { id: "4", node: "SOLAR-ROOF-07", role: "sell", energyKwh: 340, pricePerKwh: 4.95, window: "Today 11:00–15:00" },
  { id: "5", node: "VOLT-NODE-09", role: "sell", energyKwh: 180, pricePerKwh: 5.25, window: "Next 48h" },
  { id: "6", node: "WIND-FARM-03", role: "sell", energyKwh: 500, pricePerKwh: 4.80, window: "Tonight 22:00–04:00" },
];

type SettlementItem = {
  id: string;
  type: string;
  hash: string;
  amount: string;
  credit?: boolean;
  time: string;
};

const INITIAL_SETTLEMENTS: SettlementItem[] = [
  {
    id: "s-1",
    type: "P2P buy — NODE-GAMMA (45 kWh @ ₹4.90)",
    hash: "0x6c2a…91ff",
    amount: "-Rs. 220.50",
    credit: false,
    time: "22m ago",
  },
  {
    id: "s-2",
    type: "P2P sell — Excess rooftop solar (80 kWh @ ₹5.15)",
    hash: "0x4d11…80aa",
    amount: "+Rs. 412.00",
    credit: true,
    time: "5h ago",
  },
  {
    id: "s-3",
    type: "P2P buy — Peak shave load (110 kWh @ ₹4.85)",
    hash: "0xbb09…2c44",
    amount: "-Rs. 533.50",
    credit: false,
    time: "1d ago",
  },
  {
    id: "s-4",
    type: "P2P sell — Battery discharge (65 kWh @ ₹5.30)",
    hash: "0x3e19…44bb",
    amount: "+Rs. 344.50",
    credit: true,
    time: "2d ago",
  },
];

export default function P2PPage() {
  const [listings, setListings] = useState<Listing[]>(INITIAL_LISTINGS);
  const [settlements, setSettlements] = useState<SettlementItem[]>(INITIAL_SETTLEMENTS);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);

  const handleMatch = (item: Listing) => {
    if (item.matched) return;

    setListings((prev) =>
      prev.map((l) => (l.id === item.id ? { ...l, matched: true } : l))
    );

    const totalCost = Number((item.energyKwh * item.pricePerKwh).toFixed(2));
    const isSell = item.role === "sell";

    const newSettlement: SettlementItem = {
      id: `s-${Date.now()}`,
      type: `${isSell ? "P2P buy" : "P2P sell"} — ${item.node} (${item.energyKwh} kWh @ ₹${item.pricePerKwh.toFixed(2)})`,
      hash: `0x${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}`,
      amount: `${isSell ? "-" : "+"}Rs. ${totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      credit: !isSell,
      time: "Just now",
    };

    setSettlements((prev) => [newSettlement, ...prev]);
    setMatchNotice(
      `Order matched with ${item.node}! ${item.energyKwh} kWh @ Rs. ${item.pricePerKwh.toFixed(2)}/kWh (Total: Rs. ${totalCost.toLocaleString("en-IN")})`
    );

    setTimeout(() => {
      setMatchNotice(null);
    }, 4500);
  };

  return (
    <>
      <header className="gridos-page-head">
        <h1 className="gridos-page-title">P2P marketplace</h1>
        <p className="gridos-page-desc">
          Trade surplus kWh with verified nodes. Prices settle on-chain; delivery windows are matched
          automatically when both parties confirm.
        </p>
      </header>

      {matchNotice && (
        <div
          role="status"
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: "12px 18px",
            borderRadius: "12px",
            marginBottom: "16px",
            fontSize: "0.92rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 2px 8px rgba(22, 101, 52, 0.08)",
          }}
        >
          <span>✓</span>
          <span>{matchNotice}</span>
        </div>
      )}

      <div className="gridos-p2p-stats">
        <Card className="gridos-p2p-stat">
          <p className="gridos-p2p-stat-label">24h volume</p>
          <p className="gridos-p2p-stat-value">Rs. 48,250.00</p>
          <p className="gridos-p2p-stat-sub">9,840 kWh settled notional</p>
        </Card>
        <Card className="gridos-p2p-stat">
          <p className="gridos-p2p-stat-label">Best ask</p>
          <p className="gridos-p2p-stat-value">Rs. 4.80/kWh</p>
          <p className="gridos-p2p-stat-sub">Lowest peer sell rate</p>
        </Card>
        <Card className="gridos-p2p-stat">
          <p className="gridos-p2p-stat-label">Open listings</p>
          <p className="gridos-p2p-stat-value">12</p>
          <p className="gridos-p2p-stat-sub">Across mainnet peer nodes</p>
        </Card>
      </div>

      <Card className="gridos-p2p-table-card">
        <div className="gridos-p2p-table-head">
          <h3 className="gridos-section-title" style={{ marginBottom: 0 }}>
            Live book
          </h3>
          <span className="gridos-live-badge">Matching</span>
        </div>
        <div className="gridos-p2p-table-wrap">
          <table className="gridos-p2p-table">
            <thead>
              <tr>
                <th>Node</th>
                <th>Side</th>
                <th>Energy</th>
                <th>Price / kWh</th>
                <th>Window</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listings.map((row) => (
                <tr key={row.id}>
                  <td className="gridos-p2p-mono">{row.node}</td>
                  <td>
                    <span
                      className={
                        row.role === "sell"
                          ? "gridos-p2p-tag gridos-p2p-tag--sell"
                          : "gridos-p2p-tag gridos-p2p-tag--buy"
                      }
                    >
                      {row.role === "sell" ? "Sell" : "Buy"}
                    </span>
                  </td>
                  <td>{row.energyKwh} kWh</td>
                  <td className="gridos-p2p-price">Rs. {row.pricePerKwh.toFixed(2)}</td>
                  <td className="gridos-p2p-muted">{row.window}</td>
                  <td>
                    <button
                      type="button"
                      className="gridos-p2p-action"
                      disabled={row.matched}
                      onClick={() => handleMatch(row)}
                      style={
                        row.matched
                          ? { backgroundColor: "#dcfce7", color: "#166534", cursor: "default" }
                          : undefined
                      }
                    >
                      {row.matched
                        ? "Matched ✓"
                        : row.role === "sell"
                        ? "Match"
                        : row.node.includes("(you)")
                        ? "Manage"
                        : "Counter"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="gridos-settlements-card">
        <h3 className="gridos-section-title">Recent P2P settlements</h3>
        <div className="gridos-tx-list">
          {settlements.map((tx) => (
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
    </>
  );
}

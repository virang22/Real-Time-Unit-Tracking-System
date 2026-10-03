import Card from "../components/dashboard/Card";

const FAQ = [
  {
    q: "How is my balance converted to Rs.?",
    a: "The app uses a fixed display multiplier (83 INR per USDT-equivalent unit) for demos. Production would use live FX or oracle rates.",
  },
  {
    q: "Why did my P2P match fail?",
    a: "Both nodes must be online and within the delivery window. Check sync status in the top bar and retry after a few minutes.",
  },
  {
    q: "How do I rotate my validator keys?",
    a: "Open Settings → Node and use “Rotate keys” when we ship wallet connect. Until then, contact support with your node ID.",
  },
];

export default function SupportPage() {
  return (
    <>
      <header className="gridos-page-head">
        <h1 className="gridos-page-title">Support</h1>
        <p className="gridos-page-desc">
          Help with GridOS nodes, billing, and on-chain settlements. For emergencies include your node ID
          and a recent tx hash.
        </p>
      </header>

      <div className="gridos-support-grid">
        <Card className="gridos-support-card gridos-support-card--primary">
          <h3 className="gridos-section-title">Contact</h3>
          <p className="gridos-support-email">
            <a href="mailto:support@gridos.node">support@gridos.node</a>
          </p>
          <p className="gridos-support-meta">Typical reply within one business day.</p>
          <div className="gridos-support-actions">
            <a className="gridos-support-btn" href="mailto:support@gridos.node?subject=GridOS%20help">
              Open mail
            </a>
            <button type="button" className="gridos-support-btn gridos-support-btn--ghost" disabled title="Demo">
              Live chat
            </button>
          </div>
        </Card>

        <Card className="gridos-support-card">
          <h3 className="gridos-section-title">Resources</h3>
          <ul className="gridos-support-links">
            <li>
              <a href="#docs">Documentation</a>
              <span>Setup, API, contracts</span>
            </li>
            <li>
              <a href="#status">Network status</a>
              <span>Mainnet &amp; RPC health</span>
            </li>
            <li>
              <a href="#security">Security</a>
              <span>Disclosure policy</span>
            </li>
          </ul>
        </Card>
      </div>

      <Card className="gridos-support-faq">
        <h3 className="gridos-section-title">FAQ</h3>
        <dl className="gridos-support-faq-list">
          {FAQ.map((item) => (
            <div key={item.q} className="gridos-support-faq-item">
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}

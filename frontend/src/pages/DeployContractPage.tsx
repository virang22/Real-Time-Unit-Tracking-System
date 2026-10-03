import { useState } from "react";
import Card from "../components/dashboard/Card";
import { IconPlus } from "../components/dashboard/gridosIcons";
import { formatRs } from "../utils/inrFormat";

export default function DeployContractPage() {
  const [name, setName] = useState("ALPHA-01-settlement-v2");
  const [template, setTemplate] = useState("energy");
  const [network, setNetwork] = useState("mainnet");
  const [bytecode, setBytecode] = useState("");
  const [busy, setBusy] = useState(false);

  const onDeploy = () => {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      window.alert(
        `Demo: contract "${name}" would be submitted to ${network}. Sign in your wallet to confirm.`,
      );
    }, 900);
  };

  return (
    <>
      <header className="gridos-page-head">
        <h1 className="gridos-page-title">Deploy contract</h1>
        <p className="gridos-page-desc">
          Publish a new on-chain program for settlements, metering, or node rules. Review gas and
          bytecode before confirming in your wallet.
        </p>
      </header>

      <div className="gridos-deploy-layout">
        <Card className="gridos-deploy-form-card">
          <h3 className="gridos-section-title">Configuration</h3>
          <div className="gridos-deploy-fields">
            <label className="gridos-deploy-field">
              <span>Contract label</span>
              <input
                className="gridos-deploy-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-node-contract"
                autoComplete="off"
              />
            </label>
            <label className="gridos-deploy-field">
              <span>Template</span>
              <select
                className="gridos-deploy-input gridos-deploy-select"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <option value="energy">Energy settlement</option>
                <option value="registry">Node registry</option>
                <option value="custom">Custom (bytecode below)</option>
              </select>
            </label>
            <label className="gridos-deploy-field">
              <span>Network</span>
              <select
                className="gridos-deploy-input gridos-deploy-select"
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
              >
                <option value="mainnet">Mainnet</option>
                <option value="sepolia">Sepolia (test)</option>
              </select>
            </label>
            {template === "custom" ? (
              <label className="gridos-deploy-field">
                <span>Bytecode (hex, optional)</span>
                <textarea
                  className="gridos-deploy-textarea"
                  value={bytecode}
                  onChange={(e) => setBytecode(e.target.value)}
                  placeholder="0x6080604052..."
                  rows={4}
                />
              </label>
            ) : null}
          </div>
          <button type="button" className="gridos-deploy-submit" onClick={onDeploy} disabled={busy}>
            <IconPlus />
            {busy ? "Preparing…" : "Deploy via wallet"}
          </button>
        </Card>

        <Card className="gridos-deploy-side">
          <h3 className="gridos-section-title">Estimate</h3>
          <ul className="gridos-deploy-estimate">
            <li>
              <span>Gas (mock)</span>
              <strong>0 units</strong>
            </li>
            <li>
              <span>Deploy fee (mock)</span>
              <strong>{formatRs(0)}</strong>
            </li>
            <li>
              <span>Compiler</span>
              <strong>Solidity 0.8.23</strong>
            </li>
          </ul>
          <p className="gridos-deploy-note">
            Final cost depends on network congestion. You will approve the transaction in your connected
            wallet.
          </p>
        </Card>
      </div>
    </>
  );
}

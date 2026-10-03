import React, { useState } from "react";
import { addRealtimeBalanceInr } from "../../utils/realtimeBalance";
import "../../styles/payment-gateway.css";

export type PaymentSuccessData = {
  amountInr: number;
  paymentMethod: string;
  transactionId: string;
  timestamp: string;
};

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: PaymentSuccessData) => void;
}

type PaymentTab = "upi" | "card" | "netbanking" | "crypto";

const PRESET_AMOUNTS = [1000, 2000, 3000, 5000, 10000];

export default function PaymentGatewayModal({
  isOpen,
  onClose,
  onSuccess,
}: PaymentGatewayModalProps) {
  const [amount, setAmount] = useState<number>(2000);
  const [customInput, setCustomInput] = useState<string>("2000");
  const [activeTab, setActiveTab] = useState<PaymentTab>("upi");

  // Form states
  const [upiMode, setUpiMode] = useState<"id" | "qr">("id");
  const [upiId, setUpiId] = useState("");
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>("gpay");
  const [qrUtr, setQrUtr] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [selectedBank, setSelectedBank] = useState("HDFC");
  const [netbankingUserId, setNetbankingUserId] = useState("");
  const [cryptoNetwork, setCryptoNetwork] = useState("Polygon");
  const [cryptoTxHash, setCryptoTxHash] = useState("");

  // Error state
  const [errorMessage, setErrorMessage] = useState("");

  // Gateway status: 'idle' | 'awaiting_approval' | 'processing' | 'success'
  const [status, setStatus] = useState<"idle" | "awaiting_approval" | "processing" | "success">("idle");
  const [processingStep, setProcessingStep] = useState<number>(0);
  const [generatedTxnId, setGeneratedTxnId] = useState<string>("");
  const [countdownSeconds, setCountdownSeconds] = useState<number>(180);

  const handleClose = () => {
    setStatus("idle");
    setProcessingStep(0);
    setGeneratedTxnId("");
    setErrorMessage("");
    onClose();
  };

  // Countdown timer for UPI awaiting approval
  React.useEffect(() => {
    if (status !== "awaiting_approval") return;
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setStatus("idle");
          setErrorMessage("Payment request timed out. Please try again.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (!isOpen) return null;

  const handleAmountSelect = (val: number) => {
    setAmount(val);
    setCustomInput(String(val));
    setErrorMessage("");
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setCustomInput(val);
    setErrorMessage("");
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setAmount(num);
    } else {
      setAmount(0);
    }
  };

  const formatCardNumber = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 16);
    const groups = clean.match(/.{1,4}/g);
    return groups ? groups.join(" ") : clean;
  };

  const formatExpiry = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 4);
    if (clean.length >= 3) {
      return `${clean.slice(0, 2)}/${clean.slice(2, 4)}`;
    }
    return clean;
  };

  const proceedWithPayment = (methodLabel: string) => {
    setStatus("processing");
    setProcessingStep(1);

    setTimeout(() => {
      setProcessingStep(2);
      setTimeout(() => {
        setProcessingStep(3);
        setTimeout(() => {
          const txnId = `TXN_GRID_${Math.floor(100000000 + Math.random() * 900000000)}`;
          setGeneratedTxnId(txnId);
          setStatus("success");

          // Update local wallet balance
          addRealtimeBalanceInr(amount);

          onSuccess({
            amountInr: amount,
            paymentMethod: methodLabel,
            transactionId: txnId,
            timestamp: "Just now",
          });
        }, 800);
      }, 900);
    }, 800);
  };

  const handlePayNow = () => {
    setErrorMessage("");

    if (!amount || amount < 100) {
      setErrorMessage("Please enter an amount of at least ₹100.");
      return;
    }

    // 1. UPI Validation
    if (activeTab === "upi") {
      if (upiMode === "id") {
        const cleanUpi = upiId.trim();
        if (!cleanUpi) {
          setErrorMessage("Please enter your UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm).");
          return;
        }
        if (!cleanUpi.includes("@") || cleanUpi.indexOf("@") === 0 || cleanUpi.indexOf("@") === cleanUpi.length - 1) {
          setErrorMessage("Invalid UPI ID format. It must contain '@' (e.g. username@bank).");
          return;
        }
        // Send collect request & wait for user approval on app
        setCountdownSeconds(180);
        setStatus("awaiting_approval");
        return;
      } else {
        // QR Code UTR validation
        const cleanUtr = qrUtr.trim();
        if (!cleanUtr) {
          setErrorMessage("Please scan the QR code and enter the 12-digit UTR / Reference number from your bank receipt.");
          return;
        }
        if (cleanUtr.length !== 12 || !/^\d{12}$/.test(cleanUtr)) {
          setErrorMessage("UTR number must be exactly 12 numeric digits (e.g. 423891024958).");
          return;
        }
        proceedWithPayment(`UPI QR (UTR: ${cleanUtr.slice(-4)})`);
        return;
      }
    }

    // 2. Card Validation
    if (activeTab === "card") {
      const cleanCard = cardNumber.replace(/\s/g, "");
      if (cleanCard.length !== 16) {
        setErrorMessage("Please enter a valid 16-digit debit/credit card number.");
        return;
      }
      if (!cardName.trim()) {
        setErrorMessage("Please enter cardholder name as printed on the card.");
        return;
      }
      if (cardExpiry.length !== 5 || !cardExpiry.includes("/")) {
        setErrorMessage("Please enter card expiry in MM/YY format.");
        return;
      }
      if (cardCvv.length < 3) {
        setErrorMessage("Please enter a 3 or 4 digit CVV/CVC.");
        return;
      }
      proceedWithPayment(`Card (•••• ${cleanCard.slice(-4)})`);
      return;
    }

    // 3. Net Banking Validation
    if (activeTab === "netbanking") {
      if (!netbankingUserId.trim()) {
        setErrorMessage(`Please enter your ${selectedBank} NetBanking Customer ID / User ID.`);
        return;
      }
      proceedWithPayment(`NetBanking (${selectedBank})`);
      return;
    }

    // 4. Crypto Validation
    if (activeTab === "crypto") {
      const cleanTx = cryptoTxHash.trim();
      if (!cleanTx || cleanTx.length < 20) {
        setErrorMessage("Please transfer USDT and paste your deposit Transaction Hash (TxID).");
        return;
      }
      proceedWithPayment(`Crypto (${cryptoNetwork})`);
      return;
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `0${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="pg-overlay" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="pg-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pg-header">
          <div className="pg-header-left">
            <div className="pg-shield-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              </svg>
            </div>
            <div>
              <h2 className="pg-title">GridOS Secure Payment Gateway</h2>
              <p className="pg-subtitle">
                <span className="pg-ssl-tag">256-bit SSL</span> Instant Power Credit Settlement
              </p>
            </div>
          </div>
          <button
            type="button"
            className="pg-close-btn"
            onClick={handleClose}
            aria-label="Close payment modal"
          >
            ✕
          </button>
        </div>

        {status === "awaiting_approval" ? (
          <div className="pg-awaiting-view">
            <div className="pg-awaiting-pulse">
              📱
            </div>
            <h3 className="pg-awaiting-title">Payment Request Sent!</h3>
            <p className="pg-awaiting-desc">
              We have sent an instant collect request for <strong>₹{amount.toLocaleString("en-IN")}.00</strong> to your UPI ID.
              Please open your UPI app to approve the payment.
            </p>

            <div className="pg-awaiting-id-card">
              <div style={{ textAlign: "left" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                  Requested UPI VPA
                </span>
                <strong style={{ color: "#0f172a", fontSize: "1.05rem" }}>{upiId}</strong>
              </div>
              <div className="pg-timer-box">
                ⏱ {formatTimer(countdownSeconds)}
              </div>
            </div>

            <div className="pg-action-group">
              <button
                type="button"
                className="pg-secondary-btn"
                onClick={() => {
                  setStatus("idle");
                  setErrorMessage("");
                }}
              >
                ✕ Cancel
              </button>
              <button
                type="button"
                className="pg-verify-btn"
                onClick={() => proceedWithPayment(`UPI (${upiId})`)}
              >
                ✓ I Have Approved on App
              </button>
            </div>
          </div>
        ) : status === "processing" ? (
          <div className="pg-processing-view">
            <div className="pg-spinner" />
            <h3 className="pg-proc-title">Verifying Payment with Bank</h3>
            <p className="pg-proc-desc">Please do not refresh or close this window...</p>

            <div className="pg-proc-steps">
              <div className={`pg-step ${processingStep >= 1 ? "is-active" : ""}`}>
                <span className="pg-step-icon">{processingStep > 1 ? "✓" : "1"}</span>
                <span>Connecting to NPCI / Bank gateway</span>
              </div>
              <div className={`pg-step ${processingStep >= 2 ? "is-active" : ""}`}>
                <span className="pg-step-icon">{processingStep > 2 ? "✓" : "2"}</span>
                <span>Verifying UPI settlement authorization</span>
              </div>
              <div className={`pg-step ${processingStep >= 3 ? "is-active" : ""}`}>
                <span className="pg-step-icon">3</span>
                <span>Syncing balance to GridOS energy wallet</span>
              </div>
            </div>
          </div>
        ) : status === "success" ? (
          <div className="pg-success-view">
            <div className="pg-success-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="pg-success-title">Payment Successful!</h3>
            <p className="pg-success-desc">
              Your prepaid energy credit has been updated and activated.
            </p>

            <div className="pg-receipt-card">
              <div className="pg-receipt-row">
                <span>Amount Paid</span>
                <strong className="pg-highlight-green">₹{amount.toLocaleString("en-IN")}.00</strong>
              </div>
              <div className="pg-receipt-row">
                <span>Transaction ID</span>
                <code className="pg-mono">{generatedTxnId}</code>
              </div>
              <div className="pg-receipt-row">
                <span>Payment Mode</span>
                <span>{activeTab.toUpperCase()} Verified</span>
              </div>
              <div className="pg-receipt-row">
                <span>Status</span>
                <span className="pg-badge-success">Confirmed & Credited</span>
              </div>
            </div>

            <button type="button" className="pg-done-btn" onClick={onClose}>
              Done & Return to Wallet
            </button>
          </div>
        ) : (
          <div className="pg-body">
            {/* Amount Selection Section */}
            <div className="pg-amount-box">
              <label className="pg-amount-label">Select Recharge Amount</label>
              <div className="pg-preset-grid">
                {PRESET_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    className={`pg-preset-btn ${amount === val ? "is-selected" : ""}`}
                    onClick={() => handleAmountSelect(val)}
                  >
                    ₹{val.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>

              <div className="pg-custom-amount-wrapper">
                <span className="pg-currency-prefix">₹</span>
                <input
                  type="text"
                  className="pg-custom-amount-input"
                  placeholder="Enter custom amount"
                  value={customInput}
                  onChange={handleCustomAmountChange}
                />
                <span className="pg-amount-equiv">
                  ≈ {(amount / 83).toFixed(2)} USDT Power Credit
                </span>
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div className="pg-methods-container">
              <label className="pg-amount-label">Choose Payment Method</label>
              <div className="pg-tabs-bar" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "upi"}
                  className={`pg-tab ${activeTab === "upi" ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveTab("upi");
                    setErrorMessage("");
                  }}
                >
                  <span className="pg-tab-emoji">📱</span> UPI / QR
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "card"}
                  className={`pg-tab ${activeTab === "card" ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveTab("card");
                    setErrorMessage("");
                  }}
                >
                  <span className="pg-tab-emoji">💳</span> Card
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "netbanking"}
                  className={`pg-tab ${activeTab === "netbanking" ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveTab("netbanking");
                    setErrorMessage("");
                  }}
                >
                  <span className="pg-tab-emoji">🏦</span> Net Banking
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "crypto"}
                  className={`pg-tab ${activeTab === "crypto" ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveTab("crypto");
                    setErrorMessage("");
                  }}
                >
                  <span className="pg-tab-emoji">⚡</span> Web3 / Crypto
                </button>
              </div>

              <div className="pg-tab-content">
                {/* 1. UPI */}
                {activeTab === "upi" && (
                  <div className="pg-upi-view">
                    <div className="pg-mode-toggle">
                      <button
                        type="button"
                        className={`pg-mode-toggle-btn ${upiMode === "id" ? "is-active" : ""}`}
                        onClick={() => {
                          setUpiMode("id");
                          setErrorMessage("");
                        }}
                      >
                        📱 Enter UPI ID
                      </button>
                      <button
                        type="button"
                        className={`pg-mode-toggle-btn ${upiMode === "qr" ? "is-active" : ""}`}
                        onClick={() => {
                          setUpiMode("qr");
                          setErrorMessage("");
                        }}
                      >
                        📷 Scan QR Code & Enter UTR
                      </button>
                    </div>

                    {upiMode === "id" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div className="pg-upi-apps">
                          <p className="pg-sub-heading">Select UPI App:</p>
                          <div className="pg-app-chips">
                            {[
                              { id: "gpay", name: "Google Pay", handle: "@okaxis", color: "#4285F4" },
                              { id: "phonepe", name: "PhonePe", handle: "@ybl", color: "#5f259f" },
                              { id: "paytm", name: "Paytm", handle: "@paytm", color: "#00b9f5" },
                              { id: "bhim", name: "BHIM UPI", handle: "@upi", color: "#22c55e" },
                            ].map((app) => (
                              <button
                                key={app.id}
                                type="button"
                                className={`pg-app-chip ${selectedUpiApp === app.id ? "is-active" : ""}`}
                                onClick={() => {
                                  setSelectedUpiApp(app.id);
                                  setErrorMessage("");
                                }}
                              >
                                <span className="pg-app-dot" style={{ backgroundColor: app.color }} />
                                {app.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="pg-upi-id-row">
                          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                            Enter UPI ID / VPA: <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <input
                            type="text"
                            className={`pg-input ${errorMessage && !upiId ? "is-error" : ""}`}
                            placeholder={
                              selectedUpiApp === "phonepe"
                                ? "e.g. yourname@ybl or 9876543210@ibl"
                                : selectedUpiApp === "paytm"
                                ? "e.g. 9876543210@paytm"
                                : selectedUpiApp === "bhim"
                                ? "e.g. yourname@upi"
                                : "e.g. yourname@okhdfcbank or yourname@okaxis"
                            }
                            value={upiId}
                            onChange={(e) => {
                              setUpiId(e.target.value);
                              setErrorMessage("");
                            }}
                          />
                          <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                            A payment collect request for ₹{amount.toLocaleString("en-IN")} will be sent to your app.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="pg-upi-qr-card">
                        <div className="pg-qr-frame">
                          <svg viewBox="0 0 100 100" width="120" height="120" className="pg-qr-code">
                            <rect x="0" y="0" width="100" height="100" fill="#0c121e" />
                            <rect x="10" y="10" width="25" height="25" fill="#38bdf8" rx="3" />
                            <rect x="15" y="15" width="15" height="15" fill="#0c121e" />
                            <rect x="18" y="18" width="9" height="9" fill="#38bdf8" />
                            <rect x="65" y="10" width="25" height="25" fill="#38bdf8" rx="3" />
                            <rect x="70" y="15" width="15" height="15" fill="#0c121e" />
                            <rect x="73" y="18" width="9" height="9" fill="#38bdf8" />
                            <rect x="10" y="65" width="25" height="25" fill="#38bdf8" rx="3" />
                            <rect x="15" y="70" width="15" height="15" fill="#0c121e" />
                            <rect x="18" y="73" width="9" height="9" fill="#38bdf8" />
                            <rect x="42" y="12" width="12" height="12" fill="#38bdf8" />
                            <rect x="42" y="30" width="16" height="8" fill="#38bdf8" />
                            <rect x="12" y="42" width="18" height="16" fill="#38bdf8" />
                            <rect x="42" y="44" width="16" height="16" fill="#34d399" />
                            <rect x="65" y="42" width="24" height="14" fill="#38bdf8" />
                            <rect x="42" y="66" width="14" height="22" fill="#38bdf8" />
                            <rect x="62" y="64" width="26" height="24" fill="#38bdf8" />
                          </svg>
                          <span className="pg-qr-badge">Scan & Pay ₹{amount}</span>
                        </div>

                        <div style={{ flex: 1 }}>
                          <p style={{ margin: "0 0 6px", fontSize: "0.82rem", fontWeight: 700, color: "#1e293b" }}>
                            Scan QR with any UPI App:
                          </p>
                          <p style={{ margin: "0 0 10px", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.4 }}>
                            Pay ₹{amount.toLocaleString("en-IN")} and enter the 12-digit UTR/Reference number from your receipt:
                          </p>
                          <input
                            type="text"
                            maxLength={12}
                            className={`pg-input ${errorMessage && !qrUtr ? "is-error" : ""}`}
                            placeholder="Enter 12-digit UTR (e.g. 423891024958)"
                            value={qrUtr}
                            onChange={(e) => {
                              setQrUtr(e.target.value.replace(/\D/g, ""));
                              setErrorMessage("");
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. CARD */}
                {activeTab === "card" && (
                  <div className="pg-card-view">
                    <div className="pg-field">
                      <label>Card Number <span style={{ color: "#ef4444" }}>*</span></label>
                      <input
                        type="text"
                        className="pg-input"
                        placeholder="4532 •••• •••• 8921"
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => {
                          setCardNumber(formatCardNumber(e.target.value));
                          setErrorMessage("");
                        }}
                      />
                    </div>

                    <div className="pg-field">
                      <label>Cardholder Name <span style={{ color: "#ef4444" }}>*</span></label>
                      <input
                        type="text"
                        className="pg-input"
                        placeholder="Name on card"
                        value={cardName}
                        onChange={(e) => {
                          setCardName(e.target.value);
                          setErrorMessage("");
                        }}
                      />
                    </div>

                    <div className="pg-field-grid">
                      <div className="pg-field">
                        <label>Expiry (MM/YY) <span style={{ color: "#ef4444" }}>*</span></label>
                        <input
                          type="text"
                          className="pg-input"
                          placeholder="12/28"
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => {
                            setCardExpiry(formatExpiry(e.target.value));
                            setErrorMessage("");
                          }}
                        />
                      </div>
                      <div className="pg-field">
                        <label>CVV / CVC <span style={{ color: "#ef4444" }}>*</span></label>
                        <input
                          type="password"
                          className="pg-input"
                          placeholder="•••"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => {
                            setCardCvv(e.target.value.replace(/\D/g, ""));
                            setErrorMessage("");
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. NET BANKING */}
                {activeTab === "netbanking" && (
                  <div className="pg-bank-view">
                    <label className="pg-sub-heading">Select Bank:</label>
                    <div className="pg-bank-grid">
                      {["HDFC", "SBI", "ICICI", "Axis Bank", "Kotak", "PNB"].map((b) => (
                        <button
                          key={b}
                          type="button"
                          className={`pg-bank-card ${selectedBank === b ? "is-selected" : ""}`}
                          onClick={() => {
                            setSelectedBank(b);
                            setErrorMessage("");
                          }}
                        >
                          🏦 {b}
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: "14px" }}>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                        Enter {selectedBank} NetBanking Customer ID / User ID: <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="pg-input"
                        placeholder="e.g. 98401924"
                        value={netbankingUserId}
                        onChange={(e) => {
                          setNetbankingUserId(e.target.value);
                          setErrorMessage("");
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 4. CRYPTO */}
                {activeTab === "crypto" && (
                  <div className="pg-crypto-view">
                    <label className="pg-sub-heading">Select Network:</label>
                    <div className="pg-bank-grid">
                      {["Polygon", "Arbitrum", "Ethereum", "TRC-20"].map((net) => (
                        <button
                          key={net}
                          type="button"
                          className={`pg-bank-card ${cryptoNetwork === net ? "is-selected" : ""}`}
                          onClick={() => {
                            setCryptoNetwork(net);
                            setErrorMessage("");
                          }}
                        >
                          ⚡ {net}
                        </button>
                      ))}
                    </div>
                    <div className="pg-crypto-addr">
                      <p className="pg-crypto-label">Deposit Address (USDT):</p>
                      <code className="pg-crypto-code">0x742d35Cc6634C0532925a3b844Bc454e4438f44e</code>
                    </div>
                    <div style={{ marginTop: "12px" }}>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                        Paste Transaction Hash (TxID) after transfer: <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="pg-input"
                        placeholder="0x4a9f...e901"
                        value={cryptoTxHash}
                        onChange={(e) => {
                          setCryptoTxHash(e.target.value);
                          setErrorMessage("");
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage ? (
              <div className="pg-error-banner" role="alert">
                ⚠️ {errorMessage}
              </div>
            ) : null}

            {/* Summary & Checkout Button */}
            <div className="pg-footer">
              <div className="pg-summary-strip">
                <div>
                  <span className="pg-summary-label">Total Payable:</span>
                  <strong className="pg-summary-amount">₹{amount.toLocaleString("en-IN")}.00</strong>
                </div>
                <div className="pg-zero-fee-tag">Zero Gateway Fee</div>
              </div>

              <button
                type="button"
                className="pg-pay-btn"
                onClick={handlePayNow}
                disabled={amount <= 0}
              >
                <span>🔒 Pay ₹{amount.toLocaleString("en-IN")} Now</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

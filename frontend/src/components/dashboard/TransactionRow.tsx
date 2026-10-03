type TransactionRowProps = {
  type: string;
  hash: string;
  amount: string;
  credit?: boolean;
  time: string;
};

export default function TransactionRow({
  type,
  hash,
  amount,
  credit,
  time,
}: TransactionRowProps) {
  return (
    <div className="gridos-tx-row">
      <div>
        <p className="gridos-tx-type">{type}</p>
        <p className="gridos-tx-hash">{hash}</p>
      </div>
      <div className="gridos-tx-right">
        <p className={`gridos-tx-amount ${credit ? "gridos-tx-amount--credit" : ""}`}>{amount}</p>
        <p className="gridos-tx-time">{time}</p>
      </div>
    </div>
  );
}

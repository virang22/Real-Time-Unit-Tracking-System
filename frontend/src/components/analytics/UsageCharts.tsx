type WeeklyBarChartProps = {
  labels: string[];
  valuesKwh: number[];
};

export function WeeklyBarChart({ labels, valuesKwh }: WeeklyBarChartProps) {
  const w = 400;
  const h = 140;
  const padL = 8;
  const padR = 8;
  const padB = 22;
  const chartH = h - padB;
  const max = Math.max(...valuesKwh, 1);
  const n = valuesKwh.length;
  const slot = (w - padL - padR) / n;
  const barW = slot * 0.55;

  return (
    <svg className="gridos-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <line className="gridos-chart-axis" x1={padL} y1={chartH} x2={w - padR} y2={chartH} />
      {valuesKwh.map((v, i) => {
        const bh = (v / max) * (chartH - 6);
        const x = padL + i * slot + (slot - barW) / 2;
        const y = chartH - bh;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={Math.max(bh, 2)}
            rx={3}
            fill="url(#gridosBarGrad)"
            opacity={0.9}
          />
        );
      })}
      <defs>
        <linearGradient id="gridosBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff88" />
          <stop offset="100%" stopColor="#00ff8833" />
        </linearGradient>
      </defs>
      {labels.map((lb, i) => {
        const cx = padL + i * slot + slot / 2;
        return (
          <text key={i} className="gridos-chart-bar-label" x={cx} y={h - 4} textAnchor="middle">
            {lb}
          </text>
        );
      })}
    </svg>
  );
}

type MonthlyLineChartProps = {
  labels: string[];
  valuesKwh: number[];
};

export function MonthlyLineChart({ labels, valuesKwh }: MonthlyLineChartProps) {
  const w = 400;
  const h = 140;
  const padX = 12;
  const padB = 22;
  const chartH = h - padB;
  const max = Math.max(...valuesKwh, 1);
  const n = valuesKwh.length;
  const step = n > 1 ? (w - padX * 2) / (n - 1) : 0;

  const points = valuesKwh.map((v, i) => {
    const x = padX + i * step;
    const y = chartH - (v / max) * (chartH - 10);
    return `${x},${y}`;
  });

  const lineD = `M ${points.join(" L ")}`;
  const areaD = `${lineD} L ${padX + (n - 1) * step},${chartH} L ${padX},${chartH} Z`;

  return (
    <svg className="gridos-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <line className="gridos-chart-axis" x1={padX} y1={chartH} x2={w - padX} y2={chartH} />
      <path d={areaD} fill="url(#gridosAreaGrad)" opacity={0.35} />
      <path
        d={lineD}
        fill="none"
        stroke="#00ff88"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {valuesKwh.map((v, i) => {
        const x = padX + i * step;
        const y = chartH - (v / max) * (chartH - 10);
        return <circle key={i} cx={x} cy={y} r={3.5} fill="#0d0d0d" stroke="#00ff88" strokeWidth="1.8" />;
      })}
      <defs>
        <linearGradient id="gridosAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
        </linearGradient>
      </defs>
      {labels.map((lb, i) => {
        const cx = padX + i * step;
        return (
          <text key={i} className="gridos-chart-bar-label" x={cx} y={h - 4} textAnchor="middle">
            {lb}
          </text>
        );
      })}
    </svg>
  );
}

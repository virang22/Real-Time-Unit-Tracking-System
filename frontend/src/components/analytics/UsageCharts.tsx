type WeeklyBarChartProps = {
  labels: string[];
  valuesKwh: number[];
};

function getKwhScale(values: number[]) {
  const dataMax = Math.max(0, ...values.filter(Number.isFinite));
  if (dataMax === 0) {
    return { max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  }

  const rawStep = dataMax / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const multiplier = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10;
  const step = multiplier * magnitude;
  const max = Math.ceil(dataMax / step) * step;
  const tickCount = Math.round(max / step);
  const decimals = (step.toFixed(6).split(".")[1] ?? "").replace(/0+$/, "").length;

  return {
    max,
    ticks: Array.from({ length: tickCount + 1 }, (_, index) => Number((step * index).toFixed(decimals))),
  };
}

function formatKwhTick(value: number, step: number) {
  const decimals = (step.toFixed(6).split(".")[1] ?? "").replace(/0+$/, "").length;
  return value.toFixed(decimals);
}

export function WeeklyBarChart({ labels, valuesKwh }: WeeklyBarChartProps) {
  const w = 440;
  const h = 160;
  const padL = 42;
  const padR = 8;
  const padT = 14;
  const padB = 24;
  const chartBottom = h - padB;
  const chartHeight = chartBottom - padT;
  const { max, ticks } = getKwhScale(valuesKwh);
  const tickStep = ticks[1] ?? 1;
  const n = valuesKwh.length;
  const slot = (w - padL - padR) / n;
  const barW = slot * 0.55;

  return (
    <svg className="gridos-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label="Weekly energy consumption in kilowatt-hours">
      <text x={padL} y={10} fill="#64748b" fontSize={9}>kWh</text>
      {ticks.map((tick) => {
        const y = chartBottom - (tick / max) * chartHeight;
        return (
          <g key={tick}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(148, 163, 184, 0.28)" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize={9}>
              {formatKwhTick(tick, tickStep)}
            </text>
          </g>
        );
      })}
      {valuesKwh.map((v, i) => {
        const bh = (v / max) * (chartHeight - 2);
        const x = padL + i * slot + (slot - barW) / 2;
        const y = chartBottom - bh;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={bh}
            rx={3}
            fill="url(#gridosBarGrad)"
            opacity={0.9}
          >
            <title>{labels[i]}: {v.toFixed(4)} kWh</title>
          </rect>
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
  const w = 440;
  const h = 160;
  const padL = 42;
  const padR = 12;
  const padT = 14;
  const padB = 24;
  const chartBottom = h - padB;
  const chartHeight = chartBottom - padT;
  const { max, ticks } = getKwhScale(valuesKwh);
  const tickStep = ticks[1] ?? 1;
  const n = valuesKwh.length;
  const step = n > 1 ? (w - padL - padR) / (n - 1) : 0;

  const points = valuesKwh.map((v, i) => {
    const x = padL + i * step;
    const y = chartBottom - (v / max) * chartHeight;
    return `${x},${y}`;
  });

  const lineD = points.length > 0 ? `M ${points.join(" L ")}` : "";
  const areaD = points.length > 1 ? `${lineD} L ${padL + (n - 1) * step},${chartBottom} L ${padL},${chartBottom} Z` : "";

  return (
    <svg className="gridos-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label="Daily energy consumption in kilowatt-hours">
      <text x={padL} y={10} fill="#64748b" fontSize={9}>kWh</text>
      {ticks.map((tick) => {
        const y = chartBottom - (tick / max) * chartHeight;
        return (
          <g key={tick}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(148, 163, 184, 0.28)" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize={9}>
              {formatKwhTick(tick, tickStep)}
            </text>
          </g>
        );
      })}
      {areaD ? <path d={areaD} fill="url(#gridosAreaGrad)" opacity={0.35} /> : null}
      {lineD ? (
        <path
          d={lineD}
          fill="none"
          stroke="#00ff88"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {valuesKwh.map((v, i) => {
        const x = padL + i * step;
        const y = chartBottom - (v / max) * chartHeight;
        return (
          <circle key={i} cx={x} cy={y} r={3.5} fill="#0d0d0d" stroke="#00ff88" strokeWidth="1.8">
            <title>{labels[i]}: {v.toFixed(4)} kWh</title>
          </circle>
        );
      })}
      <defs>
        <linearGradient id="gridosAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
        </linearGradient>
      </defs>
      {labels.map((lb, i) => {
        if (n > 12 && i !== 0 && (i + 1) % 5 !== 0 && i !== n - 1) return null;
        const cx = padL + i * step;
        return (
          <text key={i} className="gridos-chart-bar-label" x={cx} y={h - 4} textAnchor="middle" fontSize={9}>
            {lb}
          </text>
        );
      })}
    </svg>
  );
}

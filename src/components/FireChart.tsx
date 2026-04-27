import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { FireResult, formatAsset, DC_AVAILABLE_AGE } from '../utils/fireCalc';

interface Props {
  result: FireResult;
}

interface TooltipPayload {
  age: number;
  investmentPart: number;
  cashPart: number;
  dcPart: number;
  accumulatedPart: number;
  totalAsset: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: TooltipPayload }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="tooltip-age">{label}歳</div>
      <div className="tooltip-total">総資産：{formatAsset(d.totalAsset)}</div>
      <div className="tooltip-row">
        <span className="dot" style={{ background: '#aaaacc' }} />
        現金：{formatAsset(d.cashPart)}
      </div>
      <div className="tooltip-row">
        <span className="dot" style={{ background: '#4488ff' }} />
        通常投資：{formatAsset(d.investmentPart)}
      </div>
      <div className="tooltip-row">
        <span className="dot" style={{ background: '#ffaa00' }} />
        DC：{formatAsset(d.dcPart)}
      </div>
      <div className="tooltip-row">
        <span className="dot" style={{ background: '#44cc88' }} />
        通常積立：{formatAsset(d.accumulatedPart)}
      </div>
    </div>
  );
}

function yTickFormatter(value: number): string {
  if (value >= 10000) {
    const oku = value / 10000;
    return oku % 1 === 0 ? `${oku}億` : `${oku.toFixed(1)}億`;
  }
  return `${value}万`;
}

export default function FireChart({ result }: Props) {
  const { snapshots, fireAge, targetAsset, assetLifeAge } = result;

  if (snapshots.length === 0) return null;

  const lastAge = snapshots[snapshots.length - 1].age;
  const fireStartSnap = snapshots.find((s) => s.isWithdrawal);
  const fireStartAge = fireStartSnap?.age ?? null;

  return (
    <div className="chart-wrapper">
      <h3 className="section-title">資産推移グラフ</h3>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart
          data={snapshots}
          margin={{ top: 36, right: 20, left: 10, bottom: 10 }}
        >
          <defs>
            <linearGradient id="gradCash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#aaaacc" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#aaaacc" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="gradInvestment" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4488ff" stopOpacity={0.85} />
              <stop offset="95%" stopColor="#4488ff" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="gradDC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ffaa00" stopOpacity={0.85} />
              <stop offset="95%" stopColor="#ffaa00" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="gradAccumulated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#44cc88" stopOpacity={0.85} />
              <stop offset="95%" stopColor="#44cc88" stopOpacity={0.2} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="age"
            stroke="#aaa"
            tick={{ fill: '#aaa', fontSize: 12 }}
            tickFormatter={(v) => `${v}歳`}
          />
          <YAxis
            stroke="#aaa"
            tick={{ fill: '#aaa', fontSize: 11 }}
            tickFormatter={yTickFormatter}
            width={58}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* 取り崩しフェーズ背景 */}
          {fireStartAge !== null && (
            <ReferenceArea
              x1={fireStartAge}
              x2={lastAge}
              fill="rgba(255,255,255,0.03)"
              stroke="none"
            />
          )}

          {/* FIRE目標資産額ライン */}
          <ReferenceLine
            y={targetAsset}
            stroke="#ff4444"
            strokeDasharray="6 3"
            strokeWidth={2}
          >
            <Label
              value={`目標 ${formatAsset(targetAsset)}`}
              position="insideTopRight"
              fill="#ff6666"
              fontSize={11}
              offset={6}
            />
          </ReferenceLine>

          {/* FIRE達成縦線 */}
          {fireAge !== null && (
            <ReferenceLine x={fireAge} stroke="#ff8800" strokeWidth={2}>
              <Label
                value="🔥 FIRE"
                position="top"
                fill="#ff8800"
                fontSize={13}
                fontWeight="bold"
              />
            </ReferenceLine>
          )}

          {/* DC解禁ライン（FIRE後かつ60歳以降の場合のみ表示） */}
          {fireAge !== null && DC_AVAILABLE_AGE > fireAge && DC_AVAILABLE_AGE <= lastAge && (
            <ReferenceLine
              x={DC_AVAILABLE_AGE}
              stroke="#ffaa00"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            >
              <Label
                value="🔓 DC解禁"
                position="top"
                fill="#ffaa00"
                fontSize={11}
              />
            </ReferenceLine>
          )}

          {/* 年金受給開始ライン */}
          {result.pension.pensionStartAge <= lastAge && (
            <ReferenceLine
              x={result.pension.pensionStartAge}
              stroke="#44bbdd"
              strokeDasharray="5 3"
              strokeWidth={1.5}
            >
              <Label
                value={`💰 年金開始 (${result.pension.monthlyPension.toFixed(1)}万円/月)`}
                position="top"
                fill="#44bbdd"
                fontSize={11}
              />
            </ReferenceLine>
          )}

          {/* 資産寿命マーカー */}
          {assetLifeAge !== null && assetLifeAge <= lastAge && (
            <ReferenceLine x={assetLifeAge} stroke="#888" strokeDasharray="4 2">
              <Label value="💀" position="top" fill="#aaa" fontSize={16} />
            </ReferenceLine>
          )}

          {/* スタック順: 下から現金→投資→DC→積立 */}
          <Area
            type="monotone"
            dataKey="cashPart"
            stackId="1"
            stroke="#aaaacc"
            strokeWidth={1}
            fill="url(#gradCash)"
            name="現金"
          />
          <Area
            type="monotone"
            dataKey="investmentPart"
            stackId="1"
            stroke="#4488ff"
            strokeWidth={1.5}
            fill="url(#gradInvestment)"
            name="通常投資"
          />
          <Area
            type="monotone"
            dataKey="dcPart"
            stackId="1"
            stroke="#ffaa00"
            strokeWidth={1.5}
            fill="url(#gradDC)"
            name="DC"
          />
          <Area
            type="monotone"
            dataKey="accumulatedPart"
            stackId="1"
            stroke="#44cc88"
            strokeWidth={1.5}
            fill="url(#gradAccumulated)"
            name="通常積立"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#aaaacc' }} />
          現金・預金
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#4488ff' }} />
          通常投資の複利
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#ffaa00' }} />
          DC（初期+積立）の複利
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#44cc88' }} />
          通常積立の複利
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#ff4444', borderRadius: 0 }} />
          FIRE目標資産額
        </span>
      </div>
    </div>
  );
}

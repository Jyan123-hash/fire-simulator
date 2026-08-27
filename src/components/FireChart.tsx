import {
  AreaChart,
  Area,
  Line,
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
  idecoPart: number;
  investmentPrincipal: number;
  investmentGains: number;
  dcPrincipal: number;
  dcGains: number;
  idecoPrincipal: number;
  idecoGains: number;
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
  const totalPrincipal = d.investmentPrincipal + d.cashPart + d.dcPrincipal + d.idecoPrincipal;
  const totalGains     = d.investmentGains + d.dcGains + d.idecoGains;
  return (
    <div className="chart-tooltip">
      <div className="tooltip-age">{label}歳</div>
      <div className="tooltip-total">総資産：{formatAsset(d.totalAsset)}</div>
      <div className="tooltip-row" style={{ borderTop: '1px solid #444', marginTop: 4, paddingTop: 4 }}>
        元本合計：{formatAsset(totalPrincipal)}
      </div>
      <div className="tooltip-row">
        運用益合計：{formatAsset(totalGains)}
      </div>
      <div className="tooltip-row" style={{ borderTop: '1px solid #444', marginTop: 4, paddingTop: 4 }}>
        <span className="dot" style={{ background: '#aaaacc' }} />
        現金：{formatAsset(d.cashPart)}
      </div>
      <div className="tooltip-row">
        <span className="dot" style={{ background: '#cc8800' }} />
        DC：{formatAsset(d.dcPart)}
        <span style={{ color: '#888', marginLeft: 6, fontSize: '0.78rem' }}>
          （元本{formatAsset(d.dcPrincipal)} / 運用益{formatAsset(d.dcGains)}）
        </span>
      </div>
      <div className="tooltip-row">
        <span className="dot" style={{ background: '#44cc88' }} />
        iDeCo：{formatAsset(d.idecoPart)}
        <span style={{ color: '#888', marginLeft: 6, fontSize: '0.78rem' }}>
          （元本{formatAsset(d.idecoPrincipal)} / 運用益{formatAsset(d.idecoGains)}）
        </span>
      </div>
      <div className="tooltip-row">
        <span className="dot" style={{ background: '#6366f1' }} />
        通常投資：{formatAsset(d.investmentPart)}
        <span style={{ color: '#888', marginLeft: 6, fontSize: '0.78rem' }}>
          （元本{formatAsset(d.investmentPrincipal)} / 運用益{formatAsset(d.investmentGains)}）
        </span>
      </div>
    </div>
  );
}

export default function FireChart({ result }: Props) {
  const { snapshots, fireAge, targetAsset, assetLifeAge } = result;

  if (snapshots.length === 0) return null;

  const lastAge = snapshots[snapshots.length - 1].age;
  const fireStartSnap = snapshots.find((s) => s.isWithdrawal);
  const fireStartAge = fireStartSnap?.age ?? null;

  const hasIdeco = snapshots.some((s) => s.idecoPart > 0);
  const hasDc    = snapshots.some((s) => s.dcPart > 0);

  // Y軸上限: データの最大値と目標資産の1.1倍のうち大きい方を採用（必ず全データを表示）
  const datMax = Math.max(...snapshots.map((s) => s.totalAsset));
  const rawMax = Math.max(datMax, targetAsset * 1.1, 1000);
  // 年利を上げると資産は指数的に増えるため、非有限値・異常値を必ず弾く
  const safeMax = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 1000;

  // 目盛り間隔は 1/2/2.5/5 × 10^n から選び、本数を常に MAX_TICKS 前後に収める。
  // 固定刻みだと高年利時に目盛り数が爆発し Array.from が RangeError で落ちる。
  const MAX_TICKS = 12;
  const rough = safeMax / MAX_TICKS;
  const pow   = Math.pow(10, Math.floor(Math.log10(rough)));
  const tickStep =
    [1, 2, 2.5, 5, 10].map((m) => m * pow).find((v) => v >= rough) ?? pow * 10;
  const yMax = Math.ceil(safeMax / tickStep) * tickStep;
  const tickCount = Math.min(Math.round(yMax / tickStep) + 1, MAX_TICKS + 2);
  const yTicks = Array.from({ length: tickCount }, (_, i) => i * tickStep);

  // 軸ラベル: 1兆以上は「○兆」、1億以上は「○億」、それ以下は「○万」
  const yTickFormatter = (v: number): string => {
    if (v >= 100_000_000) {
      const cho = v / 100_000_000;
      return cho % 1 === 0 ? `${cho}兆` : `${cho.toFixed(1)}兆`;
    }
    if (v >= 10_000) {
      const oku = v / 10_000;
      return oku % 1 === 0 ? `${oku}億` : `${oku.toFixed(1)}億`;
    }
    return `${v.toLocaleString()}万`;
  };

  // X軸: 5歳刻みのtick（5の倍数のみ表示）
  const firstAge = snapshots[0].age;
  const xStart = Math.ceil(firstAge / 5) * 5;
  const xTicks: number[] = [];
  for (let a = xStart; a <= lastAge; a += 5) xTicks.push(a);

  return (
    <div className="chart-wrapper">
      <h3 className="section-title">資産推移グラフ</h3>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart
          data={snapshots}
          margin={{ top: 72, right: 20, left: 10, bottom: 10 }}
        >
          <defs>
            {/* 現金（元本のみ） */}
            <linearGradient id="gradCash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#aaaacc" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#aaaacc" stopOpacity={0.2} />
            </linearGradient>
            {/* DC 元本（濃いオレンジ） */}
            <linearGradient id="gradDcPrincipal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#cc8800" stopOpacity={0.95} />
              <stop offset="95%" stopColor="#cc8800" stopOpacity={0.4} />
            </linearGradient>
            {/* DC 運用益（薄いオレンジ） */}
            <linearGradient id="gradDcGains" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ffcc66" stopOpacity={0.65} />
              <stop offset="95%" stopColor="#ffcc66" stopOpacity={0.15} />
            </linearGradient>
            {/* 通常投資 元本（濃い青） */}
            <linearGradient id="gradInvPrincipal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.95} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.4} />
            </linearGradient>
            {/* 通常投資 運用益（薄い青） */}
            <linearGradient id="gradInvGains" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#a5b4fc" stopOpacity={0.65} />
              <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0.15} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="age"
            type="number"
            domain={[firstAge, lastAge]}
            ticks={xTicks}
            stroke="#aaa"
            tick={{ fill: '#aaa', fontSize: 12 }}
            tickFormatter={(v) => `${v}歳`}
          />
          <YAxis
            stroke="#aaa"
            tick={{ fill: '#aaa', fontSize: 11 }}
            tickFormatter={yTickFormatter}
            domain={[0, yMax]}
            ticks={yTicks}
            interval={0}
            width={72}
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

          {/* 縦線 3本のラベルを縦方向にずらして重なり回避
              下段(offset=5): DC・iDeCo解禁
              中段(offset=26): FIRE
              上段(offset=47): 年金開始 */}

          {/* DC・iDeCo解禁ライン（下段） */}
          {fireAge !== null && DC_AVAILABLE_AGE > fireAge && DC_AVAILABLE_AGE <= lastAge && (
            <ReferenceLine
              x={DC_AVAILABLE_AGE}
              stroke="#ffaa00"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            >
              <Label
                value="🔓 DC・iDeCo解禁"
                position="top"
                offset={5}
                fill="#ffaa00"
                fontSize={11}
              />
            </ReferenceLine>
          )}

          {/* FIRE達成縦線（中段） */}
          {fireAge !== null && (
            <ReferenceLine x={fireAge} stroke="#ff8800" strokeWidth={2}>
              <Label
                value="🔥 FIRE"
                position="top"
                offset={26}
                fill="#ff8800"
                fontSize={13}
                fontWeight="bold"
              />
            </ReferenceLine>
          )}

          {/* 年金受給開始ライン（上段） */}
          {result.pension.pensionStartAge <= lastAge && (
            <ReferenceLine
              x={result.pension.pensionStartAge}
              stroke="#44bbdd"
              strokeDasharray="5 3"
              strokeWidth={1.5}
            >
              <Label
                value={`💰 年金開始 (${result.pension.monthlyPension.toFixed(1)}万/月)`}
                position="top"
                offset={47}
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

          {/* スタック順（下から）:
              現金 → DC元本 → DC運用益 → 通常投資元本 → 通常投資運用益
              濃い色＝元本、薄い色＝複利で増えた運用益 */}
          <Area
            type="monotone"
            dataKey="cashPart"
            stackId="1"
            stroke="#aaaacc"
            strokeWidth={1}
            fill="url(#gradCash)"
            name="現金"
          />
          {hasDc && (
            <Area
              type="monotone"
              dataKey="dcPrincipal"
              stackId="1"
              stroke="#cc8800"
              strokeWidth={1}
              fill="url(#gradDcPrincipal)"
              name="DC元本"
            />
          )}
          {hasDc && (
            <Area
              type="monotone"
              dataKey="dcGains"
              stackId="1"
              stroke="#ffcc66"
              strokeWidth={1}
              fill="url(#gradDcGains)"
              name="DC運用益"
            />
          )}
          <Area
            type="monotone"
            dataKey="investmentPrincipal"
            stackId="1"
            stroke="#6366f1"
            strokeWidth={1}
            fill="url(#gradInvPrincipal)"
            name="投資元本"
          />
          <Area
            type="monotone"
            dataKey="investmentGains"
            stackId="1"
            stroke="#a5b4fc"
            strokeWidth={1}
            fill="url(#gradInvGains)"
            name="投資運用益"
          />
          {/* iDeCo は独立した Line として描画 */}
          {hasIdeco && (
            <Line
              type="monotone"
              dataKey="idecoPart"
              stroke="#44cc88"
              strokeWidth={2}
              dot={false}
              name="iDeCo"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#aaaacc' }} />
          現金・預金
        </span>
        {hasDc && (
          <span className="legend-item">
            <span className="legend-dot" style={{ background: '#cc8800' }} />
            DC元本
          </span>
        )}
        {hasDc && (
          <span className="legend-item">
            <span className="legend-dot" style={{ background: '#ffcc66' }} />
            DC運用益
          </span>
        )}
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#6366f1' }} />
          投資元本
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#a5b4fc' }} />
          投資運用益
        </span>
        {hasIdeco && (
          <span className="legend-item">
            <span className="legend-dot" style={{ background: '#44cc88' }} />
            iDeCo
          </span>
        )}
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#ff4444', borderRadius: 0 }} />
          FIRE目標資産額
        </span>
      </div>
    </div>
  );
}

import { calcHensachi, getLevel } from '../utils/hensachi';

interface Props {
  savingsMan: number;
  age: number;
  isSingle: boolean;
}

export default function HensachiCard({ savingsMan, age, isSingle }: Props) {
  const hensachi = calcHensachi(savingsMan, age, isSingle);
  const level = getLevel(hensachi);

  const gaugePercent = Math.min(100, Math.max(0, ((hensachi - 20) / 60) * 100));

  return (
    <div className="hensachi-card">
      <h3 className="section-title">資産偏差値</h3>

      <div className="hensachi-display">
        <div className="hensachi-score" style={{ color: level.color }}>
          {hensachi.toFixed(1)}
        </div>
        <div className="hensachi-label" style={{ color: level.color }}>
          {level.label}
        </div>
        <div className="hensachi-comment">{level.comment}</div>
      </div>

      <div className="hensachi-gauge">
        <div className="gauge-track">
          <div
            className="gauge-fill"
            style={{
              width: `${gaugePercent}%`,
              background: `linear-gradient(90deg, #6699cc, #ffcc00, #ff4500)`,
            }}
          />
          <div
            className="gauge-needle"
            style={{ left: `${gaugePercent}%` }}
          />
        </div>
        <div className="gauge-labels">
          <span>20</span>
          <span>40</span>
          <span>50</span>
          <span>60</span>
          <span>70</span>
          <span>80</span>
        </div>
      </div>

      <div className="hensachi-table">
        {[
          { range: '70〜', label: '東大理三', color: '#ff4500' },
          { range: '65〜70', label: '東大', color: '#ff6600' },
          { range: '60〜65', label: '早慶', color: '#ff8800' },
          { range: '55〜60', label: '関関同立', color: '#ffaa00' },
          { range: '50〜55', label: 'MARCH', color: '#ffcc00' },
          { range: '40〜50', label: '日東駒専', color: '#88bb44' },
          { range: '〜40', label: '専門学校', color: '#6699cc' },
        ].map((row) => (
          <div
            key={row.label}
            className={`hensachi-row ${level.label.includes(row.label) ? 'active' : ''}`}
          >
            <span className="row-range" style={{ color: row.color }}>
              {row.range}
            </span>
            <span className="row-label">{row.label}レベル</span>
          </div>
        ))}
      </div>
    </div>
  );
}

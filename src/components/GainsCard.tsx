import { useState } from 'react';
import {
  FireResult,
  calcYearlyGains,
  formatAssetShort,
  GainPhase,
} from '../utils/fireCalc';

interface Props {
  result: FireResult;
}

const PHASE_LABEL: Record<GainPhase, string> = {
  accumulation: '積立',
  withdrawal: '取崩',
  pension: '年金',
};

export default function GainsCard({ result }: Props) {
  const [open, setOpen] = useState(false);
  const gains = calcYearlyGains(result);

  if (gains.rows.length === 0) return null;

  return (
    <div className="gains-card">
      <h3 className="section-title">複利で増えた金額</h3>

      <div className="gains-summary">
        <div className="gains-metric">
          <span className="gains-metric__label">
            {gains.referenceAge}歳時点の累計運用益
          </span>
          <span className="gains-metric__value">
            {formatAssetShort(gains.fireCumulativeGains)}
            <span className="gains-metric__unit">円</span>
          </span>
        </div>
        <div className="gains-metric">
          <span className="gains-metric__label">積立期の年平均</span>
          <span className="gains-metric__value">
            {formatAssetShort(gains.accumulationAvgGain)}
            <span className="gains-metric__unit">円/年</span>
          </span>
        </div>
        <div className="gains-metric">
          <span className="gains-metric__label">元本の何倍</span>
          <span className="gains-metric__value">
            {gains.multipleOfPrincipal.toFixed(1)}
            <span className="gains-metric__unit">倍</span>
          </span>
        </div>
      </div>

      <button
        className="gains-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={`gains-toggle__caret ${open ? 'is-open' : ''}`}>▾</span>
        {open ? '年ごとの内訳を隠す' : '年ごとの内訳を表示'}
      </button>

      {open && (
        <>
          <div className="gains-table-scroll">
            <table className="gains-table">
              <thead>
                <tr>
                  <th className="gains-th--age">年齢</th>
                  <th>総資産</th>
                  <th>元本</th>
                  <th>累計運用益</th>
                  <th className="gains-th--delta">その年の増減</th>
                </tr>
              </thead>
              <tbody>
                {gains.rows.map((r) => (
                  <tr key={r.age} className={r.isFireYear ? 'is-fire' : ''}>
                    <td className="gains-td--age">
                      <span className="gains-age">{r.age}歳</span>
                      <span className="gains-phase">
                        {r.isFireYear ? 'FIRE' : PHASE_LABEL[r.phase]}
                      </span>
                    </td>
                    <td>{formatAssetShort(r.totalAsset)}</td>
                    <td className="gains-td--muted">{formatAssetShort(r.principal)}</td>
                    <td>{formatAssetShort(r.cumulativeGains)}</td>
                    <td className={r.yearlyGain < 0 ? 'gains-neg' : 'gains-pos'}>
                      {r.yearlyGain < 0 ? '' : '+'}
                      {formatAssetShort(r.yearlyGain)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="gains-note">
            その年の増減は運用益の前年差です。取り崩し期は引き出しにより運用益も按分して減るため、
            生活費が運用リターンを上回る年はマイナスになります。
          </p>
        </>
      )}
    </div>
  );
}

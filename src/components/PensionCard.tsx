import { PensionInfo, PENSION_BASE_AGE } from '../utils/fireCalc';

interface Props {
  pension: PensionInfo;
  fireAge: number | null;
  startWorkAge: number;
  annualExpenses: number;
}

export default function PensionCard({ pension, fireAge, startWorkAge, annualExpenses }: Props) {
  const workYears = fireAge !== null ? Math.max(0, Math.min(fireAge, 65) - startWorkAge) : 0;
  const netWithdrawal = Math.max(0, annualExpenses - pension.totalAnnualPension);

  const adjPct = ((pension.adjustmentRate - 1) * 100);
  const isEarly    = pension.pensionStartAge < PENSION_BASE_AGE;
  const isDeferred = pension.pensionStartAge > PENSION_BASE_AGE;
  const adjColor   = isEarly ? '#ff7777' : isDeferred ? '#44cc88' : '#8892a8';
  const adjSign    = adjPct > 0 ? '+' : '';
  const adjLabel   = isEarly
    ? `繰り上げ受給（▼${Math.abs(adjPct).toFixed(1)}%）`
    : isDeferred
    ? `繰り下げ受給（▲${adjPct.toFixed(1)}%）`
    : '通常受給（65歳基準）';

  return (
    <div className="pension-card">
      <h3 className="section-title">年金シミュレーション</h3>

      <div className="pension-meta">
        <span>就労期間：{startWorkAge}歳〜{fireAge ?? '?'}歳（{workYears}年）</span>
        <span>受給開始：{pension.pensionStartAge}歳〜</span>
        <span style={{ color: adjColor, fontWeight: 700 }}>{adjLabel}</span>
      </div>

      {/* 65歳基準額（調整前）*/}
      {pension.adjustmentRate !== 1 && (
        <div className="pension-base-row">
          <span className="pension-base-label">65歳基準額（調整前）</span>
          <span className="pension-base-value">{pension.baseAnnualPension.toFixed(1)}万円/年</span>
        </div>
      )}

      <div className="pension-rows">
        <div className="pension-row">
          <div className="pension-row__label">
            <span className="pension-badge pension-badge--basic">基礎</span>
            老齢基礎年金
          </div>
          <div className="pension-row__values">
            <span className="pension-annual">{pension.basicPension.toFixed(1)}万円/年</span>
            <span className="pension-monthly">（月 {(pension.basicPension / 12).toFixed(1)}万円）</span>
          </div>
        </div>

        <div className="pension-row">
          <div className="pension-row__label">
            <span className="pension-badge pension-badge--employee">厚生</span>
            老齢厚生年金
          </div>
          <div className="pension-row__values">
            <span className="pension-annual">{pension.employeePension.toFixed(1)}万円/年</span>
            <span className="pension-monthly">（月 {(pension.employeePension / 12).toFixed(1)}万円）</span>
          </div>
        </div>

        <div className="pension-row pension-row--total">
          <div className="pension-row__label">
            合計受給額
            {pension.adjustmentRate !== 1 && (
              <span style={{ fontSize: '0.78rem', color: adjColor, marginLeft: 6 }}>
                {adjSign}{adjPct.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="pension-row__values">
            <span className="pension-annual pension-annual--total">
              {pension.totalAnnualPension.toFixed(1)}万円/年
            </span>
            <span className="pension-monthly">（月 {pension.monthlyPension.toFixed(1)}万円）</span>
          </div>
        </div>
      </div>

      <div className="pension-note">
        <span className="pension-note__label">
          {pension.pensionStartAge}歳以降の実質取り崩し額
        </span>
        <span className="pension-note__value">
          {netWithdrawal > 0
            ? `${netWithdrawal.toFixed(0)}万円/年（月 ${(netWithdrawal / 12).toFixed(1)}万円）`
            : '年金だけで生活費をカバー ✨'}
        </span>
      </div>

      <p className="pension-disclaimer">
        ※ 老齢基礎年金満額 81.6万円/年（2024年度）、厚生年金は平均標準報酬月額×5.481/1000×加入月数で試算。
        繰り上げ −0.4%/月・繰り下げ +0.7%/月（厚生労働省）。FIRE後は国民年金加入継続を想定。
      </p>
    </div>
  );
}

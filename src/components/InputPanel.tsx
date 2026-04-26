import {
  AccumulationStep,
  FireInput,
  calcPensionAdjustmentRate,
  PENSION_MIN_AGE,
  PENSION_MAX_AGE,
  PENSION_BASE_AGE,
} from '../utils/fireCalc';

interface Props {
  input: FireInput;
  isSingle: boolean;
  onChange: (input: FireInput, isSingle: boolean) => void;
  dieWithZeroTarget?: number;
}

function NumInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="input-row">
      <label className="input-label">{label}</label>
      <div className="input-with-unit">
        <input
          type="number"
          className="input-field"
          value={value}
          min={min}
          max={max}
          step={step ?? 1}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        {unit && <span className="input-unit">{unit}</span>}
      </div>
    </div>
  );
}

function pensionAdjustLabel(age: number): { text: string; color: string } {
  const rate = calcPensionAdjustmentRate(age);
  const pct = ((rate - 1) * 100).toFixed(1);
  if (age < PENSION_BASE_AGE) {
    return { text: `▼${Math.abs(Number(pct))}%（${Math.round(rate * 100)}%）`, color: '#ff7777' };
  }
  if (age > PENSION_BASE_AGE) {
    return { text: `▲${pct}%（${Math.round(rate * 100)}%）`, color: '#44cc88' };
  }
  return { text: '基準（100%）', color: '#8892a8' };
}

export default function InputPanel({ input, isSingle, onChange, dieWithZeroTarget }: Props) {
  const update = (partial: Partial<FireInput>, newIsSingle?: boolean) => {
    onChange({ ...input, ...partial }, newIsSingle ?? isSingle);
  };

  const updateStep = (idx: number, partial: Partial<AccumulationStep>) => {
    const newSteps = input.steps.map((s, i) =>
      i === idx ? { ...s, ...partial } : s
    );
    update({ steps: newSteps });
  };

  const addStep = () => {
    if (input.steps.length >= 4) return;
    const lastAge = input.steps.length > 0
      ? input.steps[input.steps.length - 1].startAge + 5
      : input.currentAge;
    update({ steps: [...input.steps, { startAge: lastAge, endAge: null, monthlyAmount: 5 }] });
  };

  const removeStep = (idx: number) => {
    update({ steps: input.steps.filter((_, i) => i !== idx) });
  };

  const totalCurrentAssets =
    input.currentInvestment + input.currentCash + input.dcCurrentAmount;

  const pensionAdj = pensionAdjustLabel(input.pensionStartAge ?? PENSION_BASE_AGE);

  return (
    <div className="input-panel">
      {/* ── 基本情報 ── */}
      <section className="input-section">
        <h3 className="section-title">基本情報</h3>

        <NumInput
          label="現在の年齢"
          value={input.currentAge}
          onChange={(v) => update({ currentAge: v })}
          min={18} max={70} unit="歳"
        />

        <div className="input-row">
          <label className="input-label">世帯種別</label>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${isSingle ? 'active' : ''}`}
              onClick={() => onChange(input, true)}
            >
              単身
            </button>
            <button
              className={`toggle-btn ${!isSingle ? 'active' : ''}`}
              onClick={() => onChange(input, false)}
            >
              2人以上
            </button>
          </div>
        </div>

        <NumInput
          label="想定年利"
          value={input.annualRate}
          onChange={(v) => update({ annualRate: v })}
          min={0} max={30} step={0.1} unit="%"
        />
      </section>

      {/* ── 現在の資産内訳 ── */}
      <section className="input-section">
        <h3 className="section-title">現在の資産内訳</h3>

        <NumInput
          label="投資額"
          value={input.currentInvestment}
          onChange={(v) => update({ currentInvestment: v })}
          min={0} step={10} unit="万円"
        />

        <NumInput
          label="現金・預金"
          value={input.currentCash}
          onChange={(v) => update({ currentCash: v })}
          min={0} step={10} unit="万円"
        />

        <div className="input-row info-row">
          <label className="input-label">合計</label>
          <span className="info-value info-value--neutral">
            {(input.currentInvestment + input.currentCash).toLocaleString()}万円
          </span>
        </div>
      </section>

      {/* ── 企業型確定拠出年金 ── */}
      <section className="input-section">
        <h3 className="section-title">企業型確定拠出年金（DC）</h3>

        <NumInput
          label="現在の評価額"
          value={input.dcCurrentAmount}
          onChange={(v) => update({ dcCurrentAmount: v })}
          min={0} step={10} unit="万円"
        />

        <NumInput
          label="毎月積立額"
          value={input.dcMonthlyContribution}
          onChange={(v) => update({ dcMonthlyContribution: v })}
          min={0} step={0.5} unit="万円/月"
        />
      </section>

      {/* 合計資産サマリ */}
      <div className="asset-summary">
        <span className="asset-summary__label">現在の総資産</span>
        <span className="asset-summary__value">
          {totalCurrentAssets.toLocaleString()}万円
        </span>
      </div>

      {/* ── 積立設定 ── */}
      <section className="input-section">
        <h3 className="section-title">積立設定（最大4ステップ）</h3>

        {input.steps.map((step, idx) => (
          <div key={idx} className="step-row step-row--col">
            <div className="step-row-header">
              <span className="step-label">Step {idx + 1}</span>
              <button className="remove-btn" onClick={() => removeStep(idx)}>✕</button>
            </div>
            <div className="step-fields">
              <div className="input-with-unit">
                <input
                  type="number"
                  className="input-field step-field"
                  value={step.startAge}
                  min={input.currentAge} max={80}
                  onChange={(e) =>
                    updateStep(idx, { startAge: parseInt(e.target.value) || input.currentAge })
                  }
                />
                <span className="input-unit">歳〜</span>
              </div>
              <div className="input-with-unit">
                <input
                  type="number"
                  className="input-field step-field"
                  value={step.endAge ?? ''}
                  placeholder="FIRE時"
                  min={step.startAge + 1} max={80}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateStep(idx, { endAge: val === '' ? null : parseInt(val) || null });
                  }}
                />
                <span className="input-unit">歳まで</span>
              </div>
              <div className="input-with-unit">
                <input
                  type="number"
                  className="input-field step-field"
                  value={step.monthlyAmount}
                  min={0} step={0.5}
                  onChange={(e) =>
                    updateStep(idx, { monthlyAmount: parseFloat(e.target.value) || 0 })
                  }
                />
                <span className="input-unit">万円/月</span>
              </div>
            </div>
          </div>
        ))}

        {input.steps.length < 4 && (
          <button className="add-step-btn" onClick={addStep}>
            ＋ ステップを追加
          </button>
        )}
      </section>

      {/* ── FIRE・取り崩し設定 ── */}
      <section className="input-section">
        <h3 className="section-title">FIRE・取り崩し設定</h3>

        <NumInput
          label="年間生活費"
          value={input.annualExpenses}
          onChange={(v) => update({ annualExpenses: v })}
          min={0} step={10} unit="万円/年"
        />

        <NumInput
          label="年間取り崩し率"
          value={input.withdrawalRate}
          onChange={(v) => update({ withdrawalRate: v })}
          min={1} max={20} step={0.1} unit="%"
        />

        <div className="input-row">
          <label className="input-label">FIRE目標資産</label>
          <div className="target-asset-group">
            <div className="input-with-unit">
              <input
                type="number"
                className="input-field"
                value={input.targetAsset}
                min={0}
                step={100}
                onChange={(e) => update({ targetAsset: parseFloat(e.target.value) || 0 })}
              />
              <span className="input-unit">万円</span>
            </div>
            <button
              className="recommend-btn"
              title="取り崩し率から自動計算"
              onClick={() =>
                update({ targetAsset: Math.round(input.annualExpenses / (input.withdrawalRate / 100)) })
              }
            >
              推奨 {Math.round(input.annualExpenses / (input.withdrawalRate / 100)).toLocaleString()}万
            </button>
            {dieWithZeroTarget !== undefined && (
              <button
                className="recommend-btn recommend-btn--dwz"
                title="100歳で資産ゼロになる金額（Die with Zero）"
                onClick={() => update({ targetAsset: dieWithZeroTarget })}
              >
                💀 {dieWithZeroTarget.toLocaleString()}万
              </button>
            )}
          </div>
        </div>

        <NumInput
          label="FIRE後〜年金前積立"
          value={input.postFireMonthlyInvestment}
          onChange={(v) => update({ postFireMonthlyInvestment: v })}
          min={0} step={0.5} unit="万円/月"
        />

        <NumInput
          label="年金受給後の積立"
          value={input.postPensionMonthlyInvestment}
          onChange={(v) => update({ postPensionMonthlyInvestment: v })}
          min={0} step={0.5} unit="万円/月"
        />
      </section>

      {/* ── 年金設定 ── */}
      <section className="input-section">
        <h3 className="section-title">年金設定</h3>

        <NumInput
          label="就労開始年齢"
          value={input.startWorkAge}
          onChange={(v) => update({ startWorkAge: v })}
          min={18} max={40} unit="歳"
        />

        <NumInput
          label="平均年収（会社員時代）"
          value={input.averageAnnualSalary}
          onChange={(v) => update({ averageAnnualSalary: v })}
          min={0} step={50} unit="万円/年"
        />

        {/* 年金受給開始年齢 + 調整率バッジ */}
        <div className="input-row">
          <label className="input-label">受給開始年齢</label>
          <div className="input-with-unit">
            <input
              type="number"
              className="input-field"
              value={input.pensionStartAge ?? PENSION_BASE_AGE}
              min={PENSION_MIN_AGE}
              max={PENSION_MAX_AGE}
              step={1}
              onChange={(e) => {
                const v = parseInt(e.target.value) || PENSION_BASE_AGE;
                update({ pensionStartAge: Math.max(PENSION_MIN_AGE, Math.min(PENSION_MAX_AGE, v)) });
              }}
            />
            <span className="input-unit">歳</span>
          </div>
        </div>

        {/* 調整率の説明バッジ */}
        <div className="pension-adj-badge" style={{ color: pensionAdj.color }}>
          {pensionAdj.text}
          {input.pensionStartAge < PENSION_BASE_AGE && (
            <span className="pension-adj-note"> （繰り上げ −0.4%/月）</span>
          )}
          {input.pensionStartAge > PENSION_BASE_AGE && (
            <span className="pension-adj-note"> （繰り下げ +0.7%/月）</span>
          )}
        </div>
      </section>
    </div>
  );
}

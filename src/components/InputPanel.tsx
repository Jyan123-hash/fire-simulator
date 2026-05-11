import type { MouseEvent } from 'react';
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
  assetReachedAge?: number | null;
}

function clamp(v: number, min?: number, max?: number): number {
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}

// 小数点 step に伴う浮動小数誤差を補正
function roundToStep(v: number, step: number): number {
  // step が 0.1 → 1 桁、0.5 → 1 桁、1 → 0 桁、10 → 0 桁
  const decimals = step < 1 ? (step.toString().split('.')[1]?.length ?? 0) : 0;
  return Number(v.toFixed(decimals));
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
  const s = step ?? 1;
  const dec = (e: MouseEvent) => {
    e.preventDefault();
    onChange(clamp(roundToStep(value - s, s), min, max));
  };
  const inc = (e: MouseEvent) => {
    e.preventDefault();
    onChange(clamp(roundToStep(value + s, s), min, max));
  };
  const onBlur = () => {
    // フォーカスアウト時に範囲外を補正
    const clamped = clamp(value, min, max);
    if (clamped !== value) onChange(clamped);
  };
  return (
    <div className="input-row">
      <label className="input-label">{label}</label>
      <div className="input-with-unit">
        <div className="num-stepper">
          <button type="button" className="step-btn" onClick={dec} aria-label="減らす">−</button>
          <input
            type="number"
            inputMode="decimal"
            className="input-field"
            value={value}
            min={min}
            max={max}
            step={s}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                // 入力中の空文字は許容（onBlur で補正）
                onChange(0);
                return;
              }
              const parsed = parseFloat(raw);
              if (Number.isNaN(parsed)) return;
              onChange(parsed);
            }}
            onBlur={onBlur}
          />
          <button type="button" className="step-btn" onClick={inc} aria-label="増やす">＋</button>
        </div>
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

export default function InputPanel({ input, isSingle, onChange, assetReachedAge }: Props) {
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
    input.currentInvestment + input.currentCash + input.dcCurrentAmount + input.idecoCurrentAmount;

  const pensionAdj = pensionAdjustLabel(input.pensionStartAge ?? PENSION_BASE_AGE);

  // 取り崩し率（自動計算・表示用）
  const withdrawalRate = input.targetAsset > 0
    ? (input.annualExpenses / input.targetAsset) * 100
    : 0;

  // 4%ルール推奨目標資産
  const recommended4pct = Math.round(input.annualExpenses / 0.04);

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

      {/* ── iDeCo ── */}
      <section className="input-section">
        <h3 className="section-title">iDeCo（個人型確定拠出年金）</h3>

        <NumInput
          label="現在の評価額"
          value={input.idecoCurrentAmount}
          onChange={(v) => update({ idecoCurrentAmount: v })}
          min={0} step={10} unit="万円"
        />

        <NumInput
          label="毎月積立額"
          value={input.idecoMonthlyContribution}
          onChange={(v) => update({ idecoMonthlyContribution: v })}
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
          label="FIRE開始希望年齢"
          value={input.targetFireAge}
          onChange={(v) => update({ targetFireAge: v })}
          min={input.currentAge} max={75} unit="歳"
        />

        {/* FIRE開始希望年齢時点で目標資産未達の場合の警告 */}
        {assetReachedAge !== undefined && assetReachedAge !== null && assetReachedAge > input.targetFireAge && (
          <div className="target-warning">
            ⚠️ {input.targetFireAge}歳時点では目標資産（{input.targetAsset.toLocaleString()}万円）に届きません。
            <br />
            目標到達は <strong>{assetReachedAge}歳</strong> になります。
          </div>
        )}
        {assetReachedAge === null && (
          <div className="target-warning">
            ⚠️ 現状のペースでは目標資産（{input.targetAsset.toLocaleString()}万円）に到達できません。
            積立額や年利を見直してください。
          </div>
        )}

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
              title="4%ルールで自動計算（生活費 ÷ 4%）"
              onClick={() => update({ targetAsset: recommended4pct })}
            >
              4%ルール {recommended4pct.toLocaleString()}万
            </button>
          </div>
        </div>

        {/* 取り崩し率（自動表示） */}
        <div className="input-row info-row">
          <label className="input-label">取り崩し率（自動）</label>
          <span className={`info-value ${withdrawalRate > 4 ? 'info-value--warn' : 'info-value--neutral'}`}>
            {withdrawalRate.toFixed(2)}%
          </span>
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
        <NumInput
          label="受給開始年齢"
          value={input.pensionStartAge ?? PENSION_BASE_AGE}
          onChange={(v) => update({ pensionStartAge: v })}
          min={PENSION_MIN_AGE}
          max={PENSION_MAX_AGE}
          step={1}
          unit="歳"
        />

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

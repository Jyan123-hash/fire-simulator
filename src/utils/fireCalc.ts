export interface AccumulationStep {
  startAge: number;
  endAge: number | null; // null = FIRE達成まで
  monthlyAmount: number; // 万円
}

export interface FireInput {
  currentAge: number;
  currentInvestment: number;        // 現在の投資額（万円）
  currentCash: number;              // 現在の現金（万円）
  dcCurrentAmount: number;          // 企業型DC 現在の投資額（万円）
  dcMonthlyContribution: number;    // 企業型DC 毎月積立額（万円）
  annualRate: number;               // %
  steps: AccumulationStep[];
  withdrawalRate: number;           // % ← 推奨FIRE目標額の表示計算のみ
  annualExpenses: number;           // 万円/年
  targetAsset: number;              // FIRE目標資産額（万円）手動入力
  postFireMonthlyInvestment: number;    // FIRE後〜年金受給前の毎月積立（万円）
  postPensionMonthlyInvestment: number; // 年金受給後の毎月積立（万円）
  startWorkAge: number;             // 就労開始年齢
  averageAnnualSalary: number;      // 厚生年金計算用 平均年収（万円/年）
  pensionStartAge: number;          // 年金受給開始年齢（60〜75）
}

export interface PensionInfo {
  basicPension: number;        // 老齢基礎年金（調整後）万円/年
  employeePension: number;     // 老齢厚生年金（調整後）万円/年
  totalAnnualPension: number;  // 合計（調整後）万円/年
  monthlyPension: number;      // 月額（調整後）万円/月
  baseAnnualPension: number;   // 65歳基準（調整前）合計 万円/年
  adjustmentRate: number;      // 繰り上げ/繰り下げ調整率（1.0 = 65歳基準）
  pensionStartAge: number;     // 受給開始年齢
  employeeMonths: number;      // 厚生年金加入月数
}

export interface YearlySnapshot {
  age: number;
  totalAsset: number;
  investmentPart: number;
  cashPart: number;
  dcPart: number;
  accumulatedPart: number;
  isFire: boolean;
  isWithdrawal: boolean;
}

export interface FireResult {
  fireAge: number | null;
  fireAsset: number | null;
  assetLifeAge: number | null;
  targetAsset: number;
  snapshots: YearlySnapshot[];
  pension: PensionInfo;
}

// ── 年金受給調整率 ────────────────────────────────────────────────────
// 出典: 厚生労働省「老齢年金の繰下げ受給と繰上げ受給」
//   繰り上げ: -0.4%/月（60〜64歳）最大 -24%  ※1962年4月2日以降生まれ
//   繰り下げ: +0.7%/月（66〜75歳）最大 +84%
//   https://www.mhlw.go.jp/stf/nenkin_shikumi_011.html
export const DC_AVAILABLE_AGE = 60;   // DC引き出し可能年齢
export const PENSION_MIN_AGE = 60;
export const PENSION_MAX_AGE = 75;
export const PENSION_BASE_AGE = 65;
export const PENSION_EARLY_RATE  = 0.004; // 0.4%/月
export const PENSION_DEFERRED_RATE = 0.007; // 0.7%/月

export function calcPensionAdjustmentRate(pensionStartAge: number): number {
  const clampedAge = Math.max(PENSION_MIN_AGE, Math.min(PENSION_MAX_AGE, pensionStartAge));
  const monthsDiff = (clampedAge - PENSION_BASE_AGE) * 12;
  if (monthsDiff < 0) return 1 - PENSION_EARLY_RATE * Math.abs(monthsDiff);
  if (monthsDiff > 0) return 1 + PENSION_DEFERRED_RATE * monthsDiff;
  return 1.0;
}

// ── 年金計算 ─────────────────────────────────────────────────────────
function calcPensionInternal(
  averageAnnualSalary: number,
  startWorkAge: number,
  fireAge: number,
  pensionStartAge: number
): PensionInfo {
  // 厚生年金加入月数（就労開始〜FIRE時 or 65歳まで）
  const employeeMonths = Math.max(0, (Math.min(fireAge, PENSION_BASE_AGE) - startWorkAge) * 12);

  // 国民年金合計加入月数（就労開始〜65歳、上限480月）
  const totalPensionMonths = Math.min(480, (PENSION_BASE_AGE - startWorkAge) * 12);

  // 老齢基礎年金（2024年度満額 81.6万円/年）65歳基準
  const basicPensionBase = 81.6 * Math.min(480, totalPensionMonths) / 480;

  // 老齢厚生年金 = 平均標準報酬月額 × 5.481/1000 × 加入月数 65歳基準
  const avgMonthlyRemuneration = averageAnnualSalary / 12;
  const employeePensionBase = avgMonthlyRemuneration * (5.481 / 1000) * employeeMonths;

  const baseAnnualPension = basicPensionBase + employeePensionBase;

  // 繰り上げ/繰り下げ調整
  const adjustmentRate = calcPensionAdjustmentRate(pensionStartAge);
  const totalAnnualPension = baseAnnualPension * adjustmentRate;

  return {
    basicPension:       basicPensionBase    * adjustmentRate,
    employeePension:    employeePensionBase * adjustmentRate,
    totalAnnualPension,
    monthlyPension:     totalAnnualPension / 12,
    baseAnnualPension,
    adjustmentRate,
    pensionStartAge,
    employeeMonths,
  };
}

// ── FIRE計算 ──────────────────────────────────────────────────────────
export function calcFire(input: FireInput): FireResult {
  const {
    currentAge,
    currentInvestment,
    currentCash,
    dcCurrentAmount,
    dcMonthlyContribution,
    annualRate,
    steps,
    annualExpenses,
    targetAsset,
    postFireMonthlyInvestment,
    postPensionMonthlyInvestment,
    startWorkAge,
    averageAnnualSalary,
    pensionStartAge,
  } = input;

  const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  const simEndAge   = Math.min(Math.max(currentAge + 65, 101), 105);

  const sortedSteps = [...steps].sort((a, b) => a.startAge - b.startAge);

  function getMonthlyContribution(age: number): number {
    let amount = 0;
    for (const s of sortedSteps) {
      const withinEnd = s.endAge === null || age < s.endAge;
      if (age >= s.startAge && withinEnd) amount = s.monthlyAmount;
    }
    return amount;
  }

  // ── Phase 1: fireAge を特定 ───────────────────────────────────────
  let fireAge: number | null = null;
  let fireAsset: number | null = null;
  {
    let inv  = currentInvestment;
    const cash = currentCash;
    let dc   = dcCurrentAmount;

    for (let yr = currentAge; yr < simEndAge; yr++) {
      const contrib = getMonthlyContribution(yr);
      for (let m = 0; m < 12; m++) {
        inv  += contrib;           // 積立を投資に統合
        dc   += dcMonthlyContribution;
        inv  *= 1 + monthlyRate;
        dc   *= 1 + monthlyRate;
      }
      const total = inv + cash + dc;
      if (total >= targetAsset && fireAge === null) {
        fireAge   = yr + 1;
        fireAsset = total;
      }
    }
  }

  // ── 年金計算（fireAge確定後） ─────────────────────────────────────
  const effectiveFireAge = fireAge ?? simEndAge;
  const pension = calcPensionInternal(
    averageAnnualSalary, startWorkAge, effectiveFireAge, pensionStartAge
  );

  // ── Phase 2: クリーンシミュレーション ────────────────────────────
  const snapshots: YearlySnapshot[] = [];
  let assetLifeAge: number | null = null;

  let inv  = currentInvestment;
  let cash = currentCash;
  let dc   = dcCurrentAmount;
  let inWithdrawal = false;

  for (let yr = currentAge; yr < simEndAge; yr++) {
    if (!inWithdrawal) {
      // 積立フェーズ（積立額は投資に統合）
      const contrib = getMonthlyContribution(yr);
      for (let m = 0; m < 12; m++) {
        inv  += contrib;
        dc   += dcMonthlyContribution;
        inv  *= 1 + monthlyRate;
        dc   *= 1 + monthlyRate;
      }
      const total = inv + cash + dc;
      if (fireAge !== null && yr + 1 >= fireAge) inWithdrawal = true;

      snapshots.push({
        age: yr + 1, totalAsset: total,
        investmentPart: inv, cashPart: cash, dcPart: dc, accumulatedPart: 0,
        isFire: inWithdrawal, isWithdrawal: inWithdrawal,
      });
    } else {
      // 取り崩しフェーズ
      const ageAtEnd = yr + 1;
      const pensionActive = ageAtEnd >= pension.pensionStartAge;
      const monthlyPensionIncome = pensionActive ? pension.monthlyPension : 0;
      const monthlyContrib = pensionActive
        ? postPensionMonthlyInvestment
        : postFireMonthlyInvestment;

      // DC は60歳から引き出し可能
      const dcUnlocked = ageAtEnd >= 60;

      for (let m = 0; m < 12; m++) {
        inv  += monthlyContrib;   // FIRE後積立も投資に統合
        inv  *= 1 + monthlyRate;
        dc   *= 1 + monthlyRate;

        // 引き出し可能な資産（DCは60歳未満は除外）
        const liquidNow = inv + cash + (dcUnlocked ? dc : 0);

        // 取り崩し額 = 年間生活費 ÷ 12 - 年金収入
        const monthlyFromAssets = Math.max(0, annualExpenses / 12 - monthlyPensionIncome);

        if (liquidNow > 0 && monthlyFromAssets > 0) {
          const withdrawal = Math.min(liquidNow, monthlyFromAssets);
          const ratio = withdrawal / liquidNow;
          inv  -= inv  * ratio;
          cash -= cash * ratio;
          if (dcUnlocked) dc -= dc * ratio;
          if (inv  < 0) inv  = 0;
          if (cash < 0) cash = 0;
          if (dc   < 0) dc   = 0;
        }
      }

      const total = inv + cash + dc;
      if (total <= 0 && assetLifeAge === null) assetLifeAge = yr + 1;

      snapshots.push({
        age: yr + 1,
        totalAsset:      Math.max(0, total),
        investmentPart:  Math.max(0, inv),
        cashPart:        Math.max(0, cash),
        dcPart:          Math.max(0, dc),
        accumulatedPart: 0,
        isFire: true, isWithdrawal: true,
      });
    }
  }

  return { fireAge, fireAsset, assetLifeAge, targetAsset, snapshots, pension };
}

// ── Die with Zero：100歳で資産ゼロになる必要FIRE目標資産額 ──────────────────────
// シミュレーションベースの二分探索で算出。
// targetAsset を変化させながら calcFire を繰り返し呼び出し、
// 「100歳時点で資産が残る（≥0）」になる最小の targetAsset を求める。
// DC60歳ロック・比例取り崩し・積立ステップ・年金など
// すべての入力パラメータを正確に反映する。
//
// FIRE年齢は離散（年単位）なため「ちょうど0」には一般にならない。
// ここでは「100歳まで資産が尽きない最小の目標額」を返す。
// hi はクロスオーバーの直上に収束するため Math.ceil で100万単位に繰り上げ、
// 確実に100歳まで資産が持つ目標額を返す。
export function calcDieWithZeroTarget(input: FireInput): number {
  const TARGET_AGE = 100;

  let lo = 0;
  let hi = 1_000_000; // 10億円 上限

  for (let i = 0; i < 52; i++) {
    const mid = (lo + hi) / 2;
    const result = calcFire({ ...input, targetAsset: mid });
    const snap = result.snapshots.find((s) => s.age === TARGET_AGE);
    // snap が存在しない場合（simEndAge < 100 等）は 0 として扱う
    const assetAt100 = snap?.totalAsset ?? 0;

    if (assetAt100 > 0) {
      // 100歳時点でプラス → 目標を下げてFIREを早める（取り崩し期間を延ばす）
      hi = mid;
    } else {
      // 100歳時点でゼロ以下 → 目標を上げてFIREを遅らせる（取り崩し元本を増やす）
      lo = mid;
    }
  }

  // hi はクロスオーバー直上に収束している。
  // Math.ceil で100万単位に繰り上げることで、確実に100歳超まで資産が持つ最小目標額を返す。
  return Math.ceil(hi / 100) * 100;
}

export function formatAsset(man: number): string {
  if (man >= 10000) {
    const oku = man / 10000;
    return oku % 1 === 0 ? `${oku}億円` : `${oku.toFixed(1)}億円`;
  }
  return `${Math.round(man).toLocaleString()}万円`;
}

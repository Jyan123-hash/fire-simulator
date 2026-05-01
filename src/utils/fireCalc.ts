export interface AccumulationStep {
  startAge: number;
  endAge: number | null; // null = FIRE達成まで
  monthlyAmount: number; // 万円
}

export interface FireInput {
  currentAge: number;
  currentInvestment: number;        // 現在の投資額（万円）
  currentCash: number;              // 現在の現金（万円）固定・利回りなし
  dcCurrentAmount: number;          // 企業型DC 現在の投資額（万円）
  dcMonthlyContribution: number;    // 企業型DC 毎月積立額（万円）
  idecoCurrentAmount: number;       // iDeCo 現在の評価額（万円）
  idecoMonthlyContribution: number; // iDeCo 毎月積立額（万円）
  annualRate: number;               // 年利 %
  steps: AccumulationStep[];
  annualExpenses: number;           // 年間生活費（万円）固定
  targetAsset: number;              // FIRE目標資産額（万円）手動入力
  targetFireAge: number;            // FIRE開始希望年齢（手動入力）
  postFireMonthlyInvestment: number;     // FIRE後〜年金受給前の毎月積立（万円）
  postPensionMonthlyInvestment: number;  // 年金受給後の毎月積立（万円）
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
  // 各資産の合計値
  investmentPart: number;
  cashPart: number;
  dcPart: number;
  idecoPart: number;
  // 元本（拠出済み）と運用益（複利成長分）の内訳
  investmentPrincipal: number;
  investmentGains: number;
  dcPrincipal: number;
  dcGains: number;
  idecoPrincipal: number;
  idecoGains: number;
  accumulatedPart: number;
  isFire: boolean;
  isWithdrawal: boolean;
}

export interface FireResult {
  fireAge: number | null;          // 実際のFIRE開始年齢 = max(assetReachedAge, targetFireAge)
  fireAsset: number | null;        // FIRE開始時点の資産
  assetReachedAge: number | null;  // 目標資産に到達する年齢（targetFireAge無視）
  assetLifeAge: number | null;
  targetAsset: number;
  withdrawalRate: number;          // 自動計算 annualExpenses / targetAsset * 100
  snapshots: YearlySnapshot[];
  pension: PensionInfo;
}

// ── 年金受給調整率 ────────────────────────────────────────────────────
// 出典: 厚生労働省「老齢年金の繰下げ受給と繰上げ受給」
//   繰り上げ: -0.4%/月（60〜64歳）最大 -24%  ※1962年4月2日以降生まれ
//   繰り下げ: +0.7%/月（66〜75歳）最大 +84%
export const DC_AVAILABLE_AGE = 60;   // DC・iDeCo引き出し可能年齢
export const PENSION_MIN_AGE = 60;
export const PENSION_MAX_AGE = 75;
export const PENSION_BASE_AGE = 65;
export const PENSION_EARLY_RATE    = 0.004; // 0.4%/月
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
    basicPension:    basicPensionBase    * adjustmentRate,
    employeePension: employeePensionBase * adjustmentRate,
    totalAnnualPension,
    monthlyPension:  totalAnnualPension / 12,
    baseAnnualPension,
    adjustmentRate,
    pensionStartAge,
    employeeMonths,
  };
}

// ── FIRE計算 ──────────────────────────────────────────────────────────
//
// 設計方針:
//   積立フェーズ: 現在〜FIRE達成まで。投資・DC・iDeCoを複利積立。現金は固定。
//   FIRE判定: 投資 + 現金 + DC + iDeCo の合計が targetAsset に到達した年齢。
//
//   取り崩しフェーズ:
//     流動資産 = 投資 + 現金（60歳未満）/ 投資 + 現金 + DC + iDeCo（60歳以降）
//     月次取り崩し額:
//       年金受給前: annualExpenses / 12（全額を資産から）
//       年金受給後: max(0, annualExpenses/12 − 年金月額)（年金で差額充当）
//     取り崩しは流動資産を比率按分。
//     FIRE後の積立（postFireMonthlyInvestment 等）は inv に加算。
//
export function calcFire(input: FireInput): FireResult {
  const {
    currentAge,
    currentInvestment,
    currentCash,
    dcCurrentAmount,
    dcMonthlyContribution,
    idecoCurrentAmount,
    idecoMonthlyContribution,
    annualRate,
    steps,
    annualExpenses,
    targetAsset,
    targetFireAge,
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

  // ── Phase 1: 目標資産到達年齢を特定 ───────────────────────────────
  // 投資 + 現金 + DC + iDeCo の合計が targetAsset 以上になった年齢
  let assetReachedAge: number | null = null;
  {
    let inv   = currentInvestment;
    const cash = currentCash;
    let dc    = dcCurrentAmount;
    let ideco = idecoCurrentAmount;

    for (let yr = currentAge; yr < simEndAge; yr++) {
      const contrib = getMonthlyContribution(yr);
      for (let m = 0; m < 12; m++) {
        inv   += contrib;
        dc    += dcMonthlyContribution;
        ideco += idecoMonthlyContribution;
        inv   *= 1 + monthlyRate;
        dc    *= 1 + monthlyRate;
        ideco *= 1 + monthlyRate;
      }
      const total = inv + cash + dc + ideco;
      if (total >= targetAsset && assetReachedAge === null) {
        assetReachedAge = yr + 1;
      }
    }
  }

  // 実際のFIRE開始年齢 = max(目標資産到達年齢, 指定FIRE年齢)
  // ・目標未達なら fireAge = null（永久にFIREできない）
  // ・目標達成済みなら指定年齢まで待機（早期達成しても指定年齢でFIRE）
  const fireAge: number | null =
    assetReachedAge !== null ? Math.max(assetReachedAge, targetFireAge) : null;
  let fireAsset: number | null = null;

  // ── 年金計算（fireAge確定後） ─────────────────────────────────────
  const effectiveFireAge = fireAge ?? simEndAge;
  const pension = calcPensionInternal(
    averageAnnualSalary, startWorkAge, effectiveFireAge, pensionStartAge
  );

  // ── Phase 2: クリーンシミュレーション ────────────────────────────
  // 各資産について「合計値」と「元本（拠出済み）」を別途追跡。
  // 元本: 初期評価額 + 拠出累計（出金時に比率按分で減少）
  // 運用益 = 合計値 - 元本（複利成長分）
  // 取り崩し時は合計値の比率と同じ比率で元本を減らす（元本/運用益の比率を維持）
  const snapshots: YearlySnapshot[] = [];
  let assetLifeAge: number | null = null;

  let inv          = currentInvestment;
  let invPrincipal = currentInvestment;
  let cash         = currentCash; // 利回りなし → 全て元本
  let dc           = dcCurrentAmount;
  let dcPrincipal  = dcCurrentAmount;
  let ideco        = idecoCurrentAmount;
  let idecoPrincipal = idecoCurrentAmount;
  let inWithdrawal = false;

  for (let yr = currentAge; yr < simEndAge; yr++) {
    if (!inWithdrawal) {
      // ── 積立フェーズ ──
      const contrib = getMonthlyContribution(yr);
      for (let m = 0; m < 12; m++) {
        inv            += contrib;
        invPrincipal   += contrib;
        dc             += dcMonthlyContribution;
        dcPrincipal    += dcMonthlyContribution;
        ideco          += idecoMonthlyContribution;
        idecoPrincipal += idecoMonthlyContribution;
        // 複利成長（元本は変えない）
        inv   *= 1 + monthlyRate;
        dc    *= 1 + monthlyRate;
        ideco *= 1 + monthlyRate;
      }
      const total = inv + cash + dc + ideco;
      if (fireAge !== null && yr + 1 >= fireAge) {
        if (!inWithdrawal) fireAsset = total;
        inWithdrawal = true;
      }

      snapshots.push({
        age: yr + 1, totalAsset: total,
        investmentPart: inv, cashPart: cash, dcPart: dc, idecoPart: ideco,
        investmentPrincipal: invPrincipal,
        investmentGains:     Math.max(0, inv - invPrincipal),
        dcPrincipal,
        dcGains:             Math.max(0, dc - dcPrincipal),
        idecoPrincipal,
        idecoGains:          Math.max(0, ideco - idecoPrincipal),
        accumulatedPart: 0,
        isFire: inWithdrawal, isWithdrawal: inWithdrawal,
      });
    } else {
      // ── 取り崩しフェーズ ──
      const ageAtEnd = yr + 1;
      const pensionActive  = ageAtEnd >= pension.pensionStartAge;
      const dcUnlocked     = ageAtEnd >= DC_AVAILABLE_AGE;

      const monthlyContrib = pensionActive
        ? postPensionMonthlyInvestment
        : postFireMonthlyInvestment;

      const monthlyWithdrawal = pensionActive
        ? Math.max(0, annualExpenses / 12 - pension.monthlyPension)
        : annualExpenses / 12;

      for (let m = 0; m < 12; m++) {
        inv          += monthlyContrib;
        invPrincipal += monthlyContrib;
        inv   *= 1 + monthlyRate;
        dc    *= 1 + monthlyRate;
        ideco *= 1 + monthlyRate;

        const liquidNow = inv + cash + (dcUnlocked ? dc + ideco : 0);

        if (liquidNow > 0 && monthlyWithdrawal > 0) {
          const withdrawal = Math.min(liquidNow, monthlyWithdrawal);
          const ratio      = withdrawal / liquidNow;
          // 合計値と元本を同じ比率で減らす（元本/運用益の構成比を維持）
          inv          -= inv          * ratio;
          invPrincipal -= invPrincipal * ratio;
          cash         -= cash         * ratio;
          if (dcUnlocked) {
            dc             -= dc             * ratio;
            dcPrincipal    -= dcPrincipal    * ratio;
            ideco          -= ideco          * ratio;
            idecoPrincipal -= idecoPrincipal * ratio;
          }
          if (inv            < 0) inv            = 0;
          if (invPrincipal   < 0) invPrincipal   = 0;
          if (cash           < 0) cash           = 0;
          if (dc             < 0) dc             = 0;
          if (dcPrincipal    < 0) dcPrincipal    = 0;
          if (ideco          < 0) ideco          = 0;
          if (idecoPrincipal < 0) idecoPrincipal = 0;
        }
      }

      const total = inv + cash + dc + ideco;
      if (total <= 0 && assetLifeAge === null) assetLifeAge = yr + 1;

      snapshots.push({
        age: yr + 1,
        totalAsset:     Math.max(0, total),
        investmentPart: Math.max(0, inv),
        cashPart:       Math.max(0, cash),
        dcPart:         Math.max(0, dc),
        idecoPart:      Math.max(0, ideco),
        investmentPrincipal: Math.max(0, invPrincipal),
        investmentGains:     Math.max(0, inv - invPrincipal),
        dcPrincipal:         Math.max(0, dcPrincipal),
        dcGains:             Math.max(0, dc - dcPrincipal),
        idecoPrincipal:      Math.max(0, idecoPrincipal),
        idecoGains:          Math.max(0, ideco - idecoPrincipal),
        accumulatedPart: 0,
        isFire: true, isWithdrawal: true,
      });
    }
  }

  const withdrawalRate = targetAsset > 0 ? (annualExpenses / targetAsset) * 100 : 0;

  return {
    fireAge, fireAsset, assetReachedAge, assetLifeAge,
    targetAsset, withdrawalRate, snapshots, pension,
  };
}

export function formatAsset(man: number): string {
  if (man >= 10000) {
    const oku = man / 10000;
    return oku % 1 === 0 ? `${oku}億円` : `${oku.toFixed(1)}億円`;
  }
  return `${Math.round(man).toLocaleString()}万円`;
}

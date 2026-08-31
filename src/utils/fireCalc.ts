export interface AccumulationStep {
  startAge: number;
  endAge: number | null; // null = FIRE達成まで
  monthlyAmount: number; // 万円
}

export interface SpotContribution {
  year: number;   // 西暦
  month: number;  // 1-12
  amount: number; // 万円（投資へ一括追加）
}

export interface FireInput {
  currentAge: number;               // birthDate 未入力時のフォールバック
  birthDate: string;                // YYYY-MM-DD（空文字なら currentAge を使用）
  spotContributions: SpotContribution[]; // スポットでの追加投資
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
  targetFireAge: number;            // 積立を停止する年齢（FIRE年齢）
  withdrawalStartAge: number;       // 取り崩し開始年齢
  withdrawalStartMonth: number;     // 取り崩し開始月（1-12）
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
  isFire: boolean;        // 積立停止済み（FIRE後）
  isWithdrawal: boolean;  // 取り崩しが始まっている
}

export interface FireResult {
  fireAge: number | null;          // 実際のFIRE開始年齢 = max(assetReachedAge, targetFireAge)
  fireAsset: number | null;        // FIRE開始時点の資産
  assetReachedAge: number | null;  // 目標資産に到達する年齢（targetFireAge無視）
  withdrawalStartAge: number | null; // 実際に取り崩しが始まる年齢
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

// ── 生年月日から年齢を算出 ────────────────────────────────────────
// birthDate は "YYYY-MM-DD"。誕生日を迎えていなければ 1 引く。
export function calcAgeFromBirthDate(birthDate: string, today: Date = new Date()): number | null {
  const parts = (birthDate ?? '').split('-');
  if (parts.length !== 3) return null;
  const [y, mo, d] = parts.map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let age = today.getFullYear() - y;
  const nowMo = today.getMonth() + 1;
  if (nowMo < mo || (nowMo === mo && today.getDate() < d)) age--;
  return age >= 0 && age < 130 ? age : null;
}

// birthDate があればそこから、無ければ currentAge をそのまま使う
export function resolveCurrentAge(input: FireInput, today: Date = new Date()): number {
  const fromBirth = input.birthDate ? calcAgeFromBirthDate(input.birthDate, today) : null;
  return fromBirth ?? input.currentAge;
}

// ── 取り崩し開始タイミングの解決 ──────────────────────────────────
// 「N歳のMヶ月目から」を、シミュレーション開始（今月＝index 0）からの経過月に変換する。
// シミュレーションの年齢は今日を起点に12ヶ月刻みで進むため、暦月ではなく
// 「その年齢に入ってから何ヶ月目か」で指定する。暦年月は目安として併記する。
export interface WithdrawalStart {
  offset: number;        // シミュレーション開始からの経過月
  calendarYear: number;  // 解決された暦年
  calendarMonth: number; // 解決された月（1-12）
}

export function resolveWithdrawalStart(
  input: FireInput,
  today: Date = new Date()
): WithdrawalStart {
  const currentAge = resolveCurrentAge(input, today);
  const nowYear    = today.getFullYear();
  const nowMonth   = today.getMonth() + 1;

  // 1 = その年齢になった月、12 = その年齢の最後の月
  const month  = Math.min(12, Math.max(1, input.withdrawalStartMonth || 1));
  const offset = (input.withdrawalStartAge - currentAge) * 12 + (month - 1);
  const abs = nowYear * 12 + (nowMonth - 1) + offset;
  return {
    offset,
    calendarYear: Math.floor(abs / 12),
    calendarMonth: (abs % 12) + 1,
  };
}

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
//   移行フェーズ: 積立停止（FIRE）〜取り崩し開始まで。積立も取り崩しもせず運用のみ。
//     （postFireMonthlyInvestment を入れればセミリタイア中の収入も表現できる）
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

  // 年齢は生年月日から自動算出（未入力なら currentAge をフォールバック）
  const currentAge  = resolveCurrentAge(input);
  const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  const simEndAge   = Math.min(Math.max(currentAge + 65, 101), 105);

  const sortedSteps = [...steps].sort((a, b) => a.startAge - b.startAge);

  // ── スポット追加をシミュレーション開始からの経過月インデックスに変換 ──
  // シミュレーションは「今月」を起点に (yr - currentAge) * 12 + m 月目として進む。
  // 過去の月・シミュレーション期間外の指定は無視する。
  const now       = new Date();
  const nowYear   = now.getFullYear();
  const nowMonth  = now.getMonth() + 1;
  const totalMonths = (simEndAge - currentAge) * 12;
  const spotByMonth = new Map<number, number>();
  for (const sp of input.spotContributions ?? []) {
    if (!sp || !sp.amount) continue;
    const offset = (sp.year - nowYear) * 12 + (sp.month - nowMonth);
    if (offset < 0 || offset >= totalMonths) continue;
    spotByMonth.set(offset, (spotByMonth.get(offset) ?? 0) + sp.amount);
  }
  const spotAt = (yr: number, m: number): number =>
    spotByMonth.get((yr - currentAge) * 12 + m) ?? 0;

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
        inv   += contrib + spotAt(yr, m);
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

  // ── 取り崩し開始タイミング ────────────────────────────────────────
  // 「N歳のM月から」をシミュレーション開始からの経過月に変換する。
  // 積立停止（FIRE）より前には取り崩さないため、FIRE時点を下限としてクランプする。
  const fireStartOffset = fireAge !== null ? (fireAge - currentAge) * 12 : Infinity;
  const wdStartOffset = Math.max(fireStartOffset, resolveWithdrawalStart(input, now).offset, 0);

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
  let actualWithdrawalStartAge: number | null = null;

  for (let yr = currentAge; yr < simEndAge; yr++) {
    if (!inWithdrawal) {
      // ── 積立フェーズ ──
      const contrib = getMonthlyContribution(yr);
      for (let m = 0; m < 12; m++) {
        const spot = spotAt(yr, m);
        inv            += contrib + spot;
        invPrincipal   += contrib + spot;
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
      // ── FIRE後（移行フェーズ + 取り崩しフェーズ）──
      // 取り崩しは wdStartOffset 月目から始まる。それ以前は積立も取り崩しもせず運用のみ。
      const ageAtEnd = yr + 1;
      const pensionActive  = ageAtEnd >= pension.pensionStartAge;
      const dcUnlocked     = ageAtEnd >= DC_AVAILABLE_AGE;

      const monthlyContrib = pensionActive
        ? postPensionMonthlyInvestment
        : postFireMonthlyInvestment;

      const baseWithdrawal = pensionActive
        ? Math.max(0, annualExpenses / 12 - pension.monthlyPension)
        : annualExpenses / 12;

      let withdrewThisYear = false;

      for (let m = 0; m < 12; m++) {
        const monthIdx  = (yr - currentAge) * 12 + m;
        const withdrawing = monthIdx >= wdStartOffset;
        const monthlyWithdrawal = withdrawing ? baseWithdrawal : 0;
        if (withdrawing) {
          withdrewThisYear = true;
          // シミュレーション年 yr は「yr歳〜yr+1歳」を表すので、開始年齢は yr
          if (actualWithdrawalStartAge === null) actualWithdrawalStartAge = yr;
        }

        const spot = spotAt(yr, m);
        inv          += monthlyContrib + spot;
        invPrincipal += monthlyContrib + spot;
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
        isFire: true, isWithdrawal: withdrewThisYear,
      });
    }
  }

  const withdrawalRate = targetAsset > 0 ? (annualExpenses / targetAsset) * 100 : 0;

  return {
    fireAge, fireAsset, assetReachedAge,
    withdrawalStartAge: actualWithdrawalStartAge,
    assetLifeAge,
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

// 表・カード向けの短い表記（単位は「万」「億」）
export function formatAssetShort(man: number): string {
  const abs = Math.abs(man);
  const sign = man < 0 ? '−' : '';
  if (!Number.isFinite(man)) return '—';
  if (abs >= 100_000_000) {
    return `${sign}${(abs / 100_000_000).toFixed(1)}兆`;
  }
  if (abs >= 10000) {
    const oku = abs / 10000;
    return `${sign}${oku.toFixed(1)}億`;
  }
  return `${sign}${Math.round(abs).toLocaleString()}万`;
}

// ── 年ごとの運用益（複利で増えた額）内訳 ────────────────────────────
export type GainPhase = 'accumulation' | 'transition' | 'withdrawal' | 'pension';

export interface YearlyGain {
  age: number;
  phase: GainPhase;
  isFireYear: boolean;
  totalAsset: number;
  principal: number;      // 元本（現金含む）
  cumulativeGains: number; // 累計運用益
  yearlyGain: number;      // その年の運用益増減（前年差）
}

export interface GainsSummary {
  rows: YearlyGain[];
  fireCumulativeGains: number;   // FIRE時点（未達なら最終年）の累計運用益
  accumulationAvgGain: number;   // 積立期の年平均運用益
  multipleOfPrincipal: number;   // FIRE時点の 総資産 ÷ 元本
  referenceAge: number;          // 上記3指標の基準年齢
}

export function calcYearlyGains(result: FireResult): GainsSummary {
  const { snapshots, fireAge, pension, assetLifeAge } = result;

  // 資産が尽きた年以降は全て0が並ぶだけなので、その年で打ち切る
  const visible =
    assetLifeAge !== null
      ? snapshots.filter((s) => s.age <= assetLifeAge)
      : snapshots;

  const rows: YearlyGain[] = [];
  let prevCumulative = 0;

  for (const s of visible) {
    const cumulativeGains = s.investmentGains + s.dcGains + s.idecoGains;
    const principal =
      s.investmentPrincipal + s.cashPart + s.dcPrincipal + s.idecoPrincipal;

    // 積立中 → 積立停止後で取り崩し前 → 取り崩し中 → 年金受給後
    const phase: GainPhase = !s.isFire
      ? 'accumulation'
      : !s.isWithdrawal
      ? 'transition'
      : s.age >= pension.pensionStartAge
      ? 'pension'
      : 'withdrawal';

    rows.push({
      age: s.age,
      phase,
      isFireYear: fireAge !== null && s.age === fireAge,
      totalAsset: s.totalAsset,
      principal,
      cumulativeGains,
      yearlyGain: cumulativeGains - prevCumulative,
    });

    prevCumulative = cumulativeGains;
  }

  // 基準年齢: FIRE到達年。未達なら最終年。
  const refRow =
    (fireAge !== null ? rows.find((r) => r.age === fireAge) : undefined) ??
    rows[rows.length - 1];

  const accumulationRows = rows.filter((r) => r.phase === 'accumulation');
  const accumulationAvgGain =
    accumulationRows.length > 0
      ? accumulationRows.reduce((sum, r) => sum + r.yearlyGain, 0) / accumulationRows.length
      : 0;

  return {
    rows,
    fireCumulativeGains: refRow?.cumulativeGains ?? 0,
    accumulationAvgGain,
    multipleOfPrincipal:
      refRow && refRow.principal > 0 ? refRow.totalAsset / refRow.principal : 0,
    referenceAge: refRow?.age ?? 0,
  };
}

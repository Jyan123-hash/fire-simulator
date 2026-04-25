// J-FLEC 家計の金融行動に関する世論調査（2024年）の年代別・金融資産分布データ
// ブラケット上限（万円）: [0, 100, 200, 300, 400, 500, 700, 1000, 1500, 2000, 3000, ∞]
const BRACKETS = [0, 100, 200, 300, 400, 500, 700, 1000, 1500, 2000, 3000, Infinity];

const SINGLE_DIST: Record<number, number[]> = {
  20: [36.6, 26.3, 9.5, 4.9, 4.8, 2.4, 4.6, 4.0, 2.4, 0.4, 0.4, 0.0],
  30: [33.4, 15.3, 8.3, 5.8, 5.2, 2.5, 6.1, 8.0, 4.3, 2.5, 2.8, 3.1],
  40: [33.3, 13.5, 7.3, 5.0, 4.5, 2.9, 6.5, 7.7, 5.4, 3.2, 4.0, 5.6],
  50: [40.2,  9.2, 5.6, 4.4, 2.6, 2.1, 5.3, 7.2, 6.7, 3.5, 4.5, 8.7],
  60: [27.7,  9.5, 5.8, 5.0, 3.4, 2.8, 6.7, 9.3, 8.5, 4.9, 7.2, 9.2],
};

const FAMILY_DIST: Record<number, number[]> = {
  20: [22.8, 23.4, 11.1, 5.3, 4.1, 6.4, 5.8, 4.1, 5.8, 0.6, 0.0, 2.3],
  30: [24.5, 13.1, 11.3, 7.6, 4.9, 3.1, 6.2, 7.3, 7.9, 3.5, 4.2, 2.8],
  40: [25.7, 10.3,  7.5, 5.4, 4.5, 3.1, 7.4, 8.8, 9.3, 5.4, 5.3, 7.3],
  50: [29.2,  7.5,  6.0, 4.8, 3.2, 2.4, 5.7, 7.4, 9.7, 6.0, 7.7, 10.4],
  60: [20.5,  5.6,  3.7, 3.2, 2.7, 2.0, 5.5, 8.2, 10.9, 7.4, 10.9, 19.4],
};

function getInterpolatedDist(age: number, isSingle: boolean): number[] {
  const dist = isSingle ? SINGLE_DIST : FAMILY_DIST;
  const ages = Object.keys(dist).map(Number).sort((a, b) => a - b);

  const clampedAge = Math.max(ages[0], Math.min(ages[ages.length - 1], age));

  // Find surrounding age brackets
  let lo = ages[0];
  let hi = ages[ages.length - 1];
  for (let i = 0; i < ages.length - 1; i++) {
    if (clampedAge >= ages[i] && clampedAge <= ages[i + 1]) {
      lo = ages[i];
      hi = ages[i + 1];
      break;
    }
  }

  if (lo === hi) return dist[lo];

  const t = (clampedAge - lo) / (hi - lo);
  return dist[lo].map((v, i) => v + t * (dist[hi][i] - v));
}

function normsinv(p: number): number {
  // Rational approximation for normal distribution inverse CDF (Abramowitz & Stegun)
  if (p <= 0) return -8;
  if (p >= 1) return 8;

  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

export function calcHensachi(
  savingsMan: number,
  age: number,
  isSingle: boolean
): number {
  const freqs = getInterpolatedDist(age, isSingle);
  const total = freqs.reduce((s, v) => s + v, 0);
  const normalized = freqs.map((v) => v / total);

  // Build cumulative distribution
  // bracket i covers (BRACKETS[i-1], BRACKETS[i]]
  // BRACKETS[0]=0 means the first bucket is "0万円以下" (金融資産なし)
  let cumulative = 0;
  let percentile = 0;

  for (let i = 0; i < normalized.length; i++) {
    const lower = i === 0 ? 0 : BRACKETS[i - 1];
    const upper = BRACKETS[i] === Infinity ? 5000 : BRACKETS[i];
    const freq = normalized[i];

    if (savingsMan <= lower) break;

    if (savingsMan >= upper) {
      cumulative += freq;
    } else {
      // Linear interpolation within bucket
      const frac = (savingsMan - lower) / (upper - lower);
      cumulative += freq * frac;
      percentile = cumulative * 100;
      break;
    }
    percentile = cumulative * 100;
  }

  percentile = Math.max(0.5, Math.min(99.5, percentile));
  return 50 + 10 * normsinv(percentile / 100);
}

export interface HensachiLevel {
  label: string;
  comment: string;
  color: string;
}

export function getLevel(hensachi: number): HensachiLevel {
  if (hensachi >= 70) return { label: '東大理三レベル', comment: 'もうFIREできるのでは？👑', color: '#ff4500' };
  if (hensachi >= 65) return { label: '東大レベル', comment: 'FIRE射程圏内🔥', color: '#ff6600' };
  if (hensachi >= 60) return { label: '早慶レベル', comment: 'かなりの資産家', color: '#ff8800' };
  if (hensachi >= 55) return { label: '関関同立レベル', comment: '同世代トップ層', color: '#ffaa00' };
  if (hensachi >= 50) return { label: 'MARCHレベル', comment: '優秀！このまま継続', color: '#ffcc00' };
  if (hensachi >= 40) return { label: '日東駒専レベル', comment: '平均的なペース、コツコツ継続！', color: '#88bb44' };
  return { label: '専門学校レベル', comment: 'まずは貯め始めよう', color: '#6699cc' };
}

import { FireResult, formatAsset } from '../utils/fireCalc';

interface Props {
  result: FireResult;
  currentAge: number;
}

export default function FireBanner({ result, currentAge }: Props) {
  const { fireAge, fireAsset, assetLifeAge, targetAsset } = result;

  const yearsLeft = fireAge !== null ? fireAge - currentAge : null;

  return (
    <div className="fire-banner">
      <div className="fire-banner-main">
        {fireAge !== null ? (
          <>
            <span className="fire-icon">🔥</span>
            <span className="fire-headline">
              FIRE達成まであと{' '}
              <strong>{yearsLeft}年</strong>
              {' '}（<strong>{fireAge}歳</strong>で達成！）
            </span>
          </>
        ) : (
          <>
            <span className="fire-icon">💭</span>
            <span className="fire-headline">
              現在の設定では<strong>シミュレーション期間内にFIRE未達成</strong>
            </span>
          </>
        )}
      </div>
      <div className="fire-banner-sub">
        <span className="fire-stat">
          目標資産：<strong>{formatAsset(targetAsset)}</strong>
        </span>
        {fireAsset !== null && (
          <span className="fire-stat">
            達成時資産：<strong>{formatAsset(fireAsset)}</strong>
          </span>
        )}
        <span className="fire-stat">
          資産寿命：
          <strong>
            {assetLifeAge === null
              ? '100歳超でも安心 ✨'
              : `${assetLifeAge}歳まで`}
          </strong>
        </span>
      </div>
    </div>
  );
}

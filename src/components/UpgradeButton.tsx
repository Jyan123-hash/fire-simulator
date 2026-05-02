import { useState } from 'react';
import { User } from 'firebase/auth';
import { Plan } from '../hooks/useFireSettings';

interface Props {
  user: User | null;
  plan: Plan;
  planLoading: boolean;
}

export default function UpgradeButton({ user, plan, planLoading }: Props) {
  const [loading, setLoading] = useState(false);

  if (!user || planLoading) return null;

  // Pro プラン利用中
  if (plan === 'pro') {
    return <span className="plan-badge plan-badge--pro">✅ Proプラン利用中</span>;
  }

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email ?? undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('checkout URL が取得できませんでした');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      alert(`決済セッション作成に失敗しました: ${msg}`);
      setLoading(false);
    }
  };

  return (
    <button
      className="upgrade-btn"
      onClick={handleUpgrade}
      disabled={loading}
      title="Proにアップグレードすると設定の自動保存・同期が有効になります"
    >
      {loading ? '処理中…' : '💎 Proにアップグレード（¥980/月）'}
    </button>
  );
}

import { useState, useMemo, useEffect, useRef } from 'react';
import { FireInput, calcFire, calcDieWithZeroTarget } from './utils/fireCalc';
import { useFireSettings } from './hooks/useFireSettings';
import FireBanner from './components/FireBanner';
import InputPanel from './components/InputPanel';
import FireChart from './components/FireChart';
import HensachiCard from './components/HensachiCard';
import PensionCard from './components/PensionCard';
import AuthButton from './components/AuthButton';

const DEFAULT_INPUT: FireInput = {
  currentAge: 30,
  currentInvestment: 150,
  currentCash: 50,
  dcCurrentAmount: 80,
  dcMonthlyContribution: 2,
  idecoCurrentAmount: 0,
  idecoMonthlyContribution: 0,
  annualRate: 5,
  steps: [
    { startAge: 30, endAge: 35, monthlyAmount: 5 },
    { startAge: 35, endAge: null, monthlyAmount: 10 },
  ],
  withdrawalRate: 4,
  annualExpenses: 300,
  targetAsset: 7500,
  postFireMonthlyInvestment: 0,
  postPensionMonthlyInvestment: 0,
  startWorkAge: 22,
  averageAnnualSalary: 500,
  pensionStartAge: 65,
};

export default function App() {
  const [input, setInput] = useState<FireInput>(DEFAULT_INPUT);
  const [isSingle, setIsSingle] = useState(true);
  const isFirstLogin = useRef(true);

  const { user, authLoading, saveStatus, login, logout, loadSettings, scheduleSave } =
    useFireSettings();

  // ログイン時にFirestoreから設定を読み込む
  useEffect(() => {
    if (!user) {
      isFirstLogin.current = true;
      return;
    }
    if (!isFirstLogin.current) return;
    isFirstLogin.current = false;

    loadSettings(user.uid).then((saved) => {
      if (saved) {
        setInput(saved.input);
        setIsSingle(saved.isSingle);
      }
    });
  }, [user, loadSettings]);

  // 設定変更時に自動保存（ログイン中のみ）
  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (!user) return;
    scheduleSave(user.uid, { input, isSingle });
  }, [input, isSingle, user, scheduleSave]);

  const result = useMemo(() => calcFire(input), [input]);

  const handleChange = (newInput: FireInput, newIsSingle: boolean) => {
    setInput(newInput);
    setIsSingle(newIsSingle);
  };

  const totalSavings =
    input.currentInvestment + input.currentCash + input.dcCurrentAmount + input.idecoCurrentAmount;

  // Die with Zero: 全入力パラメータを考慮したシミュレーションで100歳ゼロになるFIRE目標資産
  const dieWithZeroTarget = useMemo(() => calcDieWithZeroTarget(input), [input]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">🔥 FIREシミュレーター</h1>
        <p className="app-subtitle">Financial Independence, Retire Early</p>
        <div className="auth-area">
          <AuthButton
            user={user}
            authLoading={authLoading}
            saveStatus={saveStatus}
            onLogin={login}
            onLogout={logout}
          />
        </div>
      </header>

      <FireBanner result={result} currentAge={input.currentAge} />

      <main className="app-main">
        <div className="left-col">
          <InputPanel input={input} isSingle={isSingle} onChange={handleChange} dieWithZeroTarget={dieWithZeroTarget} />
          <HensachiCard
            savingsMan={totalSavings}
            age={input.currentAge}
            isSingle={isSingle}
          />
        </div>
        <div className="right-col">
          <FireChart result={result} />
          <PensionCard
            pension={result.pension}
            fireAge={result.fireAge}
            fireAsset={result.fireAsset}
            startWorkAge={input.startWorkAge}
            withdrawalRate={input.withdrawalRate}
          />
        </div>
      </main>

      <footer className="app-footer">
        <p>※ 本シミュレーターは教育目的です。実際の投資判断・年金試算は専門家にご相談ください。</p>
        <p>データ出典：J-FLEC 家計の金融行動に関する世論調査（2024年）</p>
      </footer>
    </div>
  );
}

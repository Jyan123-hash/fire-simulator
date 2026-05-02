import { useState, useEffect, useRef, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { FireInput } from '../utils/fireCalc';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type Plan = 'free' | 'pro';

export interface SavedData {
  input: FireInput;
  isSingle: boolean;
}

export function useFireSettings() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [plan, setPlan] = useState<Plan>('free');
  const [planLoading, setPlanLoading] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // ── plan を Firestore から読み込み ──
  const loadPlan = useCallback(async (uid: string): Promise<Plan> => {
    try {
      const ref = doc(db, 'users', uid);
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data()?.plan === 'pro') return 'pro';
    } catch {
      // Firestore 読み込み失敗時は free
    }
    return 'free';
  }, []);

  // ユーザー変化時に plan を再取得
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setPlan('free');
      setPlanLoading(false);
      return;
    }
    setPlanLoading(true);
    loadPlan(user.uid).then((p) => {
      if (!cancelled) {
        setPlan(p);
        setPlanLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, loadPlan]);

  // 決済成功後など、明示的に再取得したい時用
  const refreshPlan = useCallback(async () => {
    if (!user) return;
    setPlanLoading(true);
    const p = await loadPlan(user.uid);
    setPlan(p);
    setPlanLoading(false);
  }, [user, loadPlan]);

  const login = useCallback(() => signInWithPopup(auth, googleProvider), []);
  const logout = useCallback(() => signOut(auth), []);

  const loadSettings = useCallback(async (uid: string): Promise<SavedData | null> => {
    try {
      const ref = doc(db, 'users', uid, 'settings', 'current');
      const snap = await getDoc(ref);
      if (snap.exists()) return snap.data() as SavedData;
    } catch {
      // 読み込み失敗時はデフォルトを使用
    }
    return null;
  }, []);

  const saveNow = useCallback(async (uid: string, data: SavedData) => {
    setSaveStatus('saving');
    try {
      const ref = doc(db, 'users', uid, 'settings', 'current');
      await setDoc(ref, { ...data, updatedAt: new Date().toISOString() });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, []);

  // 1.5秒のデバウンスで自動保存
  // ★ Pro プランでないと保存しない（フリーミアム制限）
  const scheduleSave = useCallback(
    (uid: string, data: SavedData) => {
      if (plan !== 'pro') return; // free ユーザーは保存スキップ
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveStatus('saving');
      saveTimer.current = setTimeout(() => saveNow(uid, data), 1500);
    },
    [saveNow, plan],
  );

  return {
    user,
    authLoading,
    saveStatus,
    plan,
    planLoading,
    refreshPlan,
    login,
    logout,
    loadSettings,
    scheduleSave,
  };
}

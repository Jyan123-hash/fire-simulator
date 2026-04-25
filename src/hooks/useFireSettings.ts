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

export interface SavedData {
  input: FireInput;
  isSingle: boolean;
}

export function useFireSettings() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

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
  const scheduleSave = useCallback((uid: string, data: SavedData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(() => saveNow(uid, data), 1500);
  }, [saveNow]);

  return { user, authLoading, saveStatus, login, logout, loadSettings, scheduleSave };
}

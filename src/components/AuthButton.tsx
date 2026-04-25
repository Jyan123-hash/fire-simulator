import { User } from 'firebase/auth';
import { SaveStatus } from '../hooks/useFireSettings';

interface Props {
  user: User | null;
  authLoading: boolean;
  saveStatus: SaveStatus;
  onLogin: () => void;
  onLogout: () => void;
}

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
  </svg>
);

export default function AuthButton({ user, authLoading, saveStatus, onLogin, onLogout }: Props) {
  if (authLoading) return null;

  if (!user) {
    return (
      <button className="auth-btn auth-btn--in" onClick={onLogin}>
        <GoogleIcon />
        Googleでログイン
      </button>
    );
  }

  return (
    <div className="auth-user">
      {user.photoURL && (
        <img src={user.photoURL} alt="" className="auth-avatar" referrerPolicy="no-referrer" />
      )}
      <span className="auth-name">{user.displayName}</span>

      {saveStatus === 'saving' && (
        <span className="save-status save-status--saving">保存中…</span>
      )}
      {saveStatus === 'saved' && (
        <span className="save-status save-status--saved">✓ 保存済み</span>
      )}
      {saveStatus === 'error' && (
        <span className="save-status save-status--error">保存失敗</span>
      )}

      <button className="auth-btn auth-btn--out" onClick={onLogout}>
        ログアウト
      </button>
    </div>
  );
}

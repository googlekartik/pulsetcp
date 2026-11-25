import React, { useState } from 'react';
import { KeyRound, Lock, ShieldCheck, UserPlus, AlertCircle } from 'lucide-react';

interface AuthGatePanelProps {
  wsConnected: boolean;
  socketFd?: number;
  threadName?: string;
  authPending: boolean;
  authError: string | null;
  onClearError: () => void;
  onSubmitAuth: (action: 'login' | 'register', username: string, password: string) => void;
}

export const AuthGatePanel: React.FC<AuthGatePanelProps> = ({
  wsConnected,
  socketFd,
  threadName,
  authPending,
  authError,
  onClearError,
  onSubmitAuth,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setLocalError(null);
    onClearError();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();

    const cleanedUser = username.trim().replace(/^@+/, '');
    if (!/^[a-zA-Z0-9_-]{3,24}$/.test(cleanedUser)) {
      setLocalError('Username must be 3–24 characters (letters, numbers, _ or -).');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    onSubmitAuth(mode, cleanedUser, password);
  };

  const handleFillDemo = () => {
    setMode('login');
    setUsername('dev_alex');
    setPassword('AlexPulse#2026');
    setLocalError(null);
    onClearError();
  };

  const activeError = localError || authError;

  return (
    <div className="w-full flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-[#181b25] border border-white/10 p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[#4cd7f6] font-mono text-[11px] font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-[#4edea3]" />
              <span>TCP Handshake &amp; User Auth</span>
            </div>
            <h2 className="text-xl font-bold text-[#dfe2ef] mt-1">
              {mode === 'login' ? 'Sign In to Chat Rooms' : 'Register TCP Chat Account'}
            </h2>
            <p className="text-xs text-[#bcc9cd] mt-1">
              Credentials are salted and hashed with PBKDF2-HMAC-SHA256 (260k iterations) in the Python server SQLite store.
            </p>
          </div>
        </div>

        {/* Live Socket Handshake Telemetry Pill */}
        <div className="p-3 rounded-lg bg-[#0a0e17] border border-white/5 font-mono text-xs flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[#869397]">Socket State</span>
            <span className={wsConnected ? 'text-[#4edea3] font-semibold' : 'text-[#ffb4ab]'}>
              {wsConnected ? `ESTABLISHED (fd:${socketFd ?? '--'})` : 'CONNECTING...'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#869397]">Python Worker</span>
            <span className="text-[#4cd7f6]">{threadName || 'Thread-waiting'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#869397]">Room Access</span>
            <span className="text-[#c0c1ff]">401 AUTH_REQUIRED</span>
          </div>
        </div>

        {/* Mode Segmented Toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0a0e17]">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`py-2 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'login'
                ? 'bg-[#262a34] text-[#4cd7f6]'
                : 'text-[#bcc9cd] hover:text-[#dfe2ef]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`py-2 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'register'
                ? 'bg-[#262a34] text-[#4edea3]'
                : 'text-[#bcc9cd] hover:text-[#dfe2ef]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register</span>
          </button>
        </div>

        {activeError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-[#93000a]/30 border border-[#ffb4ab]/30 text-[#ffdad6] text-xs font-mono flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-[#ffb4ab] shrink-0 mt-0.5" />
            <span>{activeError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-username" className="text-xs font-medium text-[#bcc9cd]">
              Username
            </label>
            <input
              id="auth-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. frank_ops"
              className="w-full px-3 py-2 rounded bg-[#0a0e17] border border-white/10 text-sm font-mono text-[#dfe2ef] placeholder-[#869397]/60 focus:outline-none focus:border-[#4cd7f6]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-password" className="text-xs font-medium text-[#bcc9cd]">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2 rounded bg-[#0a0e17] border border-white/10 text-sm font-mono text-[#dfe2ef] placeholder-[#869397]/60 focus:outline-none focus:border-[#4cd7f6]"
            />
          </div>

          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-confirm" className="text-xs font-medium text-[#bcc9cd]">
                Confirm Password
              </label>
              <input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3 py-2 rounded bg-[#0a0e17] border border-white/10 text-sm font-mono text-[#dfe2ef] placeholder-[#869397]/60 focus:outline-none focus:border-[#4cd7f6]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!wsConnected || authPending}
            className="mt-1 w-full py-2.5 rounded bg-[#4cd7f6] hover:bg-[#06b6d4] disabled:opacity-50 text-[#003640] text-sm font-semibold transition-all shadow-[0_0_18px_-4px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>
              {authPending
                ? 'Authenticating over TCP...'
                : mode === 'login'
                ? 'Authenticate & Join Rooms'
                : 'Create Account & Join Rooms'}
            </span>
          </button>
        </form>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-xs">
          <span className="text-[#869397] font-mono">Demo: dev_alex / AlexPulse#2026</span>
          <button
            type="button"
            onClick={handleFillDemo}
            className="px-2.5 py-1 rounded bg-[#262a34] hover:bg-[#31353f] text-[#4cd7f6] font-mono text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Fill Demo
          </button>
        </div>
      </div>
    </div>
  );
};

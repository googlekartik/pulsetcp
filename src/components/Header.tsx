import React from 'react';
import { Activity, LogOut, Terminal, User } from 'lucide-react';
import type { NavTab } from '../types/tcp';

interface HeaderProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  wsConnected: boolean;
  authenticated: boolean;
  username?: string;
  onLogout: () => void;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string }> = [
  { id: 'architecture', label: 'Architecture & Bento' },
  { id: 'chat', label: 'Multi-Client TCP Chat' },
  { id: 'telemetry', label: 'Packet Telemetry' },
  { id: 'docs', label: 'Documentation' },
  { id: 'benchmarks', label: 'Benchmarks' },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  wsConnected,
  authenticated,
  username,
  onLogout,
}) => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-[#0a0e17]/90 backdrop-blur-xl border-b border-white/5 shadow-[0_1px_12px_rgba(0,0,0,0.4)]">
      <div className="h-16 w-full px-4 lg:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <button
            type="button"
            onClick={() => onSelectTab('architecture')}
            className="flex items-center gap-2.5 shrink-0 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4cd7f6] rounded"
          >
            <span className="w-8 h-8 rounded bg-[#1c1f29] border border-[#4cd7f6]/30 flex items-center justify-center text-[#4cd7f6]">
              <Activity className="w-4 h-4" />
            </span>
            <span className="text-[19px] font-bold text-[#dfe2ef] tracking-tight whitespace-nowrap">
              PulseTCP
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#31353f] text-[#4cd7f6] font-mono text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">
              v2.4 Core
            </span>
          </button>

          <nav className="hidden xl:flex items-center gap-1" aria-label="Primary Navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#262a34] text-[#4cd7f6] font-semibold'
                      : 'text-[#bcc9cd] hover:text-[#dfe2ef] hover:bg-[#1c1f29]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#1c1f29] font-mono text-[11px] whitespace-nowrap shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? 'bg-[#4edea3] animate-pulse' : 'bg-[#ffb4ab]'
              }`}
            />
            <span className={wsConnected ? 'text-[#4edea3]' : 'text-[#ffb4ab]'}>
              Socket Server: 0.0.0.0:9090
            </span>
          </div>

          {authenticated && username ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectTab('chat')}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#262a34] text-[#4cd7f6] font-mono text-xs whitespace-nowrap shrink-0"
              >
                <User className="w-3.5 h-3.5" />
                <span>@{username}</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Sign Out"
                className="px-3 py-1.5 rounded bg-[#1c1f29] hover:bg-[#262a34] border border-white/10 text-[#dfe2ef] text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-[#ffb4ab]" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTab('chat')}
              className="px-4 py-1.5 rounded bg-[#4cd7f6] hover:bg-[#06b6d4] text-[#003640] text-xs font-semibold transition-all shadow-[0_0_16px_-2px_rgba(6,182,212,0.35)] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Launch Console</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact mobile/tablet sub-nav */}
      <div className="xl:hidden px-4 py-1.5 bg-[#0f131c] border-t border-white/5 flex items-center gap-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#262a34] text-[#4cd7f6] font-semibold'
                  : 'text-[#bcc9cd] hover:text-[#dfe2ef]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};

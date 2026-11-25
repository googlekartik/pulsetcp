import React from 'react';

interface FooterProps {
  wsConnected: boolean;
  currentRttMs: number;
}

export const Footer: React.FC<FooterProps> = ({ wsConnected, currentRttMs }) => {
  return (
    <footer className="w-full bg-[#0a0e17] border-t border-white/5 mt-auto">
      <div className="w-full px-4 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-3 font-mono text-[11px] text-[#bcc9cd]">
        <div className="flex flex-wrap items-center gap-3">
          <span>SPEC: RFC 793 TCP/IP</span>
          <span aria-hidden="true">·</span>
          <span>PYTHON AF_INET / SOCK_STREAM</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#4edea3] tabular-nums">LIVE RTT: {currentRttMs.toFixed(2)} ms</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                wsConnected ? 'bg-[#4edea3]' : 'bg-[#ffb4ab]'
              }`}
            />
            <span className="text-[#dfe2ef]">
              {wsConnected ? 'SYSTEM NOMINAL' : 'RECONNECTING'}
            </span>
          </div>
          <span className="font-sans text-xs text-[#869397]">
            PulseTCP Telemetry Engine
          </span>
        </div>
      </div>
    </footer>
  );
};

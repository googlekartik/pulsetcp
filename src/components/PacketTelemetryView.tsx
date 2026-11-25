import React, { useMemo, useState } from 'react';
import { Activity, Cpu, Search } from 'lucide-react';
import type { RawHexCapture, ServerStats } from '../types/tcp';
import { formatBytesCompact, type PacketMetadata, type PeerInfo } from '../utils/protocol';

interface PacketTelemetryViewProps {
  peers: PeerInfo[];
  stats: ServerStats | null;
  rawCaptures: RawHexCapture[];
  lastPacket: PacketMetadata;
  rttHistory: number[];
  currentRttMs: number;
  onTriggerPing: () => void;
}

export const PacketTelemetryView: React.FC<PacketTelemetryViewProps> = ({
  peers,
  stats,
  rawCaptures,
  lastPacket,
  rttHistory,
  currentRttMs,
  onTriggerPing,
}) => {
  const [filterDir, setFilterDir] = useState<'ALL' | 'TCP_IN' | 'TCP_OUT' | 'SYN_ACK'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCaptures = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rawCaptures
      .filter((c) => (filterDir === 'ALL' ? true : c.direction === filterDir))
      .filter(
        (c) =>
          !q ||
          c.hex.toLowerCase().includes(q) ||
          c.ascii.toLowerCase().includes(q) ||
          c.checksum.toLowerCase().includes(q)
      )
      .slice()
      .reverse();
  }, [rawCaptures, filterDir, searchTerm]);

  const rttChartPath = useMemo(() => {
    const vals = rttHistory.length > 1 ? rttHistory : [currentRttMs, currentRttMs];
    const maxV = Math.max(...vals, 2);
    return vals
      .map((v, i) => {
        const x = (i / Math.max(1, vals.length - 1)) * 300;
        const y = 70 - (v / maxV) * 58;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [rttHistory, currentRttMs]);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] font-semibold text-[#4cd7f6] uppercase tracking-wider">
            Live Kernel &amp; Socket Observability
          </span>
          <h1 className="text-3xl font-bold text-[#dfe2ef] mt-1">
            TCP Packet Telemetry &amp; Thread Matrix
          </h1>
        </div>
        <button
          type="button"
          onClick={onTriggerPing}
          className="px-4 py-2 rounded bg-[#4cd7f6] hover:bg-[#06b6d4] text-[#003640] text-xs font-semibold flex items-center gap-2 cursor-pointer"
        >
          <Activity className="w-4 h-4" />
          <span>Probe TCP RTT (/ping)</span>
        </button>
      </div>

      {/* Top 4 KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#181b25] border border-white/5">
          <span className="font-mono text-[10px] text-[#869397] uppercase">Current RTT</span>
          <div className="text-2xl font-bold text-[#4cd7f6] tabular-nums mt-1">
            {currentRttMs.toFixed(2)} ms
          </div>
          <span className="font-mono text-[11px] text-[#4edea3]">TCP_NODELAY Enabled</span>
        </div>
        <div className="p-4 rounded-xl bg-[#181b25] border border-white/5">
          <span className="font-mono text-[10px] text-[#869397] uppercase">Total TX / RX</span>
          <div className="text-2xl font-bold text-[#dfe2ef] tabular-nums mt-1">
            {formatBytesCompact((stats?.totalTxBytes ?? 0) + (stats?.totalRxBytes ?? 0))}
          </div>
          <span className="font-mono text-[11px] text-[#869397]">
            {stats?.totalPackets ?? 0} frames
          </span>
        </div>
        <div className="p-4 rounded-xl bg-[#181b25] border border-white/5">
          <span className="font-mono text-[10px] text-[#869397] uppercase">Latest Checksum</span>
          <div className="text-2xl font-bold text-[#4edea3] font-mono mt-1">
            {lastPacket.checksum}
          </div>
          <span className="font-mono text-[11px] text-[#869397]">CRC32 Verified</span>
        </div>
        <div className="p-4 rounded-xl bg-[#181b25] border border-white/5">
          <span className="font-mono text-[10px] text-[#869397] uppercase">Active Workers</span>
          <div className="text-2xl font-bold text-[#c0c1ff] tabular-nums mt-1">
            {stats?.activePythonThreads ?? 1}
          </div>
          <span className="font-mono text-[11px] text-[#869397]">
            {peers.length} Authenticated FDs
          </span>
        </div>
      </div>

      {/* RTT Sparkline + Active Thread Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl bg-[#181b25] border border-white/5 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#dfe2ef]">Round-Trip Time History</h2>
            <span className="font-mono text-xs text-[#4edea3] tabular-nums">
              {rttHistory.length} samples
            </span>
          </div>
          <div className="w-full h-24 bg-[#0a0e17] rounded-lg p-3 border border-white/5">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 300 80" preserveAspectRatio="none">
              <path d={rttChartPath} fill="none" stroke="#4cd7f6" strokeWidth="2.5" />
            </svg>
          </div>
          <div className="flex justify-between font-mono text-[11px] text-[#869397]">
            <span>Min: {Math.min(...rttHistory).toFixed(2)} ms</span>
            <span>Max: {Math.max(...rttHistory).toFixed(2)} ms</span>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl bg-[#181b25] border border-white/5 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#4cd7f6]" />
              <h2 className="text-base font-semibold text-[#dfe2ef]">
                Active Python Socket Descriptors
              </h2>
            </div>
            <span className="font-mono text-[11px] text-[#869397]">
              Lock: {stats?.nickLockState || 'UNLOCKED'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="text-[#869397] text-[10px] uppercase border-b border-white/5">
                  <th className="py-2 pr-3">Thread</th>
                  <th className="py-2 pr-3">FD</th>
                  <th className="py-2 pr-3">Handle</th>
                  <th className="py-2 pr-3">Channel</th>
                  <th className="py-2 pr-3">Port</th>
                  <th className="py-2 text-right">RTT</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.workers ?? []).map((w) => (
                  <tr key={`${w.threadName}-${w.fd}`} className="border-b border-white/5">
                    <td className="py-2 pr-3 text-[#4edea3]">{w.threadName}</td>
                    <td className="py-2 pr-3 text-[#4cd7f6] tabular-nums">fd:{w.fd}</td>
                    <td className="py-2 pr-3 text-[#dfe2ef]">@{w.nick}</td>
                    <td className="py-2 pr-3 text-[#bcc9cd]">#{w.channel}</td>
                    <td className="py-2 pr-3 text-[#869397] tabular-nums">{w.port}</td>
                    <td className="py-2 text-right text-[#4edea3] tabular-nums">
                      {w.lastRttMs.toFixed(2)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Filterable Raw Hex Stream */}
      <div className="rounded-xl bg-[#181b25] border border-white/5 p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#dfe2ef]">Live Wire Capture Stream</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#869397]" />
              <input
                type="text"
                aria-label="Filter hex captures"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search hex, ascii, crc..."
                className="bg-[#0a0e17] border border-white/10 rounded pl-8 pr-3 py-1 font-mono text-xs text-[#dfe2ef] focus:outline-none focus:border-[#4cd7f6]"
              />
            </div>
            {(['ALL', 'TCP_IN', 'TCP_OUT', 'SYN_ACK'] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => setFilterDir(dir)}
                className={`px-2.5 py-1 rounded font-mono text-[11px] cursor-pointer ${
                  filterDir === dir
                    ? 'bg-[#4cd7f6] text-[#003640] font-semibold'
                    : 'bg-[#0a0e17] text-[#bcc9cd]'
                }`}
              >
                {dir}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#0a0e17] rounded-lg p-3 max-h-[320px] overflow-y-auto font-mono text-xs flex flex-col gap-1 custom-scrollbar">
          {filteredCaptures.length === 0 ? (
            <div className="text-[#869397] py-6 text-center">
              No matching captures. Trigger a /ping or send chat messages to inspect live frames.
            </div>
          ) : (
            filteredCaptures.map((cap) => (
              <div
                key={cap.id}
                className="p-1.5 rounded hover:bg-[#1c1f29] flex flex-wrap items-center gap-3 text-[11px]"
              >
                <span className="text-[#4cd7f6] font-semibold w-16">{cap.direction}</span>
                <span className="text-[#dfe2ef] flex-1 min-w-[200px]">{cap.hex}</span>
                <span className="text-[#869397]">{cap.ascii}</span>
                <span className="text-[#4edea3] tabular-nums">{cap.bytes}B</span>
                <span className="text-[#c0c1ff]">{cap.checksum}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

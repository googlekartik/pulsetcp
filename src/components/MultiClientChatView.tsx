import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  CheckCheck,
  Download,
  Eraser,
  History,
  Lock,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Reply,
  Search,
  Send,
  Shield,
  Terminal,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type {
  EventLogItem,
  RawHexCapture,
  ServerStats,
  StreamEntry,
} from '../types/tcp';
import {
  filterPeers,
  formatBytesCompact,
  type PacketMetadata,
  type PeerInfo,
} from '../utils/protocol';
import { AuthGatePanel } from './AuthGatePanel';

interface MultiClientChatViewProps {
  wsConnected: boolean;
  authenticated: boolean;
  authPending: boolean;
  authError: string | null;
  onClearAuthError: () => void;
  onSubmitAuth: (action: 'login' | 'register', username: string, password: string) => void;
  selfPeer: PeerInfo | null;
  activeChannel: string;
  peers: PeerInfo[];
  stats: ServerStats | null;
  messages: StreamEntry[];
  rawCaptures: RawHexCapture[];
  eventLogs: EventLogItem[];
  lastPacket: PacketMetadata;
  rttHistory: number[];
  currentRttMs: number;
  txBytes: number;
  rxBytes: number;
  onSendMessage: (text: string, channelOverride?: string) => void;
  onSwitchChannel: (channel: string) => void;
  onClearBuffers: () => void;
  onReconnect: () => void;
  onSpawnPeer: (customNick?: string) => Promise<{ ok: boolean; peer?: { nick: string; fd: number }; error?: string }>;
  onSendAsPeer: (nick: string, text: string, channel?: string) => Promise<{ ok: boolean; error?: string }>;
}

function formatClock(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toTimeString().split(' ')[0];
}

function initials(nick: string): string {
  const parts = nick.replace(/^@/, '').split(/[_-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nick.slice(0, 2).toUpperCase() || 'PT';
}

export const MultiClientChatView: React.FC<MultiClientChatViewProps> = ({
  wsConnected,
  authenticated,
  authPending,
  authError,
  onClearAuthError,
  onSubmitAuth,
  selfPeer,
  activeChannel,
  peers,
  stats,
  messages,
  rawCaptures,
  eventLogs,
  lastPacket,
  rttHistory,
  currentRttMs,
  txBytes,
  rxBytes,
  onSendMessage,
  onSwitchChannel,
  onClearBuffers,
  onReconnect,
  onSpawnPeer,
  onSendAsPeer,
}) => {
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual');
  const [msgFilter, setMsgFilter] = useState<'all' | 'broadcast' | 'whisper'>('all');
  const [peerQuery, setPeerQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [nickModalOpen, setNickModalOpen] = useState(false);
  const [nickDraft, setNickDraft] = useState('');
  const [spawning, setSpawning] = useState(false);
  const [peerComposerTarget, setPeerComposerTarget] = useState<PeerInfo | null>(null);
  const [peerDraft, setPeerDraft] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const streamContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (streamContainerRef.current) {
      streamContainerRef.current.scrollTop = streamContainerRef.current.scrollHeight;
    }
  }, [messages.length, viewMode]);

  const filteredPeers = useMemo(() => filterPeers(peers, peerQuery), [peers, peerQuery]);

  const visibleMessages = useMemo(() => {
    return messages.filter((m) => {
      if (msgFilter === 'broadcast') {
        return m.kind === 'broadcast' && (m.isGlobalBroadcast || m.channel === activeChannel);
      }
      if (msgFilter === 'whisper') {
        return m.kind === 'whisper';
      }
      if (m.kind === 'broadcast' && !m.isGlobalBroadcast && m.channel && m.channel !== activeChannel) {
        return false;
      }
      return true;
    });
  }, [messages, msgFilter, activeChannel]);

  const rttSvgPath = useMemo(() => {
    const vals = rttHistory.length > 1 ? rttHistory : [currentRttMs, currentRttMs];
    const maxV = Math.max(...vals, 2);
    const minV = 0;
    const pts = vals.map((v, idx) => {
      const x = (idx / Math.max(1, vals.length - 1)) * 100;
      const y = 26 - ((v - minV) / (maxV - minV)) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(' L ')}`;
  }, [rttHistory, currentRttMs]);

  const avgRtt = useMemo(() => {
    if (rttHistory.length === 0) return currentRttMs;
    const s = rttHistory.reduce((acc, v) => acc + v, 0);
    return s / rttHistory.length;
  }, [rttHistory, currentRttMs]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSendMessage(draft);
    setDraft('');
  };

  const insertSnippet = (snippet: string) => {
    setDraft(snippet);
    inputRef.current?.focus();
  };

  const handleExportLogs = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      self: selfPeer,
      stats,
      messages,
      rawCaptures,
      eventLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulsetcp-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusNotice('Exported session telemetry JSON.');
    window.setTimeout(() => setStatusNotice(null), 2500);
  };

  const handleSpawnClient = async () => {
    setSpawning(true);
    try {
      const res = await onSpawnPeer();
      if (res.ok && res.peer) {
        setStatusNotice(`Spawned TCP peer @${res.peer.nick} (fd:${res.peer.fd})`);
      } else {
        setStatusNotice(res.error || 'Could not spawn peer');
      }
    } finally {
      setSpawning(false);
      window.setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  const handleApplyNick = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nickDraft.trim().replace(/^@+/, '');
    if (clean.length < 2) return;
    onSendMessage(`/nick ${clean}`);
    setNickModalOpen(false);
  };

  const handleSendAsPeerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!peerComposerTarget || !peerDraft.trim()) return;
    await onSendAsPeer(peerComposerTarget.nick, peerDraft.trim(), activeChannel);
    setPeerDraft('');
    setPeerComposerTarget(null);
  };

  const workers = stats?.workers ?? [];

  return (
    <div className="flex flex-col w-full text-[#dfe2ef]">
      {/* Operational Control Bar */}
      <section className="w-full bg-[#0a0e17] px-4 lg:px-8 py-2.5 border-b border-white/5 flex flex-col gap-2">
        {/* Python Socket Architecture Strip */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#4cd7f6]/15 text-[#4cd7f6] font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Architecture: TCP Client–Server (AF_INET, SOCK_STREAM)</span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#4edea3]/10 text-[#4edea3] font-semibold">
              <Users className="w-3.5 h-3.5" />
              <span>Engine: threading.Thread(target=handle_client)</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {statusNotice && (
              <span className="px-2 py-0.5 rounded bg-[#4cd7f6]/20 text-[#4cd7f6] font-mono text-[11px]">
                {statusNotice}
              </span>
            )}
            <span className="px-2 py-0.5 rounded bg-[#262a34] text-[#bcc9cd] font-mono text-[10px] font-semibold flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              <span>THREAD POOL ACTIVE: {stats?.activePythonThreads ?? workers.length} WORKERS</span>
            </span>
          </div>
        </div>

        {/* Socket Status & Quick Action Toolbar */}
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#1c1f29] text-[#4edea3] font-mono text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnected ? 'bg-[#4edea3] animate-pulse' : 'bg-[#ffb4ab]'
                }`}
              />
              <span className="tracking-tight">tcp://127.0.0.1:9090</span>
              <span className="px-1.5 py-0.5 rounded bg-[#31353f] text-[#bcc9cd] text-[10px] font-semibold">
                fd:{selfPeer?.fd ?? '--'}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-[#bcc9cd]">
              <Lock className="w-3.5 h-3.5 text-[#4edea3]" />
              <span>PBKDF2-HMAC-SHA256</span>
              <span className="text-[#869397]">·</span>
              <span className="text-[#4cd7f6] font-semibold tabular-nums">
                {currentRttMs.toFixed(2)} ms RTT
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {authenticated && selfPeer && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setNickDraft(selfPeer.nick);
                    setNickModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#262a34] hover:bg-[#353943] text-[#4cd7f6] font-mono text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-full bg-[#4cd7f6] text-[#003640] flex items-center justify-center text-[10px] font-bold">
                    {selfPeer.nick.charAt(0).toUpperCase()}
                  </span>
                  <span>@{selfPeer.nick}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNickDraft(selfPeer.nick);
                    setNickModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded bg-[#262a34] hover:bg-[#353943] text-[#4cd7f6] border border-[#3d494c] font-mono text-xs flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <BadgeCheck className="w-3.5 h-3.5" />
                  <span>/nick Change</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleSpawnClient}
              disabled={spawning}
              className="px-2.5 py-1 rounded bg-[#1c1f29] hover:bg-[#31353f] text-[#dfe2ef] font-mono text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#4edea3]" />
              <span>{spawning ? 'Spawning...' : 'Spawn Client'}</span>
            </button>

            <button
              type="button"
              onClick={onClearBuffers}
              className="px-2.5 py-1 rounded bg-[#1c1f29] hover:bg-[#31353f] text-[#dfe2ef] font-mono text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Eraser className="w-3.5 h-3.5 text-[#bcc9cd]" />
              <span>Clear</span>
            </button>

            <button
              type="button"
              onClick={handleExportLogs}
              className="px-2.5 py-1 rounded bg-[#1c1f29] hover:bg-[#31353f] text-[#dfe2ef] font-mono text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#4cd7f6]" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={onReconnect}
              className="px-3 py-1 rounded bg-[#4cd7f6] hover:bg-[#06b6d4] text-[#003640] font-mono text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconnect</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Three-Column Workspace */}
      <section className="w-full px-4 lg:px-8 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* LEFT COLUMN: Active Sockets & Channels */}
        <aside className="lg:col-span-3 flex flex-col gap-4 min-w-0">
          <div className="bg-[#181b25] rounded-xl border border-white/5 p-4 flex flex-col gap-3 shadow-md h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#dfe2ef]">Active Sockets</span>
                <span className="px-1.5 py-0.5 rounded bg-[#4edea3]/10 text-[#4edea3] font-mono text-[10px] font-semibold">
                  {peers.length} ONLINE
                </span>
              </div>
              <Activity className="w-4 h-4 text-[#869397]" />
            </div>

            {/* Filter Input */}
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#869397]" />
              <input
                type="text"
                aria-label="Filter connected sockets"
                value={peerQuery}
                onChange={(e) => setPeerQuery(e.target.value)}
                placeholder="Filter fd, handle, ip..."
                className="w-full bg-[#0a0e17] text-[#dfe2ef] pl-8 pr-3 py-1.5 rounded font-mono text-xs placeholder-[#869397] border border-white/5 focus:outline-none focus:border-[#4cd7f6]"
              />
            </div>

            {/* Broadcast Channels */}
            <div className="pt-1">
              <span className="font-mono text-[10px] font-semibold text-[#869397] uppercase tracking-wider block mb-1.5">
                Broadcast Channels
              </span>
              <div className="flex flex-col gap-1">
                {[
                  { id: 'general', tag: 'PUB', tagClass: 'bg-[#4cd7f6]/20 text-[#4cd7f6]' },
                  { id: 'infra-telemetry', tag: 'OPS', tagClass: 'bg-[#4edea3]/15 text-[#4edea3]' },
                  { id: 'system-alerts', tag: 'CRIT', tagClass: 'bg-[#93000a] text-[#ffb4ab]' },
                ].map((ch) => {
                  const isActive = activeChannel === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => onSwitchChannel(ch.id)}
                      className={`w-full px-2.5 py-1.5 rounded flex items-center justify-between text-left transition-colors font-mono text-xs cursor-pointer ${
                        isActive
                          ? 'bg-[#262a34] text-[#4cd7f6] font-semibold'
                          : 'hover:bg-[#1c1f29] text-[#bcc9cd]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={isActive ? 'text-[#4cd7f6]' : 'text-[#869397]'}>#</span>
                        <span>{ch.id}</span>
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ch.tagClass}`}>
                        {ch.tag}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Connected Authenticated Clients */}
            <div className="pt-1 flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] font-semibold text-[#869397] uppercase tracking-wider">
                  Connected Clients
                </span>
                <span className="font-mono text-[10px] text-[#4edea3]">TCP_ESTABLISHED</span>
              </div>

              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[360px] pr-1 custom-scrollbar">
                {filteredPeers.length === 0 ? (
                  <div className="p-3 rounded bg-[#0a0e17] text-xs font-mono text-[#869397] text-center">
                    No matching authenticated peers.
                  </div>
                ) : (
                  filteredPeers.map((peer) => {
                    const isMe = selfPeer?.fd === peer.fd;
                    return (
                      <div
                        key={peer.fd}
                        className={`p-2 rounded flex items-center justify-between gap-2 transition-colors ${
                          isMe
                            ? 'bg-[#262a34] border border-[#4cd7f6]/30'
                            : 'bg-[#1c1f29] hover:bg-[#262a34]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (authenticated && !isMe) {
                              insertSnippet(`/msg @${peer.nick} `);
                            }
                          }}
                          className="flex items-center gap-2 min-w-0 text-left flex-1 cursor-pointer"
                          title={isMe ? 'Your active socket' : `Whisper @${peer.nick}`}
                        >
                          <div className="relative shrink-0">
                            <div className="w-7 h-7 rounded bg-[#4cd7f6]/20 text-[#4cd7f6] flex items-center justify-center font-mono text-[11px] font-bold">
                              {initials(peer.nick)}
                            </div>
                            <span className="w-2 h-2 rounded-full bg-[#4edea3] absolute -bottom-0.5 -right-0.5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono text-xs font-semibold text-[#dfe2ef] truncate">
                              @{peer.nick} {isMe ? '(YOU)' : ''}
                            </span>
                            <span className="font-mono text-[10px] text-[#869397] truncate">
                              {peer.role} · fd:{peer.fd} · #{peer.channel}
                            </span>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-[11px] text-[#4edea3] tabular-nums">
                            {peer.lastRttMs.toFixed(1)}ms
                          </span>
                          {peer.isVirtual && authenticated && (
                            <button
                              type="button"
                              aria-label={`Send message as @${peer.nick}`}
                              onClick={() => {
                                setPeerComposerTarget(peer);
                                setPeerDraft('');
                              }}
                              className="px-1.5 py-0.5 rounded bg-[#3131c0]/40 hover:bg-[#3131c0]/70 text-[#c0c1ff] font-mono text-[10px] cursor-pointer"
                              title={`Send real TCP frame from @${peer.nick}`}
                            >
                              Act
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#0a0e17] border border-white/5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-[11px] font-bold text-[#dfe2ef]">
                  Python Socket Daemon
                </span>
                <span className="font-mono text-[10px] text-[#869397]">
                  SQLite Auth Store · {stats?.registeredUsers ?? 4} Users
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-[#1bbd85] text-[#00452e] font-mono text-[9px] font-bold">
                READY
              </span>
            </div>
          </div>
        </aside>

        {/* CENTER COLUMN: Auth Gate OR Live Message Stream */}
        <main className="lg:col-span-6 flex flex-col gap-3 min-w-0">
          {!authenticated ? (
            <AuthGatePanel
              wsConnected={wsConnected}
              socketFd={selfPeer?.fd}
              threadName={selfPeer?.threadName}
              authPending={authPending}
              authError={authError}
              onClearError={() => onClearAuthError()}
              onSubmitAuth={onSubmitAuth}
            />
          ) : (
            <>
              {/* Console Header Bar */}
              <div className="bg-[#181b25] border border-white/5 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1 p-0.5 rounded bg-[#0a0e17]">
                  <button
                    type="button"
                    onClick={() => setViewMode('visual')}
                    className={`px-2.5 py-1 rounded font-mono text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      viewMode === 'visual'
                        ? 'bg-[#262a34] text-[#4cd7f6] font-semibold'
                        : 'text-[#bcc9cd] hover:text-[#dfe2ef]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Visual Stream</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('raw')}
                    className={`px-2.5 py-1 rounded font-mono text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      viewMode === 'raw'
                        ? 'bg-[#262a34] text-[#4cd7f6] font-semibold'
                        : 'text-[#bcc9cd] hover:text-[#dfe2ef]'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Raw Hex/TCP</span>
                  </button>

                  <div className="h-4 w-px bg-[#3d494c] mx-1 hidden sm:block" />

                  <button
                    type="button"
                    onClick={() => setMsgFilter('all')}
                    className={`px-2 py-1 rounded font-mono text-[11px] whitespace-nowrap cursor-pointer ${
                      msgFilter === 'all' ? 'bg-[#1c1f29] text-[#dfe2ef] font-bold' : 'text-[#869397]'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setMsgFilter('broadcast')}
                    className={`px-2 py-1 rounded font-mono text-[11px] whitespace-nowrap cursor-pointer ${
                      msgFilter === 'broadcast'
                        ? 'bg-[#1c1f29] text-[#4cd7f6] font-bold'
                        : 'text-[#4cd7f6]/80'
                    }`}
                  >
                    # Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setMsgFilter('whisper')}
                    className={`px-2 py-1 rounded font-mono text-[11px] flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                      msgFilter === 'whisper'
                        ? 'bg-[#1c1f29] text-[#c0c1ff] font-bold'
                        : 'text-[#c0c1ff]/80'
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    <span>Whispers</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] text-[#869397]">
                  <span>ROOM:</span>
                  <span className="text-[#4cd7f6] font-bold">#{activeChannel}</span>
                  <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
                </div>
              </div>

              {/* Stream Viewport */}
              {viewMode === 'visual' ? (
                <div
                  ref={streamContainerRef}
                  data-testid="visual-stream"
                  className="flex-1 bg-[#0a0e17] border border-white/5 rounded-xl p-4 overflow-y-auto max-h-[540px] min-h-[400px] flex flex-col gap-3 custom-scrollbar"
                >
                  {visibleMessages.length === 0 ? (
                    <div className="m-auto text-center max-w-xs flex flex-col items-center gap-2 py-8">
                      <Terminal className="w-8 h-8 text-[#4cd7f6]/60" />
                      <p className="text-sm font-semibold text-[#dfe2ef]">
                        Channel #{activeChannel} Ready
                      </p>
                      <p className="text-xs text-[#869397]">
                        Send a message below, use <code className="text-[#4cd7f6]">/msg @user</code> for private whispers, or click Spawn Client to test concurrent users.
                      </p>
                    </div>
                  ) : (
                    visibleMessages.map((item) => {
                      if (
                        item.kind === 'handshake' ||
                        item.kind === 'thread' ||
                        item.kind === 'nick' ||
                        item.kind === 'system' ||
                        item.kind === 'pong' ||
                        item.kind === 'error' ||
                        item.kind === 'stats'
                      ) {
                        const isErr = item.kind === 'error';
                        return (
                          <div
                            key={item.id}
                            className={`w-full p-2.5 rounded-lg border text-xs font-mono ${
                              isErr
                                ? 'bg-[#93000a]/25 border-[#ffb4ab]/30 text-[#ffdad6]'
                                : 'bg-[#181b25] border-white/5 text-[#dfe2ef]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span
                                className={`text-[10px] font-bold uppercase ${
                                  isErr
                                    ? 'text-[#ffb4ab]'
                                    : item.kind === 'nick'
                                    ? 'text-[#c0c1ff]'
                                    : 'text-[#4edea3]'
                                }`}
                              >
                                {item.title}
                              </span>
                              <span className="text-[10px] text-[#869397] tabular-nums">
                                {formatClock(item.timestamp)}
                              </span>
                            </div>
                            <pre className="whitespace-pre-wrap font-mono text-[11px] text-[#bcc9cd] leading-relaxed">
                              {item.text}
                            </pre>
                          </div>
                        );
                      }

                      if (item.kind === 'whisper') {
                        return (
                          <div
                            key={item.id}
                            className={`flex flex-col gap-1 max-w-[90%] ${
                              item.isOwn ? 'self-end items-end' : 'self-start items-start'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="font-bold text-[#c0c1ff]">@{item.fromNick}</span>
                              <span className="px-1.5 py-0.5 rounded bg-[#3131c0]/40 text-[#c0c1ff] text-[9px] flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                <span>WHISPER → @{item.toNick}</span>
                              </span>
                              <span className="text-[10px] text-[#869397] tabular-nums">
                                {formatClock(item.timestamp)}
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-[#262a34] border border-[#c0c1ff]/30 text-[#dfe2ef] text-sm shadow-md">
                              <p>{item.text}</p>
                              <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-4 font-mono text-[10px]">
                                <span className="text-[#c0c1ff]">
                                  {item.nonce || 'DIRECT_FD'} · {item.dispatchUs ?? 0}µs
                                </span>
                                {!item.isOwn && item.fromNick && (
                                  <button
                                    type="button"
                                    onClick={() => insertSnippet(`/msg @${item.fromNick} `)}
                                    className="text-[#c0c1ff] hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <Reply className="w-3 h-3" />
                                    <span>Reply Private</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Public broadcast message
                      return (
                        <div
                          key={item.id}
                          className={`flex flex-col gap-1 max-w-[90%] ${
                            item.isOwn ? 'self-end items-end' : 'self-start items-start'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="font-bold text-[#4cd7f6]">@{item.fromNick}</span>
                            <span className="px-1.5 py-0.5 rounded bg-[#1c1f29] text-[#bcc9cd] text-[9px]">
                              {item.isGlobalBroadcast ? 'BROADCAST' : `#${item.channel || 'general'}`}
                            </span>
                            <span className="text-[10px] text-[#869397]">
                              fd:{item.fromFd} · {formatClock(item.timestamp)}
                            </span>
                          </div>
                          <div
                            className={`p-3 rounded-xl text-sm shadow-sm ${
                              item.isOwn
                                ? 'bg-[#4cd7f6] text-[#003640] rounded-tr-none font-medium'
                                : 'bg-[#1c1f29] text-[#dfe2ef] rounded-tl-none'
                            }`}
                          >
                            <p>{item.text}</p>
                          </div>
                          {item.isOwn && (
                            <span className="font-mono text-[10px] text-[#4edea3] flex items-center gap-1">
                              <CheckCheck className="w-3 h-3" />
                              <span>ACK ({item.dispatchUs ?? 0} µs py-dispatch)</span>
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div
                  data-testid="raw-hex-stream"
                  className="flex-1 bg-[#0a0e17] border border-white/5 rounded-xl p-4 overflow-y-auto max-h-[580px] min-h-[420px] font-mono text-xs flex flex-col gap-1 custom-scrollbar"
                >
                  <div className="text-[#869397] pb-2 text-[10px] font-semibold uppercase tracking-wider">
                    HEX DUMP INTERCEPTOR [PYTHON SOCKET RAW CAPTURE]
                  </div>
                  {rawCaptures.length === 0 ? (
                    <div className="text-[#869397] py-6 text-center">
                      No captured frames yet. Send a message or ping to capture TCP bytes.
                    </div>
                  ) : (
                    rawCaptures.map((cap) => (
                      <div
                        key={cap.id}
                        className="p-1.5 rounded hover:bg-[#181b25] flex flex-wrap items-center gap-2 text-[11px]"
                      >
                        <span className="text-[#869397] tabular-nums">
                          {formatClock(cap.timestamp)}
                        </span>
                        <span
                          className={`px-1 rounded text-[10px] font-bold ${
                            cap.direction === 'TCP_OUT'
                              ? 'bg-[#4cd7f6]/20 text-[#4cd7f6]'
                              : 'bg-[#4edea3]/15 text-[#4edea3]'
                          }`}
                        >
                          {cap.direction}
                        </span>
                        <span className="text-[#dfe2ef]">{cap.hex}</span>
                        <span className="text-[#869397]">| {cap.ascii}</span>
                        <span className="text-[#c0c1ff] ml-auto">{cap.checksum}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Quick Command Snippets */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                <span className="font-mono text-[10px] text-[#869397] uppercase tracking-wider shrink-0">
                  Snippets:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const target = peers.find((p) => p.fd !== selfPeer?.fd)?.nick || 'alice_core';
                    insertSnippet(`/msg @${target} `);
                  }}
                  className="px-2 py-0.5 rounded bg-[#1c1f29] hover:bg-[#262a34] text-[#4cd7f6] font-mono text-xs shrink-0 cursor-pointer"
                >
                  /msg whisper
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('/broadcast ')}
                  className="px-2 py-0.5 rounded bg-[#1c1f29] hover:bg-[#262a34] text-[#bcc9cd] font-mono text-xs shrink-0 cursor-pointer"
                >
                  /broadcast all
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('/nick ')}
                  className="px-2 py-0.5 rounded bg-[#1c1f29] hover:bg-[#262a34] text-[#bcc9cd] font-mono text-xs shrink-0 cursor-pointer"
                >
                  /nick name
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage('/ping')}
                  className="px-2 py-0.5 rounded bg-[#1c1f29] hover:bg-[#262a34] text-[#4edea3] font-mono text-xs shrink-0 cursor-pointer"
                >
                  /ping server
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage('/stats')}
                  className="px-2 py-0.5 rounded bg-[#1c1f29] hover:bg-[#262a34] text-[#c0c1ff] font-mono text-xs shrink-0 cursor-pointer"
                >
                  /stats
                </button>
              </div>

              {/* Message Composer */}
              <div className="bg-[#181b25] border border-white/5 rounded-xl p-2.5 flex flex-col gap-1.5">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <span className="pl-2 font-mono text-sm text-[#4cd7f6] font-bold select-none">
                    &gt;
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    aria-label="Message or TCP command"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type message or command (/msg @user <text>, /broadcast <text>, /nick <name>)..."
                    className="flex-1 bg-transparent text-[#dfe2ef] font-mono text-xs sm:text-sm placeholder-[#869397] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-[#4cd7f6] hover:bg-[#06b6d4] text-[#003640] text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
                <div className="flex items-center justify-between px-2 text-[11px] font-mono text-[#869397]">
                  <span>Encoding: UTF-8 · Framing: Newline-Delimited JSON/Text</span>
                  <span className="hidden sm:inline">Press Enter to transmit</span>
                </div>
              </div>
            </>
          )}
        </main>

        {/* RIGHT COLUMN: Python Thread Inspector, Packet Inspector, Latency & Event Log */}
        <aside className="lg:col-span-3 flex flex-col gap-4 min-w-0">
          {/* Panel 1: Python Thread Inspector */}
          <div className="bg-[#181b25] rounded-xl p-4 flex flex-col gap-2.5 border border-[#4cd7f6]/20 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#4edea3]" />
                <span className="text-sm font-bold text-[#dfe2ef]">Python Thread Inspector</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-[#4edea3]/10 text-[#4edea3] font-mono text-[10px] font-semibold">
                {workers.length} THREADS
              </span>
            </div>
            <p className="font-mono text-[11px] text-[#bcc9cd]">
              Concurrency: <code className="text-[#4cd7f6]">threading.Thread</code> per socket.
            </p>

            <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar font-mono text-[11px]">
              {workers.map((w) => {
                const isMe = selfPeer?.fd === w.fd;
                return (
                  <div
                    key={`${w.threadName}-${w.fd}`}
                    className={`p-1.5 rounded flex items-center justify-between gap-2 ${
                      isMe
                        ? 'bg-[#262a34] border border-[#4cd7f6]/40'
                        : 'bg-[#1c1f29]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          w.authenticated ? 'bg-[#4edea3]' : 'bg-[#c0c1ff]'
                        }`}
                      />
                      <span className="font-semibold text-[#dfe2ef] shrink-0">
                        {w.threadName}
                      </span>
                      <span className="text-[#869397] truncate">
                        (@{w.nick})
                      </span>
                    </div>
                    <span className="text-[#4cd7f6] font-bold shrink-0 tabular-nums">
                      fd:{w.fd} [{w.authenticated ? 'ACTIVE' : 'AUTH'}]
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-2 rounded bg-[#0a0e17] text-[11px] font-mono text-[#869397] flex flex-col gap-1">
              <div className="flex justify-between">
                <span>TCP Handshake:</span>
                <span className="text-[#4edea3] font-bold">SYN → SYN-ACK → ACK</span>
              </div>
              <div className="flex justify-between">
                <span>Nick Lock State:</span>
                <span className="text-[#dfe2ef]">{stats?.nickLockState || 'UNLOCKED (0 queued)'}</span>
              </div>
            </div>
          </div>

          {/* Panel 2: Packet Inspector */}
          <div className="bg-[#181b25] rounded-xl border border-white/5 p-4 flex flex-col gap-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#dfe2ef]">Packet Inspector</span>
              <span className="px-1.5 py-0.5 rounded bg-[#31353f] text-[#4cd7f6] font-mono text-[10px]">
                LAST FRAME
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-2 rounded bg-[#1c1f29] flex flex-col">
                <span className="font-mono text-[9px] text-[#869397] uppercase">Source Port</span>
                <span className="font-mono text-xs font-bold text-[#4cd7f6] tabular-nums">
                  {lastPacket.srcPort}
                </span>
              </div>
              <div className="p-2 rounded bg-[#1c1f29] flex flex-col">
                <span className="font-mono text-[9px] text-[#869397] uppercase">Dest Port</span>
                <span className="font-mono text-xs font-bold text-[#dfe2ef] tabular-nums">
                  {lastPacket.dstPort} (TCP)
                </span>
              </div>
              <div className="p-2 rounded bg-[#1c1f29] flex flex-col">
                <span className="font-mono text-[9px] text-[#869397] uppercase">Seq Number</span>
                <span className="font-mono text-[11px] text-[#dfe2ef] tabular-nums">
                  {lastPacket.seq}
                </span>
              </div>
              <div className="p-2 rounded bg-[#1c1f29] flex flex-col">
                <span className="font-mono text-[9px] text-[#869397] uppercase">Ack Number</span>
                <span className="font-mono text-[11px] text-[#dfe2ef] tabular-nums">
                  {lastPacket.ack}
                </span>
              </div>
            </div>

            <div className="p-2 rounded bg-[#1c1f29] flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-[9px] text-[#869397] uppercase">Flags</span>
                <div className="flex items-center gap-1 mt-0.5">
                  {lastPacket.flags.map((f) => (
                    <span
                      key={f}
                      className="px-1 rounded bg-[#4edea3]/20 text-[#4edea3] font-mono text-[9px] font-bold"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-[9px] text-[#869397] uppercase block">Win Size</span>
                <span className="font-mono text-xs font-bold text-[#dfe2ef] tabular-nums">
                  {lastPacket.winSize}
                </span>
              </div>
            </div>

            <div className="p-2 rounded bg-[#1c1f29] flex items-center justify-between">
              <span className="font-mono text-[9px] text-[#869397] uppercase">CRC32 Checksum</span>
              <span className="font-mono text-[11px] text-[#4edea3] font-bold">
                {lastPacket.checksum} [VALID]
              </span>
            </div>
          </div>

          {/* Panel 3: Buffer & Latency */}
          <div className="bg-[#181b25] rounded-xl border border-white/5 p-4 flex flex-col gap-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#dfe2ef]">Buffer &amp; Latency</span>
              <span className="font-mono text-xs text-[#4edea3] font-bold tabular-nums">
                avg {avgRtt.toFixed(2)} ms
              </span>
            </div>

            <div className="w-full h-12 bg-[#0a0e17] rounded p-1.5 flex items-end">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 30">
                <path d={rttSvgPath} fill="none" stroke="#4cd7f6" strokeWidth="2" />
              </svg>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-2 rounded bg-[#1c1f29] flex flex-col">
                <div className="flex items-center gap-1 text-[#4cd7f6]">
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span className="font-mono text-[9px] uppercase">TX Bytes</span>
                </div>
                <span className="font-mono text-xs font-bold text-[#dfe2ef] tabular-nums mt-0.5">
                  {formatBytesCompact(txBytes)}
                </span>
              </div>
              <div className="p-2 rounded bg-[#1c1f29] flex flex-col">
                <div className="flex items-center gap-1 text-[#4edea3]">
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span className="font-mono text-[9px] uppercase">RX Bytes</span>
                </div>
                <span className="font-mono text-xs font-bold text-[#dfe2ef] tabular-nums mt-0.5">
                  {formatBytesCompact(rxBytes)}
                </span>
              </div>
            </div>
          </div>

          {/* Panel 4: Event Log */}
          <div className="bg-[#181b25] rounded-xl border border-white/5 p-4 flex flex-col gap-2 shadow-md flex-1 min-h-[160px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History className="w-4 h-4 text-[#869397]" />
                <span className="text-sm font-bold text-[#dfe2ef]">Event Log</span>
              </div>
              <span className="font-mono text-[9px] text-[#4edea3] animate-pulse">STREAMING</span>
            </div>

            <div className="flex-1 bg-[#0a0e17] rounded p-2 overflow-y-auto max-h-[160px] font-mono text-[11px] flex flex-col gap-1 text-[#bcc9cd] custom-scrollbar">
              {eventLogs.map((ev) => (
                <div key={ev.id} className="leading-snug">
                  <span className="text-[#869397] tabular-nums">{formatClock(ev.timestamp)}</span>{' '}
                  <span
                    className={
                      ev.tag === 'ERR'
                        ? 'text-[#ffb4ab]'
                        : ev.tag === 'AUTH' || ev.tag === 'ACCEPT'
                        ? 'text-[#4edea3]'
                        : ev.tag === 'PIPE' || ev.tag === 'NICK'
                        ? 'text-[#c0c1ff]'
                        : 'text-[#4cd7f6]'
                    }
                  >
                    {ev.tag}
                  </span>{' '}
                  :: {ev.message}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {/* /nick Change Modal */}
      {nickModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Update Socket Handle"
          className="fixed inset-0 bg-[#0a0e17]/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
        >
          <form
            onSubmit={handleApplyNick}
            className="bg-[#181b25] border border-white/10 p-6 rounded-xl shadow-2xl max-w-sm w-full flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-[#dfe2ef]">Update Socket Handle</span>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setNickModalOpen(false)}
                className="text-[#869397] hover:text-[#dfe2ef] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#bcc9cd] leading-relaxed">
              Sends <code className="text-[#4cd7f6] font-mono">/nick &lt;handle&gt;</code> over{' '}
              <code>fd:{selfPeer?.fd}</code>. The Python server acquires{' '}
              <code className="text-[#4edea3] font-mono">nicknames_lock</code> to guarantee handle uniqueness.
            </p>
            <input
              type="text"
              aria-label="New handle"
              value={nickDraft}
              onChange={(e) => setNickDraft(e.target.value)}
              className="bg-[#0a0e17] border border-white/10 px-3 py-2 rounded text-[#dfe2ef] font-mono text-sm focus:outline-none focus:border-[#4cd7f6]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNickModalOpen(false)}
                className="px-4 py-1.5 rounded bg-[#1c1f29] text-[#dfe2ef] hover:bg-[#262a34] font-mono text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[#4cd7f6] text-[#003640] hover:bg-[#06b6d4] text-xs font-semibold cursor-pointer"
              >
                Update Handle
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Send As Managed Peer Modal */}
      {peerComposerTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Send TCP Frame as @${peerComposerTarget.nick}`}
          className="fixed inset-0 bg-[#0a0e17]/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
        >
          <form
            onSubmit={handleSendAsPeerSubmit}
            className="bg-[#181b25] border border-white/10 p-6 rounded-xl shadow-2xl max-w-md w-full flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-[#dfe2ef]">
                Transmit as @{peerComposerTarget.nick} (fd:{peerComposerTarget.fd})
              </span>
              <button
                type="button"
                aria-label="Close peer composer"
                onClick={() => setPeerComposerTarget(null)}
                className="text-[#869397] hover:text-[#dfe2ef] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#bcc9cd]">
              Writes directly to @{peerComposerTarget.nick}&apos;s real TCP socket on Python{' '}
              <code>{peerComposerTarget.threadName}</code>. Try a broadcast or{' '}
              <code className="text-[#c0c1ff]">/msg @{selfPeer?.nick} hello!</code>
            </p>
            <input
              type="text"
              aria-label="Message from spawned peer"
              value={peerDraft}
              onChange={(e) => setPeerDraft(e.target.value)}
              placeholder={`e.g. /msg @${selfPeer?.nick || 'dev_alex'} Ack from fd:${peerComposerTarget.fd}`}
              className="bg-[#0a0e17] border border-white/10 px-3 py-2 rounded text-[#dfe2ef] font-mono text-xs focus:outline-none focus:border-[#4cd7f6]"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPeerComposerTarget(null)}
                className="px-4 py-1.5 rounded bg-[#1c1f29] text-[#dfe2ef] hover:bg-[#262a34] font-mono text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[#c0c1ff] text-[#1000a9] hover:opacity-90 text-xs font-semibold cursor-pointer"
              >
                Transmit Over TCP
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

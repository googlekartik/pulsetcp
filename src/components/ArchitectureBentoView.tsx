import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Cpu,
  Lock,
  Radio,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react';
import type { NavTab, ServerStats } from '../types/tcp';
import { formatBytesCompact, type PacketMetadata, type PeerInfo } from '../utils/protocol';

interface ArchitectureBentoViewProps {
  peers: PeerInfo[];
  stats: ServerStats | null;
  lastPacket: PacketMetadata;
  currentRttMs: number;
  onNavigate: (tab: NavTab) => void;
}

const CODE_SNIPPETS: Record<string, string> = {
  python_server: `server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(("0.0.0.0", 9090))
server.listen(128)
while running:
    conn, addr = server.accept()
    threading.Thread(target=handle_client, args=(conn, addr), daemon=True).start()`,
  python_client: `sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
sock.connect(("127.0.0.1", 9090))
threading.Thread(target=receive_loop, args=(sock,), daemon=True).start()
sock.sendall(b'/login dev_alex AlexPulse#2026\\n')
sock.sendall(b'/msg @alice_core Ready for burst\\n')`,
  cli_netcat: `# Connect directly to the Python TCP server over raw socket:
python3 python/tcp_client.py --host 127.0.0.1 --port 9090 --user dev_alex
> /join #infra-telemetry
> /broadcast Cluster node online
> /msg @dana_sec Key rotation verified`,
  wire_json: `{
  "type": "message:whisper",
  "fromNick": "dev_alex",
  "toNick": "dana_sec",
  "text": "Checksum verified: 0x9F4B2C81",
  "packet": { "srcPort": 52190, "dstPort": 9090, "flags": ["PSH", "ACK"] }
}`,
};

export const ArchitectureBentoView: React.FC<ArchitectureBentoViewProps> = ({
  peers,
  stats,
  lastPacket,
  currentRttMs,
  onNavigate,
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [activeLang, setActiveLang] = useState<keyof typeof CODE_SNIPPETS>('python_server');

  const launchCmd = 'python3 python/tcp_server.py --host 0.0.0.0 --port 9090';

  const handleCopyCommand = () => {
    navigator.clipboard?.writeText(launchCmd).catch(() => {});
    setCopiedCmd(true);
    window.setTimeout(() => setCopiedCmd(false), 1800);
  };

  const displayPeers = peers.slice(0, 4);

  return (
    <div className="flex flex-col w-full">
      {/* HERO BANNER SECTION */}
      <section className="relative w-full px-4 lg:px-8 pt-10 pb-14 overflow-hidden bg-[#0a0e17]">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-[#4cd7f6]/10 via-[#3131c0]/10 to-transparent blur-3xl pointer-events-none rounded-full" />
        <div className="relative max-w-7xl mx-auto flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#262a34] border border-white/10">
            <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
            <span className="font-mono text-[10px] font-semibold text-[#4cd7f6] tracking-wider uppercase">
              RFC 793 TCP/IP · Python AF_INET Sockets · Per-Client Threading
            </span>
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl font-bold text-[#dfe2ef] tracking-tight max-w-4xl leading-tight text-balance">
            Next-Gen Multi-Client <span className="text-[#4cd7f6]">TCP Engine</span> &amp; Socket Telemetry
          </h1>

          <p className="mt-4 max-w-3xl text-base text-[#bcc9cd] leading-relaxed">
            Built on Python <code className="text-[#4cd7f6] font-mono">socket</code> and{' '}
            <code className="text-[#4edea3] font-mono">threading</code> primitives with PBKDF2-HMAC-SHA256 user
            authentication, TCP_NODELAY low-latency dispatch, and real-time packet telemetry.
          </p>

          {/* Action Commands Bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 w-full max-w-3xl">
            <div className="flex items-center gap-2.5 bg-[#181b25] border border-white/10 px-4 py-2.5 rounded-lg shadow-lg">
              <span className="font-mono text-xs text-[#4cd7f6] select-none">$</span>
              <code className="font-mono text-xs sm:text-sm text-[#dfe2ef]">{launchCmd}</code>
              <button
                type="button"
                onClick={handleCopyCommand}
                aria-label="Copy Python server launch command"
                className="ml-2 px-2 py-1 rounded bg-[#262a34] hover:bg-[#353943] text-[#dfe2ef] text-[11px] font-mono transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copiedCmd ? (
                  <Check className="w-3.5 h-3.5 text-[#4edea3]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#4cd7f6]" />
                )}
                <span>{copiedCmd ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="px-5 py-2.5 rounded-lg bg-[#4cd7f6] hover:bg-[#06b6d4] text-[#003640] text-sm font-semibold transition-all shadow-[0_0_20px_-4px_rgba(6,182,212,0.4)] flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Terminal className="w-4 h-4" />
              <span>Launch Live Console</span>
            </button>
          </div>

          {/* Live Telemetry Metrics Strip */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
            <div className="p-4 rounded-lg bg-[#1c1f29] border border-white/5 flex flex-col items-center text-center">
              <span className="font-mono text-[10px] font-semibold text-[#bcc9cd] uppercase tracking-wider">
                Active Peers
              </span>
              <span className="text-3xl font-bold text-[#4edea3] tabular-nums mt-1">
                {stats?.activeClients ?? peers.length}
              </span>
              <span className="font-mono text-[11px] text-[#869397]">Authenticated Sockets</span>
            </div>

            <div className="p-4 rounded-lg bg-[#1c1f29] border border-white/5 flex flex-col items-center text-center">
              <span className="font-mono text-[10px] font-semibold text-[#bcc9cd] uppercase tracking-wider">
                Live TCP RTT
              </span>
              <span className="text-3xl font-bold text-[#4cd7f6] tabular-nums mt-1">
                {currentRttMs.toFixed(2)}ms
              </span>
              <span className="font-mono text-[11px] text-[#869397]">TCP_NODELAY Active</span>
            </div>

            <div className="p-4 rounded-lg bg-[#1c1f29] border border-white/5 flex flex-col items-center text-center">
              <span className="font-mono text-[10px] font-semibold text-[#bcc9cd] uppercase tracking-wider">
                Python Threads
              </span>
              <span className="text-3xl font-bold text-[#dfe2ef] tabular-nums mt-1">
                {stats?.activePythonThreads ?? 1}
              </span>
              <span className="font-mono text-[11px] text-[#869397]">threading.Thread Pool</span>
            </div>

            <div className="p-4 rounded-lg bg-[#1c1f29] border border-white/5 flex flex-col items-center text-center">
              <span className="font-mono text-[10px] font-semibold text-[#bcc9cd] uppercase tracking-wider">
                Frames Dispatched
              </span>
              <span className="text-3xl font-bold text-[#c0c1ff] tabular-nums mt-1">
                {stats?.totalPackets ?? 0}
              </span>
              <span className="font-mono text-[11px] text-[#869397]">
                {formatBytesCompact((stats?.totalTxBytes ?? 0) + (stats?.totalRxBytes ?? 0))} Total I/O
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO GRID SYSTEM SHOWCASE */}
      <section className="w-full px-4 lg:px-8 py-12 bg-[#0f131c]">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="font-mono text-[10px] font-semibold text-[#4cd7f6] uppercase tracking-wider">
                Core Systems &amp; Observability Matrix
              </span>
              <h2 className="text-3xl font-semibold text-[#dfe2ef] mt-1">
                Modular Python TCP Thread Architecture
              </h2>
            </div>
            <p className="font-mono text-xs text-[#bcc9cd] max-w-md">
              Multi-threaded socket multiplexing with explicit mutex locking (clients_lock, nicknames_lock, auth_store), PBKDF2 hashing, and point-to-point whispers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* BENTO CARD 1: 8 Cols - Live Socket Mesh Topology */}
            <div className="md:col-span-8 rounded-xl bg-[#181b25] border border-white/5 p-6 flex flex-col justify-between shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#1bbd85] text-[#00452e] font-mono text-[10px] font-semibold uppercase">
                    Socket Core
                  </span>
                  <span className="font-mono text-xs text-[#dfe2ef] font-semibold">
                    Live Python Socket Mesh Topology
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
                  <span className="font-mono text-[11px] text-[#4edea3]">
                    AF_INET · SOCK_STREAM ACTIVE
                  </span>
                </div>
              </div>

              <div className="w-full py-4 my-1 rounded-lg bg-[#0a0e17] px-4 flex flex-col gap-4 border border-white/5">
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[#bcc9cd]">
                  <span>BIND HOST: 0.0.0.0:9090 (INADDR_ANY)</span>
                  <span className="text-[#4cd7f6]">
                    CONCURRENT PEERS: {peers.length} Sockets Attached
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
                  <div className="sm:col-span-2 p-4 rounded-lg bg-[#1c1f29] flex flex-col gap-1.5 border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[#4cd7f6] uppercase font-semibold">
                        Python Daemon
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#262a34] text-[#4edea3]">
                        LISTEN
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[#dfe2ef] font-bold">
                      PulseTCP Server
                    </span>
                    <span className="font-mono text-[11px] text-[#869397]">
                      0.0.0.0:9090 (TCP_NODELAY)
                    </span>
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between font-mono text-[11px] text-[#bcc9cd]">
                      <span>Rx: {formatBytesCompact(stats?.totalRxBytes ?? 0)}</span>
                      <span className="text-[#4cd7f6] font-bold">
                        Tx: {formatBytesCompact(stats?.totalTxBytes ?? 0)}
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-1 hidden sm:flex items-center justify-center">
                    <svg className="w-full h-24 text-[#4cd7f6]" fill="none" viewBox="0 0 100 80">
                      <path d="M 5 40 H 45 C 55 40 55 15 65 15 H 95" opacity="0.6" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1.5" />
                      <path d="M 5 40 H 45 C 55 40 55 35 65 35 H 95" opacity="0.8" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M 5 40 H 45 C 55 40 55 55 65 55 H 95" opacity="0.9" stroke="currentColor" strokeDasharray="4 2" strokeWidth="1.5" />
                      <path d="M 5 40 H 45 C 55 40 55 75 65 75 H 95" opacity="0.5" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="5" cy="40" fill="#4edea3" r="3" />
                      <circle cx="95" cy="15" fill="#4cd7f6" r="2.5" />
                      <circle cx="95" cy="35" fill="#4cd7f6" r="2.5" />
                      <circle cx="95" cy="55" fill="#4cd7f6" r="2.5" />
                      <circle cx="95" cy="75" fill="#4cd7f6" r="2.5" />
                    </svg>
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    {displayPeers.length > 0 ? (
                      displayPeers.map((p) => (
                        <div
                          key={p.fd}
                          className="p-1.5 px-2.5 rounded bg-[#1c1f29] flex items-center justify-between font-mono text-[11px]"
                        >
                          <span className="text-[#dfe2ef] truncate">
                            fd:{p.fd} &lt;@{p.nick}&gt;
                          </span>
                          <span className="text-[#4edea3] tabular-nums shrink-0">
                            {p.state} ({p.lastRttMs}ms)
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-2 rounded bg-[#1c1f29] font-mono text-[11px] text-[#869397]">
                        Waiting for authenticated peer sockets...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 font-mono text-[11px] text-[#bcc9cd]">
                <span>Concurrency: 1 Python Thread per Client Descriptor</span>
                <span className="text-[#dfe2ef]">Registered Users: {stats?.registeredUsers ?? 4}</span>
              </div>
            </div>

            {/* BENTO CARD 2: 4 Cols - Authentication & Handshake */}
            <div className="md:col-span-4 rounded-xl bg-[#181b25] border border-white/5 p-6 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between pb-3">
                  <span className="px-2 py-0.5 rounded bg-[#1c1f29] text-[#4cd7f6] font-mono text-[10px] font-semibold uppercase">
                    Security &amp; Auth
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#4edea3]/10 text-[#4edea3] font-mono text-[11px]">
                    PBKDF2-SHA256
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-[#dfe2ef]">
                  Client Handshake &amp; Auth Layer
                </h3>
                <p className="mt-1 text-xs text-[#bcc9cd]">
                  Every socket completes 3-way TCP synchronization followed by salted credential verification before room access.
                </p>

                <div className="mt-4 p-3 rounded-lg bg-[#0a0e17] font-mono text-[11px] flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#869397]">
                    <span className="text-[#4edea3]">01</span>
                    <span>TCP [SYN] → Client initiates socket</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#869397]">
                    <span className="text-[#4edea3]">02</span>
                    <span>TCP [SYN-ACK] ← Python spawns Thread-N</span>
                  </div>
                  <div className="p-2 rounded bg-[#1c1f29] text-[#dfe2ef]">
                    <div className="text-[#4cd7f6] font-bold mb-1">Auth Envelope:</div>
                    <div className="text-[#869397]">{'{'}</div>
                    <div className="pl-3 text-[#c0c1ff]">
                      type: <span className="text-[#4edea3]">"login"</span>,
                    </div>
                    <div className="pl-3 text-[#c0c1ff]">
                      hash: <span className="text-[#869397]">"pbkdf2_sha256$260k"</span>
                    </div>
                    <div className="text-[#869397]">{'}'}</div>
                  </div>
                  <div className="flex items-center justify-between text-[#4edea3] font-bold pt-1">
                    <span>[200 AUTH_GRANTED]</span>
                    <span className="text-[#bcc9cd] font-normal">SQLite Stored</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between font-mono text-[11px] text-[#869397]">
                <span>16-byte Random Salt</span>
                <span className="text-[#4cd7f6]">Constant-Time Verify</span>
              </div>
            </div>

            {/* BENTO CARD 3: 4 Cols - Packet Frame */}
            <div className="md:col-span-4 rounded-xl bg-[#181b25] border border-white/5 p-6 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between pb-3">
                  <span className="px-2 py-0.5 rounded bg-[#31353f] text-[#c0c1ff] font-mono text-[10px] font-semibold uppercase">
                    Live Wire Frame
                  </span>
                  <span className="text-[#4edea3] font-mono text-[11px] tabular-nums">
                    {lastPacket.byteLength}B Payload
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-[#dfe2ef]">
                  TCP Packet Frame Inspector
                </h3>
                <p className="mt-1 text-xs text-[#bcc9cd]">
                  Real-time byte capture from the latest transmitted or received socket frame.
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
                    <div className="p-2 rounded bg-[#4cd7f6]/15 text-[#4cd7f6] font-bold">
                      <div className="text-[9px] uppercase">Src Port</div>
                      <span className="tabular-nums">{lastPacket.srcPort}</span>
                    </div>
                    <div className="p-2 rounded bg-[#3131c0]/30 text-[#c0c1ff] font-bold">
                      <div className="text-[9px] uppercase">Dst Port</div>
                      <span className="tabular-nums">{lastPacket.dstPort}</span>
                    </div>
                    <div className="p-2 rounded bg-[#1c1f29] text-[#dfe2ef] font-bold">
                      <div className="text-[9px] uppercase">SeqNum</div>
                      <span className="tabular-nums">#{lastPacket.seq}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded bg-[#0a0e17] font-mono text-[11px] text-[#dfe2ef] flex flex-col gap-1">
                    <div className="flex justify-between text-[#869397] text-[10px]">
                      <span>HEX STREAM PREVIEW</span>
                      <span className="text-[#4edea3]">{lastPacket.flags.join(' · ')}</span>
                    </div>
                    <div className="text-xs text-[#acedff] tracking-wider break-all">
                      {lastPacket.hexPreview}
                    </div>
                    <div className="mt-1 pt-1 border-t border-white/5 flex justify-between items-center text-[#869397]">
                      <span>CRC32 CHECKSUM</span>
                      <span className="text-[#4edea3]">{lastPacket.checksum}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between font-mono text-[11px] text-[#bcc9cd]">
                <span>Win Size: {lastPacket.winSize}</span>
                <span className="text-[#4edea3]">Zero Dropped Frames</span>
              </div>
            </div>

            {/* BENTO CARD 4: 8 Cols - Public Broadcast vs Private Whispers */}
            <div className="md:col-span-8 rounded-xl bg-[#181b25] border border-white/5 p-6 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between pb-3">
                  <span className="px-2 py-0.5 rounded bg-[#06b6d4] text-[#00424f] font-mono text-[10px] font-semibold uppercase">
                    Dispatch Mechanics
                  </span>
                  <span className="text-[#bcc9cd] font-mono text-[11px]">Dual Dispatch Engine</span>
                </div>
                <h3 className="text-lg font-semibold text-[#dfe2ef]">
                  Public Fan-Out Broadcast vs. Private Socket Whispers
                </h3>
                <p className="mt-1 text-xs text-[#bcc9cd]">
                  Route room-wide broadcasts under <code className="text-[#4cd7f6] font-mono">broadcast_lock</code> or
                  direct point-to-point whispers to an isolated client socket descriptor.
                </p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-[#0a0e17] border border-white/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs text-[#4cd7f6] font-bold">
                          /broadcast &lt;payload&gt;
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#1c1f29] font-mono text-[10px] text-[#dfe2ef]">
                          Fan-out: All Peers
                        </span>
                      </div>
                      <p className="text-xs text-[#869397]">
                        Iterates authenticated client sockets under mutex lock and writes UTF-8 frames via{' '}
                        <code className="text-[#dfe2ef]">conn.sendall()</code>.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between font-mono text-[11px]">
                      <span className="text-[#bcc9cd]">Cluster Dispatch:</span>
                      <span className="text-[#4edea3] font-bold">&lt; 1ms Local TCP</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-[#0a0e17] border border-white/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs text-[#c0c1ff] font-bold">
                          /msg @&lt;nick&gt; &lt;msg&gt;
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#1c1f29] font-mono text-[10px] text-[#c0c1ff]">
                          Point-to-Point
                        </span>
                      </div>
                      <p className="text-xs text-[#869397]">
                        Direct hash-table lookup via <code className="text-[#dfe2ef]">nicknames_lock</code>. Delivered strictly to target socket fd.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between font-mono text-[11px]">
                      <span className="text-[#bcc9cd]">Isolation Mode:</span>
                      <span className="text-[#4cd7f6] font-bold">Zero Peer Leakage</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[#bcc9cd]">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#4cd7f6]" />
                  <span>Thread-Safe Mutex Synchronization</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[#4edea3]" />
                  <span>Nagle Algorithm Disabled (TCP_NODELAY)</span>
                </div>
              </div>
            </div>

            {/* BENTO CARD 5: 6 Cols - Metrics Gauge */}
            <div className="md:col-span-6 rounded-xl bg-[#181b25] border border-white/5 p-6 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between pb-3">
                  <span className="px-2 py-0.5 rounded bg-[#1c1f29] text-[#4edea3] font-mono text-[10px] font-semibold uppercase">
                    Live Telemetry
                  </span>
                  <span className="font-mono text-[11px] text-[#4edea3]">Stream Nominal</span>
                </div>
                <h3 className="text-lg font-semibold text-[#dfe2ef]">
                  Integrated Socket Metrics Gauge
                </h3>
                <p className="mt-1 text-xs text-[#bcc9cd]">
                  Real-time operational counters streamed directly from the Python server process.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded bg-[#0a0e17]">
                    <span className="font-mono text-[10px] text-[#869397] uppercase">
                      Active Concurrent Peers
                    </span>
                    <div className="text-2xl font-bold text-[#dfe2ef] mt-1 tabular-nums">
                      {stats?.activeClients ?? peers.length}
                    </div>
                    <div className="w-full bg-[#1c1f29] h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-[#4cd7f6] h-full rounded-full"
                        style={{ width: `${Math.min(100, ((stats?.activeClients ?? 1) / 16) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded bg-[#0a0e17]">
                    <span className="font-mono text-[10px] text-[#869397] uppercase">
                      Packets Dispatched
                    </span>
                    <div className="text-2xl font-bold text-[#4edea3] mt-1 tabular-nums">
                      {stats?.totalPackets ?? 0}
                    </div>
                    <div className="w-full bg-[#1c1f29] h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-[#4edea3] h-full rounded-full w-4/5" />
                    </div>
                  </div>

                  <div className="p-3 rounded bg-[#0a0e17]">
                    <span className="font-mono text-[10px] text-[#869397] uppercase">
                      TX / RX Bandwidth
                    </span>
                    <div className="text-2xl font-bold text-[#4cd7f6] mt-1 tabular-nums">
                      {formatBytesCompact((stats?.totalTxBytes ?? 0) + (stats?.totalRxBytes ?? 0))}
                    </div>
                    <div className="w-full bg-[#1c1f29] h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-[#4cd7f6] h-full rounded-full w-1/3" />
                    </div>
                  </div>

                  <div className="p-3 rounded bg-[#0a0e17]">
                    <span className="font-mono text-[10px] text-[#869397] uppercase">
                      Server Uptime
                    </span>
                    <div className="text-2xl font-bold text-[#dfe2ef] mt-1 tabular-nums">
                      {stats?.uptimeSec ?? 0}s
                    </div>
                    <div className="w-full bg-[#1c1f29] h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-[#c0c1ff] h-full rounded-full w-full" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between font-mono text-[11px] text-[#869397]">
                <span>/api/health Endpoint Active</span>
                <span className="text-[#4edea3]">200 OK</span>
              </div>
            </div>

            {/* BENTO CARD 6: 6 Cols - Code Snippets */}
            <div className="md:col-span-6 rounded-xl bg-[#181b25] border border-white/5 p-6 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                  <span className="px-2 py-0.5 rounded bg-[#262a34] text-[#4cd7f6] font-mono text-[10px] font-semibold uppercase">
                    Python Socket Implementation
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'python_server', label: 'Server' },
                      { id: 'python_client', label: 'Client' },
                      { id: 'cli_netcat', label: 'CLI' },
                      { id: 'wire_json', label: 'Wire' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveLang(tab.id as keyof typeof CODE_SNIPPETS)}
                        className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors cursor-pointer ${
                          activeLang === tab.id
                            ? 'bg-[#4cd7f6] text-[#003640] font-semibold'
                            : 'bg-[#1c1f29] hover:bg-[#353943] text-[#bcc9cd]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-[#dfe2ef]">
                  Python Sockets &amp; Threading Core
                </h3>
                <p className="mt-1 text-xs text-[#bcc9cd]">
                  Clean standard-library TCP socket listener paired with multi-threaded client handlers and SQLite auth.
                </p>

                <div className="mt-4 rounded-lg bg-[#0a0e17] p-4 font-mono text-[11px] text-[#dfe2ef] overflow-x-auto border border-white/5">
                  <pre className="leading-5 whitespace-pre">{CODE_SNIPPETS[activeLang]}</pre>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between font-mono text-[11px] text-[#869397]">
                <span>Thread-Safe Mutex Locks</span>
                <button
                  type="button"
                  onClick={() => onNavigate('docs')}
                  className="text-[#4cd7f6] hover:underline cursor-pointer"
                >
                  View Full Python Source →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE PILLARS & CTA */}
      <section className="w-full px-4 lg:px-8 py-12 bg-[#0a0e17]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-[#181b25] border border-white/5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#1c1f29] flex items-center justify-center text-[#4cd7f6] mb-1">
              <Cpu className="w-5 h-5" />
            </div>
            <h4 className="text-base font-semibold text-[#dfe2ef]">Per-Client Python Threads</h4>
            <p className="text-xs text-[#869397] leading-relaxed">
              Every accepted TCP connection runs inside an isolated <code className="text-[#dfe2ef]">threading.Thread</code> worker so slow readers never stall concurrent peers.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-[#181b25] border border-white/5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#1c1f29] flex items-center justify-center text-[#4edea3] mb-1">
              <Radio className="w-5 h-5" />
            </div>
            <h4 className="text-base font-semibold text-[#dfe2ef]">TCP_NODELAY Low Latency</h4>
            <p className="text-xs text-[#869397] leading-relaxed">
              Disables Nagle buffering on every client socket so chat broadcasts and private whispers flush immediately to the wire.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-[#181b25] border border-white/5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#1c1f29] flex items-center justify-center text-[#c0c1ff] mb-1">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-base font-semibold text-[#dfe2ef]">Salted PBKDF2 Credential Store</h4>
            <p className="text-xs text-[#869397] leading-relaxed">
              Users register and authenticate over the TCP stream against a thread-safe SQLite database storing 260,000-round PBKDF2-HMAC-SHA256 digests.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-12 rounded-xl bg-gradient-to-r from-[#1c1f29] via-[#262a34] to-[#1c1f29] border border-white/10 p-8 text-center flex flex-col items-center gap-4 shadow-2xl">
          <span className="px-2.5 py-1 rounded bg-[#31353f] text-[#4cd7f6] font-mono text-[10px] font-semibold uppercase tracking-wider">
            Ready For Live Messaging
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#dfe2ef] max-w-2xl">
            Open the Multi-Client TCP Chat Console
          </h2>
          <p className="text-sm text-[#bcc9cd] max-w-xl">
            Register an account or sign in as a cluster operator, spawn concurrent Python socket peers, and inspect live TCP frames and thread locks in real time.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="px-6 py-2.5 rounded-lg bg-[#4cd7f6] hover:bg-[#06b6d4] text-[#003640] text-sm font-semibold transition-all shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] cursor-pointer"
            >
              Open TCP Chat Console
            </button>
            <button
              type="button"
              onClick={() => onNavigate('benchmarks')}
              className="px-6 py-2.5 rounded-lg bg-[#31353f] hover:bg-[#353943] text-[#dfe2ef] text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Run Live TCP Benchmark</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

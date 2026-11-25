export type CommandKind =
  | 'nick'
  | 'whisper'
  | 'broadcast'
  | 'join'
  | 'ping'
  | 'stats'
  | 'chat';

export interface ParsedCommand {
  kind: CommandKind;
  target?: string;
  channel?: string;
  body: string;
  raw: string;
  valid: boolean;
  error?: string;
}

export interface PacketMetadata {
  srcPort: number;
  dstPort: number;
  seq: number;
  ack: number;
  flags: string[];
  winSize: number;
  checksum: string;
  byteLength: number;
  hexPreview: string;
  asciiPreview: string;
}

export interface PeerInfo {
  fd: number;
  ip: string;
  port: number;
  nick: string;
  channel: string;
  threadName: string;
  role: string;
  authenticated?: boolean;
  isVirtual: boolean;
  connectedAt: number;
  lastRttMs: number;
  txBytes: number;
  rxBytes: number;
  state: string;
}

export interface LatencySummary {
  count: number;
  minMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export function sanitizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 24);
}

export function parseTcpCommand(input: string): ParsedCommand {
  const raw = input.trim();
  if (!raw) {
    return { kind: 'chat', body: '', raw, valid: false, error: 'Empty payload' };
  }

  if (raw.startsWith('/nick')) {
    const arg = sanitizeHandle(raw.slice(5));
    if (arg.length < 2) {
      return {
        kind: 'nick',
        body: arg,
        raw,
        valid: false,
        error: 'Handle must be at least 2 alphanumeric or underscore characters.',
      };
    }
    return { kind: 'nick', target: arg, body: arg, raw, valid: true };
  }

  if (raw.startsWith('/msg')) {
    const rest = raw.slice(4).trim();
    const firstSpace = rest.indexOf(' ');
    if (firstSpace === -1) {
      return {
        kind: 'whisper',
        body: '',
        raw,
        valid: false,
        error: 'Usage: /msg @<handle> <message>',
      };
    }
    const target = sanitizeHandle(rest.slice(0, firstSpace));
    const body = rest.slice(firstSpace + 1).trim();
    if (!target || !body) {
      return {
        kind: 'whisper',
        target,
        body,
        raw,
        valid: false,
        error: 'Both target handle and message body are required.',
      };
    }
    return { kind: 'whisper', target, body, raw, valid: true };
  }

  if (raw.startsWith('/broadcast')) {
    const body = raw.slice(10).trim();
    if (!body) {
      return {
        kind: 'broadcast',
        body: '',
        raw,
        valid: false,
        error: 'Usage: /broadcast <message>',
      };
    }
    return { kind: 'broadcast', body, raw, valid: true };
  }

  if (raw.startsWith('/join')) {
    const channel = raw.slice(5).trim().replace(/^#+/, '').toLowerCase();
    if (!channel) {
      return {
        kind: 'join',
        body: '',
        raw,
        valid: false,
        error: 'Usage: /join #<channel>',
      };
    }
    return { kind: 'join', channel, body: channel, raw, valid: true };
  }

  if (raw === '/ping' || raw.startsWith('/ping ')) {
    return { kind: 'ping', body: raw.slice(5).trim(), raw, valid: true };
  }

  if (raw === '/stats' || raw.startsWith('/stats ')) {
    return { kind: 'stats', body: raw.slice(6).trim(), raw, valid: true };
  }

  return { kind: 'chat', body: raw, raw, valid: true };
}

export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatHexPreview(text: string, maxBytes = 16): { hex: string; ascii: string } {
  const encoder = new TextEncoder();
  const slice = encoder.encode(text).slice(0, maxBytes);
  const hex = Array.from(slice)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
  const ascii = Array.from(slice)
    .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
    .join('');
  return { hex, ascii };
}

export function computeLatencySummary(samplesMs: number[]): LatencySummary {
  if (samplesMs.length === 0) {
    return { count: 0, minMs: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const percentile = (p: number) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return Number(sorted[idx].toFixed(2));
  };
  return {
    count: sorted.length,
    minMs: Number(sorted[0].toFixed(2)),
    avgMs: Number((sum / sorted.length).toFixed(2)),
    p50Ms: percentile(50),
    p95Ms: percentile(95),
    p99Ms: percentile(99),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
  };
}

export function filterPeers(peers: PeerInfo[], query: string): PeerInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return peers;
  return peers.filter(
    (p) =>
      p.nick.toLowerCase().includes(q) ||
      `fd:${p.fd}`.includes(q) ||
      String(p.fd).includes(q) ||
      p.ip.toLowerCase().includes(q) ||
      p.threadName.toLowerCase().includes(q)
  );
}

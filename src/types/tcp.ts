import type { PacketMetadata, PeerInfo } from '../utils/protocol';

export type NavTab =
  | 'architecture'
  | 'chat'
  | 'telemetry'
  | 'docs'
  | 'benchmarks';

export interface WorkerThreadInfo {
  threadName: string;
  fd: number;
  nick: string;
  state: string;
  channel: string;
  port: number;
  lastRttMs: number;
  authenticated: boolean;
}

export interface ServerStats {
  host: string;
  port: number;
  activeClients: number;
  registeredUsers: number;
  activePythonThreads: number;
  workers: WorkerThreadInfo[];
  totalTxBytes: number;
  totalRxBytes: number;
  totalPackets: number;
  uptimeSec: number;
  nickLockState: string;
  tcpNoDelay: boolean;
  channels: string[];
}

export type StreamItemKind =
  | 'handshake'
  | 'thread'
  | 'nick'
  | 'broadcast'
  | 'whisper'
  | 'system'
  | 'error'
  | 'pong'
  | 'stats';

export interface StreamEntry {
  id: string;
  kind: StreamItemKind;
  timestamp: number;
  fromNick?: string;
  fromFd?: number;
  fromThread?: string;
  toNick?: string;
  toFd?: number;
  channel?: string;
  isGlobalBroadcast?: boolean;
  isOwn?: boolean;
  title?: string;
  text: string;
  nonce?: string;
  dispatchUs?: number;
  packet?: PacketMetadata;
  statsSnapshot?: ServerStats;
}

export interface RawHexCapture {
  id: string;
  timestamp: number;
  direction: 'TCP_IN' | 'TCP_OUT' | 'SYN_ACK' | 'FIN_ACK';
  flags: string[];
  hex: string;
  ascii: string;
  bytes: number;
  checksum: string;
}

export interface EventLogItem {
  id: string;
  timestamp: number;
  tag: 'ACCEPT' | 'THREAD' | 'AUTH' | 'NICK' | 'BCAST' | 'PIPE' | 'FIN' | 'ERR' | 'INFO';
  message: string;
}

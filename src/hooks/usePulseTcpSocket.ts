import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EventLogItem,
  RawHexCapture,
  ServerStats,
  StreamEntry,
} from '../types/tcp';
import type { PacketMetadata, PeerInfo } from '../utils/protocol';

const DEFAULT_PACKET: PacketMetadata = {
  srcPort: 52190,
  dstPort: 9090,
  seq: 1000,
  ack: 1064,
  flags: ['SYN', 'ACK'],
  winSize: 65535,
  checksum: '0x00000000',
  byteLength: 64,
  hexPreview: '50 75 6c 73 65 54 43 50',
  asciiPreview: 'PulseTCP',
};

export function usePulseTcpSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const selfNickRef = useRef<string>('');
  const selfFdRef = useRef<number | null>(null);
  const autostartDoneRef = useRef(false);

  const [wsConnected, setWsConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selfPeer, setSelfPeer] = useState<PeerInfo | null>(null);
  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [messages, setMessages] = useState<StreamEntry[]>([]);
  const [rawCaptures, setRawCaptures] = useState<RawHexCapture[]>([]);
  const [eventLogs, setEventLogs] = useState<EventLogItem[]>([]);
  const [lastPacket, setLastPacket] = useState<PacketMetadata>(DEFAULT_PACKET);
  const [rttHistory, setRttHistory] = useState<number[]>([0.62, 0.48, 0.54, 0.41, 0.52, 0.44]);
  const [currentRttMs, setCurrentRttMs] = useState<number>(0.44);
  const [txBytes, setTxBytes] = useState<number>(0);
  const [rxBytes, setRxBytes] = useState<number>(0);

  const pushEventLog = useCallback((tag: EventLogItem['tag'], message: string, ts?: number) => {
    const entry: EventLogItem = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: ts || Date.now() / 1000,
      tag,
      message,
    };
    setEventLogs((prev) => [entry, ...prev].slice(0, 80));
  }, []);

  const pushRawCapture = useCallback(
    (pkt: PacketMetadata | undefined, direction: RawHexCapture['direction'], ts?: number) => {
      if (!pkt) return;
      setLastPacket(pkt);
      const item: RawHexCapture = {
        id: `raw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: ts || Date.now() / 1000,
        direction,
        flags: pkt.flags,
        hex: pkt.hexPreview,
        ascii: pkt.asciiPreview,
        bytes: pkt.byteLength,
        checksum: pkt.checksum,
      };
      setRawCaptures((prev) => [...prev.slice(-119), item]);
    },
    []
  );

  const pushMessage = useCallback((entry: Omit<StreamEntry, 'id'>) => {
    const item: StreamEntry = {
      ...entry,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    setMessages((prev) => [...prev.slice(-199), item]);
  }, []);

  const handleServerFrame = useCallback(
    (frame: Record<string, any>) => {
      const ftype = frame.type as string;
      const ts = typeof frame.timestamp === 'number' ? frame.timestamp : Date.now() / 1000;

      if (frame.stats) {
        setStats(frame.stats as ServerStats);
        setTxBytes(frame.stats.totalTxBytes ?? 0);
        setRxBytes(frame.stats.totalRxBytes ?? 0);
      }
      if (Array.isArray(frame.peers)) {
        setPeers(frame.peers as PeerInfo[]);
      }

      if (ftype === 'welcome') {
        const me = frame.self as PeerInfo;
        setSelfPeer(me);
        selfNickRef.current = me.nick;
        selfFdRef.current = me.fd;
        setAuthenticated(Boolean(me.authenticated));
        pushRawCapture(frame.packet, 'SYN_ACK', ts);
        pushEventLog(
          'ACCEPT',
          `fd:${me.fd} TCP handshake complete (${me.ip}:${me.port}) -> ${me.threadName}`,
          ts
        );
        pushMessage({
          kind: 'handshake',
          timestamp: ts,
          title: '[TCP_HANDSHAKE_COMPLETED] 3-WAY SYN / SYN-ACK / ACK',
          text: `Socket attached on fd:${me.fd} (${me.ip}:${me.port}) managed by Python ${me.threadName}. ${
            me.authenticated
              ? `Authenticated as @${me.nick}.`
              : 'Authenticate via PBKDF2-HMAC-SHA256 to join chat rooms.'
          }`,
          packet: frame.packet,
        });

        // Support ?autostart=1 for immediate verified demo sign-in
        const params = new URLSearchParams(window.location.search);
        if (
          params.get('autostart') === '1' &&
          !me.authenticated &&
          !autostartDoneRef.current &&
          wsRef.current?.readyState === WebSocket.OPEN
        ) {
          autostartDoneRef.current = true;
          wsRef.current.send(
            JSON.stringify({
              type: 'login',
              username: 'dev_alex',
              password: 'AlexPulse#2026',
              channel: 'general',
            })
          );
        }
        return;
      }

      if (ftype === 'auth:success') {
        const me = frame.self as PeerInfo;
        setSelfPeer(me);
        selfNickRef.current = me.nick;
        selfFdRef.current = me.fd;
        setAuthenticated(true);
        setAuthPending(false);
        setAuthError(null);
        setActiveChannel(me.channel || 'general');
        pushRawCapture(frame.packet, 'TCP_IN', ts);
        pushEventLog('AUTH', `200 AUTH_GRANTED :: @${me.nick} bound to fd:${me.fd}`, ts);
        pushMessage({
          kind: 'system',
          timestamp: ts,
          title: `[AUTH_GRANTED] @${me.nick} joined #${me.channel}`,
          text: `${frame.message}. Active socket fd:${me.fd} on ${me.threadName}.`,
          packet: frame.packet,
        });
        return;
      }

      if (ftype === 'auth:error') {
        setAuthPending(false);
        setAuthError(frame.message || 'Authentication failed.');
        pushEventLog('ERR', frame.message || 'Authentication error', ts);
        return;
      }

      if (ftype === 'auth:logged_out') {
        const me = frame.self as PeerInfo;
        setSelfPeer(me);
        selfNickRef.current = me.nick;
        setAuthenticated(false);
        setAuthPending(false);
        pushEventLog('AUTH', `Logged out @${frame.oldNick || ''} -> session unauthenticated`, ts);
        return;
      }

      if (ftype === 'peer:joined') {
        const peer = frame.peer as PeerInfo;
        pushRawCapture(frame.packet, 'SYN_ACK', ts);
        pushEventLog(
          'THREAD',
          `${peer.threadName} spawned for @${peer.nick} (fd:${peer.fd})`,
          ts
        );
        pushMessage({
          kind: 'thread',
          timestamp: ts,
          title: `[THREAD_SPAWN] ${peer.threadName}(target=handle_client, fd:${peer.fd})`,
          text: `Client @${peer.nick} authenticated from ${peer.ip}:${peer.port} and joined #${peer.channel}.`,
          packet: frame.packet,
        });
        return;
      }

      if (ftype === 'peer:left') {
        pushRawCapture(frame.packet, 'FIN_ACK', ts);
        pushEventLog('FIN', `fd:${frame.fd} @${frame.nick} disconnected (FIN/ACK)`, ts);
        pushMessage({
          kind: 'system',
          timestamp: ts,
          title: `[SOCKET_CLOSED] @${frame.nick} (fd:${frame.fd})`,
          text: `TCP stream closed cleanly. Worker ${frame.threadName} exited.`,
          packet: frame.packet,
        });
        return;
      }

      if (ftype === 'peer:nick_changed') {
        if (selfFdRef.current !== null && frame.fd === selfFdRef.current) {
          setSelfPeer((prev) => (prev ? { ...prev, nick: frame.newNick } : prev));
          selfNickRef.current = frame.newNick;
        }
        pushRawCapture(frame.packet, 'TCP_IN', ts);
        pushEventLog(
          'NICK',
          `fd:${frame.fd} @${frame.oldNick} -> @${frame.newNick} (nicknames_lock)`,
          ts
        );
        pushMessage({
          kind: 'nick',
          timestamp: ts,
          title: '[NICK_REGISTRATION] with nicknames_lock:',
          text: `Thread acquired mutex nicknames_lock: @${frame.oldNick} updated to @${frame.newNick} on fd:${frame.fd} (${frame.status}).`,
          dispatchUs: frame.dispatchUs,
          packet: frame.packet,
        });
        return;
      }

      if (ftype === 'peer:channel_switched') {
        if (selfFdRef.current !== null && frame.fd === selfFdRef.current) {
          setActiveChannel(frame.channel);
        }
        pushEventLog(
          'INFO',
          `@${frame.nick} switched channel #${frame.oldChannel} -> #${frame.channel}`,
          ts
        );
        pushMessage({
          kind: 'system',
          timestamp: ts,
          title: `[ROOM_SWITCH] @${frame.nick} -> #${frame.channel}`,
          text: `Socket fd:${frame.fd} subscribed to broadcast channel #${frame.channel}.`,
        });
        return;
      }

      if (ftype === 'message:broadcast') {
        const isOwn = frame.fromNick === selfNickRef.current;
        pushRawCapture(frame.packet, isOwn ? 'TCP_OUT' : 'TCP_IN', ts);
        pushEventLog(
          'BCAST',
          `#${frame.channel} @${frame.fromNick} (${frame.packet?.byteLength ?? 0}B in ${frame.dispatchUs ?? 0}us)`,
          ts
        );
        pushMessage({
          kind: 'broadcast',
          timestamp: ts,
          fromNick: frame.fromNick,
          fromFd: frame.fromFd,
          fromThread: frame.fromThread,
          channel: frame.channel,
          isGlobalBroadcast: Boolean(frame.isGlobalBroadcast),
          isOwn,
          text: frame.text,
          dispatchUs: frame.dispatchUs,
          packet: frame.packet,
        });
        return;
      }

      if (ftype === 'message:whisper') {
        const isOwn = frame.fromNick === selfNickRef.current;
        pushRawCapture(frame.packet, isOwn ? 'TCP_OUT' : 'TCP_IN', ts);
        pushEventLog(
          'PIPE',
          `Direct fd:${frame.fromFd} (@${frame.fromNick}) -> fd:${frame.toFd} (@${frame.toNick})`,
          ts
        );
        pushMessage({
          kind: 'whisper',
          timestamp: ts,
          fromNick: frame.fromNick,
          fromFd: frame.fromFd,
          fromThread: frame.fromThread,
          toNick: frame.toNick,
          toFd: frame.toFd,
          isOwn,
          text: frame.text,
          nonce: frame.nonce,
          dispatchUs: frame.dispatchUs,
          packet: frame.packet,
        });
        return;
      }

      if (ftype === 'system:pong') {
        const rtt =
          typeof frame.clientTs === 'number'
            ? Math.max(0.08, Number((Date.now() - frame.clientTs).toFixed(2)))
            : Number(((frame.dispatchUs ?? 250) / 1000).toFixed(2));
        setCurrentRttMs(rtt);
        setRttHistory((prev) => [...prev.slice(-19), rtt]);
        pushRawCapture(frame.packet, 'TCP_IN', ts);
        pushEventLog('INFO', `PONG from 127.0.0.1:9090 RTT=${rtt}ms (py_dispatch=${frame.dispatchUs}us)`, ts);
        pushMessage({
          kind: 'pong',
          timestamp: ts,
          title: '[TCP_PING_PONG]',
          text: `Socket response from 127.0.0.1:9090 in ${rtt} ms (Python worker ${frame.threadName} dispatch: ${frame.dispatchUs} us).`,
          dispatchUs: frame.dispatchUs,
          packet: frame.packet,
        });
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'rtt_report', rttMs: rtt }));
        }
        return;
      }

      if (ftype === 'system:stats') {
        pushRawCapture(frame.packet, 'TCP_IN', ts);
        pushMessage({
          kind: 'stats',
          timestamp: ts,
          title: '[PYTHON_SOCKET_STATS]',
          text: JSON.stringify(frame.stats, null, 2),
          statsSnapshot: frame.stats,
          packet: frame.packet,
        });
        return;
      }

      if (ftype === 'system:error') {
        pushEventLog('ERR', frame.message || 'Socket command error', ts);
        pushMessage({
          kind: 'error',
          timestamp: ts,
          title: `[${frame.code || 'SOCKET_ERROR'}]`,
          text: frame.message || 'Unknown socket error',
          packet: frame.packet,
        });
      }
    },
    [pushEventLog, pushMessage, pushRawCapture]
  );

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      pushEventLog('INFO', 'WebSocket-to-Python TCP bridge connected (port 9090)');
    };

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        handleServerFrame(frame);
      } catch {
        // Ignore non-JSON frame
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setAuthenticated(false);
      pushEventLog('ERR', 'TCP bridge disconnected — retrying in 2s');
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, 2000);
    };
  }, [handleServerFrame, pushEventLog]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  // Periodic live RTT ping every 8s when connected
  useEffect(() => {
    if (!wsConnected) return;
    const timer = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', clientTs: Date.now() }));
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [wsConnected]);

  const submitAuth = useCallback(
    (action: 'login' | 'register', username: string, password: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setAuthError('Socket bridge is reconnecting. Please wait a moment.');
        return;
      }
      setAuthError(null);
      setAuthPending(true);
      wsRef.current.send(
        JSON.stringify({
          type: action,
          username: username.trim(),
          password,
          channel: activeChannel,
        })
      );
    },
    [activeChannel]
  );

  const logout = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'logout' }));
    }
  }, []);

  const sendMessage = useCallback(
    (text: string, channelOverride?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      if (trimmed === '/ping') {
        wsRef.current.send(JSON.stringify({ type: 'ping', clientTs: Date.now() }));
        return;
      }
      wsRef.current.send(
        JSON.stringify({
          type: 'chat',
          text: trimmed,
          channel: channelOverride || activeChannel,
          clientTs: Date.now(),
        })
      );
    },
    [activeChannel]
  );

  const switchChannel = useCallback(
    (channel: string) => {
      setActiveChannel(channel);
      if (authenticated && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'chat',
            text: `/join #${channel}`,
            channel,
          })
        );
      }
    },
    [authenticated]
  );

  const clearBuffers = useCallback(() => {
    setMessages([]);
    setRawCaptures([]);
    pushEventLog('INFO', 'Console stream and raw hex buffers cleared');
  }, [pushEventLog]);

  const spawnConcurrentPeer = useCallback(async (customNick?: string) => {
    const res = await fetch('/api/spawn-peer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customNick ? { nick: customNick } : {}),
    });
    return res.json();
  }, []);

  const sendAsPeer = useCallback(
    async (nick: string, text: string, channel?: string) => {
      const res = await fetch('/api/peer-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick, text, channel: channel || activeChannel }),
      });
      return res.json();
    },
    [activeChannel]
  );

  return {
    wsConnected,
    authenticated,
    authPending,
    authError,
    setAuthError,
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
    connect,
    submitAuth,
    logout,
    sendMessage,
    switchChannel,
    clearBuffers,
    spawnConcurrentPeer,
    sendAsPeer,
  };
}

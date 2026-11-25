import express from 'express';
import http from 'http';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { computeLatencySummary } from './src/utils/protocol';

const PORT = Number(process.env.PORT || 3000);
const TCP_HOST = '127.0.0.1';
const TCP_PORT = Number(process.env.TCP_PORT || 9090);
const PID_FILE = path.resolve(process.cwd(), '.python_tcp.pid');

interface ManagedPeerSocket {
  nick: string;
  socket: net.Socket;
  authenticated: boolean;
  fd?: number;
  threadName?: string;
}

const managedPeers = new Map<string, ManagedPeerSocket>();
let pythonProc: ChildProcess | null = null;

function cleanupPreviousPythonPid() {
  try {
    if (fs.existsSync(PID_FILE)) {
      const oldPid = Number(fs.readFileSync(PID_FILE, 'utf-8').trim());
      if (Number.isInteger(oldPid) && oldPid > 0) {
        try {
          process.kill(oldPid, 'SIGTERM');
        } catch {
          // Process already dead
        }
      }
      fs.unlinkSync(PID_FILE);
    }
  } catch {
    // Ignore cleanup errors
  }
}

function waitForTcpReady(host: string, port: number, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const probe = new net.Socket();
      probe.setTimeout(400);
      probe.once('connect', () => {
        probe.destroy();
        resolve();
      });
      probe.once('error', () => {
        probe.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for Python TCP server on ${host}:${port}`));
        } else {
          setTimeout(attempt, 150);
        }
      });
      probe.connect(port, host);
    };
    attempt();
  });
}

async function startPythonTcpServer(): Promise<void> {
  cleanupPreviousPythonPid();
  const scriptPath = path.resolve(process.cwd(), 'python/tcp_server.py');
  const dbPath = path.resolve(process.cwd(), 'python/users.db');

  // Windows ships the interpreter as `python` (and `py`); `python3` only
  // exists on macOS/Linux. Pick the right command for this OS so
  // `npm run dev` works on Kartik's Windows PC too.
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  pythonProc = spawn(pythonCmd, [scriptPath, '--host', '0.0.0.0', '--port', String(TCP_PORT), '--db', dbPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  pythonProc.on('error', (err) => {
    console.error(
      `[py-tcp] Could not start the Python server with "${pythonCmd}": ${err.message}. ` +
        `Make sure Python is installed and on your PATH, then restart.`
    );
  });

  if (pythonProc.pid) {
    fs.writeFileSync(PID_FILE, String(pythonProc.pid), 'utf-8');
  }

  pythonProc.stdout?.on('data', (d) => {
    process.stdout.write(`[py-tcp] ${d.toString()}`);
  });
  pythonProc.stderr?.on('data', (d) => {
    process.stderr.write(`[py-tcp-err] ${d.toString()}`);
  });

  pythonProc.on('exit', (code) => {
    console.log(`[py-tcp] exited with code ${code}`);
  });

  await waitForTcpReady(TCP_HOST, TCP_PORT, 8000);
}

function connectAndAuthManagedPeer(
  username: string,
  password: string,
  action: 'login' | 'register' = 'login',
  channel = 'general'
): Promise<{ ok: boolean; peer?: ManagedPeerSocket; error?: string }> {
  return new Promise((resolve) => {
    if (managedPeers.has(username)) {
      resolve({ ok: true, peer: managedPeers.get(username) });
      return;
    }

    const sock = new net.Socket();
    sock.setNoDelay(true);
    let buffer = '';
    let settled = false;

    const peerObj: ManagedPeerSocket = {
      nick: username,
      socket: sock,
      authenticated: false,
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        sock.destroy();
        resolve({ ok: false, error: 'TCP auth handshake timed out' });
      }
    }, 4000);

    sock.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');
      while (buffer.includes('\n')) {
        const idx = buffer.indexOf('\n');
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const frame = JSON.parse(line);
          if (frame.type === 'welcome' && !peerObj.authenticated) {
            sock.write(
              JSON.stringify({
                type: action,
                username,
                password,
                channel,
                isVirtual: true,
              }) + '\n'
            );
          } else if (frame.type === 'auth:success') {
            peerObj.authenticated = true;
            peerObj.fd = frame.self?.fd;
            peerObj.threadName = frame.self?.threadName;
            managedPeers.set(username, peerObj);
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve({ ok: true, peer: peerObj });
            }
          } else if (frame.type === 'auth:error') {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              sock.destroy();
              resolve({ ok: false, error: frame.message || 'Authentication failed' });
            }
          }
        } catch {
          // Ignore malformed line
        }
      }
    });

    sock.on('error', (err) => {
      managedPeers.delete(username);
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, error: err.message });
      }
    });

    sock.on('close', () => {
      managedPeers.delete(username);
    });

    sock.connect(TCP_PORT, TCP_HOST);
  });
}

async function seedClusterPeers(): Promise<void> {
  const seeds: Array<[string, string, string]> = [
    ['alice_core', 'AlicePulse#2026', 'general'],
    ['bob_infra', 'BobPulse#2026', 'infra-telemetry'],
    ['dana_sec', 'DanaPulse#2026', 'general'],
  ];
  for (const [u, p, ch] of seeds) {
    await connectAndAuthManagedPeer(u, p, 'login', ch);
  }
}

async function runLiveTcpBenchmark(iterations = 25): Promise<{
  summary: ReturnType<typeof computeLatencySummary>;
  samplesMs: number[];
  throughputMsgPerSec: number;
  totalDurationMs: number;
}> {
  const count = Math.min(100, Math.max(5, iterations));
  const sock = new net.Socket();
  sock.setNoDelay(true);

  return new Promise((resolve, reject) => {
    let buffer = '';
    const samplesMs: number[] = [];
    let currentIndex = 0;
    let tStart = 0;
    let benchStart = 0;

    const sendNextPing = () => {
      tStart = performance.now();
      sock.write(JSON.stringify({ type: 'ping', clientTs: Date.now() }) + '\n');
    };

    const timeout = setTimeout(() => {
      sock.destroy();
      reject(new Error('Benchmark timed out'));
    }, 10000);

    sock.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');
      while (buffer.includes('\n')) {
        const idx = buffer.indexOf('\n');
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const frame = JSON.parse(line);
          if (frame.type === 'welcome') {
            benchStart = performance.now();
            sendNextPing();
          } else if (frame.type === 'system:pong') {
            const rtt = performance.now() - tStart;
            samplesMs.push(Number(rtt.toFixed(3)));
            currentIndex += 1;
            if (currentIndex < count) {
              sendNextPing();
            } else {
              const totalDurationMs = Number((performance.now() - benchStart).toFixed(2));
              clearTimeout(timeout);
              sock.destroy();
              const summary = computeLatencySummary(samplesMs);
              const throughputMsgPerSec =
                totalDurationMs > 0 ? Math.round((count / totalDurationMs) * 1000) : 0;
              resolve({ summary, samplesMs, throughputMsgPerSec, totalDurationMs });
            }
          }
        } catch {
          // ignore
        }
      }
    });

    sock.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    sock.connect(TCP_PORT, TCP_HOST);
  });
}

async function bootstrap() {
  await startPythonTcpServer();
  await seedClusterPeers();

  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const tcpSock = new net.Socket();
    tcpSock.setNoDelay(true);
    let tcpBuffer = '';
    let tcpConnected = false;
    const pendingQueue: string[] = [];

    tcpSock.on('connect', () => {
      tcpConnected = true;
      while (pendingQueue.length > 0) {
        const msg = pendingQueue.shift();
        if (msg) tcpSock.write(msg + '\n');
      }
    });

    tcpSock.on('data', (chunk) => {
      tcpBuffer += chunk.toString('utf-8');
      while (tcpBuffer.includes('\n')) {
        const idx = tcpBuffer.indexOf('\n');
        const line = tcpBuffer.slice(0, idx).trim();
        tcpBuffer = tcpBuffer.slice(idx + 1);
        if (!line) continue;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(line);
        }
      }
    });

    tcpSock.on('error', (err) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'system:error',
            code: 'TCP_SOCKET_ERROR',
            message: `Python TCP socket bridge error: ${err.message}`,
            timestamp: Date.now() / 1000,
          })
        );
      }
    });

    tcpSock.on('close', () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    tcpSock.connect(TCP_PORT, TCP_HOST);

    ws.on('message', (data) => {
      const payload = data.toString('utf-8').trim();
      if (!payload) return;
      if (tcpConnected) {
        tcpSock.write(payload + '\n');
      } else {
        pendingQueue.push(payload);
      }
    });

    ws.on('close', () => {
      tcpSock.destroy();
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      tcpHost: TCP_HOST,
      tcpPort: TCP_PORT,
      managedPeers: Array.from(managedPeers.values()).map((p) => ({
        nick: p.nick,
        fd: p.fd,
        threadName: p.threadName,
        authenticated: p.authenticated,
      })),
    });
  });

  app.get('/api/source', (_req, res) => {
    const serverCode = fs.readFileSync(
      path.resolve(process.cwd(), 'python/tcp_server.py'),
      'utf-8'
    );
    const clientCode = fs.readFileSync(
      path.resolve(process.cwd(), 'python/tcp_client.py'),
      'utf-8'
    );
    res.json({ serverCode, clientCode });
  });

  app.post('/api/spawn-peer', async (req, res) => {
    const requestedNick = typeof req.body?.nick === 'string' ? req.body.nick.trim() : '';
    const suffix = Math.floor(100 + Math.random() * 899);
    const username = requestedNick || `node_${suffix}`;
    const password = `PeerPass!${suffix}`;

    const result = await connectAndAuthManagedPeer(username, password, 'register', 'general');
    if (!result.ok || !result.peer) {
      res.status(400).json({ ok: false, error: result.error || 'Failed to spawn peer' });
      return;
    }
    res.json({
      ok: true,
      peer: {
        nick: result.peer.nick,
        fd: result.peer.fd,
        threadName: result.peer.threadName,
      },
    });
  });

  app.post('/api/peer-send', (req, res) => {
    const nick = typeof req.body?.nick === 'string' ? req.body.nick.trim().replace(/^@/, '') : '';
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const channel = typeof req.body?.channel === 'string' ? req.body.channel : 'general';
    const peer = managedPeers.get(nick);
    if (!peer || !peer.authenticated) {
      res.status(404).json({ ok: false, error: `Managed peer @${nick} not active.` });
      return;
    }
    if (!text) {
      res.status(400).json({ ok: false, error: 'Message text required.' });
      return;
    }
    peer.socket.write(JSON.stringify({ type: 'chat', text, channel }) + '\n');
    res.json({ ok: true });
  });

  app.post('/api/disconnect-peer', (req, res) => {
    const nick = typeof req.body?.nick === 'string' ? req.body.nick.trim().replace(/^@/, '') : '';
    const peer = managedPeers.get(nick);
    if (!peer) {
      res.status(404).json({ ok: false, error: `Peer @${nick} not found.` });
      return;
    }
    peer.socket.destroy();
    managedPeers.delete(nick);
    res.json({ ok: true });
  });

  app.post('/api/benchmark', async (req, res) => {
    const count = Number(req.body?.count ?? 25);
    try {
      const report = await runLiveTcpBenchmark(count);
      res.json({ ok: true, ...report });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Benchmark failed',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[PulseTCP] Web GUI + WebSocket-to-Python-TCP Bridge listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    for (const p of managedPeers.values()) {
      p.socket.destroy();
    }
    managedPeers.clear();
    if (pythonProc && !pythonProc.killed) {
      pythonProc.kill('SIGTERM');
    }
    cleanupPreviousPythonPid();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal server bootstrap error:', err);
  process.exit(1);
});

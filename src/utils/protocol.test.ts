import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLatencySummary,
  filterPeers,
  formatBytesCompact,
  formatHexPreview,
  parseTcpCommand,
  sanitizeHandle,
  type PeerInfo,
} from './protocol';

test('sanitizeHandle strips @ and invalid characters', () => {
  assert.equal(sanitizeHandle('  @alice_core! '), 'alice_core');
  assert.equal(sanitizeHandle('bob-infra'), 'bob-infra');
});

test('parseTcpCommand parses /nick, /msg, /broadcast, /join, /ping, /stats and plain chat', () => {
  const nickOk = parseTcpCommand('/nick frank_ops');
  assert.equal(nickOk.kind, 'nick');
  assert.equal(nickOk.valid, true);
  assert.equal(nickOk.target, 'frank_ops');

  const nickBad = parseTcpCommand('/nick a');
  assert.equal(nickBad.valid, false);

  const whisper = parseTcpCommand('/msg @dana_sec rotating keys');
  assert.equal(whisper.kind, 'whisper');
  assert.equal(whisper.valid, true);
  assert.equal(whisper.target, 'dana_sec');
  assert.equal(whisper.body, 'rotating keys');

  const bcast = parseTcpCommand('/broadcast hello cluster');
  assert.equal(bcast.kind, 'broadcast');
  assert.equal(bcast.valid, true);
  assert.equal(bcast.body, 'hello cluster');

  const join = parseTcpCommand('/join #infra-telemetry');
  assert.equal(join.kind, 'join');
  assert.equal(join.channel, 'infra-telemetry');

  const ping = parseTcpCommand('/ping');
  assert.equal(ping.kind, 'ping');
  assert.equal(ping.valid, true);

  const stats = parseTcpCommand('/stats socket');
  assert.equal(stats.kind, 'stats');
  assert.equal(stats.valid, true);

  const chat = parseTcpCommand('regular message');
  assert.equal(chat.kind, 'chat');
  assert.equal(chat.body, 'regular message');
});

test('formatBytesCompact formats bytes, KB, and MB cleanly', () => {
  assert.equal(formatBytesCompact(0), '0 B');
  assert.equal(formatBytesCompact(512), '512 B');
  assert.equal(formatBytesCompact(2048), '2.0 KB');
  assert.equal(formatBytesCompact(1024 * 1024 * 1.5), '1.50 MB');
});

test('formatHexPreview outputs hex bytes and printable ascii', () => {
  const res = formatHexPreview('PulseTCP\n');
  assert.equal(res.hex, '50 75 6c 73 65 54 43 50 0a');
  assert.equal(res.ascii, 'PulseTCP.');
});

test('computeLatencySummary computes accurate percentiles', () => {
  const summary = computeLatencySummary([1.0, 0.5, 2.0, 0.8, 1.2]);
  assert.equal(summary.count, 5);
  assert.equal(summary.minMs, 0.5);
  assert.equal(summary.maxMs, 2.0);
  assert.equal(summary.p50Ms, 1.0);
  assert.equal(summary.p99Ms, 2.0);
  assert.equal(summary.avgMs, 1.1);
});

test('filterPeers matches handle, fd, ip, or threadName', () => {
  const peers: PeerInfo[] = [
    {
      fd: 12,
      ip: '127.0.0.1',
      port: 49201,
      nick: 'alice_core',
      channel: 'general',
      threadName: 'Thread-1',
      role: 'ADMIN',
      isVirtual: false,
      connectedAt: 1,
      lastRttMs: 0.4,
      txBytes: 100,
      rxBytes: 200,
      state: 'ESTABLISHED',
    },
    {
      fd: 19,
      ip: '192.168.1.10',
      port: 52190,
      nick: 'dev_alex',
      channel: 'general',
      threadName: 'Thread-2',
      role: 'CLIENT',
      isVirtual: false,
      connectedAt: 2,
      lastRttMs: 0.5,
      txBytes: 50,
      rxBytes: 80,
      state: 'ESTABLISHED',
    },
  ];
  assert.equal(filterPeers(peers, 'fd:12').length, 1);
  assert.equal(filterPeers(peers, 'alex')[0].nick, 'dev_alex');
  assert.equal(filterPeers(peers, '192.168').length, 1);
  assert.equal(filterPeers(peers, '').length, 2);
});

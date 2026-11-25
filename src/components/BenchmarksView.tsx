import React, { useState } from 'react';
import { Gauge, Play } from 'lucide-react';
import type { LatencySummary } from '../utils/protocol';

interface BenchmarkResult {
  summary: LatencySummary;
  samplesMs: number[];
  throughputMsgPerSec: number;
  totalDurationMs: number;
}

export const BenchmarksView: React.FC = () => {
  const [count, setCount] = useState(25);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBenchmark = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Benchmark failed');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] font-semibold text-[#4edea3] uppercase tracking-wider">
            Live Python Socket Benchmarking
          </span>
          <h1 className="text-3xl font-bold text-[#dfe2ef] mt-1">
            TCP Latency &amp; Transport Benchmarks
          </h1>
          <p className="text-sm text-[#bcc9cd] mt-1 max-w-2xl">
            Dispatch real sequential TCP frames against <code className="text-[#4cd7f6] font-mono">127.0.0.1:9090</code> to measure live round-trip percentiles and throughput.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="bench-count" className="text-xs font-mono text-[#bcc9cd]">
            Frames:
          </label>
          <select
            id="bench-count"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="bg-[#181b25] border border-white/10 rounded px-2.5 py-1.5 font-mono text-xs text-[#dfe2ef]"
          >
            <option value={15}>15 pings</option>
            <option value={25}>25 pings</option>
            <option value={50}>50 pings</option>
            <option value={100}>100 pings</option>
          </select>
          <button
            type="button"
            onClick={runBenchmark}
            disabled={running}
            className="px-4 py-2 rounded bg-[#4cd7f6] hover:bg-[#06b6d4] disabled:opacity-50 text-[#003640] text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{running ? 'Running TCP Burst...' : 'Run Live Benchmark'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[#93000a]/30 border border-[#ffb4ab]/30 text-[#ffdad6] text-xs font-mono">
          {error}
        </div>
      )}

      {/* Live Measured Results */}
      {result && (
        <div className="rounded-xl bg-[#181b25] border border-[#4cd7f6]/20 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-[#4cd7f6]" />
              <h2 className="text-lg font-semibold text-[#dfe2ef]">
                Measured Python TCP Socket Results ({result.summary.count} frames)
              </h2>
            </div>
            <span className="font-mono text-xs text-[#4edea3] tabular-nums">
              Total Duration: {result.totalDurationMs} ms
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Min RTT', val: `${result.summary.minMs.toFixed(2)} ms`, color: 'text-[#4edea3]' },
              { label: 'p50 Median', val: `${result.summary.p50Ms.toFixed(2)} ms`, color: 'text-[#4cd7f6]' },
              { label: 'Avg RTT', val: `${result.summary.avgMs.toFixed(2)} ms`, color: 'text-[#dfe2ef]' },
              { label: 'p95 RTT', val: `${result.summary.p95Ms.toFixed(2)} ms`, color: 'text-[#c0c1ff]' },
              { label: 'p99 RTT', val: `${result.summary.p99Ms.toFixed(2)} ms`, color: 'text-[#4cd7f6]' },
              { label: 'Throughput', val: `${result.throughputMsgPerSec} msg/s`, color: 'text-[#4edea3]' },
            ].map((stat) => (
              <div key={stat.label} className="p-3 rounded-lg bg-[#0a0e17] border border-white/5">
                <span className="font-mono text-[10px] text-[#869397] uppercase">{stat.label}</span>
                <div className={`text-xl font-bold font-mono tabular-nums mt-1 ${stat.color}`}>
                  {stat.val}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparative Transport Table */}
      <div className="overflow-x-auto rounded-xl bg-[#181b25] border border-white/5 p-5 shadow-xl">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="text-[#869397] uppercase text-[10px] border-b border-white/5">
              <th className="py-3 px-4">Protocol / Platform</th>
              <th className="py-3 px-4">Socket Model</th>
              <th className="py-3 px-4">Framing</th>
              <th className="py-3 px-4">Header Overhead</th>
              <th className="py-3 px-4">Concurrency Mechanism</th>
            </tr>
          </thead>
          <tbody className="text-[#dfe2ef]">
            <tr className="bg-[#1c1f29] font-bold">
              <td className="py-3.5 px-4 text-[#4cd7f6]">PulseTCP (Python SOCK_STREAM)</td>
              <td className="py-3.5 px-4 text-[#4edea3]">Persistent Full-Duplex TCP</td>
              <td className="py-3.5 px-4">Newline JSON/Text + TCP_NODELAY</td>
              <td className="py-3.5 px-4 text-[#4cd7f6]">20 Bytes TCP/IP</td>
              <td className="py-3.5 px-4">1 Python Thread / Client FD</td>
            </tr>
            <tr className="text-[#bcc9cd] border-t border-white/5">
              <td className="py-3.5 px-4 font-semibold text-[#dfe2ef]">Standard WebSocket (RFC 6455)</td>
              <td className="py-3.5 px-4">HTTP Upgrade + Framed TCP</td>
              <td className="py-3.5 px-4">Masked UTF-8 / Binary</td>
              <td className="py-3.5 px-4">14 - 28 Bytes</td>
              <td className="py-3.5 px-4">Event Loop</td>
            </tr>
            <tr className="text-[#bcc9cd] border-t border-white/5">
              <td className="py-3.5 px-4 font-semibold text-[#dfe2ef]">HTTP/2 Server-Sent Events</td>
              <td className="py-3.5 px-4">Unidirectional Stream</td>
              <td className="py-3.5 px-4">Chunked Text</td>
              <td className="py-3.5 px-4">~45 Bytes (HPACK)</td>
              <td className="py-3.5 px-4">Stream Multiplexing</td>
            </tr>
            <tr className="text-[#bcc9cd] border-t border-white/5">
              <td className="py-3.5 px-4 font-semibold text-[#dfe2ef]">REST Long-Polling (HTTP/1.1)</td>
              <td className="py-3.5 px-4">Repeated Request/Response</td>
              <td className="py-3.5 px-4">Full HTTP Headers</td>
              <td className="py-3.5 px-4">~350 Bytes</td>
              <td className="py-3.5 px-4">Worker Pool</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Check, Copy, FileCode2, Lock } from 'lucide-react';

export const DocumentationView: React.FC = () => {
  const [activeFile, setActiveFile] = useState<'server' | 'client'>('server');
  const [source, setSource] = useState<{ serverCode: string; clientCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/source')
      .then((r) => r.json())
      .then((data) => setSource(data))
      .catch(() => {});
  }, []);

  const codeToShow =
    activeFile === 'server'
      ? source?.serverCode || 'Loading python/tcp_server.py...'
      : source?.clientCode || 'Loading python/tcp_client.py...';

  const handleCopy = () => {
    navigator.clipboard?.writeText(codeToShow).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-6">
      <div>
        <span className="font-mono text-[10px] font-semibold text-[#4cd7f6] uppercase tracking-wider">
          Python Socket &amp; Threading Reference
        </span>
        <h1 className="text-3xl font-bold text-[#dfe2ef] mt-1">
          TCP Client–Server Protocol &amp; Auth Architecture
        </h1>
        <p className="text-sm text-[#bcc9cd] mt-2 max-w-3xl">
          Inspect the live Python socket server, multi-threaded connection handler, PBKDF2-HMAC-SHA256 SQLite credential store, and supported TCP wire commands.
        </p>
      </div>

      {/* Protocol Commands Matrix */}
      <div className="rounded-xl bg-[#181b25] border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-[#4edea3]" />
          <h2 className="text-base font-semibold text-[#dfe2ef]">TCP Wire Command Reference</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
          {[
            { cmd: '/register <user> <pass>', desc: 'Creates salted PBKDF2-HMAC-SHA256 user in SQLite & authenticates socket.' },
            { cmd: '/login <user> <pass>', desc: 'Verifies password in constant time and grants access to chat rooms.' },
            { cmd: '/join #<channel>', desc: 'Moves authenticated socket into #general, #infra-telemetry, or #system-alerts.' },
            { cmd: '/broadcast <message>', desc: 'Fans out message across all authenticated client threads via broadcast_lock.' },
            { cmd: '/msg @<handle> <message>', desc: 'Direct point-to-point whisper routed only to target client socket fd.' },
            { cmd: '/nick <new_handle>', desc: 'Updates active handle safely under nicknames_lock mutex.' },
          ].map((item) => (
            <div key={item.cmd} className="p-3 rounded-lg bg-[#0a0e17] border border-white/5">
              <div className="text-[#4cd7f6] font-bold">{item.cmd}</div>
              <p className="font-sans text-xs text-[#869397] mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live Source Viewer */}
      <div className="rounded-xl bg-[#181b25] border border-white/5 p-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-[#4cd7f6]" />
            <div className="flex items-center gap-1 p-1 rounded bg-[#0a0e17]">
              <button
                type="button"
                onClick={() => setActiveFile('server')}
                className={`px-3 py-1 rounded font-mono text-xs cursor-pointer ${
                  activeFile === 'server'
                    ? 'bg-[#262a34] text-[#4cd7f6] font-semibold'
                    : 'text-[#bcc9cd]'
                }`}
              >
                python/tcp_server.py
              </button>
              <button
                type="button"
                onClick={() => setActiveFile('client')}
                className={`px-3 py-1 rounded font-mono text-xs cursor-pointer ${
                  activeFile === 'client'
                    ? 'bg-[#262a34] text-[#4cd7f6] font-semibold'
                    : 'text-[#bcc9cd]'
                }`}
              >
                python/tcp_client.py
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded bg-[#262a34] hover:bg-[#31353f] text-[#dfe2ef] font-mono text-xs flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#4edea3]" /> : <Copy className="w-3.5 h-3.5 text-[#4cd7f6]" />}
            <span>{copied ? 'Copied' : 'Copy Source'}</span>
          </button>
        </div>

        <div className="bg-[#0a0e17] rounded-lg p-4 max-h-[520px] overflow-auto border border-white/5 custom-scrollbar">
          <pre className="font-mono text-xs text-[#dfe2ef] leading-5 whitespace-pre">
            {codeToShow}
          </pre>
        </div>
      </div>
    </div>
  );
};

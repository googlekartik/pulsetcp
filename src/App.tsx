import { useEffect, useState } from 'react';
import { ArchitectureBentoView } from './components/ArchitectureBentoView';
import { BenchmarksView } from './components/BenchmarksView';
import { DocumentationView } from './components/DocumentationView';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { MultiClientChatView } from './components/MultiClientChatView';
import { PacketTelemetryView } from './components/PacketTelemetryView';
import { usePulseTcpSocket } from './hooks/usePulseTcpSocket';
import type { NavTab } from './types/tcp';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'architecture') return 'architecture';
    if (params.get('view') === 'telemetry') return 'telemetry';
    if (params.get('view') === 'docs') return 'docs';
    if (params.get('view') === 'benchmarks') return 'benchmarks';
    if (params.get('autostart') === '1') return 'chat';
    return 'chat';
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  const tcp = usePulseTcpSocket();

  return (
    <div className="bg-[#0f131c] text-[#dfe2ef] antialiased min-h-screen flex flex-col">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        wsConnected={tcp.wsConnected}
        authenticated={tcp.authenticated}
        username={tcp.selfPeer?.nick}
        onLogout={tcp.logout}
      />

      <main className="w-full pt-24 xl:pt-16 flex-1 flex flex-col bg-[#0f131c]">
        {activeTab === 'architecture' && (
          <ArchitectureBentoView
            peers={tcp.peers}
            stats={tcp.stats}
            lastPacket={tcp.lastPacket}
            currentRttMs={tcp.currentRttMs}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'chat' && (
          <MultiClientChatView
            wsConnected={tcp.wsConnected}
            authenticated={tcp.authenticated}
            authPending={tcp.authPending}
            authError={tcp.authError}
            onClearAuthError={() => tcp.setAuthError(null)}
            onSubmitAuth={tcp.submitAuth}
            selfPeer={tcp.selfPeer}
            activeChannel={tcp.activeChannel}
            peers={tcp.peers}
            stats={tcp.stats}
            messages={tcp.messages}
            rawCaptures={tcp.rawCaptures}
            eventLogs={tcp.eventLogs}
            lastPacket={tcp.lastPacket}
            rttHistory={tcp.rttHistory}
            currentRttMs={tcp.currentRttMs}
            txBytes={tcp.txBytes}
            rxBytes={tcp.rxBytes}
            onSendMessage={tcp.sendMessage}
            onSwitchChannel={tcp.switchChannel}
            onClearBuffers={tcp.clearBuffers}
            onReconnect={tcp.connect}
            onSpawnPeer={tcp.spawnConcurrentPeer}
            onSendAsPeer={tcp.sendAsPeer}
          />
        )}

        {activeTab === 'telemetry' && (
          <PacketTelemetryView
            peers={tcp.peers}
            stats={tcp.stats}
            rawCaptures={tcp.rawCaptures}
            lastPacket={tcp.lastPacket}
            rttHistory={tcp.rttHistory}
            currentRttMs={tcp.currentRttMs}
            onTriggerPing={() => tcp.sendMessage('/ping')}
          />
        )}

        {activeTab === 'docs' && <DocumentationView />}

        {activeTab === 'benchmarks' && <BenchmarksView />}
      </main>

      <Footer wsConnected={tcp.wsConnected} currentRttMs={tcp.currentRttMs} />
    </div>
  );
}

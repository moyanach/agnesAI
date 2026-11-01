import Sidebar from '@/components/layout/Sidebar';
import { useAppStore } from '@/stores/appStore';
import ChatView from '@/pages/ChatView';
import SettingsView from '@/pages/SettingsView';

const MainContent = () => {
  const { activeView } = useAppStore();

  switch (activeView) {
    case 'chat':
      return <ChatView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <ChatView />;
  }
};

const Layout = () => {
  return (
    <div className='flex h-full w-full overflow-hidden bg-[#111111]'>
      {/* Column 1: Main Navigation (Sidebar) */}
      <Sidebar />

      {/* Columns 2 & 3: Chat/Workspace View */}
      <main className='flex h-full flex-1 min-w-0 overflow-hidden'>
        <MainContent />
      </main>
    </div>
  );
};

export default Layout;

import { MessageSquare, Settings, Sparkles } from 'lucide-react';
import { useAppStore, View } from '@/stores/appStore';

const NavItem = ({
  view,
  label,
  icon: Icon,
}: {
  view: View;
  label: string;
  icon: React.ElementType;
}) => {
  const { activeView, setActiveView } = useAppStore();
  const isActive = activeView === view;

  return (
    <button
      onClick={() => setActiveView(view)}
      className='w-[60px] flex flex-col items-center py-2.5 px-1 rounded-xl transition-all duration-200 titlebar-no-drag sidebar-nav-item'
      data-active={isActive ? 'true' : 'false'}
    >
      <Icon size={22} />
      <span className='text-[11px] mt-1 font-medium'>{label}</span>
    </button>
  );
};

const Sidebar = () => {
  const { activeView, setActiveView } = useAppStore();

  return (
    <div className='w-[76px] h-full flex flex-col items-center pt-12 pb-4 flex-shrink-0 titlebar-drag sidebar-container border-r border-[#262626] bg-[#141414]'>
      {/* 顶部 Logo */}
      <button
        onClick={() => setActiveView('chat')}
        className='mb-4 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 titlebar-no-drag text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
        title='Agnes AI Agent'
      >
        <Sparkles size={22} />
      </button>

      {/* 导航按钮组 */}
      <div className='flex flex-col gap-2'>
        <NavItem view='chat' label='Agent' icon={MessageSquare} />
      </div>

      <div className='flex-grow' />

      {/* 底部设置 */}
      <div className='flex flex-col gap-2'>
        <NavItem view='settings' label='设置' icon={Settings} />
      </div>
    </div>
  );
};

export default Sidebar;

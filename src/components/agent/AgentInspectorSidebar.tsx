import React from 'react';
import { X, Sparkles } from 'lucide-react';
import ContextCard from './ContextCard';
import ConnectorsCard from './ConnectorsCard';
import OutputsCard from './OutputsCard';
import ChangesCard from './ChangesCard';
import { useChatStore } from '@/stores/chatStore';

interface AgentInspectorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentInspectorSidebar: React.FC<AgentInspectorSidebarProps> = ({
  isOpen,
  onClose,
}) => {
  const { skills } = useChatStore();

  if (!isOpen) return null;

  return (
    <aside className='w-[320px] h-full flex flex-col flex-shrink-0 bg-[#141414] border-l border-[#262626] z-20 select-none'>
      {/* 侧边栏头部 */}
      <div className='h-12 px-4 flex items-center justify-between border-b border-[#222222] flex-shrink-0'>
        <div className='flex items-center gap-2'>
          <Sparkles size={15} className='text-blue-400' />
          <span className='text-xs font-semibold text-neutral-200 tracking-wider uppercase'>
            Inspector
          </span>
        </div>
        <button
          onClick={onClose}
          className='w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors'
          title='关闭面板'
        >
          <X size={15} />
        </button>
      </div>

      {/* 卡片纵向堆叠区域 (完全对应参考图 2) */}
      <div className='flex-1 overflow-y-auto px-3 py-3.5 flex flex-col gap-3 custom-scrollbar'>
        {/* 1. Context 卡片 */}
        <ContextCard />

        {/* 2. Connectors 卡片 */}
        <ConnectorsCard />

        {/* 3. Outputs 卡片 */}
        <OutputsCard />

        {/* 4. Changes 卡片 */}
        <ChangesCard />

        {/* 底部已挂载 Skills 小标签栏 */}
        {skills.length > 0 && (
          <div className='px-1 pt-1 pb-2 flex flex-col gap-1.5 text-[11px] text-neutral-400'>
            <span className='font-medium text-neutral-400'>活跃 Skills ({skills.length}):</span>
            <div className='flex flex-wrap gap-1.5'>
              {skills.map((s) => (
                <span
                  key={s.id}
                  className='px-2 py-0.5 rounded-md bg-[#222] border border-[#333] text-neutral-300 text-[10px]'
                  title={s.description}
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AgentInspectorSidebar;

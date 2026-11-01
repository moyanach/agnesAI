import React, { useState } from 'react';
import { ChevronDown, ChevronRight, GitCommit, Check, FileDiff } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';

export const ChangesCard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const { gitStatus } = useChatStore();

  // 若无实际 git 变更，提供对应参考图 2 的默认展示数据
  const insertions = gitStatus ? gitStatus.insertions : 42830;
  const deletions = gitStatus ? gitStatus.deletions : 536;

  const displayChanges = gitStatus?.modifiedFiles && gitStatus.modifiedFiles.length > 0
    ? gitStatus.modifiedFiles.slice(0, 3)
    : [
        { path: 'notifycenter/src/sender.ts', status: 'M' },
        { path: 'silence-fastapi/api/routes.py', status: 'M' },
      ];

  const handleCommit = () => {
    setCommitting(true);
    setTimeout(() => {
      setCommitting(false);
      setCommitted(true);
      setTimeout(() => setCommitted(false), 2500);
    }, 600);
  };

  return (
    <div className='bg-[#1c1c1c] border border-[#2b2b2b] rounded-2xl overflow-hidden transition-all duration-200'>
      {/* 头部标题与折叠开关 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors'
      >
        <span className='font-semibold text-sm text-neutral-200 tracking-wide'>
          Changes
        </span>
        <div className='text-neutral-400'>
          {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </div>
      </button>

      {/* 折叠内容 */}
      {isOpen && (
        <div className='px-4 pb-3.5 pt-0.5 flex flex-col gap-2.5'>
          {displayChanges.map((change, idx) => {
            const shortName = change.path.split('/').pop() || change.path;
            const prefix = shortName.length > 8 ? `${shortName.slice(0, 2)}.` : shortName;

            return (
              <div
                key={idx}
                className='flex items-center justify-between py-1 px-1 text-xs'
              >
                {/* 左侧文件缩写与增删行数 */}
                <div className='flex items-center gap-2 min-w-0 pr-2'>
                  <div className='w-4 h-4 rounded bg-[#2c2c2c] flex items-center justify-center flex-shrink-0 text-neutral-400'>
                    <FileDiff size={11} />
                  </div>
                  <span className='font-mono text-neutral-400 truncate' title={change.path}>
                    {prefix}
                  </span>
                  <div className='flex items-center gap-1.5 font-mono text-[11px] flex-shrink-0'>
                    <span className='text-emerald-400 font-medium'>
                      +{insertions.toLocaleString()}
                    </span>
                    <span className='text-rose-400 font-medium'>
                      −{deletions.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 右侧圆角灰色 Commit 按钮 (还原图 2) */}
                <button
                  onClick={handleCommit}
                  disabled={committing || committed}
                  className='px-2.5 py-1 text-[11px] font-medium bg-[#2e2e2e] hover:bg-[#383838] active:bg-[#252525] text-neutral-200 rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 border border-[#3a3a3a] shadow-sm'
                >
                  {committed ? (
                    <>
                      <Check size={11} className='text-emerald-400' />
                      <span>Committed</span>
                    </>
                  ) : committing ? (
                    <span>...</span>
                  ) : (
                    <span>Commit changes</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChangesCard;

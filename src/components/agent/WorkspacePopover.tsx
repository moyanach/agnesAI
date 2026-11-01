import React, { useState, useRef, useEffect } from 'react';
import {
  MoreHorizontal,
  SlidersHorizontal,
  Plus,
  PlusSquare,
  GitPullRequest,
  ExternalLink,
  Loader2,
  FolderPlus,
  Check,
} from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';

export interface ProjectItem {
  id: string;
  name: string;
  path: string;
  hasChanges?: boolean;
  isLoading?: boolean;
}

export const WorkspacePopover: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const {
    activeSessionId,
    sessions,
    setSessionWorkDir,
    refreshGitStatus,
    refreshOutputs,
  } = useChatStore();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const currentWorkDir = activeSession?.workDir;

  // 默认预置项目列表 (对应参考图 1 中的 notifycenter, silence-fastapi, alarmcenter-fastapi)
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  // 初始化拉取最近项目
  useEffect(() => {
    const fetchProjects = async () => {
      if (window.electronAPI?.getRecentProjects) {
        const list = await window.electronAPI.getRecentProjects();
        if (Array.isArray(list) && list.length > 0) {
          setProjects(list);
          return;
        }
      }
      setProjects([
        {
          id: 'p1',
          name: 'notifycenter',
          path: '/opt/projects/notifycenter',
          hasChanges: true,
          isLoading: true,
        },
        {
          id: 'p2',
          name: 'silence-fastapi',
          path: '/opt/projects/silence-fastapi',
          hasChanges: false,
          isLoading: false,
        },
        {
          id: 'p3',
          name: 'alarmcenter-fastapi',
          path: '/opt/projects/alarmcenter-fastapi',
          hasChanges: false,
          isLoading: false,
        },
      ]);
    };
    fetchProjects();
  }, []);

  // 点击外部自动关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 添加新工作区项目
  const handleAddProject = async () => {
    if (window.electronAPI?.dialogSelectWorkDirectory) {
      const dir = await window.electronAPI.dialogSelectWorkDirectory();
      if (dir) {
        const folderName = dir.split('/').filter(Boolean).pop() || dir;
        const newProj: ProjectItem = {
          id: `p_${Date.now()}`,
          name: folderName,
          path: dir,
        };
        setProjects((prev) => [newProj, ...prev]);
        if (window.electronAPI?.addRecentProject) {
          window.electronAPI.addRecentProject(newProj);
        }
        if (activeSessionId) {
          await setSessionWorkDir(activeSessionId, dir);
        }
      }
    }
  };

  // 选择项目
  const handleSelectProject = async (proj: ProjectItem) => {
    if (activeSessionId) {
      await setSessionWorkDir(activeSessionId, proj.path);
      refreshGitStatus(proj.path);
    }
    setIsOpen(false);
  };

  // 查找合并请求
  const handleOpenMergeRequests = (proj: ProjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    // 模拟或真实打开浏览器 PR 页面
    const url = `https://github.com/search?q=repo%3A${proj.name}+is%3Apr&type=pullrequests`;
    window.open(url, '_blank');
  };

  return (
    <div className='relative titlebar-no-drag' ref={popoverRef}>
      {/* 顶部右侧 3 组工具按钮 (精准对应参考图 1 顶部按钮区) */}
      <div className='flex items-center gap-1.5'>
        {/* 1. 更多操作按钮 */}
        <button
          className='w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors'
          title='更多选项'
        >
          <MoreHorizontal size={16} />
        </button>

        {/* 2. Sliders/工作区控制开关按钮 (带圆角底色背景) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`h-7 px-2 flex items-center justify-center gap-1.5 rounded-lg border transition-all ${
            isOpen
              ? 'bg-[#2b2b2b] text-white border-neutral-600 shadow-sm'
              : 'bg-[#222222] text-neutral-300 border-[#333333] hover:bg-[#2a2a2a] hover:text-white'
          }`}
          title='切换或管理工作区项目'
        >
          <SlidersHorizontal size={13} />
          {currentWorkDir && (
            <span className='text-[11px] font-medium max-w-[100px] truncate'>
              {currentWorkDir.split('/').pop()}
            </span>
          )}
        </button>

        {/* 3. 分隔符 */}
        <div className='w-[1px] h-4 bg-[#333333] mx-1' />

        {/* 4. 带圆角方框的 [+] 新增按钮 */}
        <button
          onClick={handleAddProject}
          className='w-7 h-7 flex items-center justify-center rounded-lg border border-[#333333] bg-[#222222] text-neutral-300 hover:text-white hover:bg-[#2a2a2a] transition-colors'
          title='添加工作区项目'
        >
          <Plus size={14} />
        </button>
      </div>

      {/* 弹出菜单卡片 (完全还原参考图 1 浮层排版) */}
      {isOpen && (
        <div className='absolute right-0 top-9 w-[260px] bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl shadow-2xl z-50 overflow-hidden text-neutral-200 select-none animate-in fade-in zoom-in-95 duration-150'>
          {/* 项目列表区块 */}
          <div className='flex flex-col divide-y divide-[#282828] max-h-[360px] overflow-y-auto custom-scrollbar'>
            {projects.map((proj) => {
              const isActive = currentWorkDir === proj.path;

              return (
                <div key={proj.id} className='px-3.5 py-2.5 flex flex-col gap-1.5'>
                  {/* 项目头部：项目名 + 更多图标 */}
                  <div
                    onClick={() => handleSelectProject(proj)}
                    className='flex items-center justify-between cursor-pointer group'
                  >
                    <div className='flex items-center gap-1.5 min-w-0'>
                      <span className='font-semibold text-xs text-neutral-200 group-hover:text-blue-400 transition-colors truncate'>
                        {proj.name}
                      </span>
                      {isActive && (
                        <Check size={12} className='text-blue-400 flex-shrink-0' />
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className='text-neutral-500 hover:text-neutral-300 p-0.5 rounded'
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>

                  {/* 第一行：变更 (带加号方框图标，右侧带状态/转圈) */}
                  <div
                    onClick={() => handleSelectProject(proj)}
                    className='flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer text-xs text-neutral-300'
                  >
                    <div className='flex items-center gap-2'>
                      <PlusSquare size={14} className='text-neutral-400' />
                      <span>变更</span>
                    </div>
                    {proj.isLoading ? (
                      <Loader2
                        size={12}
                        className='animate-spin text-neutral-500'
                      />
                    ) : (
                      <span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />
                    )}
                  </div>

                  {/* 第二行：查找合并请求 (带 Git 分支图标，右侧外部链接图标) */}
                  <div
                    onClick={(e) => handleOpenMergeRequests(proj, e)}
                    className='flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer text-xs text-neutral-300'
                  >
                    <div className='flex items-center gap-2'>
                      <GitPullRequest size={14} className='text-neutral-400' />
                      <span>查找合并请求</span>
                    </div>
                    <ExternalLink size={12} className='text-neutral-500' />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 底部全局功能操作区 (完全对应参考图 1 底部) */}
          <div className='px-3.5 py-2.5 border-t border-[#282828] bg-[#1a1a1a] flex flex-col gap-1.5 text-xs text-neutral-400'>
            {/* 输出内容 + */}
            <div
              onClick={() => {
                if (activeSessionId) refreshOutputs(activeSessionId);
                setIsOpen(false);
              }}
              className='flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-white/[0.04] hover:text-neutral-200 transition-colors cursor-pointer'
            >
              <span>输出内容</span>
              <Plus size={13} className='text-neutral-400' />
            </div>

            {/* 创建文件或站点 */}
            <div
              onClick={handleAddProject}
              className='flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-white/[0.04] hover:text-neutral-200 transition-colors cursor-pointer'
            >
              <span>创建文件或站点</span>
              <FolderPlus size={13} className='text-neutral-400' />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspacePopover;

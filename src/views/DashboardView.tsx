import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Image,
  Video,
  UsersRound,
  ArrowUpRight,
  Clock,
  Bot,
  Sparkles,
} from "lucide-react";

interface DailyActivity {
  date: string;
  label: string;
  count: number;
}

interface RecentConversation {
  id: string;
  title: string;
  updated_at: number;
  messageCount: number;
}

interface RecentMediaTask {
  id: string;
  type: string;
  status: string;
  created_at: number;
  model?: string;
  prompt?: string;
}

interface DashboardStats {
  conversationCount: number;
  imageCount: number;
  videoCount: number;
  activeDaysLast7: number;
  dailyActivity: DailyActivity[];
  recentConversations: RecentConversation[];
  recentMediaTasks: RecentMediaTask[];
}

const formatTime = (timestamp?: number) => {
  if (!timestamp) return "-";
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  return `${Math.floor(diff / day)} 天前`;
};

const StatCard = ({
  icon: Icon,
  title,
  value,
  hint,
  accent,
}: {
  icon: any;
  title: string;
  value: string | number;
  hint: string;
  accent: "indigo" | "violet" | "cyan" | "emerald";
}) => {
  const accentClasses = {
    indigo: "from-indigo-500/20 to-indigo-500/5 text-[var(--accent-indigo)]",
    violet: "from-violet-500/20 to-violet-500/5 text-[var(--accent-violet)]",
    cyan: "from-cyan-500/20 to-cyan-500/5 text-[var(--accent-cyan)]",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-[var(--accent-emerald)]",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
      <div className="absolute right-0 top-0 h-24 w-24 translate-x-10 -translate-y-10 rounded-full bg-gradient-to-br from-indigo-500/10 to-transparent blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-[var(--text-secondary)]">{title}</div>
          <div className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
            {value}
          </div>
          <div className="mt-2 text-xs text-[var(--text-muted)]">{hint}</div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accentClasses[accent]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
};

const ActivityChart = ({ data }: { data: DailyActivity[] }) => {
  const maxValue = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-[var(--text-primary)]">最近 7 天活跃趋势</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">按当天产生的对话消息数量统计</p>
        </div>
        <div className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs text-[var(--accent-indigo)]">
          最近一周
        </div>
      </div>

      <div className="h-56">
        <div className="flex h-full items-end justify-between gap-2">
          {data.map((item) => {
            const height = Math.max(8, Math.round((item.count / maxValue) * 100));
            return (
              <div key={item.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="relative flex h-full w-full max-w-10 items-end justify-center rounded-xl bg-[var(--surface-muted)]">
                  <div
                    className="w-full rounded-xl bg-gradient-to-t from-indigo-600 to-cyan-400 opacity-90 transition-all duration-300 group-hover:opacity-100"
                    style={{ height: `${height}%` }}
                  />
                  <div className="absolute -top-8 rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[10px] text-[var(--text-primary)] opacity-0 transition-opacity group-hover:opacity-100">
                    {item.count}
                  </div>
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const RecentList = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-base font-medium text-[var(--text-primary)]">{title}</h3>
      <span className="text-xs text-[var(--text-muted)]">最近</span>
    </div>
    {children}
  </div>
);

export default function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    window.electronAPI?.dbGetDashboardStats?.().then((data) => {
      if (!mounted) return;
      setStats(data);
      setLoading(false);
    }).catch(() => {
      if (!mounted) return;
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const totalMedia = useMemo(
    () => (stats?.imageCount || 0) + (stats?.videoCount || 0),
    [stats],
  );

  return (
    <div className="h-full w-full bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div className="relative h-full w-full overflow-y-auto p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_28%)] pointer-events-none" />

        <div className="relative mx-auto max-w-6xl space-y-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs text-[var(--accent-indigo)]">
                <Bot size={14} />
                Agnes Desktop
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                工作台总览
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                汇总你的对话、图像生成、视频生成和最近一周活跃情况，快速了解当前应用使用状态。
              </p>
            </div>
            <div className="hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-right shadow-xl md:block">
              <div className="text-xs text-[var(--text-muted)]">今日状态</div>
              <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                {loading ? "加载中..." : `${stats?.activeDaysLast7 || 0}/7 天活跃`}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300" />
                正在加载总览数据...
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard
                  icon={MessageSquare}
                  title="对话总数"
                  value={stats?.conversationCount || 0}
                  hint="已创建的对话会话"
                  accent="indigo"
                />
                <StatCard
                  icon={Image}
                  title="图片生成"
                  value={stats?.imageCount || 0}
                  hint="历史图片任务"
                  accent="violet"
                />
                <StatCard
                  icon={Video}
                  title="视频生成"
                  value={stats?.videoCount || 0}
                  hint="历史视频任务"
                  accent="cyan"
                />
                <StatCard
                  icon={UsersRound}
                  title="最近 7 天活跃"
                  value={`${stats?.activeDaysLast7 || 0}/7`}
                  hint="有对话产生的天数"
                  accent="emerald"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <ActivityChart data={stats?.dailyActivity || []} />
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-medium text-[var(--text-primary)]">使用摘要</h3>
                    <Sparkles size={16} className="text-[var(--accent-indigo)]" />
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-xl bg-[var(--surface-muted)] p-4">
                      <div className="text-xs text-[var(--text-muted)]">媒体任务总量</div>
                      <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{totalMedia}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">图片 + 视频合计</div>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-muted)] p-4">
                      <div className="text-xs text-[var(--text-muted)]">最近活跃</div>
                      <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                        {stats?.activeDaysLast7 ? "活跃" : "暂无"}
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">最近 7 天</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <RecentList title="最近对话">
                  {stats?.recentConversations?.length ? (
                    <div className="space-y-2">
                      {stats.recentConversations.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                              {item.title || "未命名对话"}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                              <MessageSquare size={12} />
                              <span>{item.messageCount || 0} 条消息</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-xs text-[var(--text-muted)]">
                            {formatTime(item.updated_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-700 bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
                      暂无对话，点击左侧“对话”开始新的交流。
                    </div>
                  )}
                </RecentList>

                <RecentList title="最近媒体任务">
                  {stats?.recentMediaTasks?.length ? (
                    <div className="space-y-2">
                      {stats.recentMediaTasks.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-3"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-[var(--accent-indigo)]">
                              {item.type === "image" ? <Image size={16} /> : <Video size={16} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                                {item.type === "image" ? "图片生成" : "视频生成"}
                              </div>
                              <div className="mt-1 truncate text-xs text-[var(--text-muted)]">
                                {item.model || "默认模型"}
                              </div>
                              {item.prompt && (
                                <div className="mt-1 line-clamp-1 text-xs text-[var(--text-muted)]">
                                  {item.prompt}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-xs text-[var(--text-muted)]">
                            <span>{formatTime(item.created_at)}</span>
                            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px]">
                              {item.status || "unknown"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-700 bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
                      暂无生成记录。
                    </div>
                  )}
                </RecentList>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

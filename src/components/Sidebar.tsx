import { MessageSquare, Image, Video, Settings, Bot } from "lucide-react";
import { useAppStore, View } from "../stores/appStore";

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
      className="w-[68px] flex flex-col items-center py-2 px-1 rounded-lg transition-colors duration-200 titlebar-no-drag sidebar-nav-item"
      data-active={isActive ? "true" : "false"}
    >
      <Icon size={24} />
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
};

const Sidebar = () => {
  const { activeView, setActiveView } = useAppStore();

  return (
    <div className="w-20 h-full flex flex-col items-center pt-14 pb-4 flex-shrink-0 titlebar-drag sidebar-container">
      <button
        onClick={() => setActiveView("dashboard")}
        className="mb-2 w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-200 titlebar-no-drag sidebar-nav-item sidebar-dashboard-btn"
        data-active={activeView === "dashboard" ? "true" : "false"}
        title="应用总览"
      >
        <Bot size={28} />
      </button>

      <div className="flex flex-col gap-2">
        <NavItem view="chat" label="对话" icon={MessageSquare} />
        <NavItem view="image" label="图像" icon={Image} />
        <NavItem view="video" label="视频" icon={Video} />
      </div>

      <div className="flex-grow" />

      <div className="flex flex-col gap-2">
        <NavItem view="settings" label="设置" icon={Settings} />
      </div>
    </div>
  );
};

export default Sidebar;

import Sidebar from "./Sidebar";
import { useAppStore } from "../stores/appStore";
import DashboardView from "../views/DashboardView";
import ChatView from "../views/ChatView";
import ImageView from "../views/ImageView";
import VideoView from "../views/VideoView";
import SettingsView from "../views/SettingsView";

const MainContent = () => {
  const { activeView } = useAppStore();

  switch (activeView) {
    case "dashboard":
      return <DashboardView />;
    case "chat":
      return <ChatView />;
    case "image":
      return <ImageView />;
    case "video":
      return <VideoView />;
    case "settings":
      return <SettingsView />;
    default:
      return <ChatView />;
  }
};

const Layout = () => {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Column 1: Main Navigation (Sidebar) */}
      <Sidebar />

      {/* Columns 2 & 3: Rendered dynamically inside the active view */}
      <main className="flex h-full flex-1 min-w-0 overflow-hidden">
        <MainContent />
      </main>
    </div>
  );
};

export default Layout;


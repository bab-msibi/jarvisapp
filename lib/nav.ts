// In-app navigation: a tab plus a stack of overlay screens (mirrors native mobile nav)

export type TabId = "dashboard" | "agents" | "tasks" | "trading" | "files" | "mac" | "settings";

export type OverlayScreen =
  | "agentDetail" | "agentChat" | "terminal" | "openclaw" | "mcp" | "devices"
  | "notifications" | "security" | "analytics" | "createTask" | "taskDetail" | "profile" | "defaultModel";


export interface NavParams { id?: string }

export interface Nav {
  params: NavParams;
  push: (screen: OverlayScreen, params?: NavParams) => void;
  pop: () => void;
  go: (tab: TabId) => void;
  replace: (target: TabId) => void;
  /** Open any screen by its app path, e.g. "/settings/devices" */
  openPath: (path: string) => void;
}

export interface ScreenProps { nav: Nav }

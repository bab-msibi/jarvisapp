// In-app navigation: a tab plus a stack of overlay screens (mirrors native mobile nav)

export type TabId = "dashboard" | "agents" | "tasks" | "trading" | "files" | "mac" | "settings";

export type OverlayScreen =
  | "agentChat" | "multiAgent" | "terminal" | "models" | "openclaw" | "mcp" | "devices" | "workflow"
  | "notifications" | "security" | "analytics" | "createAgent" | "createTask" | "taskDetail"
  | "fileDetail" | "upload" | "profile";

// login/onboarding switch the app mode rather than pushing an overlay
export type PushTarget = OverlayScreen | "login" | "onboarding";

export interface NavParams { id?: string; col?: string }

export interface Nav {
  params: NavParams;
  push: (screen: PushTarget, params?: NavParams) => void;
  pop: () => void;
  go: (tab: TabId) => void;
  replace: (target: TabId | "login" | "onboarding") => void;
}

export interface ScreenProps { nav: Nav }

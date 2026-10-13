"use client";

import dynamic from "next/dynamic";

// The app keeps its navigation, theme and portfolio in localStorage, so it renders
// on the client only — there is nothing useful to server-render behind the login screen
const App = dynamic(() => import("./app-shell").then((m) => m.AppRoot), { ssr: false });

export function ClientApp() {
  return <div id="root"><App /></div>;
}

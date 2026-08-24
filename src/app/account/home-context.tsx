"use client";

import * as React from "react";

const HomeContext = React.createContext<string>("/");

export function useHome() {
  return React.useContext(HomeContext);
}

export function HomeProvider({ home, children }: { home: string; children: React.ReactNode }) {
  return <HomeContext.Provider value={home}>{children}</HomeContext.Provider>;
}

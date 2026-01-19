"use client";

import AIChatPanel, { AIAction } from "@/components/AIChatPanel";
import Header from "@/components/Header";
import { FilterState } from "@/components/UsersFilter";
import UsersPage from "@/components/UsersPage";
import { useState } from "react";

export default function Home() {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    name: "",
    email: "",
    phone: "",
    role: [],
    department: [],
    minAge: "",
    maxAge: "",
  });

  const handleFilterApply = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleAIPanelRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans dark:bg-black overflow-hidden">
      <Header
        onAskAIClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
        isAIPanelOpen={isAIPanelOpen}
      />
      <main className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-hidden h-full flex flex-col">
          <UsersPage 
            filters={filters} 
            onFiltersChange={setFilters}
            pendingAction={pendingAction} 
            onActionComplete={() => setPendingAction(null)}
            refreshKey={refreshKey}
            onRefresh={handleAIPanelRefresh}
          />
        </div>
        <AIChatPanel
          isOpen={isAIPanelOpen}
          onClose={() => setIsAIPanelOpen(false)}
          onFilterApply={handleFilterApply}
          onAction={setPendingAction}
          onRefresh={handleAIPanelRefresh}
        />
      </main>
    </div>
  );
}

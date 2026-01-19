"use client";

import { useState } from "react";
import Header from "@/components/Header";
import UsersPage from "@/components/UsersPage";
import AIChatPanel from "@/components/AIChatPanel";
import { FilterState } from "@/components/UsersFilter";

export default function Home() {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    phone: "",
    role: "",
    department: "",
    minAge: "",
    maxAge: "",
  });

  const handleFilterApply = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      <Header
        onAskAIClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
        isAIPanelOpen={isAIPanelOpen}
      />
      <main className="flex min-h-[calc(100vh-73px)] relative">
        <div className={`flex-1 transition-all duration-300 ${isAIPanelOpen ? "md:mr-96" : ""}`}>
          <UsersPage filters={filters} onFiltersChange={setFilters} />
        </div>
        <AIChatPanel
          isOpen={isAIPanelOpen}
          onClose={() => setIsAIPanelOpen(false)}
          onFilterApply={handleFilterApply}
        />
      </main>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import UsersTable from "./UsersTable";
import CreateUserForm from "./CreateUserForm";
import Modal from "./Modal";
import UsersFilter, { FilterState } from "./UsersFilter";

interface User {
  role?: string;
  department?: string;
}

interface UsersPageProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export default function UsersPage({ filters, onFiltersChange }: UsersPageProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);

  const handleUserCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Fetch unique roles and departments for filter dropdowns
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const response = await fetch("/api/users");
        if (response.ok) {
          const data = await response.json();
          const users: User[] = data.users;

          // Extract unique roles
          const roles = Array.from(
            new Set(users.map((u) => u.role).filter(Boolean))
          ) as string[];
          setAvailableRoles(roles.sort());

          // Extract unique departments
          const departments = Array.from(
            new Set(users.map((u) => u.department).filter(Boolean))
          ) as string[];
          setAvailableDepartments(departments.sort());
        }
      } catch (error) {
        console.error("Error fetching filter options:", error);
      }
    };

    fetchFilterOptions();
  }, [refreshKey]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Users Management
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Create and manage users in the system
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create User
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <UsersFilter
          onFilterChange={onFiltersChange}
          availableRoles={availableRoles}
          availableDepartments={availableDepartments}
          initialFilters={filters}
        />
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Users List
        </h2>
        <UsersTable refreshKey={refreshKey} filters={filters} />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New User"
      >
        <CreateUserForm
          onUserCreated={handleUserCreated}
          onClose={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";

export interface FilterState {
  search: string;
  phone: string;
  role: string;
  department: string;
  minAge: string;
  maxAge: string;
}

interface UsersFilterProps {
  onFilterChange: (filters: FilterState) => void;
  availableRoles: string[];
  availableDepartments: string[];
  initialFilters?: FilterState;
}

export default function UsersFilter({
  onFilterChange,
  availableRoles,
  availableDepartments,
  initialFilters,
}: UsersFilterProps) {
  const [filters, setFilters] = useState<FilterState>(
    initialFilters || {
      search: "",
      phone: "",
      role: "",
      department: "",
      minAge: "",
      maxAge: "",
    }
  );

  // Sync with external filter changes (from AI)
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
    }
  }, [initialFilters]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: FilterState = {
      search: "",
      phone: "",
      role: "",
      department: "",
      minAge: "",
      maxAge: "",
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const hasActiveFilters =
    filters.search ||
    filters.phone ||
    filters.role ||
    filters.department ||
    filters.minAge ||
    filters.maxAge;

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Search */}
        <div>
          <label
            htmlFor="search"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
          >
            Search
          </label>
          <input
            type="text"
            id="search"
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            placeholder="Search by name or email..."
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
          />
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
          >
            Phone
          </label>
          <input
            type="text"
            id="phone"
            value={filters.phone}
            onChange={(e) => handleFilterChange("phone", e.target.value)}
            placeholder="Search by phone number..."
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
          />
        </div>

        {/* Role */}
        <div>
          <label
            htmlFor="role"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
          >
            Role
          </label>
          <select
            id="role"
            value={filters.role}
            onChange={(e) => handleFilterChange("role", e.target.value)}
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
          >
            <option value="">All Roles</option>
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {/* Department */}
        <div>
          <label
            htmlFor="department"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
          >
            Department
          </label>
          <select
            id="department"
            value={filters.department}
            onChange={(e) => handleFilterChange("department", e.target.value)}
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
          >
            <option value="">All Departments</option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Min Age */}
        <div>
          <label
            htmlFor="minAge"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
          >
            Min Age
          </label>
          <input
            type="number"
            id="minAge"
            value={filters.minAge}
            onChange={(e) => handleFilterChange("minAge", e.target.value)}
            min="0"
            placeholder="Minimum age"
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
          />
        </div>

        {/* Max Age */}
        <div>
          <label
            htmlFor="maxAge"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2"
          >
            Max Age
          </label>
          <input
            type="number"
            id="maxAge"
            value={filters.maxAge}
            onChange={(e) => handleFilterChange("maxAge", e.target.value)}
            min="0"
            placeholder="Maximum age"
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
          />
        </div>
      </div>
    </div>
  );
}

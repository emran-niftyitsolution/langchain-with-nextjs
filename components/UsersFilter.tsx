
import { Button, Input, Select } from "antd";
import { useEffect, useState } from "react";

export interface FilterState {
  name: string;
  email: string;
  phone: string;
  role: string[];
  department: string[];
  minAge: string;
  maxAge: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
      name: "",
      email: "",
      phone: "",
      role: [],
      department: [],
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

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: FilterState = {
      name: "",
      email: "",
      phone: "",
      role: [],
      department: [],
      minAge: "",
      maxAge: "",
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const hasActiveFilters =
    filters.name ||
    filters.email ||
    filters.phone ||
    filters.role.length > 0 ||
    filters.department.length > 0 ||
    filters.minAge ||
    filters.maxAge;

  const filterContent = (
    <div className="grid grid-cols-1 gap-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          Name
        </label>
        <Input
          value={filters.name}
          onChange={(e) => handleFilterChange("name", e.target.value)}
          placeholder="Search by name..."
          allowClear
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          Email
        </label>
        <Input
          value={filters.email}
          onChange={(e) => handleFilterChange("email", e.target.value)}
          placeholder="Search by email..."
          allowClear
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          Phone
        </label>
        <Input
          value={filters.phone}
          onChange={(e) => handleFilterChange("phone", e.target.value)}
          placeholder="Search by phone number..."
          allowClear
        />
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          Role
        </label>
        <Select
          mode="multiple"
          value={filters.role}
          onChange={(val) => handleFilterChange("role", val)}
          placeholder="Select Roles"
          className="w-full"
          allowClear
          options={availableRoles.map(role => ({ label: role, value: role }))}
        />
      </div>

      {/* Department */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          Department
        </label>
        <Select
          mode="multiple"
          value={filters.department}
          onChange={(val) => handleFilterChange("department", val)}
          placeholder="Select Departments"
          className="w-full"
          allowClear
          options={availableDepartments.map(dept => ({ label: dept, value: dept }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Min Age */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            Min Age
          </label>
          <Input
            type="number"
            value={filters.minAge}
            onChange={(e) => handleFilterChange("minAge", e.target.value)}
            min={0}
            placeholder="Min"
            className="w-full"
          />
        </div>

        {/* Max Age */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            Max Age
          </label>
          <Input
            type="number"
            value={filters.maxAge}
            onChange={(e) => handleFilterChange("maxAge", e.target.value)}
            min={0}
            placeholder="Max"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Filters</h3>
        {hasActiveFilters && (
          <Button
            type="link"
            onClick={clearFilters}
            className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-0 h-auto"
          >
            Clear All
          </Button>
        )}
      </div>
      {filterContent}
    </div>
  );
}

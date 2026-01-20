"use client";

import { CloseOutlined, FilterOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Modal } from "antd";
import { useEffect, useState } from "react";
import { AIAction } from "./AIChatPanel";
import CreateUserForm from "./CreateUserForm";
import UsersFilter, { FilterState } from "./UsersFilter";
import UsersTable from "./UsersTable";

interface User {
  role?: string;
  department?: string;
}

interface UsersPageProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  pendingAction?: AIAction | null;
  onActionComplete?: () => void;
  refreshKey?: number;
  onRefresh?: () => void;
}

export default function UsersPage({ 
  filters, 
  onFiltersChange,
  pendingAction,
  onActionComplete,
  refreshKey = 0,
  onRefresh
}: UsersPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const handleUserSaved = () => {
    if (onRefresh) onRefresh();
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDelete = (userId: string) => {
    Modal.confirm({
      title: "Delete User",
      content: "Are you sure you want to delete this user? This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          const response = await fetch(`/api/users/${userId}`, {
            method: "DELETE",
          });
          if (response.ok) {
            if (onRefresh) onRefresh();
          } else {
            console.error("Failed to delete user");
          }
        } catch (error) {
          console.error("Error deleting user:", error);
        }
      },
    });
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingUser(null);
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

  // Handle AI CREATE action
  useEffect(() => {
    if (pendingAction && pendingAction.type === "CREATE") {
      setEditingUser(pendingAction.fields || null);
      setIsModalOpen(true);
      if (onActionComplete) onActionComplete();
    }
  }, [pendingAction, onActionComplete]);

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-zinc-50 dark:bg-black overflow-hidden relative">
      {/* Overlay for mobile filter drawer */}
      {isFilterDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsFilterDrawerOpen(false)}
        />
      )}

      {/* Filters Section - Drawer on mobile, Sidebar on desktop */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 md:z-auto
        w-80 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 
        transform ${isFilterDrawerOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        transition-transform duration-300 ease-in-out
        flex flex-col overflow-hidden
      `}>
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between md:hidden">
          <h3 className="font-semibold text-lg">Filters</h3>
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={() => setIsFilterDrawerOpen(false)} 
          />
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <UsersFilter
            onFilterChange={onFiltersChange}
            availableRoles={availableRoles}
            availableDepartments={availableDepartments}
            initialFilters={filters}
          />
        </div>
      </div>

      {/* Main Content - Takes remaining space */}
      <div className="flex-1 h-full overflow-y-auto min-w-0">
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full">
          <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center justify-between w-full sm:w-auto">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-1 md:mb-2">
                  Users Management
                </h1>
                <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400">
                  Create and manage users
                </p>
              </div>
              <div className="md:hidden">
                <Button
                  icon={<FilterOutlined />}
                  onClick={() => setIsFilterDrawerOpen(true)}
                >
                  Filters
                </Button>
              </div>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto"
            >
              Create User
            </Button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 shadow-sm overflow-hidden">
            <h2 className="text-lg md:text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Users List
            </h2>
            <div className="overflow-x-auto">
              <UsersTable 
                refreshKey={refreshKey} 
                filters={filters} 
                onEdit={handleEdit}
                onDelete={handleDelete}
                pendingAction={pendingAction}
                onActionComplete={onActionComplete}
              />
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onCancel={handleModalClose}
        title={editingUser ? "Edit User" : "Create New User"}
        footer={null}
        destroyOnHidden
      >
        <CreateUserForm
          initialValues={editingUser}
          userId={editingUser?._id}
          onSuccess={handleUserSaved}
          onClose={handleModalClose}
        />
      </Modal>
    </div>
  );
}

"use client";

import { PlusOutlined } from "@ant-design/icons";
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
    <div className="flex h-full w-full bg-zinc-50 dark:bg-black">
      {/* Sidebar - Fixed Height/Scrollable */}
      <div className="w-80 flex-shrink-0 h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto">
        <div className="p-6">
          <UsersFilter
            onFilterChange={onFiltersChange}
            availableRoles={availableRoles}
            availableDepartments={availableDepartments}
            initialFilters={filters}
          />
        </div>
      </div>

      {/* Main Content - Independent Scroll */}
      <div className="flex-1 h-full overflow-y-auto">
        <div className="p-8 max-w-[1600px] mx-auto w-full">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                Users Management
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                Create and manage users in the system
              </p>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => setIsModalOpen(true)}
            >
              Create User
            </Button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Users List
            </h2>
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

      <Modal
        open={isModalOpen}
        onCancel={handleModalClose}
        title={editingUser ? "Edit User" : "Create New User"}
        footer={null}
        destroyOnClose
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

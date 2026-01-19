import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { AIAction } from "./AIChatPanel";
import { FilterState } from "./UsersFilter";

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  age?: number;
  address?: string;
  role?: string;
  department?: string;
  createdAt: string;
  updatedAt: string;
}

interface UsersTableProps {
  refreshKey?: number;
  filters?: FilterState;
  onEdit?: (user: User) => void;
  onDelete?: (userId: string) => void;
  pendingAction?: AIAction | null;
  onActionComplete?: () => void;
}

export default function UsersTable({
  refreshKey,
  filters,
  onEdit,
  onDelete,
  pendingAction,
  onActionComplete,
}: UsersTableProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle pending AI actions
  useEffect(() => {
    if (!loading && pendingAction && users.length > 0 && onActionComplete) {
      // Create is handled by parent, ignore here
      if (pendingAction.type === "CREATE") return;

      if (!pendingAction.targetName) {
        onActionComplete();
        return;
      }

      const targetName = pendingAction.targetName.toLowerCase();
      const targetUser = users.find(u => u.name.toLowerCase().includes(targetName));

      if (targetUser) {
        if (pendingAction.type === "UPDATE" && onEdit) {
          // Merge AI provided fields with existing user data to pre-fill the form
          const userToEdit = { ...targetUser, ...(pendingAction.fields || {}) };
          onEdit(userToEdit); 
        } else if (pendingAction.type === "DELETE" && onDelete) {
          onDelete(targetUser._id);
        }
      }
      onActionComplete();
    }
  }, [loading, pendingAction, users, onEdit, onDelete, onActionComplete]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filters) {
        if (filters.name) params.append("name", filters.name);
        if (filters.email) params.append("email", filters.email);
        if (filters.phone) params.append("phone", filters.phone);
        if (filters.role && filters.role.length > 0) 
          params.append("role", filters.role.join(","));
        if (filters.department && filters.department.length > 0)
          params.append("department", filters.department.join(","));
        if (filters.minAge) params.append("minAge", filters.minAge);
        if (filters.maxAge) params.append("maxAge", filters.maxAge);
        if (filters.sortBy) params.append("sortBy", filters.sortBy);
        if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);
      }

      const queryString = params.toString();
      const url = queryString ? `/api/users?${queryString}` : "/api/users";

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [refreshKey, filters]);

  const columns: ColumnsType<User> = [
    { 
      title: 'Name', 
      dataIndex: 'name', 
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name)
    },
    { 
      title: 'Email', 
      dataIndex: 'email', 
      key: 'email' 
    },
    { 
      title: 'Phone', 
      dataIndex: 'phone', 
      key: 'phone', 
      render: (text) => text || '-' 
    },
    { 
      title: 'Age', 
      dataIndex: 'age', 
      key: 'age', 
      render: (text) => text || '-',
      sorter: (a, b) => (a.age || 0) - (b.age || 0)
    },
    { 
      title: 'Role', 
      dataIndex: 'role', 
      key: 'role', 
      render: (text) => text || '-' 
    },
    { 
      title: 'Department', 
      dataIndex: 'department', 
      key: 'department', 
      render: (text) => text || '-' 
    },
    { 
      title: 'Created At', 
      dataIndex: 'createdAt', 
      key: 'createdAt', 
      render: (text) => new Date(text).toLocaleDateString(),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          {onEdit && (
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => onEdit(record)}
            />
          )}
          {onDelete && (
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => onDelete(record._id)}
            />
          )}
        </Space>
      ),
    },
  ];

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <Table 
      dataSource={users} 
      columns={columns} 
      rowKey="_id" 
      loading={loading} 
      pagination={{ pageSize: 10 }}
      scroll={{ x: true }}
    />
  );
}

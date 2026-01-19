"use client";

import { useEffect, useState } from "react";
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
}

export default function UsersTable({
  refreshKey,
  filters,
}: UsersTableProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filters) {
        if (filters.search) params.append("search", filters.search);
        if (filters.phone) params.append("phone", filters.phone);
        if (filters.role) params.append("role", filters.role);
        if (filters.department)
          params.append("department", filters.department);
        if (filters.minAge) params.append("minAge", filters.minAge);
        if (filters.maxAge) params.append("maxAge", filters.maxAge);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-zinc-600 dark:text-zinc-400">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse border border-zinc-200 dark:border-zinc-800">
        <thead>
          <tr className="bg-zinc-100 dark:bg-zinc-900">
            <th className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Name
            </th>
            <th className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Email
            </th>
            <th className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Phone
            </th>
            <th className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Age
            </th>
            <th className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Role
            </th>
            <th className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Department
            </th>
            <th className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Created At
            </th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="border border-zinc-200 dark:border-zinc-800 px-4 py-8 text-center text-zinc-600 dark:text-zinc-400"
              >
                No users found
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr
                key={user._id}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <td className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                  {user.name}
                </td>
                <td className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                  {user.email}
                </td>
                <td className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                  {user.phone || "-"}
                </td>
                <td className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                  {user.age || "-"}
                </td>
                <td className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                  {user.role || "-"}
                </td>
                <td className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                  {user.department || "-"}
                </td>
                <td className="border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

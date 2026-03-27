import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { apiRequest, ApiError } from "../lib/http";
import { User, UserRole, UsersResponse } from "../lib/types";
import { DataTable } from "../components/ui/DataTable";
import { Pagination } from "../components/ui/Pagination";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

type UsersPageProps = {
  token: string | null;
};

const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "createdAt", label: "Created" },
  { key: "actions", label: "Actions" },
];

const UsersPage = ({ token }: UsersPageProps): JSX.Element => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const buildUrl = (): string => {
    let url = `/users?page=${page}&limit=20&sortBy=createdAt&sortOrder=desc`;
    if (roleFilter !== "") {
      url += `&role=${roleFilter}`;
    }
    return url;
  };

  const usersQuery = useQuery({
    queryKey: ["users", page, roleFilter, token],
    queryFn: ({ signal }) =>
      apiRequest<UsersResponse>(buildUrl(), {
        token,
        signal,
      }),
    enabled: Boolean(token),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest<void>(`/users/${userId}`, {
        method: "DELETE",
        token,
      }),
    onSuccess: () => {
      toast.success("User deleted successfully.");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
      setDeleteTarget(null);
    },
  });

  const handleDelete = (user: User): void => {
    setDeleteTarget(user);
  };

  const confirmDelete = (): void => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  const cancelDelete = (): void => {
    setDeleteTarget(null);
  };

  const handleRoleChange = (value: string): void => {
    setRoleFilter(value as UserRole | "");
    setPage(1);
  };

  if (!token) {
    return (
      <section className="panel" data-testid="page-users">
        <h1>Users</h1>
        <p>
          You need to <Link to="/login">sign in</Link> as admin.
        </p>
      </section>
    );
  }

  return (
    <section className="panel" data-testid="page-users">
      <h1>Users</h1>

      <div className="filters">
        <label>
          Filter by role
          <select
            data-testid="select-role-filter"
            value={roleFilter}
            onChange={(event) => handleRoleChange(event.target.value)}
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="mentor">Mentor</option>
            <option value="student">Student</option>
          </select>
        </label>
      </div>

      {usersQuery.isPending ? <p>Loading users...</p> : null}
      {usersQuery.error ? <p className="error">Failed to load users.</p> : null}

      {usersQuery.data ? (
        <>
          <DataTable<User>
            columns={COLUMNS}
            data={usersQuery.data.data}
            testId="users"
            keyExtractor={(user) => user.id}
            emptyMessage="No users found."
            renderRow={(user) => (
              <>
                <td data-testid={`user-name-${user.id}`}>{user.name ?? "—"}</td>
                <td data-testid={`user-email-${user.id}`}>{user.email}</td>
                <td data-testid={`user-role-${user.id}`}>
                  <span className="badge">{user.role}</span>
                </td>
                <td data-testid={`user-created-${user.id}`}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <button
                    type="button"
                    className="danger-button"
                    data-testid={`btn-delete-user-${user.id}`}
                    onClick={() => handleDelete(user)}
                  >
                    Delete
                  </button>
                </td>
              </>
            )}
          />

          {usersQuery.data.meta.totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={usersQuery.data.meta.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${deleteTarget?.email ?? "this user"}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />
    </section>
  );
};

export default UsersPage;

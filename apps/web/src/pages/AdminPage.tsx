import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { apiRequest, ApiError } from "../lib/http";
import { AdminResetResponse, UserRole } from "../lib/types";

type AdminPageProps = {
  token: string | null;
  role: UserRole | null;
  onResetDone: () => void;
};

const REQUIRED_CONFIRMATION = "RESET";

const AdminPage = ({ token, role, onResetDone }: AdminPageProps): JSX.Element => {
  const [confirmation, setConfirmation] = useState("");
  const toast = useToast();
  const navigate = useNavigate();

  const resetMutation = useMutation({
    mutationFn: () =>
      apiRequest<AdminResetResponse>("/admin/reset-database", {
        method: "POST",
        token,
        body: {
          confirmation,
        },
      }),
    onSuccess: () => {
      toast.success("Database reset completed. Sign in again.");
      onResetDone();
      navigate("/login", { replace: true });
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    resetMutation.mutate();
  };

  if (!token) {
    return (
      <section className="panel">
        <h1>Admin</h1>
        <p>
          You need to <Link to="/login">sign in</Link> as admin.
        </p>
      </section>
    );
  }

  if (role !== "admin") {
    return (
      <section className="panel">
        <h1>Admin</h1>
        <p className="error">Only admin can access this page.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Admin tools</h1>
      <div className="danger-zone">
        <h2>Reset database to baseline</h2>
        <p>
          This operation removes current users, bookings, sessions and courses, then restores baseline seed data.
          Weekly auto-reset runs on Sunday at 22:00.
        </p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Type <strong>{REQUIRED_CONFIRMATION}</strong> to confirm
            <input
              type="text"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
          </label>
          <button
            className="danger-button"
            type="submit"
            disabled={
              resetMutation.isPending || confirmation.trim().toUpperCase() !== REQUIRED_CONFIRMATION
            }
          >
            {resetMutation.isPending ? "Resetting..." : "Reset database now"}
          </button>
        </form>
        {resetMutation.error ? (
          <p className="error">{(resetMutation.error as ApiError).message}</p>
        ) : null}
      </div>
    </section>
  );
};

export default AdminPage;

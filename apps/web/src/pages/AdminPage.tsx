import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { applyPublicBugState } from "../lib/bugs";
import { apiRequest, ApiError } from "../lib/http";
import {
  AdminResetResponse,
  InternalBugsResponse,
  UpdateRuntimeBugsRequest,
  UpdateRuntimeBugsResponse,
  UserRole,
} from "../lib/types";

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
  const queryClient = useQueryClient();

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

  const bugsQuery = useQuery({
    queryKey: ["internal", "bugs", token],
    queryFn: ({ signal }) =>
      apiRequest<InternalBugsResponse>("/internal/bugs", {
        token,
        signal,
      }),
    enabled: Boolean(token) && role === "admin",
  });

  const bugsUpdateMutation = useMutation({
    mutationFn: (payload: UpdateRuntimeBugsRequest) =>
      apiRequest<UpdateRuntimeBugsResponse>("/admin/bugs/state", {
        method: "PUT",
        token,
        body: payload,
      }),
    onSuccess: (response) => {
      applyPublicBugState({
        backendBugs: response.data.backendBugs,
        frontendBugs: response.data.frontendBugs,
      });
      void queryClient.invalidateQueries({ queryKey: ["internal", "bugs"] });
      void queryClient.invalidateQueries({ queryKey: ["bugs", "public-state"] });
      toast.success("Runtime bug flags updated.");
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    resetMutation.mutate();
  };

  const updateBugs = (payload: UpdateRuntimeBugsRequest): void => {
    bugsUpdateMutation.mutate(payload);
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
        <h2>Runtime bug toggles</h2>
        <p>Toggle backend and frontend bug mode instantly, without restarting Docker containers.</p>

        {bugsQuery.isPending ? <p>Loading current bug state...</p> : null}
        {bugsQuery.error ? <p className="error">Cannot load bug state.</p> : null}

        {bugsQuery.data ? (
          <>
            <p>
              Backend bugs: <strong>{bugsQuery.data.data.backendBugs ? "ON" : "OFF"}</strong>
            </p>
            <p>
              Frontend bugs: <strong>{bugsQuery.data.data.frontendBugs ? "ON" : "OFF"}</strong>
            </p>
            <div className="button-row">
              <button
                type="button"
                onClick={() => updateBugs({ backendBugs: true })}
                disabled={bugsUpdateMutation.isPending || bugsQuery.data.data.backendBugs}
              >
                Enable backend bugs
              </button>
              <button
                type="button"
                onClick={() => updateBugs({ backendBugs: false })}
                disabled={bugsUpdateMutation.isPending || !bugsQuery.data.data.backendBugs}
              >
                Disable backend bugs
              </button>
              <button
                type="button"
                onClick={() => updateBugs({ frontendBugs: true })}
                disabled={bugsUpdateMutation.isPending || bugsQuery.data.data.frontendBugs}
              >
                Enable frontend bugs
              </button>
              <button
                type="button"
                onClick={() => updateBugs({ frontendBugs: false })}
                disabled={bugsUpdateMutation.isPending || !bugsQuery.data.data.frontendBugs}
              >
                Disable frontend bugs
              </button>
            </div>
            <h3>Backend bug flags</h3>
            <pre className="debug-json">{JSON.stringify(bugsQuery.data.data.flags, null, 2)}</pre>
          </>
        ) : null}

        {bugsUpdateMutation.error ? (
          <p className="error">{(bugsUpdateMutation.error as ApiError).message}</p>
        ) : null}
      </div>

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

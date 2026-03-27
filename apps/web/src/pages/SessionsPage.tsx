import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/EmptyState";
import { Pagination } from "../components/ui/Pagination";
import { Spinner } from "../components/ui/Spinner";
import { isUiBugModeEnabled } from "../lib/bugs";
import { formatDateTime } from "../lib/datetime";
import { apiRequest, ApiError } from "../lib/http";
import { SessionListItem, SessionsResponse, UserRole } from "../lib/types";

type SessionsPageProps = {
  token: string | null;
  role: UserRole | null;
};

type BookingResponse = {
  data: {
    id: string;
    status: string;
  };
};

const COLUMNS = [
  { key: "course", label: "Course" },
  { key: "mentor", label: "Mentor" },
  { key: "startsAt", label: "Date/Time", sortable: true },
  { key: "location", label: "Location" },
  { key: "capacity", label: "Capacity" },
  { key: "available", label: "Available" },
  { key: "createdAt", label: "Created", sortable: true },
  { key: "actions", label: "Actions" },
];

const SessionsPage = ({ token, role }: SessionsPageProps): JSX.Element => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortBy, setSortBy] = useState("startsAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [courseId, setCourseId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filters, setFilters] = useState({ courseId: "", from: "", to: "" });

  const [confirmSessionId, setConfirmSessionId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const search = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sortBy,
      sortOrder,
    });

    if (filters.courseId) {
      search.set("courseId", filters.courseId);
    }

    if (filters.from) {
      search.set("from", new Date(filters.from).toISOString());
    }

    if (filters.to) {
      search.set("to", new Date(filters.to).toISOString());
    }

    return search.toString();
  }, [page, limit, sortBy, sortOrder, filters]);

  const sessionsQuery = useQuery({
    queryKey: ["sessions", queryParams, token],
    queryFn: ({ signal }) =>
      apiRequest<SessionsResponse>(`/sessions?${queryParams}`, {
        token,
        signal,
      }),
  });

  const bookingMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest<BookingResponse>("/bookings", {
        method: "POST",
        token,
        body: { sessionId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] });
      toast.success("Booking created.");
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  const onFilterSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setFilters({ courseId: courseId.trim(), from, to });
    setPage(1);
    toast.info("Filters applied.");
  };

  const submitBooking = (sessionId: string): void => {
    bookingMutation.mutate(sessionId);
    if (isUiBugModeEnabled()) {
      bookingMutation.mutate(sessionId);
    }
  };

  const handleSort = (key: string): void => {
    if (key === sortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const sessions = sessionsQuery.data?.data ?? [];
  const totalPages = sessionsQuery.data?.meta.totalPages ?? 1;
  const canCreate = role === "admin" || role === "mentor";

  return (
    <section className="panel" data-testid="page-sessions">
      <h1>Sessions</h1>

      {canCreate ? (
        <Link to="/sessions/new" className="button" data-testid="btn-create-session">
          Create session
        </Link>
      ) : null}

      <form className="filter-form" onSubmit={onFilterSubmit}>
        <label>
          Course ID
          <input
            type="text"
            data-testid="input-filter-courseId"
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            placeholder="optional"
          />
        </label>
        <label>
          From
          <input
            type="datetime-local"
            data-testid="input-filter-from"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="datetime-local"
            data-testid="input-filter-to"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <button type="submit" data-testid="btn-apply-filters">
          Apply filters
        </button>
      </form>

      {sessionsQuery.isPending ? <Spinner /> : null}
      {sessionsQuery.error ? <p className="error">Failed to load sessions.</p> : null}

      {!sessionsQuery.isPending && !sessionsQuery.error && sessions.length === 0 ? (
        <EmptyState title="No sessions found" description="Try adjusting your filters." />
      ) : null}

      {sessions.length > 0 ? (
        <DataTable<SessionListItem>
          columns={COLUMNS}
          data={sessions}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          keyExtractor={(item) => item.id}
          testId="sessions"
          renderRow={(session) => (
            <>
              <td data-testid={`cell-course-${session.id}`}>
                <Link to={`/courses/${session.course.id}`}>{session.course.title}</Link>
              </td>
              <td data-testid={`cell-mentor-${session.id}`}>
                {session.mentor.name ?? session.mentor.email}
              </td>
              <td data-testid={`cell-date-${session.id}`}>
                {formatDateTime(session.startsAt)} - {formatDateTime(session.endsAt)}
              </td>
              <td data-testid={`cell-location-${session.id}`}>
                {session.location ?? "-"}
              </td>
              <td data-testid={`cell-capacity-${session.id}`}>
                {session.capacity}
              </td>
              <td data-testid={`cell-available-${session.id}`}>
                -
              </td>
              <td data-testid={`cell-created-${session.id}`}>
                {formatDateTime(session.createdAt)}
              </td>
              <td>
                <button
                  type="button"
                  data-testid={`btn-reserve-${session.id}`}
                  disabled={!token || bookingMutation.isPending}
                  onClick={() => setConfirmSessionId(session.id)}
                >
                  Reserve
                </button>
              </td>
            </>
          )}
        />
      ) : null}

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}

      {bookingMutation.error ? (
        <p className="error">{(bookingMutation.error as ApiError).message}</p>
      ) : null}
      {!token ? <p className="error">Sign in as student to create bookings.</p> : null}

      <ConfirmDialog
        isOpen={confirmSessionId !== null}
        onConfirm={() => {
          if (confirmSessionId) {
            submitBooking(confirmSessionId);
          }
          setConfirmSessionId(null);
        }}
        onCancel={() => setConfirmSessionId(null)}
        title="Confirm reservation"
        message="Are you sure you want to reserve this session?"
        confirmLabel="Reserve"
      />
    </section>
  );
};

export default SessionsPage;

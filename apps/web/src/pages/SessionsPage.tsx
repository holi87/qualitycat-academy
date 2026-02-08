import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiRequest, ApiError } from "../lib/http";
import { SessionsResponse } from "../lib/types";

type SessionsPageProps = {
  token: string | null;
};

type BookingResponse = {
  data: {
    id: string;
    status: string;
  };
};

const SessionsPage = ({ token }: SessionsPageProps): JSX.Element => {
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filters, setFilters] = useState({ courseId: "", from: "", to: "" });

  const queryParams = useMemo(() => {
    const search = new URLSearchParams({
      page: "1",
      limit: "50",
      sortBy: "startsAt",
      sortOrder: "asc",
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
  }, [filters]);

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
    },
  });

  const onFilterSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setFilters({ courseId: courseId.trim(), from, to });
  };

  return (
    <section className="panel">
      <h1>Sessions</h1>
      <form className="filter-form" onSubmit={onFilterSubmit}>
        <label>
          Course ID
          <input
            type="text"
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            placeholder="optional"
          />
        </label>
        <label>
          From
          <input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          To
          <input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button type="submit">Apply filters</button>
      </form>

      {sessionsQuery.isPending ? <p>Loading sessions...</p> : null}
      {sessionsQuery.error ? <p className="error">Failed to load sessions.</p> : null}

      <div className="list">
        {sessionsQuery.data?.data.map((session) => (
          <article className="card" key={session.id}>
            <h2>{session.course.title}</h2>
            <p>
              {new Date(session.startsAt).toLocaleString()} - {new Date(session.endsAt).toLocaleString()}
            </p>
            <p>Mentor: {session.mentor.email}</p>
            <p>Capacity: {session.capacity}</p>
            <button
              type="button"
              disabled={!token || bookingMutation.isPending}
              onClick={() => bookingMutation.mutate(session.id)}
            >
              Reserve
            </button>
          </article>
        ))}
      </div>

      {bookingMutation.error ? (
        <p className="error">{(bookingMutation.error as ApiError).message}</p>
      ) : null}
      {!token ? <p className="error">Sign in as student to create bookings.</p> : null}
    </section>
  );
};

export default SessionsPage;

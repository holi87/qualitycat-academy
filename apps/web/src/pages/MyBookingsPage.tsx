import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/EmptyState";
import { Pagination } from "../components/ui/Pagination";
import { Spinner } from "../components/ui/Spinner";
import { formatDateTime } from "../lib/datetime";
import { apiRequest, ApiError } from "../lib/http";
import { BookingItem, MyBookingsResponse } from "../lib/types";

type MyBookingsPageProps = {
  token: string | null;
};

const COLUMNS = [
  { key: "course", label: "Course" },
  { key: "sessionDate", label: "Session Date" },
  { key: "status", label: "Status" },
  { key: "bookedOn", label: "Booked On" },
  { key: "actions", label: "Actions" },
];

const MyBookingsPage = ({ token }: MyBookingsPageProps): JSX.Element => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "mine", page, token],
    queryFn: ({ signal }) =>
      apiRequest<MyBookingsResponse>(`/bookings/mine?page=${page}&limit=10`, {
        token,
        signal,
      }),
    enabled: Boolean(token),
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiRequest<void>(`/bookings/${bookingId}`, {
        method: "PATCH",
        token,
        body: { status: "CANCELLED" },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] });
      toast.success("Booking cancelled.");
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  if (!token) {
    return (
      <section className="panel" data-testid="page-my-bookings">
        <h1>My bookings</h1>
        <p>
          You need to <Link to="/login">sign in</Link> as student.
        </p>
      </section>
    );
  }

  const bookings = bookingsQuery.data?.data ?? [];
  const totalPages = bookingsQuery.data?.meta.totalPages ?? 1;

  return (
    <section className="panel" data-testid="page-my-bookings">
      <h1>My bookings</h1>

      {bookingsQuery.isPending ? <Spinner /> : null}
      {bookingsQuery.error ? <p className="error">Failed to load bookings.</p> : null}

      {!bookingsQuery.isPending && !bookingsQuery.error && bookings.length === 0 ? (
        <EmptyState title="No bookings yet" description="Browse sessions to make your first booking." />
      ) : null}

      {bookings.length > 0 ? (
        <DataTable<BookingItem>
          columns={COLUMNS}
          data={bookings}
          keyExtractor={(item) => item.id}
          testId="bookings"
          renderRow={(booking) => (
            <>
              <td data-testid={`cell-course-${booking.id}`}>
                <Link to={`/courses/${booking.session.course.id}`}>
                  {booking.session.course.title}
                </Link>
              </td>
              <td data-testid={`cell-date-${booking.id}`}>
                {formatDateTime(booking.session.startsAt)} - {formatDateTime(booking.session.endsAt)}
              </td>
              <td data-testid={`cell-status-${booking.id}`}>
                <Badge
                  variant={booking.status === "CONFIRMED" ? "success" : "error"}
                  testId={`status-${booking.id}`}
                >
                  {booking.status}
                </Badge>
              </td>
              <td data-testid={`cell-booked-${booking.id}`}>
                {formatDateTime(booking.createdAt)}
              </td>
              <td>
                {booking.status === "CONFIRMED" ? (
                  <button
                    type="button"
                    data-testid={`btn-cancel-booking-${booking.id}`}
                    disabled={cancelMutation.isPending}
                    onClick={() => setCancelBookingId(booking.id)}
                  >
                    Cancel
                  </button>
                ) : null}
              </td>
            </>
          )}
        />
      ) : null}

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}

      <ConfirmDialog
        isOpen={cancelBookingId !== null}
        onConfirm={() => {
          if (cancelBookingId) {
            cancelMutation.mutate(cancelBookingId);
          }
          setCancelBookingId(null);
        }}
        onCancel={() => setCancelBookingId(null)}
        title="Cancel booking"
        message="Are you sure you want to cancel this booking?"
        confirmLabel="Cancel booking"
        variant="danger"
      />
    </section>
  );
};

export default MyBookingsPage;

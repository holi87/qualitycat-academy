import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../lib/http";
import { MyBookingsResponse } from "../lib/types";

type MyBookingsPageProps = {
  token: string | null;
};

const MyBookingsPage = ({ token }: MyBookingsPageProps): JSX.Element => {
  const bookingsQuery = useQuery({
    queryKey: ["bookings", "mine", token],
    queryFn: ({ signal }) =>
      apiRequest<MyBookingsResponse>("/bookings/mine", {
        token,
        signal,
      }),
    enabled: Boolean(token),
  });

  if (!token) {
    return (
      <section className="panel">
        <h1>My bookings</h1>
        <p>
          You need to <Link to="/login">sign in</Link> as student.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>My bookings</h1>
      {bookingsQuery.isPending ? <p>Loading bookings...</p> : null}
      {bookingsQuery.error ? <p className="error">Failed to load bookings.</p> : null}

      <div className="list">
        {bookingsQuery.data?.data.map((booking) => (
          <article className="card" key={booking.id}>
            <h2>{booking.session.course.title}</h2>
            <p>
              {new Date(booking.session.startsAt).toLocaleString()} -
              {" "}
              {new Date(booking.session.endsAt).toLocaleString()}
            </p>
            <p>Status: {booking.status}</p>
            <p>Booking ID: {booking.id}</p>
          </article>
        ))}
      </div>

      {bookingsQuery.data && bookingsQuery.data.data.length === 0 ? <p>No bookings yet.</p> : null}
    </section>
  );
};

export default MyBookingsPage;

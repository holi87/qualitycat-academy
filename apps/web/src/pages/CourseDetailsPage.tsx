import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { formatDateTime } from "../lib/datetime";
import { apiRequest } from "../lib/http";
import { CourseDetailsResponse } from "../lib/types";

type CourseDetailsPageProps = {
  token: string | null;
};

const CourseDetailsPage = ({ token }: CourseDetailsPageProps): JSX.Element => {
  const params = useParams();
  const courseId = params.id;

  const courseQuery = useQuery({
    queryKey: ["course", courseId, token],
    queryFn: ({ signal }) =>
      apiRequest<CourseDetailsResponse>(`/courses/${courseId}`, {
        token,
        signal,
      }),
    enabled: Boolean(courseId),
  });

  if (!courseId) {
    return <p className="error">Missing course id.</p>;
  }

  return (
    <section className="panel">
      <p>
        <Link to="/courses">← Back to courses</Link>
      </p>
      {courseQuery.isPending ? <p>Loading course...</p> : null}
      {courseQuery.error ? <p className="error">Failed to load course details.</p> : null}
      {courseQuery.data ? (
        <>
          <h1>{courseQuery.data.data.title}</h1>
          <p>{courseQuery.data.data.description ?? "No description."}</p>

          <h2>Sessions</h2>
          {courseQuery.data.data.sessions.length === 0 ? <p>No sessions yet.</p> : null}
          <ul className="sessions-list">
            {courseQuery.data.data.sessions.map((session) => (
              <li key={session.id}>
                <span>
                  {formatDateTime(session.startsAt)} - {formatDateTime(session.endsAt)}
                </span>
                <span>Capacity: {session.capacity}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
};

export default CourseDetailsPage;

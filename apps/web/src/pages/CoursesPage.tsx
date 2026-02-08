import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { apiRequest } from "../lib/http";
import { CoursesResponse } from "../lib/types";

type CoursesPageProps = {
  token: string | null;
};

const CoursesPage = ({ token }: CoursesPageProps): JSX.Element => {
  const coursesQuery = useQuery({
    queryKey: ["courses", token],
    queryFn: ({ signal }) =>
      apiRequest<CoursesResponse>("/courses?page=1&limit=24&sortBy=title&sortOrder=asc", {
        token,
        signal,
      }),
  });

  return (
    <section className="panel">
      <h1>Courses</h1>
      {coursesQuery.isPending ? <p>Loading courses...</p> : null}
      {coursesQuery.error ? <p className="error">Failed to load courses.</p> : null}
      <div className="list">
        {coursesQuery.data?.data.map((course) => (
          <article className="card" key={course.id}>
            <h2>
              <Link to={`/courses/${course.id}`}>{course.title}</Link>
            </h2>
            <p>{course.description ?? "No description."}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default CoursesPage;

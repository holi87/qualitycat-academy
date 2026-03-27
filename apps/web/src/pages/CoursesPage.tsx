import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Pagination } from "../components/ui/Pagination";
import { SearchBar } from "../components/ui/SearchBar";
import { Select } from "../components/ui/Select";
import { Spinner } from "../components/ui/Spinner";
import { apiRequest } from "../lib/http";
import { CoursesResponse, UserRole } from "../lib/types";

type CoursesPageProps = {
  token: string | null;
  role: UserRole | null;
};

const LEVEL_OPTIONS = [
  { value: "", label: "All levels" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

const levelBadgeVariant = (level: string): "success" | "warning" | "error" | "info" | "neutral" => {
  switch (level) {
    case "BEGINNER":
      return "success";
    case "INTERMEDIATE":
      return "warning";
    case "ADVANCED":
      return "error";
    default:
      return "neutral";
  }
};

const CoursesPage = ({ token, role }: CoursesPageProps): JSX.Element => {
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [sortBy] = useState("title");
  const [sortOrder] = useState<"asc" | "desc">("asc");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy,
    sortOrder,
  });
  if (search) queryParams.set("search", search);
  if (level) queryParams.set("level", level);

  const coursesQuery = useQuery({
    queryKey: ["courses", queryParams.toString(), token],
    queryFn: ({ signal }) =>
      apiRequest<CoursesResponse>(`/courses?${queryParams.toString()}`, {
        token,
        signal,
      }),
  });

  const totalPages = coursesQuery.data?.meta.totalPages ?? 1;
  const courses = coursesQuery.data?.data ?? [];
  const canCreate = role === "admin" || role === "mentor";

  return (
    <section className="panel" data-testid="page-courses">
      <h1>Courses</h1>

      <div className="courses-toolbar">
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={() => {
            setSearch(searchInput);
            setPage(1);
          }}
          onClear={() => {
            setSearchInput("");
            setSearch("");
            setPage(1);
          }}
          placeholder="Search courses..."
        />
        <Select
          name="level"
          options={LEVEL_OPTIONS}
          value={level}
          onChange={(v) => {
            setLevel(v);
            setPage(1);
          }}
        />
        {canCreate ? (
          <Link to="/courses/new" className="button" data-testid="btn-create-course">
            Create course
          </Link>
        ) : null}
      </div>

      {coursesQuery.isPending ? <Spinner /> : null}
      {coursesQuery.error ? <p className="error">Failed to load courses.</p> : null}

      {!coursesQuery.isPending && !coursesQuery.error && courses.length === 0 ? (
        <EmptyState title="No courses found" description="Try adjusting your search or filters." />
      ) : null}

      <div className="list">
        {courses.map((course) => (
          <article className="card" key={course.id} data-testid={`course-card-${course.id}`}>
            <h2>
              <Link to={`/courses/${course.id}`}>{course.title}</Link>
            </h2>
            <p>
              {course.description
                ? course.description.length > 120
                  ? `${course.description.slice(0, 120)}...`
                  : course.description
                : "No description."}
            </p>
            <div className="card__meta">
              <Badge variant={levelBadgeVariant(course.level)} testId={`level-${course.id}`}>
                {course.level}
              </Badge>
              {course.durationHours != null ? (
                <span className="card__duration">{course.durationHours}h</span>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
    </section>
  );
};

export default CoursesPage;

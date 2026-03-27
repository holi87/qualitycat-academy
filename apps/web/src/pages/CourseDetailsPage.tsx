import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { Badge } from "../components/ui/Badge";
import { Breadcrumbs } from "../components/ui/Breadcrumbs";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { Tabs } from "../components/ui/Tabs";
import { isUiBugModeEnabled } from "../lib/bugs";
import { formatDateTime } from "../lib/datetime";
import { apiRequest, ApiError } from "../lib/http";
import { CourseDetailsResponse, ReviewsResponse, UserRole } from "../lib/types";

type CourseDetailsPageProps = {
  token: string | null;
  role: UserRole | null;
};

type BookingResponse = {
  data: {
    id: string;
    status: string;
  };
};

type ReviewCreateResponse = {
  data: {
    id: string;
  };
};

const TABS = [
  { key: "info", label: "Info" },
  { key: "sessions", label: "Sessions" },
  { key: "reviews", label: "Reviews" },
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

const CourseDetailsPage = ({ token, role }: CourseDetailsPageProps): JSX.Element => {
  const params = useParams();
  const courseId = params.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("info");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");

  const courseQuery = useQuery({
    queryKey: ["course", courseId, token],
    queryFn: ({ signal }) =>
      apiRequest<CourseDetailsResponse>(`/courses/${courseId}`, {
        token,
        signal,
      }),
    enabled: Boolean(courseId),
  });

  const reviewsQuery = useQuery({
    queryKey: ["reviews", courseId, token],
    queryFn: ({ signal }) =>
      apiRequest<ReviewsResponse>(`/courses/${courseId}/reviews`, {
        token,
        signal,
      }),
    enabled: Boolean(courseId) && activeTab === "reviews",
  });

  const reserveMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest<BookingResponse>("/bookings", {
        method: "POST",
        token,
        body: { sessionId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      void queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] });
      toast.success("Booking created.");
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest<void>(`/courses/${courseId}`, {
        method: "DELETE",
        token,
      }),
    onSuccess: () => {
      toast.success("Course deleted.");
      navigate("/courses", { replace: true });
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: { rating: number; comment: string }) =>
      apiRequest<ReviewCreateResponse>(`/courses/${courseId}/reviews`, {
        method: "POST",
        token,
        body: payload,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews", courseId] });
      void queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      toast.success("Review submitted.");
      setReviewRating("5");
      setReviewComment("");
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  const submitReserve = (sessionId: string): void => {
    reserveMutation.mutate(sessionId);
    if (isUiBugModeEnabled()) {
      reserveMutation.mutate(sessionId);
    }
  };

  const onReviewSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    reviewMutation.mutate({ rating: Number(reviewRating), comment: reviewComment });
  };

  if (!courseId) {
    return <p className="error">Missing course id.</p>;
  }

  const course = courseQuery.data?.data;
  const canManage = role === "admin" || role === "mentor";

  return (
    <section className="panel" data-testid="page-course-details">
      <Breadcrumbs
        items={[
          { label: "Courses", to: "/courses" },
          { label: course?.title ?? "Course" },
        ]}
      />

      {courseQuery.isPending ? <Spinner /> : null}
      {courseQuery.error ? <p className="error">Failed to load course details.</p> : null}

      {course ? (
        <>
          {course.imageUrl ? (
            <img
              className="course-details__image"
              src={course.imageUrl}
              alt={course.title}
              data-testid="course-image"
            />
          ) : null}

          <div className="course-details__header">
            <h1>{course.title}</h1>
            {canManage ? (
              <div className="course-details__actions">
                <Link
                  to={`/courses/${courseId}/edit`}
                  className="button"
                  data-testid="btn-edit-course"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  className="button button--danger"
                  data-testid="btn-delete-course"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>

          <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
            {activeTab === "info" ? (
              <div data-testid="tab-content-info">
                <p>{course.description ?? "No description."}</p>
                <div className="course-details__meta">
                  <Badge variant={levelBadgeVariant(course.level)} testId="course-level">
                    {course.level}
                  </Badge>
                  {course.durationHours != null ? (
                    <span>Duration: {course.durationHours} hours</span>
                  ) : null}
                  <span>Created: {formatDateTime(course.createdAt)}</span>
                </div>
              </div>
            ) : null}

            {activeTab === "sessions" ? (
              <div data-testid="tab-content-sessions">
                {course.sessions.length === 0 ? (
                  <EmptyState title="No sessions yet" description="Check back later for upcoming sessions." />
                ) : (
                  <ul className="sessions-list">
                    {course.sessions.map((session) => (
                      <li key={session.id} className="sessions-list__item" data-testid={`session-${session.id}`}>
                        <div className="sessions-list__info">
                          <span>
                            {formatDateTime(session.startsAt)} - {formatDateTime(session.endsAt)}
                          </span>
                          <span>Capacity: {session.capacity}</span>
                          {session.location ? <span>Location: {session.location}</span> : null}
                        </div>
                        <button
                          type="button"
                          data-testid={`btn-reserve-${session.id}`}
                          disabled={!token || reserveMutation.isPending}
                          onClick={() => submitReserve(session.id)}
                        >
                          Reserve
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {activeTab === "reviews" ? (
              <div data-testid="tab-content-reviews">
                {reviewsQuery.isPending ? <Spinner size="sm" /> : null}
                {reviewsQuery.error ? <p className="error">Failed to load reviews.</p> : null}
                {reviewsQuery.data && reviewsQuery.data.data.length === 0 ? (
                  <EmptyState title="No reviews yet" description="Be the first to review this course." />
                ) : null}
                {reviewsQuery.data?.data.map((review) => (
                  <div key={review.id} className="review-card" data-testid={`review-${review.id}`}>
                    <div className="review-card__header">
                      <span className="review-card__stars">
                        {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                      </span>
                      <span className="review-card__author">{review.user.email}</span>
                    </div>
                    {review.comment ? <p className="review-card__comment">{review.comment}</p> : null}
                  </div>
                ))}

                {role === "student" && token ? (
                  <form className="review-form" data-testid="form-review" onSubmit={onReviewSubmit}>
                    <h3>Write a review</h3>
                    <label>
                      Rating
                      <select
                        data-testid="select-review-rating"
                        value={reviewRating}
                        onChange={(e) => setReviewRating(e.target.value)}
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                    </label>
                    <label>
                      Comment
                      <textarea
                        data-testid="input-review-comment"
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Share your experience..."
                      />
                    </label>
                    <button
                      type="submit"
                      data-testid="btn-submit-review"
                      disabled={reviewMutation.isPending}
                    >
                      {reviewMutation.isPending ? "Submitting..." : "Submit review"}
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </Tabs>

          <ConfirmDialog
            isOpen={deleteDialogOpen}
            onConfirm={() => {
              setDeleteDialogOpen(false);
              deleteMutation.mutate();
            }}
            onCancel={() => setDeleteDialogOpen(false)}
            title="Delete course"
            message={`Are you sure you want to delete "${course.title}"? This action cannot be undone.`}
            confirmLabel="Delete"
            variant="danger"
          />
        </>
      ) : null}
    </section>
  );
};

export default CourseDetailsPage;

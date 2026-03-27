import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { apiRequest, ApiError } from "../lib/http";
import { CoursesResponse, Session } from "../lib/types";

type SessionFormPageProps = {
  token: string | null;
};

type SessionResponse = {
  data: Session;
};

const STEPS = ["Select Course", "Schedule", "Review & Confirm"] as const;

const SessionFormPage = ({ token }: SessionFormPageProps): JSX.Element => {
  const navigate = useNavigate();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(0);
  const [courseId, setCourseId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [location, setLocation] = useState("");

  const coursesQuery = useQuery({
    queryKey: ["courses-for-session", token],
    queryFn: ({ signal }) =>
      apiRequest<CoursesResponse>("/courses?page=1&limit=100&sortBy=title&sortOrder=asc", {
        token,
        signal,
      }),
    enabled: Boolean(token),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      courseId: string;
      startsAt: string;
      endsAt: string;
      capacity: number;
      location?: string;
    }) =>
      apiRequest<SessionResponse>("/sessions", {
        method: "POST",
        token,
        body: payload,
      }),
    onSuccess: (data) => {
      toast.success("Session created successfully.");
      navigate(`/sessions/${data.data.id}`, { replace: true });
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  const selectedCourse = coursesQuery.data?.data.find((c) => c.id === courseId);

  const canGoNext = (): boolean => {
    if (currentStep === 0) {
      return courseId !== "";
    }
    if (currentStep === 1) {
      return startsAt !== "" && endsAt !== "" && capacity !== "" && Number(capacity) > 0;
    }
    return true;
  };

  const handleNext = (): void => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = (): void => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const payload: {
      courseId: string;
      startsAt: string;
      endsAt: string;
      capacity: number;
      location?: string;
    } = {
      courseId,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      capacity: Number(capacity),
    };

    if (location.trim() !== "") {
      payload.location = location.trim();
    }

    createMutation.mutate(payload);
  };

  return (
    <section className="panel" data-testid="page-session-form">
      <h1>Create Session</h1>

      <div className="stepper" data-testid="stepper">
        {STEPS.map((label, index) => (
          <div
            key={label}
            className={`stepper__step ${index === currentStep ? "stepper__step--active" : ""} ${index < currentStep ? "stepper__step--completed" : ""}`}
            data-testid={`stepper-step-${index}`}
          >
            <span className="stepper__number">{index + 1}</span>
            <span className="stepper__label">{label}</span>
          </div>
        ))}
      </div>

      <form className="form" data-testid="form-session" onSubmit={onSubmit}>
        {currentStep === 0 ? (
          <div data-testid="step-0">
            <label>
              Course
              {coursesQuery.isPending ? (
                <p>Loading courses...</p>
              ) : coursesQuery.error ? (
                <p className="error">Failed to load courses.</p>
              ) : (
                <select
                  data-testid="select-course"
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                  required
                >
                  <option value="">-- Select a course --</option>
                  {coursesQuery.data?.data.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
        ) : null}

        {currentStep === 1 ? (
          <div data-testid="step-1">
            <label>
              Starts at
              <input
                type="datetime-local"
                data-testid="input-starts-at"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </label>

            <label>
              Ends at
              <input
                type="datetime-local"
                data-testid="input-ends-at"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                required
              />
            </label>

            <label>
              Capacity
              <input
                type="number"
                data-testid="input-capacity"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                min="1"
                required
              />
            </label>

            <label>
              Location
              <input
                type="text"
                data-testid="input-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="card" data-testid="step-2">
            <h2>Review your session</h2>
            <dl>
              <dt>Course</dt>
              <dd data-testid="review-course">{selectedCourse?.title ?? courseId}</dd>
              <dt>Starts at</dt>
              <dd data-testid="review-starts-at">
                {startsAt ? new Date(startsAt).toLocaleString() : "—"}
              </dd>
              <dt>Ends at</dt>
              <dd data-testid="review-ends-at">
                {endsAt ? new Date(endsAt).toLocaleString() : "—"}
              </dd>
              <dt>Capacity</dt>
              <dd data-testid="review-capacity">{capacity || "—"}</dd>
              <dt>Location</dt>
              <dd data-testid="review-location">{location || "—"}</dd>
            </dl>
          </div>
        ) : null}

        <div className="button-row">
          {currentStep > 0 ? (
            <button
              type="button"
              data-testid="btn-back"
              onClick={handleBack}
            >
              Back
            </button>
          ) : null}

          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              data-testid="btn-next"
              onClick={handleNext}
              disabled={!canGoNext()}
            >
              Next
            </button>
          ) : null}

          {currentStep === STEPS.length - 1 ? (
            <button
              type="submit"
              data-testid="btn-submit-session"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Session"}
            </button>
          ) : null}
        </div>
      </form>

      {createMutation.error ? (
        <p className="error">{(createMutation.error as ApiError).message}</p>
      ) : null}
    </section>
  );
};

export default SessionFormPage;

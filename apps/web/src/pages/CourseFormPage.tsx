import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { useToast } from "../components/ToastProvider";
import { apiRequest, ApiError } from "../lib/http";
import { Course, CourseDetailsResponse } from "../lib/types";

type CourseFormPageProps = {
  token: string | null;
};

type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

type CourseFormPayload = {
  title: string;
  description?: string;
  level: CourseLevel;
  durationHours?: number;
  imageUrl?: string;
};

type CourseResponse = {
  data: Course;
};

type FieldErrors = {
  title?: string;
};

const CourseFormPage = ({ token }: CourseFormPageProps): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<CourseLevel>("BEGINNER");
  const [durationHours, setDurationHours] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const courseQuery = useQuery({
    queryKey: ["course", id, token],
    queryFn: ({ signal }) =>
      apiRequest<CourseDetailsResponse>(`/courses/${id}`, {
        token,
        signal,
      }),
    enabled: isEdit && Boolean(token),
  });

  useEffect(() => {
    if (courseQuery.data) {
      const course = courseQuery.data.data;
      setTitle(course.title);
      setDescription(course.description ?? "");
      setLevel(course.level);
      setDurationHours(course.durationHours != null ? String(course.durationHours) : "");
      setImageUrl(course.imageUrl ?? "");
    }
  }, [courseQuery.data]);

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (title.trim().length < 3) {
      errors.title = "Title must be at least 3 characters.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: (payload: CourseFormPayload) =>
      apiRequest<CourseResponse>(isEdit ? `/courses/${id}` : "/courses", {
        method: isEdit ? "PUT" : "POST",
        token,
        body: payload,
      }),
    onSuccess: (data) => {
      toast.success(isEdit ? "Course updated successfully." : "Course created successfully.");
      navigate(`/courses/${data.data.id}`, { replace: true });
    },
    onError: (error) => {
      toast.error((error as ApiError).message);
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!validate()) return;

    const payload: CourseFormPayload = {
      title: title.trim(),
      level,
    };

    if (description.trim() !== "") {
      payload.description = description.trim();
    }

    if (durationHours !== "") {
      payload.durationHours = Number(durationHours);
    }

    if (imageUrl.trim() !== "") {
      payload.imageUrl = imageUrl.trim();
    }

    saveMutation.mutate(payload);
  };

  const handleCancel = (): void => {
    if (isEdit && id) {
      navigate(`/courses/${id}`);
    } else {
      navigate("/courses");
    }
  };

  if (isEdit && courseQuery.isPending) {
    return (
      <section className="panel" data-testid="page-course-form">
        <h1>Edit Course</h1>
        <p>Loading course...</p>
      </section>
    );
  }

  if (isEdit && courseQuery.error) {
    return (
      <section className="panel" data-testid="page-course-form">
        <h1>Edit Course</h1>
        <p className="error">Failed to load course.</p>
      </section>
    );
  }

  return (
    <section className="panel" data-testid="page-course-form">
      <h1>{isEdit ? "Edit Course" : "Create Course"}</h1>
      <form className="form" data-testid="form-course" onSubmit={onSubmit}>
        <label>
          Title
          <input
            type="text"
            data-testid="input-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        {fieldErrors.title ? (
          <p className="error" data-testid="error-title">
            {fieldErrors.title}
          </p>
        ) : null}

        <label>
          Description
          <textarea
            data-testid="input-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
          />
        </label>

        <label>
          Level
          <select
            data-testid="select-level"
            value={level}
            onChange={(event) => setLevel(event.target.value as CourseLevel)}
          >
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </label>

        <label>
          Duration (hours)
          <input
            type="number"
            data-testid="input-duration"
            value={durationHours}
            onChange={(event) => setDurationHours(event.target.value)}
            min="0"
            step="1"
          />
        </label>

        <label>
          Image URL
          <input
            type="text"
            data-testid="input-image-url"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
          />
        </label>

        <div className="button-row">
          <button
            type="submit"
            data-testid="btn-submit-course"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : isEdit
                ? "Save Changes"
                : "Create Course"}
          </button>
          <button
            type="button"
            data-testid="btn-cancel"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </form>

      {saveMutation.error ? (
        <p className="error">{(saveMutation.error as ApiError).message}</p>
      ) : null}
    </section>
  );
};

export default CourseFormPage;

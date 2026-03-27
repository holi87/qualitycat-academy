export type UserRole = "admin" | "mentor" | "student";

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type MeResponse = {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

export type Course = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  durationHours: number | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  id: string;
  mentorId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  location: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CoursesResponse = {
  data: Course[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    sortBy: string;
    sortOrder: string;
  };
};

export type CourseDetailsResponse = {
  data: Course & {
    sessions: Session[];
    _count: { reviews: number };
    _avg: { rating: number | null };
  };
};

export type SessionListItem = {
  id: string;
  courseId: string;
  mentorId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  location: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  course: {
    id: string;
    title: string;
  };
  mentor: {
    id: string;
    email: string;
    name?: string | null;
  };
};

export type SessionDetailResponse = {
  data: SessionListItem & {
    bookingCount: number;
    availableSpots: number;
    course: {
      id: string;
      title: string;
      description: string | null;
      level: string;
      durationHours: number | null;
    };
    mentor: {
      id: string;
      email: string;
      name: string | null;
    };
  };
};

export type SessionsResponse = {
  data: SessionListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    sortBy: string;
    sortOrder: string;
    filters: {
      courseId: string | null;
      mentorId: string | null;
      location: string | null;
      from: string | null;
      to: string | null;
    };
  };
};

export type BookingItem = {
  id: string;
  status: "CONFIRMED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  session: {
    id: string;
    startsAt: string;
    endsAt: string;
    capacity: number;
    course: {
      id: string;
      title: string;
    };
  };
};

export type MyBookingsResponse = {
  data: BookingItem[];
  meta: PaginationMeta;
};

export type Review = {
  id: string;
  courseId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
  };
};

export type ReviewsResponse = {
  data: Review[];
  meta: PaginationMeta;
};

export type User = {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UsersResponse = {
  data: User[];
  meta: PaginationMeta & { sortBy: string; sortOrder: string };
};

export type UploadResponse = {
  data: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
    createdAt: string;
  };
};

export type RuntimeBugsData = {
  bugs: "on" | "off";
  backendBugs: boolean;
  frontendBugs: boolean;
  flags: Record<string, boolean>;
  availableFlags: string[];
};

export type InternalBugsResponse = {
  data: RuntimeBugsData;
};

export type PublicBugsStateResponse = {
  data: {
    backendBugs: boolean;
    frontendBugs: boolean;
    frontendFlags?: Record<string, boolean>;
  };
};

export type UpdateRuntimeBugsRequest = {
  backendBugs?: boolean;
  frontendBugs?: boolean;
  flags?: Record<string, boolean>;
};

export type UpdateRuntimeBugsResponse = {
  data: RuntimeBugsData;
};

export type AdminResetResponse = {
  data: {
    status: "ok";
    summary: {
      users: number;
      courses: number;
      sessions: number;
      bookings: number;
      reviews: number;
      ranAt: string;
    };
  };
};

export type AllBookingsResponse = {
  data: (BookingItem & { user: { id: string; email: string } })[];
  meta: PaginationMeta & { filters: Record<string, string | null> };
};

export type CourseSearchResponse = {
  data: Course[];
  meta: PaginationMeta;
};

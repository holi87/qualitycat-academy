export type UserRole = "admin" | "mentor" | "student";

export type MeResponse = {
  id: string;
  email: string;
  role: UserRole;
};

export type Course = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  id: string;
  mentorId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
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
  };
};

export type SessionListItem = {
  id: string;
  courseId: string;
  mentorId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  createdAt: string;
  updatedAt: string;
  course: {
    id: string;
    title: string;
  };
  mentor: {
    id: string;
    email: string;
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
};

export type InternalBugsResponse = {
  data: {
    bugs: "on" | "off";
    flags: Record<string, boolean>;
  };
};

export type AdminResetResponse = {
  data: {
    status: "ok";
    summary: {
      users: number;
      courses: number;
      sessions: number;
      bookings: number;
      ranAt: string;
    };
  };
};

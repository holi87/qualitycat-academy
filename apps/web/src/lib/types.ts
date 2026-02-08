export type UserRole = "admin" | "mentor" | "student";

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

import bcrypt from "bcrypt";
import { BookingStatus, CourseLevel, Prisma, PrismaClient, UserRole } from "@prisma/client";

type DbClient = Prisma.TransactionClient | PrismaClient;

export type BaselineSummary = {
  users: number;
  courses: number;
  sessions: number;
  bookings: number;
  reviews: number;
  ranAt: string;
};

const hashPassword = async (value: string): Promise<string> => bcrypt.hash(value, 10);

export const clearAcademyData = async (db: DbClient): Promise<void> => {
  await db.review.deleteMany();
  await db.upload.deleteMany();
  await db.booking.deleteMany();
  await db.session.deleteMany();
  await db.course.deleteMany();
  await db.user.deleteMany();
};

export const seedAcademyBaseline = async (db: DbClient): Promise<BaselineSummary> => {
  const now = new Date();
  const plusDays = (days: number): Date => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const minusDays = (days: number): Date => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // --- Users (6) ---
  const admin = await db.user.create({
    data: {
      email: "admin@qualitycat.academy",
      passwordHash: await hashPassword("admin123"),
      role: UserRole.ADMIN,
      name: "Admin User",
    },
  });

  const mentor = await db.user.create({
    data: {
      email: "mentor@qualitycat.academy",
      passwordHash: await hashPassword("mentor123"),
      role: UserRole.MENTOR,
      name: "Anna Kowalska",
      bio: "Senior QA Engineer with 10 years of experience.",
    },
  });

  const mentor2 = await db.user.create({
    data: {
      email: "mentor2@qualitycat.academy",
      passwordHash: await hashPassword("mentor123"),
      role: UserRole.MENTOR,
      name: "Tomasz Nowak",
      bio: "Automation testing specialist. Selenium & Playwright expert.",
    },
  });

  const student = await db.user.create({
    data: {
      email: "student@qualitycat.academy",
      passwordHash: await hashPassword("student123"),
      role: UserRole.STUDENT,
      name: "Jan Testowy",
    },
  });

  const student2 = await db.user.create({
    data: {
      email: "student2@qualitycat.academy",
      passwordHash: await hashPassword("student123"),
      role: UserRole.STUDENT,
      name: "Maria Bugowa",
    },
  });

  const student3 = await db.user.create({
    data: {
      email: "student3@qualitycat.academy",
      passwordHash: await hashPassword("student123"),
      role: UserRole.STUDENT,
      name: "Piotr Assertowski",
    },
  });

  // --- Courses (10) ---
  const courseApi = await db.course.create({
    data: {
      title: "API Testing Fundamentals",
      description: "Learn how to test REST APIs using Postman and automation tools. Covers HTTP methods, status codes, authentication, and error handling.",
      level: CourseLevel.BEGINNER,
      durationHours: 8,
    },
  });

  const courseSelenium = await db.course.create({
    data: {
      title: "Selenium WebDriver Mastery",
      description: "Comprehensive course on browser automation with Selenium WebDriver. Page Object Model, waits, and cross-browser testing.",
      level: CourseLevel.INTERMEDIATE,
      durationHours: 16,
    },
  });

  const coursePlaywright = await db.course.create({
    data: {
      title: "Playwright End-to-End Testing",
      description: "Modern E2E testing with Playwright. Auto-wait, network interception, visual comparisons, and CI integration.",
      level: CourseLevel.INTERMEDIATE,
      durationHours: 12,
    },
  });

  const coursePerf = await db.course.create({
    data: {
      title: "Performance Testing with k6",
      description: "Load testing, stress testing, and performance monitoring. Write test scripts in JavaScript with k6.",
      level: CourseLevel.ADVANCED,
      durationHours: 10,
    },
  });

  const courseSql = await db.course.create({
    data: {
      title: "SQL for Testers",
      description: "Essential SQL skills for QA engineers. Querying test data, verifying database state, and writing complex joins.",
      level: CourseLevel.BEGINNER,
      durationHours: 6,
    },
  });

  const courseGit = await db.course.create({
    data: {
      title: "Git & Version Control for QA",
      description: "Git fundamentals for testers. Branching, merging, pull requests, and collaboration workflows.",
      level: CourseLevel.BEGINNER,
      durationHours: 4,
    },
  });

  const courseCi = await db.course.create({
    data: {
      title: "CI/CD Pipeline Testing",
      description: "Integrating tests into CI/CD pipelines. GitHub Actions, Jenkins, Docker, and test reporting.",
      level: CourseLevel.ADVANCED,
      durationHours: 8,
    },
  });

  const courseMobile = await db.course.create({
    data: {
      title: "Mobile Testing with Appium",
      description: "Automate mobile app testing on Android and iOS. Appium setup, gestures, and device farms.",
      level: CourseLevel.ADVANCED,
      durationHours: 14,
    },
  });

  const courseSecurity = await db.course.create({
    data: {
      title: "Security Testing Basics",
      description: "Introduction to security testing. OWASP Top 10, XSS, SQL injection, and basic penetration testing concepts.",
      level: CourseLevel.INTERMEDIATE,
      durationHours: 10,
    },
  });

  const courseDraft = await db.course.create({
    data: {
      title: "Test Management & Reporting",
      description: "Test planning, test case management, and reporting. Tools and best practices for QA leads.",
      level: CourseLevel.BEGINNER,
      durationHours: 6,
      isPublished: false,
    },
  });

  // --- Sessions (20) ---
  const sessions = await Promise.all([
    // API Testing - 3 sessions
    db.session.create({
      data: { courseId: courseApi.id, mentorId: mentor.id, startsAt: plusDays(2), endsAt: plusDays(2.33), capacity: 20, location: "online" },
    }),
    db.session.create({
      data: { courseId: courseApi.id, mentorId: mentor.id, startsAt: plusDays(9), endsAt: plusDays(9.33), capacity: 20, location: "online" },
    }),
    db.session.create({
      data: { courseId: courseApi.id, mentorId: mentor2.id, startsAt: plusDays(14), endsAt: plusDays(14.33), capacity: 15, location: "Room A" },
    }),
    // Selenium - 2 sessions
    db.session.create({
      data: { courseId: courseSelenium.id, mentorId: mentor.id, startsAt: plusDays(3), endsAt: plusDays(3.67), capacity: 15, location: "online", description: "Part 1: Setup and basics" },
    }),
    db.session.create({
      data: { courseId: courseSelenium.id, mentorId: mentor.id, startsAt: plusDays(10), endsAt: plusDays(10.67), capacity: 15, location: "online", description: "Part 2: Advanced patterns" },
    }),
    // Playwright - 2 sessions
    db.session.create({
      data: { courseId: coursePlaywright.id, mentorId: mentor2.id, startsAt: plusDays(4), endsAt: plusDays(4.5), capacity: 20, location: "online" },
    }),
    db.session.create({
      data: { courseId: coursePlaywright.id, mentorId: mentor2.id, startsAt: plusDays(11), endsAt: plusDays(11.5), capacity: 20, location: "online" },
    }),
    // Performance - 2 sessions
    db.session.create({
      data: { courseId: coursePerf.id, mentorId: mentor2.id, startsAt: plusDays(5), endsAt: plusDays(5.42), capacity: 10, location: "Room B" },
    }),
    db.session.create({
      data: { courseId: coursePerf.id, mentorId: mentor2.id, startsAt: plusDays(12), endsAt: plusDays(12.42), capacity: 10, location: "Room B" },
    }),
    // SQL - 2 sessions
    db.session.create({
      data: { courseId: courseSql.id, mentorId: mentor.id, startsAt: plusDays(6), endsAt: plusDays(6.25), capacity: 25, location: "online" },
    }),
    db.session.create({
      data: { courseId: courseSql.id, mentorId: mentor.id, startsAt: plusDays(13), endsAt: plusDays(13.25), capacity: 25, location: "online" },
    }),
    // Git - 1 session
    db.session.create({
      data: { courseId: courseGit.id, mentorId: mentor.id, startsAt: plusDays(7), endsAt: plusDays(7.17), capacity: 30, location: "online" },
    }),
    // CI/CD - 2 sessions
    db.session.create({
      data: { courseId: courseCi.id, mentorId: mentor2.id, startsAt: plusDays(8), endsAt: plusDays(8.33), capacity: 12, location: "Room A" },
    }),
    db.session.create({
      data: { courseId: courseCi.id, mentorId: mentor2.id, startsAt: plusDays(15), endsAt: plusDays(15.33), capacity: 12, location: "Room A" },
    }),
    // Mobile - 1 session
    db.session.create({
      data: { courseId: courseMobile.id, mentorId: mentor2.id, startsAt: plusDays(16), endsAt: plusDays(16.58), capacity: 8, location: "Lab" },
    }),
    // Security - 2 sessions
    db.session.create({
      data: { courseId: courseSecurity.id, mentorId: mentor.id, startsAt: plusDays(17), endsAt: plusDays(17.42), capacity: 15, location: "online" },
    }),
    db.session.create({
      data: { courseId: courseSecurity.id, mentorId: mentor2.id, startsAt: plusDays(20), endsAt: plusDays(20.42), capacity: 15, location: "online" },
    }),
    // Draft course - 1 session
    db.session.create({
      data: { courseId: courseDraft.id, mentorId: mentor.id, startsAt: plusDays(25), endsAt: plusDays(25.25), capacity: 20, location: "TBD" },
    }),
    // Past sessions for booking history
    db.session.create({
      data: { courseId: courseApi.id, mentorId: mentor.id, startsAt: minusDays(7), endsAt: minusDays(6.67), capacity: 20, location: "online" },
    }),
    db.session.create({
      data: { courseId: courseGit.id, mentorId: mentor.id, startsAt: minusDays(3), endsAt: minusDays(2.83), capacity: 30, location: "online" },
    }),
  ]);

  // --- Bookings (15) ---
  await db.booking.createMany({
    data: [
      // student bookings
      { sessionId: sessions[0].id, userId: student.id, status: BookingStatus.CONFIRMED },
      { sessionId: sessions[3].id, userId: student.id, status: BookingStatus.CONFIRMED },
      { sessionId: sessions[5].id, userId: student.id, status: BookingStatus.CONFIRMED },
      { sessionId: sessions[9].id, userId: student.id, status: BookingStatus.CONFIRMED },
      { sessionId: sessions[18].id, userId: student.id, status: BookingStatus.CONFIRMED },
      // student2 bookings
      { sessionId: sessions[0].id, userId: student2.id, status: BookingStatus.CONFIRMED },
      { sessionId: sessions[5].id, userId: student2.id, status: BookingStatus.CONFIRMED },
      { sessionId: sessions[7].id, userId: student2.id, status: BookingStatus.CONFIRMED },
      { sessionId: sessions[11].id, userId: student2.id, status: BookingStatus.CANCELLED },
      { sessionId: sessions[19].id, userId: student2.id, status: BookingStatus.CONFIRMED },
      // student3 bookings
      { sessionId: sessions[0].id, userId: student3.id, status: BookingStatus.CONFIRMED },
      { sessionId: sessions[3].id, userId: student3.id, status: BookingStatus.CONFIRMED },
      { sessionId: sessions[7].id, userId: student3.id, status: BookingStatus.CONFIRMED },
      { sessionId: sessions[12].id, userId: student3.id, status: BookingStatus.CONFIRMED },
      { sessionId: sessions[15].id, userId: student3.id, status: BookingStatus.CANCELLED },
    ],
  });

  // --- Reviews (8) ---
  await db.review.createMany({
    data: [
      { courseId: courseApi.id, userId: student.id, rating: 5, comment: "Excellent introduction to API testing. Very practical examples." },
      { courseId: courseApi.id, userId: student2.id, rating: 4, comment: "Good content, could use more advanced topics." },
      { courseId: courseApi.id, userId: student3.id, rating: 5, comment: null },
      { courseId: courseSelenium.id, userId: student.id, rating: 4, comment: "Great course, well structured. POM pattern explanations were very helpful." },
      { courseId: courseSelenium.id, userId: student3.id, rating: 3, comment: "Decent but a bit outdated. Would prefer more Playwright content." },
      { courseId: coursePlaywright.id, userId: student2.id, rating: 5, comment: "Modern, practical, and well-paced. Highly recommend!" },
      { courseId: courseSql.id, userId: student.id, rating: 4, comment: "Very useful for day-to-day QA work." },
      { courseId: courseGit.id, userId: student2.id, rating: 5, comment: "Finally understand rebasing! Clear and concise." },
    ],
  });

  return {
    users: 6,
    courses: 10,
    sessions: 20,
    bookings: 15,
    reviews: 8,
    ranAt: new Date().toISOString(),
  };
};

export const resetAcademyToBaseline = async (prisma: PrismaClient): Promise<BaselineSummary> => {
  return prisma.$transaction(
    async (tx) => {
      await clearAcademyData(tx);
      return seedAcademyBaseline(tx);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
};

export const bootstrapAcademyIfEmpty = async (
  prisma: PrismaClient,
): Promise<{ created: false } | { created: true; summary: BaselineSummary }> => {
  return prisma.$transaction(
    async (tx) => {
      const usersCount = await tx.user.count();
      if (usersCount > 0) {
        return { created: false } as const;
      }

      const summary = await seedAcademyBaseline(tx);
      return {
        created: true,
        summary,
      } as const;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
};

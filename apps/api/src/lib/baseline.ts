import bcrypt from "bcrypt";
import { BookingStatus, Prisma, PrismaClient, UserRole } from "@prisma/client";

type DbClient = Prisma.TransactionClient | PrismaClient;

export type BaselineSummary = {
  users: number;
  courses: number;
  sessions: number;
  bookings: number;
  ranAt: string;
};

const hashPassword = async (value: string): Promise<string> => bcrypt.hash(value, 10);

export const clearAcademyData = async (db: DbClient): Promise<void> => {
  await db.booking.deleteMany();
  await db.session.deleteMany();
  await db.course.deleteMany();
  await db.user.deleteMany();
};

export const seedAcademyBaseline = async (db: DbClient): Promise<BaselineSummary> => {
  const admin = await db.user.create({
    data: {
      email: "admin@qualitycat.academy",
      passwordHash: await hashPassword("admin123"),
      role: UserRole.ADMIN,
    },
  });

  const mentor = await db.user.create({
    data: {
      email: "mentor@qualitycat.academy",
      passwordHash: await hashPassword("mentor123"),
      role: UserRole.MENTOR,
    },
  });

  const student = await db.user.create({
    data: {
      email: "student@qualitycat.academy",
      passwordHash: await hashPassword("student123"),
      role: UserRole.STUDENT,
    },
  });

  const courseFastify = await db.course.create({
    data: {
      title: "Fastify Fundamentals",
      description: "Introduction to Fastify and API architecture.",
    },
  });

  const coursePrisma = await db.course.create({
    data: {
      title: "Prisma Essentials",
      description: "Data modeling and migrations with Prisma.",
    },
  });

  const now = new Date();
  const plusDays = (days: number): Date => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const sessionOne = await db.session.create({
    data: {
      courseId: courseFastify.id,
      mentorId: mentor.id,
      startsAt: plusDays(2),
      endsAt: plusDays(2.125),
      capacity: 20,
    },
  });

  const sessionTwo = await db.session.create({
    data: {
      courseId: courseFastify.id,
      mentorId: mentor.id,
      startsAt: plusDays(5),
      endsAt: plusDays(5.125),
      capacity: 20,
    },
  });

  const sessionThree = await db.session.create({
    data: {
      courseId: coursePrisma.id,
      mentorId: mentor.id,
      startsAt: plusDays(7),
      endsAt: plusDays(7.125),
      capacity: 15,
    },
  });

  await db.booking.createMany({
    data: [
      {
        sessionId: sessionOne.id,
        userId: student.id,
        status: BookingStatus.CONFIRMED,
      },
      {
        sessionId: sessionThree.id,
        userId: student.id,
        status: BookingStatus.CONFIRMED,
      },
      {
        sessionId: sessionTwo.id,
        userId: admin.id,
        status: BookingStatus.CANCELLED,
      },
    ],
  });

  return {
    users: 3,
    courses: 2,
    sessions: 3,
    bookings: 3,
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

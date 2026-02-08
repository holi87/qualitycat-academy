import bcrypt from "bcrypt";
import { BookingStatus, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const hashPassword = async (value: string): Promise<string> => {
  return bcrypt.hash(value, 10);
};

async function main(): Promise<void> {
  const usersCount = await prisma.user.count();
  if (usersCount > 0) {
    console.log("Bootstrap skipped: users already exist.");
    return;
  }

  const admin = await prisma.user.create({
    data: {
      email: "admin@qualitycat.academy",
      passwordHash: await hashPassword("admin123"),
      role: UserRole.ADMIN,
    },
  });

  const mentor = await prisma.user.create({
    data: {
      email: "mentor@qualitycat.academy",
      passwordHash: await hashPassword("mentor123"),
      role: UserRole.MENTOR,
    },
  });

  const student = await prisma.user.create({
    data: {
      email: "student@qualitycat.academy",
      passwordHash: await hashPassword("student123"),
      role: UserRole.STUDENT,
    },
  });

  const courseFastify = await prisma.course.create({
    data: {
      title: "Fastify Fundamentals",
      description: "Introduction to Fastify and API architecture.",
    },
  });

  const coursePrisma = await prisma.course.create({
    data: {
      title: "Prisma Essentials",
      description: "Data modeling and migrations with Prisma.",
    },
  });

  const now = new Date();
  const plusDays = (days: number): Date => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const sessions = await prisma.$transaction([
    prisma.session.create({
      data: {
        courseId: courseFastify.id,
        mentorId: mentor.id,
        startsAt: plusDays(2),
        endsAt: plusDays(2.125),
        capacity: 20,
      },
    }),
    prisma.session.create({
      data: {
        courseId: courseFastify.id,
        mentorId: mentor.id,
        startsAt: plusDays(5),
        endsAt: plusDays(5.125),
        capacity: 20,
      },
    }),
    prisma.session.create({
      data: {
        courseId: coursePrisma.id,
        mentorId: mentor.id,
        startsAt: plusDays(7),
        endsAt: plusDays(7.125),
        capacity: 15,
      },
    }),
  ]);

  await prisma.booking.createMany({
    data: [
      {
        sessionId: sessions[0].id,
        userId: student.id,
        status: BookingStatus.CONFIRMED,
      },
      {
        sessionId: sessions[2].id,
        userId: student.id,
        status: BookingStatus.CONFIRMED,
      },
      {
        sessionId: sessions[1].id,
        userId: admin.id,
        status: BookingStatus.CANCELLED,
      },
    ],
  });

  console.log("Bootstrap completed: baseline users/courses/sessions/bookings created.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

import { PrismaClient } from "@prisma/client";
import { resetAcademyToBaseline } from "../src/lib/baseline";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const summary = await resetAcademyToBaseline(prisma);
  console.log(`Seed completed: ${JSON.stringify(summary)}`);
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

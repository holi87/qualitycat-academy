import { PrismaClient } from "@prisma/client";
import { bootstrapAcademyIfEmpty } from "../src/lib/baseline";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const result = await bootstrapAcademyIfEmpty(prisma);
  if (!result.created) {
    console.log("Bootstrap skipped: users already exist.");
    return;
  }

  console.log(`Bootstrap completed: ${JSON.stringify(result.summary)}`);
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

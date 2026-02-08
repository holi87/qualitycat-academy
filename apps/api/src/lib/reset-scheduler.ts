import { PrismaClient } from "@prisma/client";
import cron from "node-cron";
import { resetAcademyToBaseline } from "./baseline";

type LoggerLike = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type SchedulerOptions = {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  prisma: PrismaClient;
  logger: LoggerLike;
};

export type SchedulerHandle = {
  stop: () => void;
};

export const startResetScheduler = ({
  enabled,
  cronExpression,
  timezone,
  prisma,
  logger,
}: SchedulerOptions): SchedulerHandle | null => {
  if (!enabled) {
    logger.info("Weekly database reset scheduler is disabled.");
    return null;
  }

  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid DB_RESET_SCHEDULE_CRON value: '${cronExpression}'`);
  }

  let inProgress = false;

  const task = cron.schedule(
    cronExpression,
    async () => {
      if (inProgress) {
        logger.warn("Skipping scheduled reset because previous run is still in progress.");
        return;
      }

      inProgress = true;
      logger.warn({ cronExpression, timezone }, "Scheduled database reset started.");

      try {
        const summary = await resetAcademyToBaseline(prisma);
        logger.warn({ summary }, "Scheduled database reset completed.");
      } catch (error) {
        logger.error({ err: error }, "Scheduled database reset failed.");
      } finally {
        inProgress = false;
      }
    },
    {
      timezone,
    },
  );

  logger.info({ cronExpression, timezone }, "Weekly database reset scheduler enabled.");

  return {
    stop: (): void => {
      task.stop();
    },
  };
};

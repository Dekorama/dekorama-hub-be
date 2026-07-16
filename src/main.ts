import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { authRateLimitMiddleware } from "./common/auth-rate-limit";
// CommonJS import para evitar problemas de default export en runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require("cookie-parser");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const helmet = require("helmet");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const http = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void };
  http.set?.("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.use("/auth/login", authRateLimitMiddleware);
  app.use("/auth/register", authRateLimitMiddleware);
  app.use("/auth/register-admin", authRateLimitMiddleware);
  app.use("/auth/register-member", authRateLimitMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Validate decorated fields; do not strip undecorated props on legacy DTOs
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Dekorama API listening on port ${port}`);
}

bootstrap();

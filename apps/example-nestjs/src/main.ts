import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true })
  );

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    })
  );

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle("Saga Bus Example API")
    .setDescription("NestJS example demonstrating saga-bus integration")
    .setVersion("1.0")
    .addTag("orders")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  // Start server
  const port = parseInt(process.env.PORT ?? "3002", 10);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen(port, host);
  console.log(`Application running on: http://${host}:${port}`);
  console.log(`Swagger docs available at: http://${host}:${port}/api`);
}

bootstrap().catch((err) => {
  console.error("Failed to start application:", err);
  process.exit(1);
});

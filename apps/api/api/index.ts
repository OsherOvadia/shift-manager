import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import express, { Request, Response } from 'express';

let cachedApp: express.Application | null = null;

async function bootstrap() {
  if (!cachedApp) {
    const expressApp = express();
    const adapter = new ExpressAdapter(expressApp);
    
    const app = await NestFactory.create(AppModule, adapter, {
      logger: ['error', 'warn', 'log'],
    });

    // Enable CORS
    app.enableCors({
      origin: [
        'http://localhost:3000',
        'https://web-sigma-woad-44.vercel.app',
        'https://shift-manager-ebg7uwqdj-oshioshiges-projects.vercel.app',
      ],
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
      exposedHeaders: ['Content-Length', 'Content-Type'],
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    // Global prefix
    app.setGlobalPrefix('api');

    await app.init();
    cachedApp = expressApp;
  }
  return cachedApp;
}

export default async (req: Request, res: Response) => {
  const app = await bootstrap();
  app(req, res);
};

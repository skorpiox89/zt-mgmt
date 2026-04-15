import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 未配置');
  }

  return databaseUrl;
}

function createAdapter() {
  const parsed = new URL(getDatabaseUrl());
  const database = parsed.pathname.replace(/^\//, '');

  if (!database) {
    throw new Error('DATABASE_URL 缺少数据库名');
  }

  return new PrismaMariaDb({
    allowPublicKeyRetrieval: true,
    database,
    host: parsed.hostname,
    password: decodeURIComponent(parsed.password),
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
  });
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: createAdapter(),
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

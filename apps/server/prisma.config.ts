import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({
  path: path.resolve(__dirname, '../../.env'),
});

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? 'mysql://root:password@127.0.0.1:3306/zt_mgmt_local_dev',
  },
  migrations: {
    path: 'prisma/migrations',
  },
  schema: 'prisma/schema.prisma',
});

# 仓库指南

## 项目结构与职责
`zt-mgmt` 是使用 `pnpm` workspace 管理的统一 ztncui 运维平台。`apps/server` 为 NestJS API：业务模块位于 `src/modules/`，通用守卫、拦截器和 Prisma 服务位于 `src/common/`，数据模型及迁移位于 `prisma/`。`apps/web` 为 Vue 3 管理台，接口封装、状态、路由和页面分别位于 `src/api/`、`src/stores/`、`src/router/`、`src/views/`；组件使用 `src/components/`。跨端类型与常量放在 `packages/shared/src/`，设计与部署文档放在 `docs/`。

后端负责鉴权、数据库持久化及与上游 ztncui 的会话和页面交互；前端只能调用本项目 API，避免直接连接控制器。

## 开发、构建与数据库
优先使用根目录 `Makefile`：

- `make env`：由 `.env.example` 创建本地配置，不覆盖已有 `.env`。
- `make install`：安装 workspace 依赖；`make dev`：加载 `.env` 后同时启动 API 和 Web。
- `make lint`：执行 `tsc` 与 `vue-tsc` 类型检查；`make build`：构建两个应用。
- `make prisma-generate`、`make prisma-migrate`：生成 Prisma Client、执行本地开发迁移。
- `docker compose up -d --build`：启动 MySQL、Server、Web 的集成环境。

可单独运行 `pnpm --filter @zt-mgmt/server start:dev` 或 `pnpm --filter @zt-mgmt/web dev`。镜像发布和客户环境部署使用 `make image-push IMAGE_TAG=<版本>` 与 `make remote-env-deploy IMAGE_TAG=<版本>`；部署前确认已填写 `.env.production`。

## 代码风格与命名
遵循 `.editorconfig`：UTF-8、LF、2 空格缩进、移除行尾空白并保留文件末尾换行。提交前应通过类型检查，不要以 `any` 绕过错误。NestJS 文件按职责命名，如 `networks.service.ts`、`networks.controller.ts`，请求 DTO 放入模块的 `dto/`。Vue 组件和布局使用 PascalCase（如 `AppLayout.vue`），路由页面按业务目录组织（如 `views/networks/detail.vue`）。

## 测试与验证
当前没有统一的测试脚本或覆盖率门槛。每次变更至少运行 `make lint` 和 `make build`；涉及数据库时执行相应 Prisma 命令，涉及界面或 API 行为时进行手工验证。新增后端测试时，使用 Nest 测试工具并将 `*.spec.ts` 与受测模块相邻放置。

## 提交与合并请求
近期提交以简短中文说明为主，常用 `feat:`、`fix:`、`docs:`、`chore:` 前缀。一次提交只处理一个明确主题。合并请求应说明改动和验证结果、关联任务；前端变更附截图，配置或数据库变更说明 `.env` 影响及迁移文件。

## 安全与配置
不得提交真实的数据库密码、JWT 密钥、控制器凭据或 planet 文件。生产环境必须替换 `JWT_SECRET`、`CONTROLLER_PASSWORD_KEY` 和数据库默认密码。审查 `apps/server/prisma/migrations/` 中的每个迁移；`remote-env-reset` 会删除客户环境的 MySQL 数据卷，仅在确认可清空数据时使用。

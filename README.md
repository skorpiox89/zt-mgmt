# zt-mgmt

`zt-mgmt` 是一个面向内部平台管理员的统一管理台，用于集中接入多个 `ztncui` 控制器，并在一个界面内完成控制器维护、网络创建与成员管理。

项目当前定位是“多控制器统一运维入口”而不是 ZeroTier 官方控制面替代品。前端只访问本项目后端，后端负责登录上游 `ztncui`、复用会话 Cookie、解析页面数据，并将平台操作转发为对应的 `ztncui` Web 请求。

## 核心功能

### 1. 平台登录与鉴权

- 提供平台管理员登录、退出登录与当前用户鉴权
- 使用 JWT 保护控制器、网络、成员相关接口
- 当前为单管理员模型，账号密码通过环境变量配置

### 2. 控制器管理

- 新增、编辑、删除 `ztncui` 控制器配置
- 保存控制器名称、区域、地址、账号、子网池 CIDR、子网前缀等信息
- 支持一键测试连接并回写在线状态、最近检测时间
- 控制器密码以 AES-256-GCM 加密后存入 MySQL
- 支持使用迁移密码加密导入、导出控制器配置和 planet 文件

### 3. 统一网络管理

- 聚合展示多个控制器下的网络列表
- 支持按控制器和关键词筛选
- 支持创建网络、重命名网络、删除网络
- 创建网络时自动完成初始化：
  - 自动分配下一个可用子网
  - 自动设置私有网络
  - 自动写入 IP 分配池
- 针对同一控制器的建网流程做了串行锁，避免并发分配重复子网

### 4. 网络详情与成员管理

- 查看网络详情、路由、IP 分配池、成员列表
- 支持成员授权开关
- 支持修改 `Member name`
- 支持删除成员
- 页面会展示成员在线状态、IP 分配、对端地址等信息

### 5. 部署与运维能力

- 支持 `pnpm workspace` 单仓管理前后端
- 提供 `Makefile` 统一开发命令
- 提供 `Dockerfile` 与 `docker-compose.yaml`，可一键启动 `MySQL + Server + Web`
- 提供健康检查接口：`/api/health`

## 技术栈

- 前端：Vue 3、TypeScript、Vite、Ant Design Vue、Pinia、Vue Router
- 后端：NestJS、TypeScript
- 数据层：Prisma、MySQL 8.4
- 仓库结构：`pnpm` workspace monorepo

## 目录结构

```text
zt-mgmt/
  apps/
    server/   # NestJS API、Prisma、ztncui 集成逻辑
    web/      # Vue 管理台
  packages/
    shared/   # 共享类型与常量
  docs/       # 设计说明与进度记录
  Makefile
  docker-compose.yaml
```

## 快速开始

### 本地开发

1. 准备 MySQL，并确保 `.env` 中的 `DATABASE_URL` 可连接。
2. 初始化环境文件：

```bash
make env
```

3. 安装依赖并生成 Prisma Client：

```bash
make install
make prisma-generate
make prisma-migrate
```

4. 启动前后端开发环境：

```bash
make dev
```

启动后，后端默认监听 `http://127.0.0.1:3001`，前端开发地址通常为 `http://127.0.0.1:5173`。

### Docker Compose

```bash
docker compose up -d --build
```

默认端口：

- Web：`http://127.0.0.1:4173`
- API：`http://127.0.0.1:3001/api/health`
- MySQL：`127.0.0.1:19075`

### 客户环境部署

部署流程与 `casino-mgmt2` 的 `image-push + remote-env-up` 一致，分为构建机和客户机两个步骤。
客户机需要该仓库的部署文件、Docker Engine 和 Docker Compose v2，不需要安装 Node.js 或 pnpm。
`remote-env-deploy` 会拉取镜像并启动完整的 `MySQL + Server + Web` 栈；MySQL 数据保存在 Docker
volume 中，常规停止和更新不会删除。

1. 在客户机基于模板创建并填写生产配置，生产密钥和数据库密码不能保留示例值：

```bash
cp .env.production.example .env.production
```

2. 在构建机发布应用镜像：

```bash
make image-push IMAGE_TAG=20260711
```

3. 在客户机使用相同镜像标签部署完整环境：

```bash
make remote-env-deploy IMAGE_TAG=20260711
```

私有镜像仓库需要在构建机和客户机预先执行对应的 `docker login`。若通过域名访问 Web，请在
`.env.production` 的 `VITE_ALLOWED_HOSTS` 中填写域名；多个域名以逗号分隔。

常用运维命令：

```bash
make remote-env-status IMAGE_TAG=20260711
make remote-env-down IMAGE_TAG=20260711
make remote-env-reset IMAGE_TAG=20260711
```

`remote-env-down` 保留 MySQL 数据卷；`remote-env-reset` 会删除数据卷后重新部署。端口可通过
`REMOTE_ENV_MYSQL_PORT`、`REMOTE_ENV_SERVER_PORT`、`REMOTE_ENV_WEB_PORT` 覆盖，配置文件路径可通过
`REMOTE_ENV_FILE` 覆盖。

## Makefile 命令说明

执行 `make help` 可以查看当前仓库所有可用目标。下面按使用场景汇总各命令；带有 `.env` 的开发命令会先检查该文件是否存在。

### 环境、开发与数据库

| 命令 | 用途 |
| --- | --- |
| `make env` | 当根目录不存在 `.env` 时，从 `.env.example` 创建；不会覆盖已有配置。 |
| `make install` | 安装 pnpm workspace 依赖。 |
| `make lint` | 执行 Server 的 TypeScript 检查和 Web 的 `vue-tsc` 检查。 |
| `make build` | 构建 Server 与 Web 的生产产物。 |
| `make clean` | 删除 `apps/server/dist` 与 `apps/web/dist` 构建产物。 |
| `make dev` | 使用 `.env` 同时启动 NestJS 监听模式和 Vite 开发服务器。 |
| `make server-build` | 仅构建 NestJS Server。 |
| `make server-dev` | 使用 `.env` 以监听模式启动 Server。 |
| `make server-start` | 使用 `.env` 启动已构建的 Server。 |
| `make web-build` | 仅构建 Vue Web 生产产物。 |
| `make web-dev` | 使用 `.env` 启动 Vite 开发服务器。 |
| `make web-preview` | 使用 `.env` 预览已构建的 Web 产物。 |
| `make prisma-generate` | 使用 `.env` 生成 Prisma Client。 |
| `make prisma-migrate` | 使用 `.env` 执行 Prisma 开发迁移；仅用于本地开发数据库。 |

### 镜像与本地 Compose

| 命令 | 用途 |
| --- | --- |
| `make server-package` | 构建 Server 镜像，同时写入本地标签和镜像仓库标签。 |
| `make server-push` | 构建并推送 Server 镜像。 |
| `make web-package` | 构建 Web 镜像，同时写入本地标签和镜像仓库标签。 |
| `make web-push` | 构建并推送 Web 镜像。 |
| `make image` | 构建 Server 与 Web 两个镜像，不推送。 |
| `make image-push` | 构建并推送 Server 与 Web 两个镜像，是构建机发布入口。 |
| `make push` | `image-push` 的别名。 |
| `make redeploy` | 在当前机器拉取 Compose 所需镜像，并协调本地 `MySQL + Server + Web` 栈；不会删除数据卷。 |

### 客户镜像环境

以下命令在客户机执行，默认读取 `.env.production`，并以 `zt-mgmt-remote` 作为 Docker Compose 项目名。除日志命令外，都建议带上与构建机相同的 `IMAGE_TAG`。

| 命令 | 用途 |
| --- | --- |
| `make remote-env-config-check` | 检查生产配置文件和数据库密码、JWT 密钥、控制器密码加密密钥是否仍为默认值。 |
| `make remote-env-pull` | 拉取 MySQL、Server、Web 所需镜像，不启动服务。 |
| `make remote-env-deploy` | 拉取镜像、启动完整环境、轮询 API/Web 健康检查并输出状态。 |
| `make remote-env-up` | `remote-env-deploy` 的别名。 |
| `make remote-env-status` | 输出使用的镜像、访问地址和容器状态。 |
| `make remote-env-check` | 单独轮询 API 和 Web 健康检查；失败时输出服务状态和最近日志。 |
| `make remote-env-down` | 停止并删除容器、网络，保留 MySQL 数据卷。 |
| `make remote-env-stop` | `remote-env-down` 的别名。 |
| `make remote-env-reset` | 删除容器、网络和 MySQL 数据卷后立即重新部署；会清空所有业务数据。 |
| `make remote-env-server-logs` | 持续查看 Server 日志。 |
| `make remote-env-web-logs` | 持续查看 Web 日志。 |
| `make remote-env-mysql-logs` | 持续查看 MySQL 日志。 |

若要只清除客户机环境而不重新部署，请执行：

```bash
docker compose \
  --env-file .env.production \
  -p zt-mgmt-remote \
  -f docker-compose.yaml \
  down --volumes --remove-orphans
```

若部署时设置过 `REMOTE_ENV_NAME`，请将上例的 `zt-mgmt-remote` 替换为实际项目名。

### 常用参数

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `IMAGE_TAG` | `latest` | Server/Web 镜像标签。构建机推送和客户机部署必须使用相同值。 |
| `REGISTRY` | `registry.cn-hangzhou.aliyuncs.com/skorpiox89` | Server/Web 镜像仓库地址。 |
| `REMOTE_ENV_FILE` | `.env.production` | 客户环境的生产配置文件路径。 |
| `REMOTE_ENV_NAME` | `zt-mgmt-remote` | 客户环境的 Docker Compose 项目名，用于隔离容器、网络和数据卷。 |
| `REMOTE_ENV_MYSQL_PORT` | `19075` | 客户环境 MySQL 宿主机端口。 |
| `REMOTE_ENV_SERVER_PORT` | `19070` | 客户环境 API 宿主机端口。 |
| `REMOTE_ENV_WEB_PORT` | `19071` | 客户环境 Web 宿主机端口。 |
| `REMOTE_ENV_MYSQL_IMAGE`、`REMOTE_ENV_SERVER_IMAGE`、`REMOTE_ENV_WEB_IMAGE` | 对应默认镜像 | 覆盖客户环境使用的单个镜像地址或标签。 |
| `REMOTE_ENV_CHECK_ATTEMPTS`、`REMOTE_ENV_CHECK_INTERVAL` | `60`、`2` | 客户环境健康检查的最大次数和间隔秒数。 |

例如，将 Web 暴露到 `8080`，并使用指定镜像版本部署：

```bash
make remote-env-deploy IMAGE_TAG=20260711 REMOTE_ENV_WEB_PORT=8080
```

### 本地 Caddy 域名

仓库根目录提供了 `Caddyfile`，用于本地 HTTPS 反代：

- `https://zt-mgmt.dev` -> 前端
- `https://api.zt-mgmt.dev` -> 后端

`.dev` 域名在浏览器中强制 HTTPS，首次使用需执行 `sudo caddy trust` 并将 `zt-mgmt.dev`、`api.zt-mgmt.dev` 指向 `127.0.0.1`。详细步骤见 `docs/local-caddy.md`。

## 关键环境变量

```env
DATABASE_URL=mysql://zt_mgmt:zt_mgmt@127.0.0.1:19075/zt_mgmt
JWT_SECRET=replace-this-with-a-long-random-string
CONTROLLER_PASSWORD_KEY=replace-this-with-a-long-random-string
VITE_API_BASE_URL=/api
```

首次启动并完成数据库迁移后，系统会自动初始化唯一管理员账号：`admin / admin`。
请在首次登录后立即修改该密码。

## 当前边界

- 当前采用轻量用户体系：唯一管理员 + 多个普通用户，不包含多租户与通用 RBAC
- 控制器配置持久化到 MySQL；网络与成员数据仍以实时拉取为主
- 上游集成依赖 `ztncui` Web 登录与页面解析，不是直接调用 ZeroTier 官方 API
- 仓库暂未提供完整自动化测试与端到端测试套件

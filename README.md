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

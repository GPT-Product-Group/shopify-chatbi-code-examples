# shopify-chatbi-code-examples

Shopify GraphQL 代理服务，支持 CLI 查询和 HTTP 服务两种模式。可与 [Dify GraphQL 插件](https://marketplace.dify.ai/plugins/jingfelix/graphql) 集成。

## 功能

1. **CLI 模式** - 命令行直接执行 GraphQL 查询
2. **HTTP 服务模式** - 提供 GraphQL 端点供 Dify 插件调用

## 运行要求

- Node.js 18+
- pnpm

## 安装

```bash
pnpm install
```

## 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```env
# Shopify 配置 (必需)
SHOP_DOMAIN=your-store.myshopify.com
SHOP_ACCESS_TOKEN=shpat_xxxxx

# 可选配置
SHOPIFY_SCOPES=read_orders,read_products,read_customers,read_inventory
SHOPIFY_API_VERSION=2024-10

# HTTP 服务器配置 (仅用于 graphql-server.ts)
SERVER_PORT=3500
API_KEY=your-secret-api-key
```

---

## 模式一：CLI 查询（原有功能）

```bash
# 方式1：通过命令行参数传递查询
pnpm ts-node -r dotenv/config --compiler-options '{"module":"CommonJS"}' minimal-shopify-query.ts 'query { shop { name } }'

# 方式2：使用 npm script
pnpm query 'query { shop { name } }'

# 方式3：通过环境变量传递查询
SHOPIFY_GRAPHQL='query { shop { name } }' pnpm query
```

输出示例：
```
[info] 正在校验 Shopify 授权 scope...
[info] 授权通过，正在调用 Shopify...
{
  "shop": {
    "name": "Skateboard Shop"
  }
}
```

---

## 模式二：HTTP 服务（Dify 集成）

### 启动服务

```bash
# 方式1：直接启动
pnpm ts-node -r dotenv/config --compiler-options '{"module":"CommonJS"}' graphql-server.ts

# 方式2：使用 npm script
pnpm server
```

服务启动后输出：
```
============================================================
Shopify GraphQL Proxy Server
============================================================
[info] 服务已启动: http://localhost:3500
[info] GraphQL 端点: http://localhost:3500/graphql
[info] 健康检查: http://localhost:3500/health
[info] 店铺域名: your-store.myshopify.com
[info] API Key 验证: 已启用
============================================================
```

### API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/graphql` | POST | GraphQL 查询端点 |
| `/graphql` | GET | Schema 信息 |
| `/health` | GET | 健康检查 |

### 请求示例

```bash
# 不带认证
curl -X POST http://localhost:3500/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { shop { name } }"}'

# 带 API Key 认证
curl -X POST http://localhost:3500/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-api-key" \
  -d '{"query": "query { shop { name } }"}'
```

响应示例：
```json
{
  "data": {
    "shop": {
      "name": "Skateboard Shop"
    }
  }
}
```

---

## Dify GraphQL 插件配置

在 Dify 中安装 [GraphQL 插件](https://marketplace.dify.ai/plugins/jingfelix/graphql) 后，配置以下参数：

| 配置项 | 值 |
|--------|-----|
| GraphQL Endpoint | `http://your-server:3500/graphql` |
| Authorization Header | `Bearer your-secret-api-key`（如设置了 API_KEY）|

### 使用流程

```
┌─────────────┐     GraphQL Query      ┌──────────────────┐     Shopify API     ┌─────────────┐
│   Dify AI   │ ────────────────────▶ │  graphql-server  │ ──────────────────▶ │   Shopify   │
│  (GraphQL   │                        │   (本项目)        │                      │  Admin API  │
│   插件)     │ ◀──────────────────── │                  │ ◀────────────────── │             │
└─────────────┘     JSON Response      └──────────────────┘     JSON Response    └─────────────┘
```

### Dify 工作流示例

1. 在 Dify 工作流中添加 GraphQL 工具节点
2. 配置 Endpoint 为你的服务地址
3. 在查询中使用 Shopify GraphQL 语法

示例查询：
```graphql
query {
  shop {
    name
    email
  }
  products(first: 5) {
    edges {
      node {
        title
        handle
      }
    }
  }
}
```

---

## 项目结构

```
├── shopify-graphql-core.ts   # 核心模块（共享逻辑）
├── minimal-shopify-query.ts  # CLI 入口
├── graphql-server.ts         # HTTP 服务入口
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 安全建议

1. **生产环境必须设置 API_KEY** - 防止未授权访问
2. **使用 HTTPS** - 在生产环境中通过反向代理（nginx/caddy）启用 HTTPS
3. **限制 IP 访问** - 配置防火墙只允许 Dify 服务器 IP 访问
4. **定期轮换 Token** - 定期更换 Shopify Access Token 和 API Key

## License

ISC

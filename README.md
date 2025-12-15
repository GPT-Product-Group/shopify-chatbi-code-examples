# shopify-chatbi-code-examples

最简 Shopify 查询示例（可直接单独使用或拷贝到独立仓库），纯 TypeScript 脚本，输入 GraphQL 查询与凭证后返回 Shopify 原始 JSON 输出，并带基础的 scope 校验/错误提示。

## 运行要求
- Node.js 18+
- 安装依赖：`pnpm install`
- 环境变量：
  - `SHOP_DOMAIN`：店铺域名，例如 `your-store.myshopify.com`
  - `SHOP_ACCESS_TOKEN`：Admin API Token
  - `SHOPIFY_GRAPHQL`：待执行的 GraphQL 查询字符串
  - 可选 `SHOPIFY_SCOPES`：覆盖默认 scope（`read_orders,read_products,read_customers,read_inventory`）
  - 可选 `SHOPIFY_API_VERSION`：覆盖默认的 `2024-10`

## 快速开始
```bash
# 设置环境变量并执行
SHOP_DOMAIN=your-store.myshopify.com \
SHOP_ACCESS_TOKEN=shpat_xxx \
SHOPIFY_GRAPHQL='query { shop { name } }' \
pnpm ts-node shopify-chatbi-code-examples/minimal-shopify-query.ts
```

脚本会先校验缺失的 scopes（若缺少会提示重新安装应用），然后调用 Shopify Admin GraphQL API，将原始 JSON 打印到标准输出。可直接将本目录复制到独立仓库 `shopify-chatbi-code-examples` 使用。

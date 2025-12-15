/// <reference types="node" />

/**
 * Minimal Shopify GraphQL runner (standalone).
 *
 * Inputs (environment variables):
 * - SHOP_DOMAIN: your shop domain, e.g. `your-store.myshopify.com`
 * - SHOP_ACCESS_TOKEN: Admin API access token
 * - SHOPIFY_GRAPHQL: GraphQL query string (可选，如果通过命令行参数传递则不需要)
 * - SHOPIFY_SCOPES: optional comma-separated scopes, default:
 *   read_orders,read_products,read_customers,read_inventory
 * - SHOPIFY_API_VERSION: optional Admin API version, default 2024-10
 *
 * Usage:
 *   pnpm ts-node -r dotenv/config --compiler-options '{"module":"CommonJS"}' minimal-shopify-query.ts 'query { shop { name } }'
 *   # 或通过环境变量 SHOPIFY_GRAPHQL 传递查询
 *
 * The script will:
 * 1) Validate required inputs
 * 2) Check Shopify scopes
 * 3) Run the GraphQL query and print raw JSON to stdout
 */

import {
  requireEnv,
  validateAndQuery,
  ShopifyConfig,
} from "./shopify-graphql-core";

async function main() {
  try {
    const shopDomain = requireEnv("SHOP_DOMAIN");
    const accessToken = requireEnv("SHOP_ACCESS_TOKEN");
    // 支持命令行参数传递查询，如果没有则回退到环境变量
    const cliQuery = process.argv[2]?.trim();
    const query = cliQuery || requireEnv("SHOPIFY_GRAPHQL");

    const config: ShopifyConfig = {
      shopDomain,
      accessToken,
      apiVersion: process.env.SHOPIFY_API_VERSION,
      scopes: process.env.SHOPIFY_SCOPES,
    };

    console.error("[info] 正在校验 Shopify 授权 scope...");
    console.error("[info] 授权通过，正在调用 Shopify...");

    const data = await validateAndQuery(config, query);

    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`[error] ${(err instanceof Error ? err.message : "未知错误") as string}`);
    process.exit(1);
  }
}

void main();

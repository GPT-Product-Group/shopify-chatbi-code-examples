/**
 * Minimal Shopify GraphQL runner (standalone).
 *
 * Inputs (environment variables):
 * - SHOP_DOMAIN: your shop domain, e.g. `your-store.myshopify.com`
 * - SHOP_ACCESS_TOKEN: Admin API access token
 * - SHOPIFY_GRAPHQL: GraphQL query string to execute (single-line or multi-line)
 * - SHOPIFY_SCOPES: optional comma-separated scopes, default:
 *   read_orders,read_products,read_customers,read_inventory
 * - SHOPIFY_API_VERSION: optional Admin API version, default 2024-10
 *
 * Usage:
 *   pnpm ts-node shopify-chatbi-code-examples/minimal-shopify-query.ts
 *
 * The script will:
 * 1) Validate required inputs
 * 2) Check Shopify scopes
 * 3) Run the GraphQL query and print raw JSON to stdout
 */
const DEFAULT_SCOPES =
  "read_orders,read_products,read_customers,read_inventory";

function getRequiredScopes() {
  const scopes = process.env.SHOPIFY_SCOPES ?? DEFAULT_SCOPES;
  return scopes
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

type GraphqlParams = {
  shop: string;
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
};

async function runShopifyQuery<T = unknown>({
  shop,
  accessToken,
  query,
  variables,
}: GraphqlParams): Promise<T> {
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-10";
  const endpoint = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error (${res.status} ${res.statusText}): ${text}`);
  }

  const data = (await res.json()) as { data?: T; errors?: unknown };
  if (data.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return (data.data ?? (data as unknown as T)) as T;
}

async function getMissingScopes(
  shop: string,
  accessToken: string,
  requiredScopes = getRequiredScopes(),
) {
  const res = await fetch(`https://${shop}/admin/oauth/access_scopes.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `获取 Shopify 授权 scope 失败 (${res.status} ${res.statusText}): ${text}`,
    );
  }

  const data = (await res.json()) as { access_scopes: { handle: string }[] };
  const granted = new Set(
    data.access_scopes.map((scope) => scope.handle.trim()).filter(Boolean),
  );

  return requiredScopes.filter((scope) => !granted.has(scope));
}

async function main() {
  try {
    const shopDomain = requireEnv("SHOP_DOMAIN");
    const accessToken = requireEnv("SHOP_ACCESS_TOKEN");
    const query = requireEnv("SHOPIFY_GRAPHQL");

    console.error("[info] 正在校验 Shopify 授权 scope...");
    const requiredScopes = getRequiredScopes();
    const missingScopes = await getMissingScopes(shopDomain, accessToken, requiredScopes);

    if (missingScopes.length > 0) {
      console.error(
        `[error] Shopify 应用缺少以下授权：${missingScopes.join(", ")}。请重新安装应用以授予这些 scope。`,
      );
      process.exit(1);
    }

    console.error("[info] 授权通过，正在调用 Shopify...");
    const data = await runShopifyQuery({
      shop: shopDomain,
      accessToken,
      query,
    });

    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`[error] ${(err instanceof Error ? err.message : "未知错误") as string}`);
    process.exit(1);
  }
}

void main();

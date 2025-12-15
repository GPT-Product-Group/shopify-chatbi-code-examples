/**
 * Shopify GraphQL Core Module
 *
 * 核心模块，封装Shopify GraphQL执行逻辑，供CLI和HTTP服务复用
 */

export const DEFAULT_SCOPES = "read_orders,read_products,read_customers,read_inventory";

export interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
  scopes?: string;
}

export interface GraphqlParams {
  shop: string;
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
  apiVersion?: string;
}

export interface GraphqlResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; [key: string]: unknown }>;
}

export function getRequiredScopes(scopesEnv?: string): string[] {
  const scopes = scopesEnv ?? DEFAULT_SCOPES;
  return scopes
    .split(",")
    .map((scope: string) => scope.trim())
    .filter(Boolean);
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

export async function runShopifyQuery<T = unknown>({
  shop,
  accessToken,
  query,
  variables,
  apiVersion = "2024-10",
}: GraphqlParams): Promise<T> {
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

  const data = (await res.json()) as GraphqlResponse<T>;
  if (data.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return (data.data ?? (data as unknown as T)) as T;
}

export async function getMissingScopes(
  shop: string,
  accessToken: string,
  requiredScopes: string[],
): Promise<string[]> {
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

  return requiredScopes.filter((scope: string) => !granted.has(scope));
}

export async function validateAndQuery<T = unknown>(
  config: ShopifyConfig,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const { shopDomain, accessToken, apiVersion, scopes } = config;

  const requiredScopes = getRequiredScopes(scopes);
  const missingScopes = await getMissingScopes(shopDomain, accessToken, requiredScopes);

  if (missingScopes.length > 0) {
    throw new Error(
      `Shopify 应用缺少以下授权：${missingScopes.join(", ")}。请重新安装应用以授予这些 scope。`,
    );
  }

  return runShopifyQuery<T>({
    shop: shopDomain,
    accessToken,
    query,
    variables,
    apiVersion: apiVersion || "2024-10",
  });
}

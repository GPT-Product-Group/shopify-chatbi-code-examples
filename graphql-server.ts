/// <reference types="node" />

/**
 * GraphQL HTTP Server for Dify Plugin
 *
 * 为 Dify GraphQL 插件提供 HTTP 服务端点
 *
 * 启动命令：
 *   pnpm ts-node -r dotenv/config --compiler-options '{"module":"CommonJS"}' graphql-server.ts
 *
 * 环境变量：
 * - SHOP_DOMAIN: 店铺域名
 * - SHOP_ACCESS_TOKEN: Admin API Token
 * - SERVER_PORT: 服务端口（默认 3000）
 * - API_KEY: 可选，用于验证请求的 API Key
 * - SHOPIFY_SCOPES: 可选，覆盖默认 scope
 * - SHOPIFY_API_VERSION: 可选，覆盖默认 API 版本
 *
 * Dify GraphQL 插件配置：
 * - GraphQL Endpoint: http://your-server:3000/graphql
 * - Headers: { "Authorization": "Bearer <API_KEY>" }（如果设置了 API_KEY）
 */

import * as http from "http";
import { validateAndQuery, requireEnv, ShopifyConfig } from "./shopify-graphql-core";

const PORT = parseInt(process.env.SERVER_PORT || "3500", 10);
const API_KEY = process.env.API_KEY?.trim();

interface GraphQLRequestBody {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, statusCode: number, message: string): void {
  sendJson(res, statusCode, { errors: [{ message }] });
}

function validateApiKey(req: http.IncomingMessage): boolean {
  if (!API_KEY) {
    return true; // 未设置 API_KEY 则不验证
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return false;
  }

  // 支持 "Bearer <token>" 和直接传递 token
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  return token === API_KEY;
}

async function parseRequestBody(req: http.IncomingMessage): Promise<GraphQLRequestBody> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body) as GraphQLRequestBody;
        resolve(parsed);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function handleGraphQLRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ShopifyConfig,
): Promise<void> {
  // 验证 API Key
  if (!validateApiKey(req)) {
    sendError(res, 401, "Unauthorized: Invalid or missing API key");
    return;
  }

  try {
    const { query, variables } = await parseRequestBody(req);

    if (!query || typeof query !== "string") {
      sendError(res, 400, "Missing or invalid 'query' field");
      return;
    }

    console.error(`[info] 收到 GraphQL 查询请求`);
    console.error(`[info] Query: ${query.slice(0, 100)}${query.length > 100 ? "..." : ""}`);

    const data = await validateAndQuery(config, query, variables);

    sendJson(res, 200, { data });
    console.error(`[info] 查询成功`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[error] ${message}`);
    sendError(res, 500, message);
  }
}

function handleHealthCheck(res: http.ServerResponse): void {
  sendJson(res, 200, { status: "ok", service: "shopify-graphql-proxy" });
}

function handleIntrospection(res: http.ServerResponse): void {
  // 返回简化的 schema 说明，让 Dify 插件知道这是一个 Shopify GraphQL 代理
  const schemaInfo = {
    data: {
      __schema: {
        description: "Shopify Admin GraphQL API Proxy",
        queryType: { name: "QueryRoot" },
        mutationType: { name: "Mutation" },
        types: [],
      },
    },
  };
  sendJson(res, 200, schemaInfo);
}

async function main(): Promise<void> {
  // 启动时验证必需的环境变量
  const shopDomain = requireEnv("SHOP_DOMAIN");
  const accessToken = requireEnv("SHOP_ACCESS_TOKEN");

  const config: ShopifyConfig = {
    shopDomain,
    accessToken,
    apiVersion: process.env.SHOPIFY_API_VERSION,
    scopes: process.env.SHOPIFY_SCOPES,
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);

    // 处理 CORS 预检请求
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }

    // 路由处理
    if (url.pathname === "/health" || url.pathname === "/") {
      handleHealthCheck(res);
      return;
    }

    if (url.pathname === "/graphql") {
      if (req.method === "POST") {
        await handleGraphQLRequest(req, res, config);
      } else if (req.method === "GET") {
        // GET 请求返回 schema 信息或健康检查
        handleIntrospection(res);
      } else {
        sendError(res, 405, "Method not allowed. Use POST for GraphQL queries.");
      }
      return;
    }

    sendError(res, 404, "Not found. Use /graphql endpoint for GraphQL queries.");
  });

  server.listen(PORT, () => {
    console.error("=".repeat(60));
    console.error("Shopify GraphQL Proxy Server");
    console.error("=".repeat(60));
    console.error(`[info] 服务已启动: http://localhost:${PORT}`);
    console.error(`[info] GraphQL 端点: http://localhost:${PORT}/graphql`);
    console.error(`[info] 健康检查: http://localhost:${PORT}/health`);
    console.error(`[info] 店铺域名: ${shopDomain}`);
    console.error(`[info] API Key 验证: ${API_KEY ? "已启用" : "未启用"}`);
    console.error("=".repeat(60));
    console.error("");
    console.error("Dify GraphQL 插件配置:");
    console.error(`  - Endpoint URL: http://your-server:${PORT}/graphql`);
    if (API_KEY) {
      console.error(`  - Authorization Header: Bearer <your-api-key>`);
    }
    console.error("");
    console.error("示例请求:");
    console.error(`  curl -X POST http://localhost:${PORT}/graphql \\`);
    console.error(`    -H "Content-Type: application/json" \\`);
    if (API_KEY) {
      console.error(`    -H "Authorization: Bearer ${API_KEY}" \\`);
    }
    console.error(`    -d '{"query": "query { shop { name } }"}'`);
    console.error("=".repeat(60));
  });
}

void main();

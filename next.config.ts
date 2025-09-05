// next.config.ts
import type { NextConfig } from "next";

// 在 GitHub Actions 环境下使用仓库子路径；本地开发仍然用根路径
const isCI = process.env.GITHUB_ACTIONS === "true";
const repo = "daily-site";                    // ← 改成你的仓库名
const basePath = isCI ? `/${repo}` : "";

const nextConfig: NextConfig = {
  output: "export",            // 关键：静态导出（生成纯静态站）
  images: { unoptimized: true },
  basePath,                    // 让页面/路由走子路径  /<repo>
  assetPrefix: basePath,       // 让静态资源走子路径 /<repo>/_next/...
};

export default nextConfig;

/** @type {import('next').NextConfig} */

// 在 CI (GitHub Actions) 下使用仓库子路径；本地开发走根路径
const isCI = process.env.GITHUB_ACTIONS === 'true';
const repo = 'daily-site';                 // ← 改成你的仓库名
const basePath = isCI ? `/${repo}` : '';

const nextConfig = {
  output: 'export',            // 纯静态导出
  images: { unoptimized: true },
  basePath,                    // 页面/路由前缀
  assetPrefix: basePath,       // 静态资源前缀
};

export default nextConfig;

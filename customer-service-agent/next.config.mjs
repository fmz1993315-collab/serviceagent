/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * 默认适配 Vercel 部署。
   * 如需静态导出：将 output 改为 "export" 并确保不使用 server-only 能力
   * （本项目含 /api + Prisma，因此不适合纯静态导出）。
   */
};

export default nextConfig;


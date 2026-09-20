import type { NextConfig } from "next";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] || "";
const isProjectPage =
  process.env.GITHUB_ACTIONS === "true" &&
  repository.length > 0 &&
  !repository.endsWith(".github.io");
const assetPrefix = isProjectPage ? "/" + repository : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  assetPrefix: assetPrefix || undefined,
};

export default nextConfig;

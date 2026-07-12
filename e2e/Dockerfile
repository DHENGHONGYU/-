# V9 视觉回归 — Docker 基线生成环境
# 用途：统一跨平台（Windows/macOS/Linux）视觉回归基线，消除字体/渲染差异
# 基线真相源：由此容器生成的截图应提交到仓库，作为 CI 回归的唯一参考
#
# 使用方式：
#   1. 本地更新基线：docker compose -f e2e/docker-compose.yml run --rm visual-update
#   2. CI 回归比对：docker compose -f e2e/docker-compose.yml run --rm visual-test
#   3. 直接构建：docker build -t v9-visual -f e2e/Dockerfile . && docker run --rm -v $(pwd)/e2e:/app/e2e v9-visual

# ══════════════════════════════════════════════════════════════════════════════
# 基础镜像：Playwright 官方镜像（已预装 Chromium/Firefox/WebKit 依赖）
# 版本必须与 package.json 中 @playwright/test 一致
# ══════════════════════════════════════════════════════════════════════════════
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

# 设置工作目录
WORKDIR /app

# 安装 Node.js 20（Playwright 官方镜像自带 Node 18，升级到 20 与项目一致）
RUN apt-get update && apt-get install -y curl \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

# 验证 Node 版本
RUN node --version && npm --version

# 复制依赖文件并安装（利用 Docker 缓存层）
COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit

# 安装 Playwright 浏览器（确保与镜像预装依赖一致）
RUN npx playwright install chromium

# 复制项目源码（通过 .dockerignore 排除不需要的文件）
COPY . .

# 暴露 Vite dev server 端口（Playwright webServer 自动使用）
EXPOSE 3000

# 默认命令：运行视觉回归测试（比对模式，不更新基线）
CMD ["npm", "run", "test:e2e:visual"]

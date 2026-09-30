# 弈境 · 中国象棋

一款支持人人对战与人机对战的在线中国象棋。使用 React、TypeScript 与 Vite 构建，可直接部署为 GitHub Pages 静态站点。

## 功能

- 人人对战：同一设备轮流落子，支持红黑双方。
- 人机对战：可选择执红或执黑，内置入门、进阶、高手、大师四档 AI。
- 完整规则：将、士、象、马、车、炮、兵走法，以及蹩马腿、塞象眼、炮架、九宫、过河兵、将帅照面和不能送将等约束。
- 对局辅助：悔棋、提示、翻转棋盘、最近一步标记、合法落点提示和中文棋谱。
- 对局体验：将军与终局提示、Web Audio 音效、明暗主题和移动端自适应布局。
- 本地保存：自动保存棋局、主题和音效设置；PWA 支持离线访问。

## 本地开发

```bash
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。

## 测试与构建

```bash
npm test
npm run build
npm run preview
```

`npm test` 运行 Vitest 单元测试，`npm run build` 执行 TypeScript 类型检查并生成生产构建，产物位于 `dist/`。

## 部署

仓库已包含 `.github/workflows/deploy.yml`。推送到 `main` 分支后，GitHub Actions 会自动运行测试、构建并部署到 GitHub Pages。仓库的 Pages Source 需设置为 **GitHub Actions**。

部署完成后访问：<https://zhq734.github.io/yx-xq/>

## 技术结构

```text
src/
  components/       界面组件与 SVG 棋盘
  engine/           象棋规则引擎与 AI 搜索
  hooks/            棋局状态、音效等 React Hooks
  test/             测试环境初始化
public/             PWA 清单、Service Worker 与图标
```

## 许可

本项目仅用于学习与娱乐。

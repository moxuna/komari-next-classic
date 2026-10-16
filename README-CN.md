# Komari Next Classic

[Komari](https://komari-document.pages.dev/) 自定义前端主题 —— **v2.0.1**。

Komari Next Classic 是在 Komari Next 系列基础上重做的看板主题，**只包含前端主题**：
不需要配套后端、不需要额外服务、不需要探针。把主题包装到原版 Komari 上即可使用。

- 主题清单：`theme/komari-theme.json` —— `name: Komari Next Classic`、`short: komari-next-classic`、`version: 2.0.1`
- 技术栈：Next.js 16（静态导出）· React 19 · TypeScript · Tailwind CSS 4 · Radix UI

![预览](./theme/preview.png)

## 功能特性

**首页**

- 6 个状态卡片紧贴顶部导航栏：当前时间（带时区下拉）、当前在线、地区概览、流量概览、
  实时速率、资产概览
- 节点卡片显示 CPU 型号 × 核数、内存与硬盘用量（已用/总量），并按监测点分行显示
  名称 + 色块 + 延迟 / 丢包（最多 3 行，超出折叠）
- 「月度」流量行最多保留两位小数（`1.5 TB` / `1.49 TB`），不再取整
- 分组切换与节点搜索合并成一行轻量工具栏，不再有占满屏幕的搜索大卡片

**节点详情页**

- 负载与延迟图表、网络质量面板
- 「处理器」卡片带 CPU 规格信息行
- 到期时间线（导航栏日历按钮）与资产概览面板

**交互**

- 导航栏最左侧搜索按钮弹出搜索面板；`/` 聚焦输入框，`Esc` 先清空、再按一次才关闭
- 主题配置全部通过 Komari 后台「主题设置」管理
- 多语言跟随 Komari 语言包（`en`、`zh_CN`、`zh_TW`、`ja_JP`、`id_ID`）
- 构建时自动注入增强脚本：到期提醒 + 资产计算器按钮、心情/等级挂件、资产计算修正

## 安装

### 方式 A —— 直接安装打包好的主题（推荐）

1. 下载 Release 中的 `komari-next-classic-v*.zip`
2. Komari 后台 → **主题管理 → 上传主题 / 更新主题**
3. 包内已包含 `komari-theme.json`、`preview.png` 与 `dist/`，可直接上传

> **不要**把 GitHub 源码 ZIP 当成主题包上传 —— 源码包没有构建产物。

### 方式 B —— 从源码构建

```bash
cd theme
npm ci
npm run build        # next build + postbuild 注入增强脚本
./build-theme.sh     # 可选：打包成 dist/komari-next-classic-v<日期>-<commit>.zip
```

然后把 `theme/dist/` 连同 `theme/komari-theme.json`、`theme/preview.png` 一起部署到主题目录。

环境要求：

- **Node.js 20+**（Next.js 16 的要求）
- **Python 3** —— `postbuild` 步骤（`python inject-enhancements.py`）负责把增强脚本注入到
  构建产物 HTML 里；跳过它就没有到期/资产按钮和心情挂件

## 配置项

全部在 Komari 后台的「主题设置」里配置：

| 配置键 | 说明 |
|---|---|
| `colorTheme` | 6 套配色：`default`、`ocean`、`sunset`、`forest`、`midnight`、`rose` |
| `backgroundImageUrl` | 背景图片链接 |
| `logoImageUrl` | Logo 图片链接 |
| `showAssetCalculatorButton` | 右下角资产计算器按钮 |
| `statusCardsVisibility.*` | 逐个卡片显隐：`currentTime`、`currentOnline`、`regionOverview`、`trafficOverview`、`networkSpeed`、`assetOverview` |
| `showMoodSystem`、`showLevelSystem` | 心情 / 等级系统 |

主题还会读取主题配置里的 `cardLayout` 与 `selectedTimeZone`。时区下拉位于「当前时间」卡片上，
只影响该卡片。

## 开发

```bash
cd theme
npm ci
npm run dev            # 开发服务器
npm run build          # 生产构建 + 注入增强脚本
python inject-enhancements.py --check   # 校验注入是否就位（脚本幂等）
npx tsc --noEmit       # 类型检查
npx eslint src         # 代码检查
npm run i18n:sync:dry  # i18n 键差异（npm run i18n:sync 会写回，需要 OPENAI_API_KEY）
```

源码、构建与打包说明：

- `src/` —— 主题源码（Next.js App Router）
- `enhancements/` —— 构建后注入的运行时增强脚本
- `inject-enhancements.py` —— 幂等注入器，作为 `postbuild` 自动执行
- `build-theme.sh` —— 把 `preview.png` + `komari-theme.json` + `dist/` 打成发布 zip
- `preview.png` —— 主题商店预览图

## 仓库结构

```text
.
├── theme/
│   ├── src/                  # 主题源码（组件、Context、i18n、样式）
│   ├── public/               # 静态资源
│   ├── enhancements/         # 注入用的增强脚本
│   ├── script/               # i18n 同步辅助脚本
│   ├── dist/                 # 构建产物（已 gitignore，随发布 zip 分发）
│   ├── komari-theme.json     # 主题清单
│   ├── preview.png           # 主题预览图
│   ├── inject-enhancements.py
│   └── build-theme.sh
├── README.md
├── README-CN.md
├── SECURITY.md
└── LICENSE
```

## 致谢

Komari Next Classic 是 **Komari Next Pro**（作者 LIU，<https://github.com/fanchengliu/komari-next-pro>）
的修改版分支，后者又源自 Komari Next 主题。

本分支的改动：

- 更名为 Komari Next Classic，主题版本号提升到 `2.0.1`
- 移除可选的 `unlock-probe` 后端、流媒体解锁面板与 IP 信息面板
- 不再需要「主题 + 反代后端」的组合，只需要原版 Komari
- 清掉不可达的上游代码（后台 admin 模块、未被引用的 UI 基础件与辅助组件，约 50 个文件），
  并修完全部 lint 错误：`npx eslint src` 不再报 error
- 五种内置语言包的键已全部对齐（各 **95** 键：删掉了 584 个本项目用不到的死键，
  语言包体积 175 KB → 24 KB；如日后要跟上游同步，直接用上游语言包覆盖即可）
- 手机端与作者发布的「预构建产物」逐项对齐（卡片恒为两列、状态卡片内边距、行距/进度条厚度、
  详情页手机端图表尺寸等），预览图已换成当前界面的实拍
- 在上游主题基础上做了前端修复与清理（另删掉 6 个零引用文件：`LoadChart.tsx`、`utils/index.ts`
  及其 3 个只被它转出的辅助模块、`rpc2.ts.rej`；全仓库行尾统一为 LF）

## 许可证

[MIT](./LICENSE) —— 保留原始版权声明。

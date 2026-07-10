# M2 依赖安全审计 — 2026-07-10

> 范围：只处理原项目分析中的第 5 项“生产依赖可达性审计与安全升级”。不处理 `web_search`、官网或法务页面。

## 1. 结论

本轮通过直接依赖升级、同主版本 `overrides`、删除无引用依赖，以及把 Office 附件转换从废弃的 `markitdown-js` 切到仓库既有 Python/uv 工具链，完成两轮依赖收口。

`bun audit --production` 从 **161（5 critical / 71 high / 76 moderate / 9 low）** 降至 **40（1 critical / 20 high / 18 moderate / 1 low）**。审计数字不能直接等同为可利用漏洞数量；当前唯一 critical 是跨 Pi、飞书与 WhatsApp 运行时的 `protobufjs`，不能用单一全局大版本覆盖安全消除。

## 2. 已升级与固定

| 依赖 | 原版本范围 | 新安全下限 | 作用域 |
|---|---:|---:|---|
| `electron` | `^39.2.7` | `^39.8.10` | 桌面运行时 |
| `shell-quote` | `^1.8.3` | `^1.9.0` | shared 运行时与传递链 |
| `undici` | `^7.22.0` | `^7.28.0` | Electron 网络依赖 |
| `ws` | `^8.16.0` / `^8.19.0` | `8.21.0` | Electron、server、Pi/Lark/Baileys 传递链 |
| `vite` | `^6.2.4` | `^6.4.3` | 构建工具 |
| `postcss` | `^8.5.6` | `^8.5.16` | 构建工具 |
| `@aws-sdk/client-s3` | `^3.947.0` | `^3.1084.0` | 发布/上传工具 |
| `@larksuiteoapi/node-sdk` | `^1.62.1` | `^1.70.0` | 飞书消息集成 |
| `linkify-it` | `^5.0.0` | `^5.0.2` | Markdown 链接识别 |

根 `package.json` 的 Bun 顶层 `overrides` 固定以下已修复版本：`@hono/node-server`、`@xmldom/xmldom`、`axios`、`diff`、`fast-uri`、`flatted`、`follow-redirects`、`form-data`、`hono`、`ip-address`、`linkify-it`、`lodash`、`markdown-it`、`path-to-regexp`、`qs`、`rollup`、`shell-quote`、`tmp`、`ws`。

其中 `fast-uri@3.1.2`、`ip-address@10.1.1`、`markdown-it@14.2.0`、`lodash@4.18.1` 均使用其安全公告给出的首个修复版本或更高同主版本。

## 3. 已删除的依赖链

### 3.1 `markitdown-js`

原 `packages/server-core/src/handlers/rpc/files.ts` 在 Office 附件存储时直接调用 `markitdown-js@0.0.14`。该包带入 `xmldom`、`node-tesseract-ocr`、`xlsx`、`exiftool-vendored`、旧 Azure SDK 等无人维护或不可安全升级的链路。

现状：

- 新增 `packages/server-core/src/services/markitdown.ts`，使用 `execFile` 调用 `apps/electron/resources/scripts/markitdown_cli.py`。
- 参数不经过 shell；输入、输出均作为独立 argv 传递。
- runtime 依次支持 server-build `CRAFT_SCRIPTS`、Electron `U_AGENTS_RESOURCES_BASE`、packaged fallback 与 monorepo dev fallback。
- 转换超时 300 秒（覆盖首次 uv 依赖准备），输出为空即失败；失败时附件 handler 清理中间 `.md`。
- 根依赖与 `bun.lock` 已完全移除 `markitdown-js`、`xmldom@0.6.0`、`node-tesseract-ocr`、`xlsx@0.18.5`、`exiftool-vendored`。

该改造同时让 Electron main bundle 从本轮改造前的 **43.3 MB** 降至 **24.1 MB**。

### 3.2 无引用直依赖

- 删除 `@github/copilot-sdk`：全仓源码无 import；U Agents 也不开放 Copilot provider UI。由它带入的旧 `@github/copilot` 高危 CLI 链随之消失。
- 删除 `react-devtools-core`：全仓源码无 import；移除后所有剩余 `ws` 均为 8.x，可安全统一到 8.21.0。

## 4. 剩余 critical：`protobufjs`

当前存在两条运行时链：

- `protobufjs@7.5.4`：由 `@google/genai@1.52.0`、`@larksuiteoapi/node-sdk` 和 `@whiskeysockets/baileys` 带入。
- `protobufjs@6.8.8`：由 `@whiskeysockets/libsignal-node` 精确依赖带入。

Bun 当前不支持 nested overrides。全局强制到 7.x 会覆盖 libsignal 的精确 6.8.8 合同，可能破坏 WhatsApp 加密协议；强制到 6.x 又会倒退其他 SDK，因此本轮不做危险覆盖。

后续应随 Pi/Google SDK 与 Baileys/libsignal 上游升级，并在变更后真测 WhatsApp 配对、收发消息和历史凭证兼容。

## 5. 剩余 high / moderate 的边界

- `music-metadata@7` / `file-type@16`：由 Baileys 6.x 带入；安全版本位于更高主版本，需随 WhatsApp SDK 升级。
- `minimatch@3`、`picomatch@2`：与 5/9/10 或 4.x 多主版本并存，主要来自 Electron builder、ESLint 和 Sentry Vite 构建链；Bun 无 nested override，不能全局压成单一版本。
- `@opentelemetry/core`：Sentry 10.36.0 的 OpenTelemetry 组件存在精确版本互锁；只覆盖 `core` 会制造同套 SDK 内部版本错位，应在同步升级整套 Sentry 时处理。
- `js-yaml@3` / `ajv@6`：来自 `gray-matter` 与旧 ESLint 工具链，其中部分公告当前没有可用的同主版本修复。
- `uuid` 多主版本与 `@babel/core` 构建链：等待直接父依赖升级，不做跨主版本全局覆盖。

## 6. 验证

- `bun install --frozen-lockfile`：通过，1748 installs / 1650 packages，无变化。
- `bun run validate:ci`：通过。
- TypeScript：全部 package 通过。
- shared tests：20 + 5 + 79 全绿。
- doc tools smoke tests：19 全绿，包含 DOCX `markitdown` 实际转换。
- `markitdown.test.ts`：4/4，通过四种 runtime 路径解析。
- `convertDocumentToMarkdown` 真实进程调用：通过，输出内容校验成功。
- `bun run electron:build`：通过；main、preload、renderer、resources 与 assets 均生成成功。
- i18n parity / sorted / coverage：全绿。

## 7. 后续同步约束

v0.11.0 会把 Pi SDK 升至 0.80.3，但不能据此假设 `protobufjs` 风险自动关闭。同步时必须保留本轮依赖删除、安全下限和根 `overrides`，再以合并后的 `bun.lock` 重新执行 §6；`bun audit --production` 不得高于 **40**，新增 critical 必须停下。

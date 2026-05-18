# 🎯 GotoPlan - AI 计划管理器

<div align="center">

[![Version](https://img.shields.io/badge/version-1.0.4-blue.svg)](https://github.com/feixuelingcloud/gotoplan-manager)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Plugin-orange.svg)](https://openclaw.ai)

**一个强大的 OpenClaw 插件，通过 AI 助手实现智能计划和任务管理、AI 员工克隆与 Boss 多 Agent 编排**

[English](README_EN.md) | 简体中文

</div>

---

## ✨ 功能特性

### 📋 计划管理
- **创建计划草稿** - AI 辅助创建结构化的计划草稿
- **确认和修改计划** - 灵活的计划确认和修改流程
- **计划列表查询** - 支持多种时间范围和状态筛选
  - **本周** / **上周** / **本月** / **全部**
  - **待办** / **进行中** / **已完成** / **被阻塞**
- **计划详情查看** - 获取完整的计划信息和任务层级

### ✅ 任务管理
- **任务状态更新** - 快速更新任务的执行状态
- **进度跟踪** - 实时追踪任务和计划的完成进度
- **层级任务支持** - 支持多层级的父子任务关系

### 📊 报告和分析
- **执行报告生成** - 自动生成计划执行情况报告
  - 完成率统计
  - 逾期任务统计
  - 阻塞任务识别
  - 下一步行动建议
- **今日重点** - 快速查看今天需要关注的任务
- **计划提醒** - 智能提醒即将到期的任务

### 🤖 AI 员工克隆与 Boss 多 Agent 编排
- **AI 员工列表** - 查看当前账号下所有可用的 AI 员工
- **一键克隆员工** - 将 AI 员工克隆为活跃的 Agent（支持单个或批量克隆）
- **智能克隆检测** - 克隆前自动检测已有克隆体，弹窗提示选择"全部重新克隆"或"只克隆新增"，避免误操作
- **克隆体管理** - 查看所有已激活的克隆 Agent，支持停用
- **Boss 任务分派** - Boss 助理向指定 Agent 下发任务，Agent 自主执行
- **任务状态追踪** - 实时查询已分派任务的执行进度
- **工作汇报系统** - Agent 完成任务后自动提交工作报告，Boss 审阅确认
- **Boss 晨间调度** - 每天早上一键将当日待办任务自动分派给各 Agent

### 💬 GotoBot 频道集成
- **机器人指令执行** - 通过 `execute_bot_command` 向 GotoBot 频道发送机器人指令
- **频道消息回复** - 通过 `send_gotobot_reply` 在 GotoBot 频道中发送回复消息
- **实时沟通桥梁** - 实现 AI 员工与团队成员在 GotoBot 频道的实时交互

### 📝 计划成果同步（Notion / 飞书 / 语雀）
- **Notion 同步** - 确认报告后自动将成果写入 Notion 页面（Markdown 格式完整保留）
- **飞书文档同步** - 确认报告后自动创建飞书 Docx 文档并写入成果
- **语雀同步** - 确认报告后自动将成果发布到语雀知识库文章
- **灵活选择** - 每次确认报告时可选同步目标：`notion` / `feishu` / `yuque` / `both` / `none` / `auto`
- **自动模式** - `auto` 模式下根据插件配置开关自动决定同步到哪个平台

### 🔌 AI 集成
- 自然语言交互
- 智能时间解析（支持"明天"、"下周一"等自然表达）
- 上下文感知的任务管理
- 自动化的工作流建议
- **连接诊断** - 内置连接测试工具，快速排查 API Key / 网络问题

---

## 🚀 快速开始

### macOS / Linux

**方式一：OpenClaw 聊天自动安装（推荐）⭐**

在 **OpenClaw 聊天界面**中直接输入：

```
从 GitHub 安装插件：https://github.com/feixuelingcloud/gotoplan-manager
```

OpenClaw 会自动克隆、构建、配置并重启 Gateway，按提示填入 API Key 即可。

**方式二：命令行安装（备选）**

```bash
git clone https://github.com/feixuelingcloud/gotoplan-manager.git
cd gotoplan-manager
chmod +x install.sh && ./install.sh
```

---

### Windows ⚠️ 请使用脚本安装

> Windows 版 OpenClaw 通过聊天安装 GitHub 插件时存在已知问题：
> 插件文件未能正确写入 plugins 目录，且会向 `openclaw.json` 写入不合法的 `path` 字段，
> 导致 Gateway 无法启动。请使用以下脚本方式安装。

**一键安装脚本**（推荐）：

```powershell
git clone https://github.com/feixuelingcloud/gotoplan-manager.git
cd gotoplan-manager
powershell -ExecutionPolicy Bypass -File windows-install.ps1
```

或直接右键 `windows-install.ps1` → **用 PowerShell 运行**

**无 git 环境**，可下载 zip 后命令行安装：

```powershell
$url = "https://github.com/feixuelingcloud/gotoplan-manager/archive/refs/heads/main.zip"
Invoke-WebRequest -Uri $url -OutFile "$env:TEMP\plugin.zip"
Expand-Archive "$env:TEMP\plugin.zip" "$env:TEMP\plugin-src" -Force
New-Item -ItemType Directory -Force "$env:USERPROFILE\.openclaw\plugins\gotoplan-manager"
Copy-Item "$env:TEMP\plugin-src\gotoplan-manager-main\*" "$env:USERPROFILE\.openclaw\plugins\gotoplan-manager\" -Recurse -Force
cd "$env:USERPROFILE\.openclaw\plugins\gotoplan-manager"; npm install
openclaw gateway restart
```

详细说明及故障排查见 [INSTALLATION.md](INSTALLATION.md)。

---

## ⚙️ 配置说明

### API Key 获取

你需要从你的 AI 计划管理系统后端获取 API Key：

1. 登录你的 AI 计划管理系统
2. 进入 **设置 → API 管理**
3. 点击 **创建新的 API Key**
4. 复制 API Key 并妥善保存

### 在 OpenClaw 中配置 API Key

#### 💡 方法 1：通过聊天界面配置（最简单）

在 OpenClaw 聊天界面中输入：

```
请配置 gotoplan-manager 插件的 API Key: YOUR_API_KEY_HERE
```

OpenClaw 会自动帮你更新配置！

#### 方法 2：手动编辑配置文件

编辑 **`~/.openclaw/openclaw.json`**，在 `plugins.entries` 下只使用 `enabled`、`config` 等允许字段（与 `openclaw.plugin.json` 中 `configSchema` 一致，接口地址键名为 **`apiBase`**）：

```json
{
  "plugins": {
    "entries": {
      "@gotoplan/manager": {
        "enabled": true,
        "config": {
          "apiKey": "YOUR_API_KEY",
          "apiBase": "https://plan.lingcloudai.com/api"
        }
      }
    }
  }
}
```

配置完成后重启 OpenClaw 即可生效。

### Notion 同步配置（可选）

在 OpenClaw 插件配置中添加以下字段，即可在确认报告时自动同步成果到 Notion：

| 配置项 | 说明 |
|-------|------|
| `notionEnabled` | 设为 `true` 启用 Notion 同步 |
| `notionApiKey` | Notion Integration Token（以 `secret_` 或 `ntn_` 开头） |
| `notionParentPageId` | Notion 父页面 ID（成果会写入该页面下的当日子页面） |

> 获取方式：在 [Notion Integrations](https://www.notion.so/my-integrations) 创建 Integration，获取 Token 后邀请至目标页面。

### 飞书文档同步配置（可选）

在 OpenClaw 插件配置中添加以下字段，即可在确认报告时自动同步成果到飞书文档：

| 配置项 | 说明 |
|-------|------|
| `feishuEnabled` | 设为 `true` 启用飞书同步 |
| `feishuAppId` | 飞书开放平台应用的 App ID |
| `feishuAppSecret` | 飞书开放平台应用的 App Secret |
| `feishuFolderToken` | （可选）飞书云空间文件夹 token，设置后文档会创建在该文件夹下 |

> 获取方式：在 [飞书开放平台](https://open.feishu.cn/) 创建企业自建应用，开启「云文档」权限，获取 App ID 和 App Secret。

### 语雀同步配置（可选）

在 OpenClaw 插件配置中添加以下字段，即可在确认报告时自动同步成果到语雀知识库：

| 配置项 | 说明 |
|-------|------|
| `yuqueEnabled` | 设为 `true` 启用语雀同步 |
| `yuqueToken` | 语雀个人访问令牌（在语雀账号设置 → Token 中生成） |
| `yuqueNamespace` | 目标知识库路径，格式：`用户名/知识库slug`，例如 `zhangsan/work-notes` |

> 获取方式：登录 [语雀](https://www.yuque.com/)，进入账号设置 → Token，创建个人访问令牌。知识库路径可从知识库 URL 中获取。

---

## 📖 使用指南

### 基础操作

#### 1. 创建计划 📝

```
帮我创建一个新项目计划：开发移动应用，包含设计、开发、测试三个阶段
```

AI 会帮你生成计划草稿，确认后会自动创建。

#### 2. 查看计划列表 📋

```
告诉我本周的计划
```

```
查看上周完成的计划
```

```
显示所有进行中的计划
```

#### 3. 查看计划详情 🔍

```
告诉我第1个计划的详情
```

#### 4. 更新任务状态 ✅

```
将"设计原型"这个任务标记为已完成
```

#### 5. 生成执行报告 📊

```
生成本周的计划执行报告
```

```
查看上周的计划完成情况
```

#### 6. 查看今日重点 🎯

```
今天我需要做什么？
```

```
显示今日重点任务
```

### AI 员工克隆与 Boss 调度

#### 7. 查看 AI 员工 👥

```
列出我的AI员工
```

#### 8. 克隆 AI 员工 🧬

```
克隆我的AI员工
```

```
把"小王"克隆为活跃Agent
```

#### 9. 查看已克隆的 Agent 🤖

```
列出所有克隆体
```

#### 10. Boss 分派任务 📤

```
给"写作助手"分派任务：撰写一篇关于AI趋势的分析报告
```

#### 11. 查看任务执行状态 🔍

```
查看任务执行状态
```

#### 12. 查看工作汇报 📬

```
查看Agent的工作汇报
```

#### 13. 确认报告并同步成果 ✅

```
确认这份报告，并同步到飞书
```

```
确认报告，同步到Notion
```

```
确认报告，同步到语雀
```

```
确认报告，同时同步到飞书和Notion
```

#### 14. Boss 晨间调度 🌅

```
执行晨间调度，把今天的任务分派给各Agent
```

#### 15. GotoBot 频道操作 💬

```
向GotoBot频道发送指令：查询今日销售数据
```

```
在GotoBot频道回复：已处理完毕，结果已更新到系统
```

### 高级功能

#### 时间范围筛选 📅

支持的时间范围：
- `本周` - 当前周（周一到周日）
- `上周` - 上一周（周一到周日）✨ **新增**
- `本月` - 当前月
- `全部` - 所有时间

示例：
```
查看上周的计划
告诉我本月所有已完成的计划
显示全部进行中的任务
```

#### 状态筛选 🏷️

支持的状态：
- `待办` (pending)
- `进行中` (in_progress)
- `已完成` (completed)
- `被阻塞` (blocked)

#### 关键词搜索 🔎

```
查找包含"开发"的计划
```

---

## 🛠️ 可用工具

插件提供以下 **22 个工具**：

#### 计划管理（10 个）

| 工具名称 | 描述 | 类型 |
|---------|------|------|
| `create_plan_draft` | 创建计划草稿 | 只读 |
| `confirm_plan` | 确认创建计划 | 写入 |
| `update_plan` | 修改计划信息 | 写入 |
| `list_plans` | 列出计划列表（支持时间范围/状态筛选） | 只读 |
| `get_plan_detail` | 获取计划详情 | 只读 |
| `update_task_status` | 更新任务状态 | 写入 |
| `generate_execution_report` | 生成执行报告 | 只读 |
| `get_plan_reminders` | 获取计划提醒 | 只读 |
| `get_today_focus` | 获取今日重点 | 只读 |
| `test_connection` | 连接诊断（排查 Token/网络问题） | 只读 |

#### AI 员工克隆与 Boss 多 Agent 编排（10 个）

| 工具名称 | 描述 | 类型 |
|---------|------|------|
| `list_ai_staff` | 列出当前账号的 AI 员工 | 只读 |
| `clone_staff_agent` | 克隆某个员工为活跃 Agent | 写入 |
| `clone_all_ai_staff` | 批量克隆所有 AI 员工（支持智能跳过已有克隆） | 写入 |
| `list_cloned_agents` | 列出所有已激活的克隆 Agent | 只读 |
| `remove_clone` | 停用某个克隆 Agent | 写入 |
| `dispatch_task_to_agent` | Boss 向指定 Agent 分派任务 | 写入 |
| `get_task_status` | 查询已分派任务的执行状态 | 只读 |
| `get_boss_reports` | Boss 获取 Agent 提交的工作汇报 | 只读 |
| `acknowledge_report` | Boss 确认报告（可选同步到 Notion/飞书/语雀） | 写入 |
| `boss_morning_dispatch` | Boss 晨间自动调度：分派当日任务给各 Agent | 写入 |

#### GotoBot 频道集成（2 个）🆕

| 工具名称 | 描述 | 类型 |
|---------|------|------|
| `execute_bot_command` | 向 GotoBot 频道执行机器人指令 | 写入 |
| `send_gotobot_reply` | 向 GotoBot 频道发送回复消息 | 写入 |

---

## 📁 项目结构

```
gotoplan-manager/
├── src/
│   ├── client/              # API 客户端
│   │   └── apiClient.ts
│   ├── config/              # 配置管理
│   │   └── index.ts
│   ├── tools/               # OpenClaw 工具（22 个）
│   │   ├── createPlanDraft.ts
│   │   ├── confirmPlan.ts
│   │   ├── updatePlan.ts
│   │   ├── listPlans.ts
│   │   ├── getPlanDetail.ts
│   │   ├── updateTaskStatus.ts
│   │   ├── generateReport.ts
│   │   ├── getPlanReminders.ts
│   │   ├── getTodayFocus.ts
│   │   ├── testConnection.ts
│   │   ├── listAIStaff.ts
│   │   ├── cloneStaffAgent.ts
│   │   ├── cloneAllAIStaff.ts
│   │   ├── listClonedAgents.ts
│   │   ├── removeClone.ts
│   │   ├── dispatchTaskToAgent.ts
│   │   ├── getTaskStatus.ts
│   │   ├── getBossReports.ts
│   │   ├── acknowledgeReport.ts
│   │   ├── bossMorningDispatch.ts
│   │   ├── executeBotCommand.ts  # GotoBot 频道指令 🆕
│   │   └── sendGotobotReply.ts   # GotoBot 频道回复 🆕
│   └── utils/               # 工具函数
│       ├── errors.ts
│       ├── datetime.ts
│       ├── openclawCli.ts
│       ├── notionClient.ts     # Notion 同步
│       ├── feishuClient.ts     # 飞书 Docx 同步
│       ├── yuqueClient.ts      # 语雀同步 🆕
│       └── gotobotChannel.ts   # GotoBot 频道客户端 🆕
├── skills/                  # 技能文档
│   ├── ai-plan-management/
│   └── boss-orchestration/
├── dist/                    # 编译输出
├── index.ts                 # 插件入口
├── claw-hub.json            # ClawHub 插件描述
├── openclaw.plugin.json     # OpenClaw 插件配置
├── package.json
├── tsconfig.json
├── README.md                # 中文文档
├── README_EN.md             # 英文文档
├── INSTALLATION.md          # 详细安装指导
├── CHANGELOG.md             # 更新日志
└── LICENSE                  # MIT 许可证
```

---

## 🔧 开发

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式（带热重载）
npm run dev

# 类型检查
npm run check

# 构建
npm run build
```

### 调试

设置环境变量启用调试模式：
```bash
DEBUG=true npm run dev
```

---

## 🆕 更新日志

### v1.0.4 (2026-05-18)

#### ✨ 新功能
- ✅ **GotoBot 频道集成** - 新增 `execute_bot_command` 和 `send_gotobot_reply` 工具，支持向 GotoBot 频道发送指令和回复
- ✅ **语雀同步** - 确认报告时可自动将成果发布到语雀知识库（需配置 `yuqueToken` 和 `yuqueNamespace`）
- ✅ **智能克隆检测** - 一键克隆 AI 员工前自动检测已有克隆体，弹窗提示选择"全部重新克隆"或"只克隆新增"，`clone_all_ai_staff` 新增 `reCloneExisting` 参数
- ✅ 工具总数从 20 个扩展到 **22 个**

#### 🎨 体验优化
- ✅ 克隆弹窗选择面板文字对比度优化，彻底解决黄色背景下文字发虚的视觉问题
- ✅ 已有克隆体列表以员工名称展示，支持超出3位时显示省略提示
- ✅ `acknowledge_report` 同步目标选项新增 `yuque` 支持

#### 🔧 配置增强
- ✅ `claw-hub.json` schema 新增 Yuque 相关配置字段（`yuqueEnabled`、`yuqueToken`、`yuqueNamespace`）

### v1.0.3 (2026-04-18)

#### 📝 文档与兼容性
- 安装说明改为当前 OpenClaw 的 `plugins.entries` / `openclaw.json`，避免在 `entries` 中误写 `path` 导致网关 `Unrecognized key` 启动失败
- 配置示例统一使用 `apiBase`（与 `openclaw.plugin.json` 一致）
- `loadConfig` 兼容旧文档中的 `apiBaseUrl` 别名
- ClawHub 打包 zip 文件名改为 `gotoplan-manager-<version>-clawhub.zip`（避免 npm scope 中的 `/` 在 Windows 下非法）

### v1.0.2 (2026-04-15)

#### ✨ 新功能
- ✅ 插件更名为 **GotoPlan**
- ✅ **飞书文档同步** - 确认报告时可自动创建飞书 Docx 并写入成果
- ✅ **Notion 同步** - 确认报告时可自动写入 Notion 页面（Markdown 格式保留）
- ✅ **同步目标可选** - `acknowledge_report` 新增 `syncTarget` 参数（`notion` / `feishu` / `both` / `none` / `auto`）
- ✅ **AI 员工克隆** - 支持单个或批量克隆 AI 员工为活跃 Agent
- ✅ **Boss 多 Agent 编排** - Boss 助理可向 Agent 分派任务、查看汇报、晨间自动调度
- ✅ **连接诊断工具** - `test_connection` 快速排查 API Key / 网络问题
- ✅ 工具总数从 9 个扩展到 **20 个**

#### 🔧 配置增强
- ✅ `claw-hub.json` schema 新增 Notion 和飞书所有配置字段
- ✅ 支持通过插件配置或环境变量配置飞书/Notion 凭据

### v1.0.0 (2026-03-31)

#### ✨ 新功能
- ✅ 支持查询"上周"的计划和报告
- ✅ 添加 `last_week` 时间范围选项
- ✅ 完善的时间范围计算逻辑

#### 🐛 Bug 修复
- 🔧 修复上周时间范围计算错误
- 🔧 优化周一/周日的边界处理

#### 📝 文档
- 📚 完整的 GitHub 发布文档
- 📚 详细的安装和配置指南
- 📚 英文版 README

查看完整更新日志：[CHANGELOG.md](CHANGELOG.md)

---

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](CONTRIBUTING.md)。

### 报告问题

如果你发现了 bug 或有功能建议，请在 [GitHub Issues](https://github.com/feixuelingcloud/gotoplan-manager/issues) 中提交。

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

---

## 🙏 致谢

- [OpenClaw](https://openclaw.ai) - 强大的 AI 助手平台
- 所有贡献者和用户的支持

---

## 📞 联系方式

- **作者**: feixuelingcloud
- **Email**: yemihu@lingcloud.ai
- **GitHub**: [@feixuelingcloud](https://github.com/feixuelingcloud)

---

## ❓ 常见问题

### Q: 如何更新插件？

**A:** 在 OpenClaw 聊天界面中输入：
```
更新 gotoplan-manager 插件
```

或手动执行：
```bash
cd gotoplan-manager
git pull
npm install
npm run build
```

### Q: 插件安装后无法使用？

**A:** 请检查：
1. API Key 是否正确配置
2. 后端服务是否正常运行
3. OpenClaw 是否已重启

### Q: 如何卸载插件？

**A:** 在 OpenClaw 聊天界面中输入：
```
卸载 gotoplan-manager 插件
```

---

## 🌟 Star History

如果这个项目对你有帮助，请给我们一个 ⭐️ Star！

[![Star History Chart](https://api.star-history.com/svg?repos=feixuelingcloud/gotoplan-manager&type=Date)](https://star-history.com/#feixuelingcloud/gotoplan-manager&Date)

---

<div align="center">

**[⬆ 回到顶部](#-gotoplan---ai-计划管理器)**

Made with ❤️ by feixuelingcloud

</div>

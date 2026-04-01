# zjjclaw

AI 驱动的都市超能网文自动写作系统，支持从世界观构建到章节生成的完整创作流水线。

## 特性

- **多 LLM 支持** — Anthropic Claude 与 DeepSeek 可随时切换
- **技能系统** — 通过 `skills/*/SKILL.md` 动态加载专属写作提示词
- **SSE 实时流式输出** — 章节内容生成实时推送
- **断点续写** — 自动流水线支持中断后恢复
- **记忆追踪** — 持续追踪角色关系、打脸对象、修炼境界、感情线进度
- **无数据库** — 所有数据以结构化文件存储于 `data/novels/{id}/`

## 技术栈

- **运行时:** Node.js + TypeScript (ES2022)
- **框架:** Express
- **LLM:** `@anthropic-ai/sdk` / `openai`（兼容 DeepSeek）

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 API Key

# 启动开发服务器（热重载）
npm run dev

# 构建并启动生产服务器
npm run build
npm start
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_PROVIDER` | LLM 提供商 (`anthropic` \| `deepseek`) | `anthropic` |
| `ANTHROPIC_API_KEY` | Anthropic API Key | — |
| `ANTHROPIC_BASE_URL` | Anthropic API 地址 | `https://api.anthropic.com` |
| `ANTHROPIC_MODEL` | Claude 模型名 | `claude-opus-4-6` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | — |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | DeepSeek 模型名 | `deepseek-chat` |
| `PORT` | 服务端口 | `7879` |

## API 接口

### 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/novels` | 创建小说项目 |
| `GET` | `/api/novels` | 列出所有项目 |
| `GET` | `/api/novels/:id` | 获取项目详情 |
| `GET` | `/api/novels/:id/status` | 查看写作进度 |

### 世界观构建（SSE 流式）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/novels/:id/world` | 生成世界观设定 |
| `POST` | `/api/novels/:id/power-system` | 设计能力体系 |
| `POST` | `/api/novels/:id/characters` | 创建角色 |
| `POST` | `/api/novels/:id/outline` | 生成故事大纲 |

### 章节操作（SSE 流式）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/novels/:id/chapters/plan` | 规划后续 N 章 |
| `POST` | `/api/novels/:id/chapters/:n/write` | 写作指定章节 |
| `POST` | `/api/novels/:id/chapters/:n/review` | 审校指定章节 |

### 自动化流水线

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/novels/:id/generate` | 全自动生成（支持断点续写）|
| `GET` | `/api/novels/:id/generate/status` | 查看流水线进度 |

### 导出 & 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/novels/:id/export` | 导出为 Markdown |
| `GET` | `/api/health` | 健康检查 |

## 项目结构

```
zjjclaw/
├── src/
│   ├── server.ts               # Express 应用入口
│   ├── routes/novels.ts        # 全部 API 路由
│   ├── services/
│   │   ├── llm.service.ts      # LLM 抽象层（Claude + DeepSeek）
│   │   ├── novel.service.ts    # 文件持久化层
│   │   └── skill.service.ts    # 技能加载与提示词构建
│   └── types/index.ts          # TypeScript 类型定义
├── skills/                     # 写作技能定义
│   ├── chapter-writer/
│   ├── chapter-planner/
│   ├── character-creator/
│   ├── plot-architect/
│   ├── world-builder/
│   ├── power-system-designer/
│   ├── novel-reviewer/
│   ├── story-memory/
│   ├── face-slap-planner/
│   ├── cheat-designer/
│   └── novel-init/
├── data/novels/                # 小说数据存储目录
├── .env.example
├── package.json
└── tsconfig.json
```

每部小说的文件结构：

```
data/novels/{novelId}/
├── meta.json
├── world.md
├── power-system.md
├── characters.json
├── outline.json
├── memory.json
├── generate-progress.json
├── chapters/
│   └── chapter-001.md ...
└── chapter-plans/
    └── plan-001.json ...
```

## 写作状态流转

```
init → world-built → power-system-designed → characters-created → outlined → writing → completed
```

## 请求示例

以下示例使用 curl，服务运行于 `http://localhost:7879`。

### 1. 创建小说项目

```bash
curl -X POST http://localhost:7879/api/novels \
  -H "Content-Type: application/json" \
  -d '{
    "title": "异能吞噬",
    "setting": "上海",
    "protagonist": "林逸",
    "cheatType": "吞噬系统",
    "targetChapters": 300,
    "wordsPerChapter": 2000,
    "themes": ["异能", "爱情", "修炼"]
  }'
```

响应：

```json
{
  "success": true,
  "data": {
    "title": "异能吞噬",
    "setting": "上海",
    "protagonist": "林逸",
    "cheatType": "吞噬系统",
    "targetChapters": 300,
    "wordsPerChapter": 2000,
    "status": "init",
    "currentChapter": 0,
    "createdAt": "2026-03-31T00:00:00.000Z",
    "updatedAt": "2026-03-31T00:00:00.000Z"
  }
}
```

### 2. 全自动生成（推荐）

一键从零生成完整小说，内部依次执行：世界观 → 力量体系 → 角色 → 大纲 → 章节规划 → 写章节。

```bash
# 启动生成（SSE 流式，每步完成实时推送）
curl -N -X POST http://localhost:7879/api/novels/abc123/generate

# 支持中断后断点续写（重新 POST 即可恢复）
# 强制从头重跑：
curl -N -X POST http://localhost:7879/api/novels/abc123/generate \
  -H "Content-Type: application/json" \
  -d '{"restart": true}'
```

SSE 事件流示例：

```
data: {"event":"start","data":{"message":"开始自动生成《都市最强学霸》"}}

data: {"event":"step","data":{"step":"构建世界观","message":"正在执行：构建世界观"}}

data: {"event":"step_done","data":{"step":"构建世界观"}}

data: {"event":"step","data":{"step":"设计力量体系","message":"正在执行：设计力量体系"}}

...

data: {"event":"done","data":{"message":"自动生成完成","status":"completed"}}
```

### 3. 查看流水线进度

```bash
curl http://localhost:7879/api/novels/abc123/generate/status
```

```json
{
  "success": true,
  "data": {
    "status": "running",
    "currentStep": "写第5章",
    "completedSteps": ["构建世界观", "设计力量体系", "创建人物", "生成大纲", "规划第1-10章", "写第1章", "写第2章", "写第3章", "写第4章"],
    "failedStep": null,
    "startedAt": "2026-03-31T00:00:00.000Z",
    "updatedAt": "2026-03-31T00:10:00.000Z"
  }
}
```

### 4. 分步手动创作

#### 生成世界观

```bash
curl -N -X POST http://localhost:7879/api/novels/abc123/world \
  -H "Content-Type: application/json" \
  -d '{"prompt": "融入道家修炼元素，现代都市与隐秘修炼界并存"}'
```

#### 创建角色

```bash
curl -N -X POST http://localhost:7879/api/novels/abc123/characters
```

#### 规划章节

```bash
curl -N -X POST http://localhost:7879/api/novels/abc123/chapters/plan \
  -H "Content-Type: application/json" \
  -d '{"from": 1, "count": 10}'
```

#### 写指定章节

```bash
curl -N -X POST http://localhost:7879/api/novels/abc123/chapters/1/write \
  -H "Content-Type: application/json" \
  -d '{"prompt": "开场要有强烈反差，主角被羞辱后系统觉醒"}'
```

#### 审校章节

```bash
curl -N -X POST http://localhost:7879/api/novels/abc123/chapters/1/review
```

### 5. 查看写作进度

```bash
curl http://localhost:7879/api/novels/abc123/status
```

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "title": "都市最强学霸",
    "status": "writing",
    "currentChapter": 12,
    "targetChapters": 100,
    "progress": "12/100章",
    "protagonistRealm": "炼气期第三层",
    "pendingFaceSlaps": 3
  }
}
```

### 6. 导出为 Markdown

```bash
curl http://localhost:7879/api/novels/abc123/export -o "都市最强学霸.md"
```

### 7. 列出所有项目

```bash
curl http://localhost:7879/api/novels
```

### 8. 健康检查

```bash
curl http://localhost:7879/api/health
```

---

## 技能系统

每个技能位于 `skills/{skill-name}/SKILL.md`，包含 YAML frontmatter 元数据与详细写作指引。技能在生成请求时被自动加载，注入到 LLM 的系统提示词中，控制写作风格、节奏、禁用模式等。

内置技能：章节写作、章节规划、角色创建、情节架构、世界观构建、能力体系设计、小说审校、故事记忆、打脸规划、金手指设计、小说初始化。

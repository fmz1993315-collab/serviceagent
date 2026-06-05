# customer-service-agent

一个完整的 AI 客服 Agent Demo（Next.js App Router + Prisma + SQLite + DeepSeek 流式输出 + 知识库检索 + 前端聊天组件）。

## 1. 功能

- 右下角悬浮按钮打开聊天窗口
- 桌面端：380×500，移动端：全屏
- Markdown 渲染（列表/加粗/代码块高亮）
- DeepSeek 流式输出（SSE 打字机效果）
- 简单知识库检索（`knowledge/base.json`，关键词匹配）
- SQLite 本地数据库持久化会话与消息
- 👍👎 反馈记录

## 2. 环境变量

复制并填写环境变量：

```bash
cp .env.example .env
```

然后编辑 `.env`：

```bash
DEEPSEEK_API_KEY=你的DeepSeek API Key
DATABASE_URL="file:./dev.db"
```

## 3. 安装依赖

```bash
npm install
```

## 4. 初始化数据库（Prisma + SQLite）

```bash
npx prisma migrate dev --name init
```

## 5. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问：

- http://localhost:3000

## 6. API 说明

### POST /api/chat

请求：

```json
{ "message": "你好", "sessionId": "可选" }
```

响应：SSE（`text/event-stream`），事件形如：

```txt
data: {"type":"meta","sessionId":"xxx"}

data: {"type":"token","token":"你"}

data: {"type":"token","token":"好"}

data: {"type":"done","messageId":"xxx"}

data: [DONE]
```

### POST /api/chat/feedback

```json
{ "messageId": "xxx", "type": "thumb_up" }
```

### GET /api/chat/history?sessionId=xxx

返回该会话的历史消息。

## 7. 部署

- 推荐部署到 Vercel（需要 Node.js runtime 支持）
- 本项目包含 `/api` 与 Prisma/SQLite，不适合纯静态导出


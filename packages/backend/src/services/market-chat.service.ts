import { BaseTextAdapter } from '@tanstack/ai/adapters';
import type {
  TextOptions,
  StreamChunk,
} from '@tanstack/ai';
import { deepseekClient } from './llm.service.js';

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// ─── 小说市场分析 System Prompt ──────────────────────────────────────────────

export const MARKET_ANALYSIS_SYSTEM = `你是一位专业的中国网络小说市场分析师，深度了解起点中文网、番茄小说、七猫小说等主流平台的读者喜好和市场趋势（数据截至 2025 年初）。

## 各平台特征
- **起点中文网**：主力付费用户群，偏好硬核玄幻修仙、都市商战、历史穿越；读者重视完善的升级体系、打脸爽感和宏大世界观；均订要求高
- **番茄小说**：免费+广告模式，读者年龄跨度大；偏好轻松爽文、甜宠无脑爽、快穿逆袭、末世重生；节奏要快，每章需有爽点
- **七猫小说**：付费+免费混合，女频市场占优；古言甜宠、现言总裁霸总文市场稳定，男频以低调修仙+都市异能为主

## 当前热门趋势（2024-2025）
1. **都市异能**：主角获得超凡能力在现代都市叱咤风云，"低调的强者"人设最吸量，医学/商业/军事背景加持
2. **玄幻修真**："重生+逆袭"组合依然是顶流，无敌流从未过时，关键在于爽点密度
3. **末世重生**：生存+进化体系+物资囤积，末日背景叠加回到过去的先知优势
4. **系统流**：各类型均可叠加系统金手指，任务系统/签到系统/商店系统仍有稳定受众
5. **赘婿/入赘**：低调高手被轻视后的逆袭，女频男频通吃

## 黄金套路要素
- 开篇必须前 3 章立住金手指，快速展示力量
- 打脸节奏：被轻视→积累实力→公开打脸，每 5-10 章一次小爽点
- 女主设定：强势外表+暗中欣赏/支持主角，增加粉丝粘性
- 结尾钩子：每章末尾悬念，保证追读率

## 核心任务
当用户请求市场分析或题材推荐时，你必须：
1. 用 2-3 句话简要分析当前市场热点
2. 推荐 3-5 个具体可落地的小说题材方案
3. 在回复末尾输出一个 JSON 数组（放在 \`\`\`json 代码块中），每个方案对应一个对象

JSON 数组格式（严格遵守，id 从 1 开始递增）：
\`\`\`json
[
  {
    "id": 1,
    "title": "小说标题",
    "template": "urban-supernatural",
    "tagline": "一句话吸引读者的核心卖点",
    "themes": ["标签1", "标签2", "标签3"],
    "setting": "背景城市或世界名",
    "protagonist": "主角姓名",
    "cheatType": "金手指类型描述",
    "hooks": ["爽点/钩子1", "爽点/钩子2"]
  }
]
\`\`\`

- template 只能取 "urban-supernatural"（都市异能）/ "xianxia"（玄幻修真）/ "post-apocalyptic"（末世重生）
- tagline 要有吸引力，概括核心爽点
- hooks 是读者会追读的关键悬念或爽点，2-3 条
- 每次推荐必须输出此 JSON，用户选择后系统将自动创建项目`;

// ─── DeepSeek 自定义 Adapter ─────────────────────────────────────────────────

export class DeepSeekChatAdapter extends (BaseTextAdapter as any) {
  name = 'deepseek' as const;

  constructor() {
    super({}, DEEPSEEK_MODEL);
  }

  async *chatStream(options: TextOptions): AsyncGenerator<StreamChunk> {
    const { messages, systemPrompts } = options;
    const messageId = (this as any).generateId() as string;
    const runId = (this as any).generateId() as string;

    yield { type: 'RUN_STARTED', runId } as unknown as StreamChunk;
    yield { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' } as unknown as StreamChunk;

    const systemContent = systemPrompts?.join('\n') ?? '';
    const formattedMessages = [
      ...(systemContent ? [{ role: 'system' as const, content: systemContent }] : []),
      ...(messages as Array<{ role: string; content: unknown }>).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    ];

    const stream = await deepseekClient.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: formattedMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield { type: 'TEXT_MESSAGE_CONTENT', messageId, delta } as unknown as StreamChunk;
      }
    }

    yield { type: 'TEXT_MESSAGE_END', messageId } as unknown as StreamChunk;
    yield {
      type: 'RUN_FINISHED',
      runId,
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0 },
    } as unknown as StreamChunk;
  }

  async structuredOutput(
    _options: Record<string, unknown>,
  ): Promise<unknown> {
    throw new Error('DeepSeekChatAdapter: structuredOutput not supported');
  }
}

export const deepSeekChatAdapter = new DeepSeekChatAdapter();
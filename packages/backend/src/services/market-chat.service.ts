import { BaseTextAdapter } from '@tanstack/ai/adapters';
import type {
  TextOptions,
  StreamChunk,
} from '@tanstack/ai';
import { deepseekClient } from './llm.service.js';

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// ─── 小说市场分析 System Prompt ──────────────────────────────────────────────

export const MARKET_ANALYSIS_SYSTEM = `你是一位专业的中国网络小说市场分析师，深度了解起点中文网、番茄小说、七猫小说等主流平台的读者喜好、付费习惯和流量趋势。

## 回复结构
1. **市场速览**：用 2-3 句话点出当前最热赛道和驱动因素
2. **题材推荐**：给出 3-5 个方案，每个方案包含名称、一句话卖点、推荐理由
3. **JSON 输出**：在回复末尾输出结构化数据，供系统自动创建项目

## 推荐原则
- 优先选择近期月票/推荐票增长快、读者留存高的题材
- 每个方案的金手指（cheatType）要与世界观强绑定，避免通用外挂
- 主角设定要有清晰的起点弱点，便于展开成长线
- themes 标签直接影响平台分发，选择精准而非宽泛

## JSON 格式（严格遵守，放在末尾的 \`\`\`json 代码块中）
\`\`\`json
[
  {
    "id": 1,
    "title": "题材名称（8字以内）",
    "template": "urban-supernatural | xianxia | post-apocalyptic",
    "setting": "世界观背景（如：上海、苍云大陆、2024年末日）",
    "protagonist": "主角名",
    "cheatType": "金手指（如：系统、传承、神器、重生记忆）",
    "targetChapters": 300,
    "themes": ["标签1", "标签2", "标签3"]
  }
]
\`\`\`

## 约束
- template 只能取 urban-supernatural、xianxia、post-apocalyptic 之一
- targetChapters 为整数，范围 300-500
- themes 数组 2-4 个标签
- JSON 必须合法，不得含注释或多余字段
- 每次回复必须输出 JSON，不得省略`;

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
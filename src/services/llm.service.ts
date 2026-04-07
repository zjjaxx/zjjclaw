import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const SSE_LOG_FILE = path.join(process.cwd(), 'logs', 'sse.log');
fs.mkdirSync(path.dirname(SSE_LOG_FILE), { recursive: true });

// ─── LLM 提供商配置 ──────────────────────────────────────────────────────────

export type LLMProvider = 'anthropic' | 'deepseek';

const DEFAULT_PROVIDER: LLMProvider =
  (process.env.LLM_PROVIDER as LLMProvider) || 'anthropic';

export const anthropicClient = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const deepseekClient = new OpenAI({
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-6';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

/** @deprecated 保留向后兼容 */
export const client = anthropicClient;

export function getProvider(): LLMProvider {
  return DEFAULT_PROVIDER;
}

// ─── SSE 工具 ─────────────────────────────────────────────────────────────────

export function sseHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

export function sendSSE(res: Response, event: string, data: unknown): void {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  res.write(line);
  const logLine = `[${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}] ${line}`;
  try {
    fs.appendFileSync(SSE_LOG_FILE, logLine);
  } catch (err) {
    console.error('[SSE log]', err);
  }
}

// ─── 流式写作（章节正文）─────────────────────────────────────────────────────

export async function streamToSSE(
  res: Response,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 6000,
  onComplete?: (fullText: string) => void,
  provider?: LLMProvider,
): Promise<void> {
  const p = provider ?? DEFAULT_PROVIDER;
  if (p === 'deepseek') {
    await streamToSSEDeepSeek(res, systemPrompt, userMessage, maxTokens, onComplete);
  } else {
    await streamToSSEAnthropic(res, systemPrompt, userMessage, maxTokens, onComplete);
  }
}

async function streamToSSEAnthropic(
  res: Response,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  onComplete?: (fullText: string) => void,
): Promise<void> {
  let fullText = '';

  const stream = anthropicClient.messages.stream({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const chunk = event.delta.text;
      fullText += chunk;
      sendSSE(res, 'delta', { text: chunk });
    } else if (event.type === 'message_stop') {
      sendSSE(res, 'done', { text: fullText });
    }
  }

  if (onComplete) onComplete(fullText);
}

async function streamToSSEDeepSeek(
  res: Response,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  onComplete?: (fullText: string) => void,
): Promise<void> {
  let fullText = '';

  const stream = await deepseekClient.chat.completions.create({
    model: DEEPSEEK_MODEL,
    max_tokens: maxTokens,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      fullText += delta;
      sendSSE(res, 'delta', { text: delta });
    }
    if (chunk.choices[0]?.finish_reason === 'stop') {
      sendSSE(res, 'done', { text: fullText });
    }
  }

  if (onComplete) onComplete(fullText);
}

// ─── 非流式调用（结构化数据生成）────────────────────────────────────────────

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096,
  provider?: LLMProvider,
  response_format?:ChatCompletionCreateParamsBase['response_format'],
): Promise<string> {
  const p = provider ?? DEFAULT_PROVIDER;
  if (p === 'deepseek') {
    return callDeepSeek(systemPrompt, userMessage, maxTokens,response_format);
  }
  return callAnthropic(systemPrompt, userMessage, maxTokens);
}

async function callAnthropic(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<string> {
  const response = await anthropicClient.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content.find(b => b.type === 'text');
  return text ? text.text : '';
}

async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  response_format?:ChatCompletionCreateParamsBase['response_format'],
): Promise<string> {
  const response = await deepseekClient.chat.completions.create({
    model: DEEPSEEK_MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: response_format,
  });

  return response.choices[0]?.message?.content ?? '';
}

// ─── JSON 提取 ────────────────────────────────────────────────────────────────

/**
 * 从 Claude 返回的文本中提取第一个 JSON 代码块
 * Claude 通常会把 JSON 包在 ```json … ``` 中
 */
export function extractJSON<T>(text: string): T | null {
  // 尝试提取 ```json ... ``` 块（兼容 ```json / ```typescript 等各种语言标识符）
  const codeBlockMatch = text.match(/```[^\n]*\n([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    return JSON.parse(codeBlockMatch[1].trim()) as T;
  }
  return JSON.parse(text.trim()) as T;
}

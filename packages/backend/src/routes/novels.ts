import { Router, type Request, type Response } from 'express';
import { buildSystemPrompt } from '../services/skill.service.js';
import {
  appendCharacters,
  buildChapterContext,
  buildGeneralContext,
  createNovel,
  deleteGenerateProgress,
  exportNovel,
  getCharacters,
  getChapter,
  getChapterPlan,
  getGenerateProgress,
  getMeta,
  getMemory,
  getOutline,
  getPowerSystem,
  getWorld,
  listGeneratedChapters,
  listNovels,
  saveCharacters,
  saveChapter,
  saveChapterPlan,
  saveGenerateProgress,
  saveMeta,
  saveMemory,
  saveOutline,
  savePowerSystem,
  saveWorld,
  type PipelineProgress,
} from '../services/novel.service.js';
import {
  callClaude,
  extractJSON,
  sendSSE,
  sseHeaders,
  streamToSSE,
} from '../services/llm.service.js';
import type {
  Character,
  ChapterPlan,
  CreateNovelRequest,
  Outline,
  MarketChatRequest,
  StoryMemory,
} from '../types/index.js';
import { chat } from '@tanstack/ai';
import { openaiText } from "@tanstack/ai-openai";
import { deepSeekChatAdapter, MARKET_ANALYSIS_SYSTEM } from '../services/market-chat.service.js';


export const router = Router();

// ─── 辅助：统一错误处理 ───────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, context: string): void {
  console.error(`[${context}]`, err);
  if (!res.headersSent) {
    res.status(500).json({ success: false, error: String(err) });
  } else {
    sendSSE(res, 'error', { message: String(err) });
    res.end();
  }
}

type GenerateStepStatus = 'pending' | 'running' | 'completed' | 'failed';

function buildGenerateStepStatuses(id: string, progress: PipelineProgress | null) {
  const completed = new Set(progress?.completedSteps ?? []);

  return buildGenerationPipeline(id).map((step) => {
    let status: GenerateStepStatus = 'pending';

    if (progress?.failedStep === step.name) {
      status = 'failed';
    } else if (progress?.currentStep === step.name && progress.status === 'running') {
      status = 'running';
    } else if (completed.has(step.name)) {
      status = 'completed';
    }

    return {
      name: step.name,
      status,
    };
  });
}

// ─── 市场分析聊天 ─────────────────────────────────────────────────────────────

// POST /api/novels/chat — 基于 @tanstack/ai 的流式聊天，分析起点/番茄/七猫小说市场
// 请求体：{ messages: [{role, content}][], autoCreate?: boolean }
// SSE 事件流：AG-UI 标准事件 (RUN_STARTED / TEXT_MESSAGE_* / RUN_FINISHED)
//             若 autoCreate:true 且 AI 回复含 JSON，额外推送 novel_created 事件
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const body = req.body as { messages: Array<{ role: 'user' | 'assistant'; content: string }>; autoCreate?: boolean };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      res.status(400).json({ success: false, error: '缺少 messages 字段' });
      return;
    }

    sseHeaders(res);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = chat({
      adapter: deepSeekChatAdapter as any,
      messages: body.messages,
      systemPrompts: [MARKET_ANALYSIS_SYSTEM],
    });

    let fullText = '';
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      if ((chunk as { type: string; delta?: string }).type === 'TEXT_MESSAGE_CONTENT') {
        fullText += (chunk as { delta: string }).delta;
      }
    }

    // 若 autoCreate:true，尝试从 AI 回复中解析小说创建参数并自动创建
    if (body.autoCreate) {
      const novelParams = extractJSON<CreateNovelRequest>(fullText);
      if (novelParams?.title?.trim()) {
        const meta = createNovel(novelParams);
        sendSSE(res, 'novel_created', { success: true, data: meta });
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    handleError(res, err, 'POST /chat');
  }
});

// ─── 小说项目 CRUD ────────────────────────────────────────────────────────────
// POST /api/novels — 创建小说项目
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as CreateNovelRequest;
    if (!body.title?.trim()) {
      res.status(400).json({ success: false, error: '缺少 title 字段' });
      return;
    }
    const meta = createNovel(body);
    res.json({ success: true, data: meta });
  } catch (err) {
    handleError(res, err, 'POST /novels');
  }
});

// GET /api/novels — 列出所有项目
router.get('/', (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: listNovels() });
  } catch (err) {
    handleError(res, err, 'GET /novels');
  }
});

// GET /api/novels/:id — 项目详情
router.get('/:id', (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }
    res.json({
      success: true,
      data: {
        ...meta,
        world: getWorld(meta.id) || null,
        powerSystem: getPowerSystem(meta.id) || null,
        characters: getCharacters(meta.id),
        outline: getOutline(meta.id),
        chapters: listGeneratedChapters(meta.id),
      },
    });
  } catch (err) {
    handleError(res, err, 'GET /novels/:id');
  }
});

// ─── 世界观构建 ───────────────────────────────────────────────────────────────

// POST /api/novels/:id/world  — SSE 流式生成世界观
router.post('/:id/world', async (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    sseHeaders(res);

    const systemPrompt = buildSystemPrompt('world-builder', '', meta.template);
    const userMsg = `请为以下小说构建世界观设定：
标题：${meta.title}
背景城市：${meta.setting}
主角类型：${meta.protagonist}
金手指：${meta.cheatType}
${(req.body as { prompt?: string }).prompt ? '额外要求：' + (req.body as { prompt?: string }).prompt : ''}`;

    await streamToSSE(res, systemPrompt, userMsg, 4096, (text) => {
      saveWorld(meta.id, text);
      meta.status = 'world-built';
      saveMeta(meta);
      console.log(`[world] 已保存世界观 for ${meta.id}`);
    });

    res.end();
  } catch (err) {
    handleError(res, err, 'POST /world');
  }
});

// ─── 力量体系 ─────────────────────────────────────────────────────────────────

// POST /api/novels/:id/power-system — SSE 流式生成力量体系
router.post('/:id/power-system', async (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    sseHeaders(res);

    const world = getWorld(meta.id);
    const context = world ? `### 世界观\n${world}` : '';
    const systemPrompt = buildSystemPrompt('power-system-designer', context, meta.template);

    const userMsg = `请为《${meta.title}》设计完整的力量/修炼体系。
金手指类型：${meta.cheatType}
${(req.body as { prompt?: string }).prompt ? '额外要求：' + (req.body as { prompt?: string }).prompt : ''}`;

    await streamToSSE(res, systemPrompt, userMsg, 4096, (text) => {
      savePowerSystem(meta.id, text);
      meta.status = 'power-system-designed';
      saveMeta(meta);
    });

    res.end();
  } catch (err) {
    handleError(res, err, 'POST /power-system');
  }
});

// ─── 角色创建 ─────────────────────────────────────────────────────────────────

// POST /api/novels/:id/characters — SSE + 解析保存角色 JSON
// 支持 mode: "core"（核心角色）| "arc"（弧线角色）| 缺省（旧版全量创建，兼容）
router.post('/:id/characters', async (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    const body = req.body as { prompt?: string; mode?: 'core' | 'arc'; arcIndex?: number };
    const mode = body.mode ?? 'full';

    sseHeaders(res);

    const context = buildGeneralContext(meta.id);
    let skillName: string;
    let userMsg: string;

    if (mode === 'core') {
      skillName = 'core-character-creator';
      userMsg = `请为《${meta.title}》创建核心人物（主角、核心女主、大Boss、关键配角），共 5-7 个角色，输出 JSON 数组。
主角名：${meta.protagonist}
金手指：${meta.cheatType}
${body.prompt ? '额外要求：' + body.prompt : ''}`;
    } else if (mode === 'arc') {
      skillName = 'arc-character-creator';
      const outline = getOutline(meta.id);
      const arcIdx = body.arcIndex ?? 0;
      const arc = outline?.arcs[arcIdx];
      const existingChars = getCharacters(meta.id);
      const existingList = existingChars.map(c => `${c.name}（${c.role}）`).join('、');
      userMsg = `请为《${meta.title}》的"${arc?.name ?? `第${arcIdx + 1}弧`}"弧创建新角色。
已有角色（不要重复创建）：${existingList}
${arc?.newCharacterHints?.length ? '本弧角色需求：\n' + arc.newCharacterHints.map((h, i) => `${i + 1}. ${h}`).join('\n') : ''}
${arc ? '本弧剧情：' + arc.summary : ''}
${body.prompt ? '额外要求：' + body.prompt : ''}
请输出 JSON 数组`;
    } else {
      skillName = 'character-creator';
      userMsg = `请为《${meta.title}》创建完整的人物体系，输出 JSON 格式。
主角名：${meta.protagonist}
金手指：${meta.cheatType}
${body.prompt ? '额外要求：' + body.prompt : ''}

请输出一个 JSON 数组，每个人物包含：name, role, appearance, personality, background, abilities, currentRealm, relationshipToProtagonist`;
    }

    const systemPrompt = buildSystemPrompt(skillName, context, meta.template);

    await streamToSSE(res, systemPrompt, userMsg, 4096, (text) => {
      const characters = extractJSON<Character[]>(text);
      if (characters && Array.isArray(characters)) {
        if (mode === 'arc') {
          appendCharacters(meta.id, characters);
        } else {
          saveCharacters(meta.id, characters);
        }
        meta.status = 'characters-created';
        saveMeta(meta);
        console.log(`[characters:${mode}] 已保存 ${characters.length} 个角色`);
      } else {
        console.warn('[characters] 无法解析 JSON，原始文本已在流中返回');
      }
    });

    res.end();
  } catch (err) {
    handleError(res, err, 'POST /characters');
  }
});

// ─── 故事大纲 ─────────────────────────────────────────────────────────────────

// POST /api/novels/:id/outline — SSE + 解析保存大纲
router.post('/:id/outline', async (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    sseHeaders(res);

    const context = buildGeneralContext(meta.id);
    const systemPrompt = buildSystemPrompt('plot-architect', context, meta.template);

    const userMsg = `请为《${meta.title}》创建完整故事大纲，输出 JSON 格式。
目标章节数：${meta.targetChapters}章
${(req.body as { prompt?: string }).prompt ? '额外要求：' + (req.body as { prompt?: string }).prompt : ''}

JSON 结构：{ premise, goldenFinger, overallConflict, endingVision, arcs: [{name, chapterRange, summary, majorEvents, faceSlapTargets, realmBreakthrough, newCharacterHints}] }
其中 newCharacterHints 是字符串数组，每弧 3-6 条，说明本弧需要新增什么类型的角色`;

    await streamToSSE(res, systemPrompt, userMsg, 6000, (text) => {
      const outline = extractJSON<Outline>(text);
      if (outline?.arcs) {
        saveOutline(meta.id, outline);
        meta.status = 'outlined';
        saveMeta(meta);
      }
    });

    res.end();
  } catch (err) {
    handleError(res, err, 'POST /outline');
  }
});

// ─── 章节规划 ─────────────────────────────────────────────────────────────────

// POST /api/novels/:id/chapters/plan — 规划接下来 N 章
router.post('/:id/chapters/plan', async (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    const body = req.body as { from?: number; count?: number; prompt?: string };
    const fromChapter = body.from ?? (meta.currentChapter + 1);
    const count = body.count ?? 5;

    sseHeaders(res);

    const context = buildGeneralContext(meta.id);
    const memory = getMemory(meta.id);
    const outline = getOutline(meta.id);

    const systemPrompt = buildSystemPrompt('chapter-planner', context, meta.template);

    const userMsg = `请为《${meta.title}》规划第 ${fromChapter} 到第 ${fromChapter + count - 1} 章，共 ${count} 章。
输出 JSON 数组，每章格式：{ chapterNumber, title, pov, location, summary, beats, faceSlapMoment, breakthroughMoment, romanceMoment, endingHook, wordTarget }

${outline ? '当前故事弧：' + JSON.stringify(outline.arcs.find(a => fromChapter >= a.chapterRange[0] && fromChapter <= a.chapterRange[1])) : ''}
${memory ? '主角当前境界：' + memory.protagonistState.realm : ''}
${memory?.pendingFaceSlaps.length ? '待打脸对象：' + memory.pendingFaceSlaps.map(f => f.target).join('、') : ''}
${body.prompt ? '额外要求：' + body.prompt : ''}`;

    await streamToSSE(res, systemPrompt, userMsg, 4096, (text) => {
      const plans = extractJSON<ChapterPlan[]>(text);
      if (plans && Array.isArray(plans)) {
        for (const plan of plans) {
          saveChapterPlan(meta.id, plan.chapterNumber, plan);
        }
        console.log(`[plan] 已保存 ${plans.length} 章计划`);
      }
    });

    res.end();
  } catch (err) {
    handleError(res, err, 'POST /chapters/plan');
  }
});

// ─── 写章节（核心功能）───────────────────────────────────────────────────────

// POST /api/novels/:id/chapters/:n/write — SSE 流式写章节
router.post('/:id/chapters/:n/write', async (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    const n = parseInt(req.params.n, 10);
    if (isNaN(n) || n < 1) {
      res.status(400).json({ success: false, error: '章节号无效' });
      return;
    }

    sseHeaders(res);
    sendSSE(res, 'start', { chapter: n, title: `第${n}章` });

    const chapterContext = buildChapterContext(meta.id, n);
    const systemPrompt = buildSystemPrompt('chapter-writer', chapterContext, meta.template);
    const plan = getChapterPlan(meta.id, n);

    const userMsg = `请写《${meta.title}》第${n}章。
${plan ? `本章标题：${plan.title}

【本章情节节拍（严格按此顺序推进，不得添加节拍外的场景）】
${plan.beats.map((b, i) => `${i + 1}. ${b}`).join('\n')}

【章节边界要求】
- 写完第 ${plan.beats.length} 个节拍后立即停笔
- 最后一幕：${plan.endingHook}
- 禁止在节拍完成后添加任何额外场景（含其他视角、监视者、旁观者等）` : '请根据上下文自然续写。'}
${(req.body as { prompt?: string }).prompt ? '额外要求：' + (req.body as { prompt?: string }).prompt : ''}
目标字数约 ${meta.wordsPerChapter} 字。`;

    await streamToSSE(res, systemPrompt, userMsg, 6000, async (text) => {
      saveChapter(meta.id, n, text);
      if (n > meta.currentChapter) meta.currentChapter = n;
      meta.status = 'writing';
      saveMeta(meta);

      // 异步更新故事记忆（不阻塞 SSE 结束）
      updateMemoryAfterChapter(meta.id, n, text).catch(console.error);
    });

    res.end();
  } catch (err) {
    handleError(res, err, `POST /chapters/:n/write`);
  }
});

// ─── 全自动写作 ───────────────────────────────────────────────────────────────

// POST /api/novels/:id/generate — 按顺序自动完成所有步骤（SSE，支持断点续传）
router.post('/:id/generate', async (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    const body = req.body as { restart?: boolean };
    const existingProgress = getGenerateProgress(meta.id);

    if (body.restart) {
      deleteGenerateProgress(meta.id);
    } else if (existingProgress?.status === 'running') {
      res.status(409).json({ success: false, error: '当前已有生成任务正在执行' });
      return;
    }

    const steps = buildGenerationPipeline(meta.id);
    const progress: PipelineProgress = {
      status: 'running',
      completedSteps: [],
      currentStep: null,
      failedStep: null,
      failedError: null,
      startedAt: existingProgress?.startedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveGenerateProgress(meta.id, progress);

    sseHeaders(res);
    sendSSE(res, 'start', { message: `开始自动生成《${meta.title}》` });

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 5000;

    for (const step of steps) {
      if (step.skip?.()) {
        sendSSE(res, 'skip', { step: step.name });
        progress.completedSteps = [...new Set([...progress.completedSteps, step.name])];
        progress.updatedAt = new Date().toISOString();
        saveGenerateProgress(meta.id, progress);
        continue;
      }

      progress.currentStep = step.name;
      progress.failedStep = null;
      progress.failedError = null;
      progress.updatedAt = new Date().toISOString();
      saveGenerateProgress(meta.id, progress);
      sendSSE(res, 'step', { step: step.name, message: `正在执行：${step.name}` });

      let succeeded = false;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await step.run();
          succeeded = true;
          break;
        } catch (err) {
          console.error(`[generate] ${step.name} 第${attempt}次失败:`, err);
          if (attempt < MAX_RETRIES) {
            sendSSE(res, 'step_retry', {
              step: step.name,
              attempt,
              maxRetries: MAX_RETRIES,
              error: String(err),
              message: `${step.name} 失败，${RETRY_DELAY_MS / 1000}秒后重试（${attempt}/${MAX_RETRIES}）`,
            });
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          } else {
            progress.status = 'failed';
            progress.failedStep = step.name;
            progress.failedError = String(err);
            progress.updatedAt = new Date().toISOString();
            saveGenerateProgress(meta.id, progress);
            sendSSE(res, 'step_error', { step: step.name, error: String(err), message: `${step.name} 重试${MAX_RETRIES}次后仍失败` });
          }
        }
      }

      if (!succeeded) {
        sendSSE(res, 'done', { message: `生成中断：${step.name} 重试${MAX_RETRIES}次后仍失败` });
        res.end();
        return;
      }

      progress.completedSteps = [...new Set([...progress.completedSteps, step.name])];
      progress.currentStep = null;
      progress.updatedAt = new Date().toISOString();
      saveGenerateProgress(meta.id, progress);
      sendSSE(res, 'step_done', { step: step.name });
    }

    progress.status = 'completed';
    progress.currentStep = null;
    progress.failedStep = null;
    progress.failedError = null;
    progress.updatedAt = new Date().toISOString();
    saveGenerateProgress(meta.id, progress);
    sendSSE(res, 'done', { message: '自动生成完成' });
    res.end();
  } catch (err) {
    const novelId = req.params.id;
    const progress = getGenerateProgress(novelId);
    if (progress) {
      const activeStep = progress.currentStep;
      progress.status = 'failed';
      progress.failedStep = progress.failedStep ?? activeStep;
      progress.failedError = String(err);
      progress.currentStep = null;
      progress.updatedAt = new Date().toISOString();
      saveGenerateProgress(novelId, progress);
    }
    handleError(res, err, 'POST /generate');
  }
});

// ─── 审校 ────────────────────────────────────────────────────────────────────

// POST /api/novels/:id/chapters/:n/review — SSE 审校某章
router.post('/:id/chapters/:n/review', async (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    const n = parseInt(req.params.n, 10);
    const chapterText = getChapter(meta.id, n);
    if (!chapterText) {
      res.status(404).json({ success: false, error: `第${n}章不存在` });
      return;
    }

    sseHeaders(res);

    const context = buildGeneralContext(meta.id);
    const systemPrompt = buildSystemPrompt('novel-reviewer', context, meta.template);

    const userMsg = `请审校《${meta.title}》第${n}章，给出修改意见：\n\n${chapterText}`;

    await streamToSSE(res, systemPrompt, userMsg, 4096);
    res.end();
  } catch (err) {
    handleError(res, err, `POST /chapters/:n/review`);
  }
});

// ─── 进度 & 导出 ──────────────────────────────────────────────────────────────

// GET /api/novels/:id/generate/status — 查看流水线进度
router.get('/:id/generate/status', (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    const progress = getGenerateProgress(meta.id);
    const steps = buildGenerateStepStatuses(meta.id, progress);

    res.json({
      success: true,
      data: {
        status: progress?.status ?? 'idle',
        currentStep: progress?.currentStep ?? null,
        failedStep: progress?.failedStep ?? null,
        failedError: progress?.failedError ?? null,
        startedAt: progress?.startedAt ?? null,
        updatedAt: progress?.updatedAt ?? null,
        completedSteps: progress?.completedSteps ?? [],
        steps,
      },
    });
  } catch (err) {
    handleError(res, err, 'GET /generate/status');
  }
});

// GET /api/novels/:id/status — 查看写作进度
router.get('/:id/status', (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    const memory = getMemory(meta.id);
    res.json({
      success: true,
      data: {
        ...meta,
        progress: `${meta.currentChapter}/${meta.targetChapters}章`,
        protagonistRealm: memory?.protagonistState.realm ?? '未知',
        pendingFaceSlaps: memory?.pendingFaceSlaps.length ?? 0,
      },
    });
  } catch (err) {
    handleError(res, err, 'GET /status');
  }
});

// GET /api/novels/:id/export — 导出完整小说
router.get('/:id/export', (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    const text = exportNovel(meta.id);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.title)}.md"`);
    res.send(text);
  } catch (err) {
    handleError(res, err, 'GET /export');
  }
});

// ─── 内部：写完章节后更新故事记忆 ────────────────────────────────────────────

async function updateMemoryAfterChapter(
  id: string,
  chapterN: number,
  chapterText: string,
): Promise<void> {
  const meta = getMeta(id);
  const oldMemory = getMemory(id);
  if (!meta || !oldMemory) return;

  const systemPrompt = buildSystemPrompt('story-memory', '', meta.template);
  const userMsg = `请根据第${chapterN}章内容，更新故事记忆状态，输出完整 JSON。

当前记忆：
${JSON.stringify(oldMemory, null, 2)}

第${chapterN}章内容：
${chapterText}

请更新并输出完整的 StoryMemory JSON（包含所有字段）。`;

  const result = await callClaude(systemPrompt, userMsg, 8000,undefined,{type: 'json_object'});
  const newMemory = extractJSON<StoryMemory>(result);
  if (newMemory) {
    newMemory.lastUpdatedChapter = chapterN;
    saveMemory(id, newMemory);
    console.log(`[memory] 已更新第${chapterN}章记忆`);
  }
}

// ─── 内部：全自动写作流水线 ────────────────────────────────────────────────

interface PipelineStep {
  name: string;
  skip?: () => boolean;
  run: () => Promise<void>;
}

const BATCH_SIZE = 10;

function findCurrentArc(outline: Outline, chapterNum: number) {
  return outline.arcs.find(
    (arc) => chapterNum >= arc.chapterRange[0] && chapterNum <= arc.chapterRange[1],
  );
}

function buildChapterSteps(id: string, meta: ReturnType<typeof getMeta> & {}): PipelineStep[] {
  const total = meta.targetChapters;
  const steps: PipelineStep[] = [];
  const arcRanges = computeArcRanges(total);
  const insertedArcs = new Set<number>();

  for (let batchStart = 1; batchStart <= total; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, total);

    // 在每弧第一个 batch 之前插入弧线角色创建步骤
    const arcIndex = arcRanges.findIndex(
      ([s, e]) => batchStart >= s && batchStart <= e,
    );
    if (arcIndex >= 0 && !insertedArcs.has(arcIndex)) {
      insertedArcs.add(arcIndex);
      const arcNum = arcIndex + 1;
      steps.push({
        name: `补充第${arcNum}弧角色`,
        skip: () => {
          const outline = getOutline(id);
          if (!outline?.arcs[arcIndex]) return true;
          const hints = outline.arcs[arcIndex].newCharacterHints;
          if (!hints || hints.length === 0) return true;
          // 如果该弧已经补充过角色（通过检查是否有 firstAppearance 在该弧范围内的非核心角色）
          const chars = getCharacters(id);
          const [arcStart, arcEnd] = arcRanges[arcIndex];
          const hasArcChars = chars.some(
            c => c.firstAppearance && c.firstAppearance >= arcStart && c.firstAppearance <= arcEnd
              && (c.role === 'antagonist' || c.role === 'cannon_fodder'),
          );
          return hasArcChars;
        },
        run: async () => {
          const outline = getOutline(id);
          const arc = outline?.arcs[arcIndex];
          if (!arc?.newCharacterHints?.length) return;
          const existingChars = getCharacters(id);
          const existingList = existingChars.map(c => `${c.name}（${c.role}）`).join('、');
          const text = await callClaude(
            buildSystemPrompt('arc-character-creator', buildGeneralContext(id), meta.template),
            `请为《${meta.title}》的"${arc.name}"弧（第${arc.chapterRange[0]}-${arc.chapterRange[1]}章）创建新角色。

已有角色（不要重复创建）：${existingList}

本弧角色需求提示：
${arc.newCharacterHints.map((h, i) => `${i + 1}. ${h}`).join('\n')}

本弧核心剧情：${arc.summary}
本弧打脸对象：${arc.faceSlapTargets.join('、')}

请创建 3-6 个新角色，输出 JSON 数组`,
            8000,
            undefined,
            {type: 'json_object'},
          );
          const chars = extractJSON<Character[]>(text);
          if (chars && Array.isArray(chars)) {
            appendCharacters(id, chars);
            console.log(`[arc-chars] 第${arcNum}弧补充了 ${chars.length} 个角色`);
          }
        },
      });
    }

    steps.push({
      name: `规划第${batchStart}-${batchEnd}章`,
      skip: () => !!getChapterPlan(id, batchStart),
      run: async () => {
        const memory = getMemory(id);
        const outline = getOutline(id);
        const arc = outline ? findCurrentArc(outline, batchStart) : null;
        const text = await callClaude(
          buildSystemPrompt('chapter-planner', buildGeneralContext(id), meta.template),
          `请规划第${batchStart}到第${batchEnd}章，输出 JSON 数组。${arc ? '当前弧：' + JSON.stringify(arc) : ''}${memory ? ' 主角境界：' + memory.protagonistState.realm : ''}`,
          8000,
          undefined,
          {type: 'json_object'},
        );
        const plans = extractJSON<ChapterPlan[]>(text);
        if (plans) for (const p of plans) saveChapterPlan(id, p.chapterNumber, p);
      },
    });

    for (let n = batchStart; n <= batchEnd; n++) {
      steps.push({
        name: `写第${n}章`,
        skip: () => !!getChapter(id, n),
        run: async () => {
          const chapterContext = buildChapterContext(id, n);
          const plan = getChapterPlan(id, n);
          const planInstruction = plan
            ? `本章标题：${plan.title}\n\n【本章情节节拍（严格按此顺序推进，不得添加节拍外的场景）】\n${plan.beats.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n\n【章节边界要求】\n- 写完第 ${plan.beats.length} 个节拍后立即停笔\n- 最后一幕：${plan.endingHook}\n- 禁止在节拍完成后添加任何额外场景（含其他视角、监视者、旁观者等）`
            : '请根据上下文自然续写。';
          const text = await callClaude(
            buildSystemPrompt('chapter-writer', chapterContext, meta.template),
            `请写《${meta.title}》第${n}章，约${meta.wordsPerChapter}字。\n${planInstruction}`,
            6000,
          );
          saveChapter(id, n, text);
          if (n > meta.currentChapter) {
            meta.currentChapter = n;
            meta.status = 'writing';
            saveMeta(meta);
          }
        },
      });
      steps.push({
        name: `更新第${n}章记忆`,
        skip: () => (getMemory(id)?.lastUpdatedChapter ?? 0) >= n,
        run: async () => {
          const text = getChapter(id, n)!;
          await updateMemoryAfterChapter(id, n, text);
        },
      });
    }
  }

  return steps;
}

/**
 * 根据目标章节数按比例计算各弧章节范围。
 * ≤100章 → 2弧，101-200 → 3弧，201-350 → 4弧，351+ → 5弧
 */
function computeArcRanges(total: number): Array<[number, number]> {
  const ratios =
    total <= 100 ? [0.4, 1.0] :
    total <= 200 ? [0.2, 0.55, 1.0] :
    total <= 350 ? [0.15, 0.4, 0.75, 1.0] :
                   [0.1, 0.3, 0.6, 0.85, 1.0];

  const ranges: Array<[number, number]> = [];
  let prev = 0;
  for (const ratio of ratios) {
    const start = prev + 1;
    const end = Math.round(total * ratio);
    ranges.push([start, end]);
    prev = end;
  }
  return ranges;
}

function buildGenerationPipeline(id: string): PipelineStep[] {
  const meta = getMeta(id)!;

  return [
    // Phase 1: 世界观 + 力量体系
    {
      name: '构建世界观',
      skip: () => !!getWorld(id),
      run: async () => {
        const text = await callClaude(
          buildSystemPrompt('world-builder', '', meta.template),
          `请为《${meta.title}》（背景：${meta.setting}，金手指：${meta.cheatType}）构建世界观设定`,
          4096,
        );
        saveWorld(id, text);
        meta.status = 'world-built';
        saveMeta(meta);
      },
    },
    {
      name: '设计力量体系',
      skip: () => !!getPowerSystem(id),
      run: async () => {
        const text = await callClaude(
          buildSystemPrompt('power-system-designer', `### 世界观\n${getWorld(id)}`, meta.template),
          `请为《${meta.title}》设计力量/修炼体系，金手指：${meta.cheatType}`,
          8000,
        );
        savePowerSystem(id, text);
        meta.status = 'power-system-designed';
        saveMeta(meta);
      },
    },

    // Phase 2: 核心角色（仅主角、核心女主、大Boss、关键配角 5-7 个）
    {
      name: '创建核心角色',
      skip: () => getCharacters(id).length > 0,
      run: async () => {
        const text = await callClaude(
          buildSystemPrompt('core-character-creator', buildGeneralContext(id), meta.template),
          `请为《${meta.title}》创建核心人物（主角、核心女主、大Boss、关键配角），共 5-7 个角色，输出 JSON 数组`,
          8000,
          undefined,
          {type: 'json_object'},
        );
        const chars = extractJSON<Character[]>(text);
        if (chars){
          saveCharacters(id, chars);
          meta.status = 'characters-created';
          saveMeta(meta);
        }
      },
    },

    // Phase 3: 大纲（基于核心角色，产出各弧结构 + newCharacterHints）
    {
      name: '生成大纲',
      skip: () => !!getOutline(id),
      run: async () => {
        const arcRanges = computeArcRanges(meta.targetChapters);
        const arcHint = arcRanges
          .map((r, i) => `第${i + 1}弧：第${r[0]}-${r[1]}章`)
          .join('；');
        const text = await callClaude(
          buildSystemPrompt('plot-architect', buildGeneralContext(id), meta.template),
          `请为《${meta.title}》生成故事大纲，总章节数：${meta.targetChapters}章，弧线章节范围：${arcHint}。每弧必须包含 newCharacterHints 字段（3-6条角色提示，说明本弧需要新增什么角色），输出 JSON`,
          30000,
          undefined,
          {type: 'json_object'},
        );
        const outline = extractJSON<Outline>(text);
        if (outline) { saveOutline(id, outline); meta.status = 'outlined'; saveMeta(meta); }
      },
    },

    // Phase 4: 按弧写作（每弧开头自动补充弧线角色）
    ...buildChapterSteps(id, meta),
  ];
}

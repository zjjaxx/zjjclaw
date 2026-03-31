import { Router, type Request, type Response } from 'express';
import { buildSystemPrompt } from '../services/skill.service.js';
import {
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
  StoryMemory,
} from '../types/index.js';

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
    res.json({ success: true, data: meta });
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

    const systemPrompt = buildSystemPrompt('world-builder');
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
    const systemPrompt = buildSystemPrompt('power-system-designer', context);

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
router.post('/:id/characters', async (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    sseHeaders(res);

    const context = buildGeneralContext(meta.id);
    const systemPrompt = buildSystemPrompt('character-creator', context);

    const userMsg = `请为《${meta.title}》创建完整的人物体系，输出 JSON 格式。
主角名：${meta.protagonist}
金手指：${meta.cheatType}
${(req.body as { prompt?: string }).prompt ? '额外要求：' + (req.body as { prompt?: string }).prompt : ''}

请输出一个 JSON 数组，每个人物包含：name, role, appearance, personality, background, abilities, currentRealm, relationshipToProtagonist`;

    await streamToSSE(res, systemPrompt, userMsg, 4096, (text) => {
      const characters = extractJSON<Character[]>(text);
      if (characters && Array.isArray(characters)) {
        saveCharacters(meta.id, characters);
        meta.status = 'characters-created';
        saveMeta(meta);
        console.log(`[characters] 已保存 ${characters.length} 个角色`);
      } else {
        // 保存原始文本供调试
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
    const systemPrompt = buildSystemPrompt('plot-architect', context);

    const userMsg = `请为《${meta.title}》创建完整故事大纲，输出 JSON 格式。
目标章节数：${meta.targetChapters}章
${(req.body as { prompt?: string }).prompt ? '额外要求：' + (req.body as { prompt?: string }).prompt : ''}

JSON 结构：{ premise, goldenFinger, overallConflict, endingVision, arcs: [{name, chapterRange, summary, majorEvents, faceSlapTargets, realmBreakthrough}] }`;

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

    const systemPrompt = buildSystemPrompt('chapter-planner', context);

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
    const systemPrompt = buildSystemPrompt('chapter-writer', chapterContext);
    const plan = getChapterPlan(meta.id, n);

    const userMsg = `请写《${meta.title}》第${n}章。
${plan ? `本章标题：${plan.title}\n结尾要求：${plan.endingHook}` : '请根据上下文自然续写。'}
${(req.body as { prompt?: string }).prompt ? '额外要求：' + (req.body as { prompt?: string }).prompt : ''}
目标字数约 ${meta.wordsPerChapter} 字，注意网文节奏，结尾留悬念。`;

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
    }

    const isResume = !body.restart && existingProgress &&
      (existingProgress.status === 'running' || existingProgress.status === 'interrupted' || existingProgress.status === 'failed');
    const completedSteps = new Set(isResume ? existingProgress!.completedSteps : []);

    sseHeaders(res);

    if (isResume) {
      sendSSE(res, 'resume', {
        message: `恢复自动生成《${meta.title}》`,
        completedSteps: [...completedSteps],
        failedStep: existingProgress!.failedStep,
      });
    } else {
      sendSSE(res, 'start', { message: `开始自动生成《${meta.title}》` });
    }

    const progress: PipelineProgress = {
      status: 'running',
      completedSteps: [...completedSteps],
      currentStep: null,
      failedStep: null,
      failedError: null,
      startedAt: isResume ? existingProgress!.startedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveGenerateProgress(meta.id, progress);

    const steps = buildGenerationPipeline(meta.id);

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 5000;

    for (const step of steps) {
      if (completedSteps.has(step.name) || step.skip?.()) {
        sendSSE(res, 'skip', { step: step.name });
        continue;
      }

      progress.currentStep = step.name;
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
            saveGenerateProgress(meta.id, progress);
            sendSSE(res, 'step_error', { step: step.name, error: String(err), message: `${step.name} 重试${MAX_RETRIES}次后仍失败` });
          }
        }
      }

      if (succeeded) {
        progress.completedSteps.push(step.name);
        progress.currentStep = null;
        saveGenerateProgress(meta.id, progress);
        sendSSE(res, 'step_done', { step: step.name });
      }
    }

    if (progress.status !== 'failed') {
      progress.status = 'completed';
      progress.currentStep = null;
      saveGenerateProgress(meta.id, progress);
    }

    sendSSE(res, 'done', {
      message: progress.status === 'completed' ? '自动生成完成' : '自动生成未完成（有步骤失败）',
      status: progress.status,
    });
    res.end();
  } catch (err) {
    handleError(res, err, 'POST /generate');
  }
});

// GET /api/novels/:id/generate/status — 查看流水线进度
router.get('/:id/generate/status', (req: Request, res: Response) => {
  try {
    const meta = getMeta(req.params.id);
    if (!meta) { res.status(404).json({ success: false, error: '小说不存在' }); return; }

    const progress = getGenerateProgress(meta.id);
    if (!progress) {
      res.json({ success: true, data: { status: 'not_started' } });
      return;
    }

    res.json({ success: true, data: progress });
  } catch (err) {
    handleError(res, err, 'GET /generate/status');
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
    const systemPrompt = buildSystemPrompt('novel-reviewer', context);

    const userMsg = `请审校《${meta.title}》第${n}章，给出修改意见：\n\n${chapterText}`;

    await streamToSSE(res, systemPrompt, userMsg, 4096);
    res.end();
  } catch (err) {
    handleError(res, err, `POST /chapters/:n/review`);
  }
});

// ─── 进度 & 导出 ──────────────────────────────────────────────────────────────

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

  const systemPrompt = buildSystemPrompt('story-memory');
  const userMsg = `请根据第${chapterN}章内容，更新故事记忆状态，输出完整 JSON。

当前记忆：
${JSON.stringify(oldMemory, null, 2)}

第${chapterN}章内容：
${chapterText.slice(0, 3000)}

请更新并输出完整的 StoryMemory JSON（包含所有字段）。`;

  const result = await callClaude(systemPrompt, userMsg, 3000);
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

  for (let batchStart = 1; batchStart <= total; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, total);

    steps.push({
      name: `规划第${batchStart}-${batchEnd}章`,
      skip: () => !!getChapterPlan(id, batchStart),
      run: async () => {
        const memory = getMemory(id);
        const outline = getOutline(id);
        const arc = outline ? findCurrentArc(outline, batchStart) : null;
        const text = await callClaude(
          buildSystemPrompt('chapter-planner', buildGeneralContext(id)),
          `请规划第${batchStart}到第${batchEnd}章，输出 JSON 数组。${arc ? '当前弧：' + JSON.stringify(arc) : ''}${memory ? ' 主角境界：' + memory.protagonistState.realm : ''}`,
          4000,
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
          const text = await callClaude(
            buildSystemPrompt('chapter-writer', chapterContext),
            `请写《${meta.title}》第${n}章，约${meta.wordsPerChapter}字，结尾留悬念`,
            6000,
          );
          saveChapter(id, n, text);
          if (n > meta.currentChapter) {
            meta.currentChapter = n;
            meta.status = 'writing';
            saveMeta(meta);
          }
          await updateMemoryAfterChapter(id, n, text);
        },
      });
    }
  }

  return steps;
}

function buildGenerationPipeline(id: string): PipelineStep[] {
  const meta = getMeta(id)!;

  return [
    {
      name: '构建世界观',
      skip: () => !!getWorld(id),
      run: async () => {
        const text = await callClaude(
          buildSystemPrompt('world-builder'),
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
          buildSystemPrompt('power-system-designer', `### 世界观\n${getWorld(id)}`),
          `请为《${meta.title}》设计力量/修炼体系，金手指：${meta.cheatType}`,
          8000,
        );
        savePowerSystem(id, text);
        meta.status = 'power-system-designed';
        saveMeta(meta);
      },
    },
    {
      name: '创建人物',
      skip: () => getCharacters(id).length > 0,
      run: async () => {
        const text = await callClaude(
          buildSystemPrompt('character-creator', buildGeneralContext(id)),
          `请为《${meta.title}》创建人物体系，输出 JSON 数组`,
          8000,
        );
        const chars = extractJSON<Character[]>(text);
        if (chars) saveCharacters(id, chars);
        meta.status = 'characters-created';
        saveMeta(meta);
      },
    },
    {
      name: '生成大纲',
      skip: () => !!getOutline(id),
      run: async () => {
        const text = await callClaude(
          buildSystemPrompt('plot-architect', buildGeneralContext(id)),
          `请为《${meta.title}》生成故事大纲，目标${meta.targetChapters}章，输出 JSON`,
          5000,
        );
        const outline = extractJSON<Outline>(text);
        if (outline) { saveOutline(id, outline); meta.status = 'outlined'; saveMeta(meta); }
      },
    },
    ...buildChapterSteps(id, meta),
  ];
}

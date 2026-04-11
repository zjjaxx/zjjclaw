import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  NovelMeta,
  NovelTemplate,
  Character,
  Outline,
  ChapterPlan,
  StoryMemory,
  CreateNovelRequest,
} from '../types/index.js';

const TEMPLATE_GENRE: Record<NovelTemplate, string> = {
  'urban-supernatural': '都市异能',
  'xianxia':            '玄幻修真',
  'post-apocalyptic':   '末世重生',
};

const TEMPLATE_DEFAULTS: Record<NovelTemplate, { setting: string; protagonist: string; cheatType: string }> = {
  'urban-supernatural': { setting: '都市', protagonist: '林凡', cheatType: '系统' },
  'xianxia':            { setting: '苍云大陆', protagonist: '叶辰', cheatType: '古神传承' },
  'post-apocalyptic':   { setting: '末日华夏', protagonist: '陈磊', cheatType: '重生+空间' },
};

// ─── 路径工具 ─────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data', 'novels');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function novelDir(id: string): string {
  return path.join(DATA_DIR, id);
}

function chapterFile(id: string, n: number): string {
  return path.join(novelDir(id), 'chapters', `chapter-${String(n).padStart(3, '0')}.md`);
}

function planFile(id: string, n: number): string {
  return path.join(novelDir(id), 'chapter-plans', `plan-${String(n).padStart(3, '0')}.json`);
}

function progressFile(id: string): string {
  return path.join(novelDir(id), 'pipeline-progress.json');
}

// ─── 初始化 ───────────────────────────────────────────────────────────────────

export function createNovel(req: CreateNovelRequest): NovelMeta {
  const id = uuidv4();
  const dir = novelDir(id);

  ensureDir(dir);
  ensureDir(path.join(dir, 'chapters'));
  ensureDir(path.join(dir, 'chapter-plans'));

  const template = req.template ?? 'urban-supernatural';
  const defaults = TEMPLATE_DEFAULTS[template];

  const meta: NovelMeta = {
    id,
    title: req.title,
    template,
    genre: TEMPLATE_GENRE[template],
    setting: req.setting ?? defaults.setting,
    protagonist: req.protagonist ?? defaults.protagonist,
    cheatType: req.cheatType ?? defaults.cheatType,
    targetChapters: req.targetChapters ?? 500,
    wordsPerChapter: 2500,
    status: 'init',
    currentChapter: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveMeta(meta);

  // 初始化空的故事记忆
  const initMemory: StoryMemory = {
    lastUpdatedChapter: 0,
    chapterContext: {
      title: '未开始',
      pov: meta.protagonist,
      primaryLocation: meta.setting,
      timeAnchor: '',
    },
    continuity: {
      facts: [],
      openConstraints: [],
    },
    protagonistState: {
      name: meta.protagonist,
      realm: '普通人',
      abilities: [],
      resources: { cash: '', items: [], intel: [], debts: [] },
      injuriesAndSideEffects: [],
      currentIntent: '',
    },
    characterStates: [],
    relationships: { edges: [] },
    factions: [],
    debtsAndLeverage: [],
    activeConflicts: [],
    plotThreads: [],
    choicesAndCosts: [],
    informationLedger: { revealed: [], hidden: [], implied: [] },
    foreshadowing: { planted: [], harvested: [] },
    unansweredQuestions: [],
    recentEvents: [],
  };
  saveMemory(id, initMemory);

  return meta;
}

// ─── 元数据 CRUD ──────────────────────────────────────────────────────────────

export function getMeta(id: string): NovelMeta | null {
  const file = path.join(novelDir(id), 'meta.json');
  if (!fs.existsSync(file)) return null;
  const meta = JSON.parse(fs.readFileSync(file, 'utf-8')) as NovelMeta;
  // 兼容旧数据：没有 template 字段时默认都市异能
  if (!meta.template) meta.template = 'urban-supernatural';
  return meta;
}

export function saveMeta(meta: NovelMeta): void {
  ensureDir(novelDir(meta.id));
  meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(novelDir(meta.id), 'meta.json'), JSON.stringify(meta, null, 2));
}

export function listNovels(): NovelMeta[] {
  ensureDir(DATA_DIR);
  return fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => getMeta(d.name))
    .filter((m): m is NovelMeta => m !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** 删除整个小说目录；id 必须落在 data/novels 下，防止路径穿越 */
export function deleteNovel(id: string): boolean {
  const dir = novelDir(id);
  const resolvedDir = path.resolve(dir);
  const resolvedData = path.resolve(DATA_DIR);
  if (resolvedDir !== resolvedData && !resolvedDir.startsWith(`${resolvedData}${path.sep}`)) {
    return false;
  }
  if (!getMeta(id)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

// ─── 世界观 ───────────────────────────────────────────────────────────────────

export function getWorld(id: string): string {
  const file = path.join(novelDir(id), 'world.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
}

export function saveWorld(id: string, content: string): void {
  fs.writeFileSync(path.join(novelDir(id), 'world.md'), content);
}

// ─── 力量体系 ─────────────────────────────────────────────────────────────────

export function getPowerSystem(id: string): string {
  const file = path.join(novelDir(id), 'power-system.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
}

export function savePowerSystem(id: string, content: string): void {
  fs.writeFileSync(path.join(novelDir(id), 'power-system.md'), content);
}

// ─── 角色 ─────────────────────────────────────────────────────────────────────

export function getCharacters(id: string): Character[] {
  const file = path.join(novelDir(id), 'characters.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as Character[];
}

export function saveCharacters(id: string, characters: Character[]): void {
  fs.writeFileSync(
    path.join(novelDir(id), 'characters.json'),
    JSON.stringify(characters, null, 2),
  );
}

export function appendCharacters(id: string, newChars: Character[]): void {
  const existing = getCharacters(id);
  const existingNames = new Set(existing.map(c => c.name));
  const deduped = newChars.filter(c => !existingNames.has(c.name));
  saveCharacters(id, [...existing, ...deduped]);
}

// ─── 大纲 ─────────────────────────────────────────────────────────────────────

export function getOutline(id: string): Outline | null {
  const file = path.join(novelDir(id), 'outline.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as Outline;
}

export function saveOutline(id: string, outline: Outline): void {
  fs.writeFileSync(path.join(novelDir(id), 'outline.json'), JSON.stringify(outline, null, 2));
}

// ─── 故事记忆 ─────────────────────────────────────────────────────────────────

export function getMemory(id: string): StoryMemory | null {
  const file = path.join(novelDir(id), 'memory.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as StoryMemory;
  } catch {
    return null;
  }
}

export function saveMemory(id: string, memory: StoryMemory): void {
  fs.writeFileSync(path.join(novelDir(id), 'memory.json'), JSON.stringify(memory, null, 2));
}

// ─── 章节 ─────────────────────────────────────────────────────────────────────

export function getChapter(id: string, n: number): string {
  const file = chapterFile(id, n);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
}

export function saveChapter(id: string, n: number, content: string): void {
  fs.writeFileSync(chapterFile(id, n), content);
}

export function getChapterPlan(id: string, n: number): ChapterPlan | null {
  const file = planFile(id, n);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as ChapterPlan;
}

export function saveChapterPlan(id: string, n: number, plan: ChapterPlan): void {
  fs.writeFileSync(planFile(id, n), JSON.stringify(plan, null, 2));
}

export interface GeneratedChapter {
  number: number;
  content: string;
}

export function listGeneratedChapters(id: string): GeneratedChapter[] {
  const dir = path.join(novelDir(id), 'chapters');
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter(file => /^chapter-\d+\.md$/.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => {
      const match = file.match(/^chapter-(\d+)\.md$/);
      const number = match ? parseInt(match[1], 10) : 0;
      return {
        number,
        content: fs.readFileSync(path.join(dir, file), 'utf-8'),
      };
    });
}

// ─── 上下文构建助手 ───────────────────────────────────────────────────────────

/**
 * 获取前 N 章的摘要（用于 chapter-writer 上下文）
 */
export function getPrevChaptersSummary(id: string, currentN: number, take = 3): string {
  const summaries: string[] = [];
  const start = Math.max(1, currentN - take);
  for (let i = start; i < currentN; i++) {
    const content = getChapter(id, i);
    if (content) {
      // 取前3章作为摘要
      summaries.push(`【第${i}章摘要】\n${content.trim()}…`);
    }
  }
  return summaries.join('\n\n');
}

/**
 * 将故事记忆序列化为可读文本（注入 system prompt）
 */
export function formatMemory(memory: StoryMemory): string {
  if (!memory) return '';

  const protagonistAbilities = (memory.protagonistState.abilities ?? []).map(a => a.name).filter(Boolean);
  const plantedSeeds = (memory.foreshadowing?.planted ?? []).map(f => f.seed).filter(Boolean);
  const conflicts = (memory.activeConflicts ?? []).map(c => c.conflict).filter(Boolean);

  const lines: string[] = [
    `**主角当前状态**`,
    `- 境界：${memory.protagonistState?.realm ?? '未知'}`,
    `- 能力：${protagonistAbilities.join('、') || '无'}`,
    `- 近期意图：${memory.protagonistState?.currentIntent || '未知'}`,
    `- 位置：${memory.chapterContext?.primaryLocation || '未知'}`,
    '',
    `**活跃冲突**`,
    ...(conflicts.length > 0 ? conflicts.map(c => `- ${c}`) : ['- 无']),
    '',
    `**未回收伏笔**`,
    ...(plantedSeeds.length > 0 ? plantedSeeds.map(s => `- ${s}`) : ['- 无']),
    '',
    `**近期事件**`,
    ...memory.recentEvents.map(e => `- ${e}`),
  ];

  return lines.join('\n');
}

/**
 * 构建写章节时所需的完整故事上下文
 */
export function buildChapterContext(id: string, chapterN: number): string {
  const meta = getMeta(id);
  const world = getWorld(id);
  const powerSystem = getPowerSystem(id);
  const characters = getCharacters(id);
  const outline = getOutline(id);
  const memory = getMemory(id);
  const plan = getChapterPlan(id, chapterN);
  const prevSummary = getPrevChaptersSummary(id, chapterN, 3);

  const parts: string[] = [];

  if (meta) {
    parts.push(
      `### 小说基本信息`,
      `- 标题：${meta.title}`,
      `- 主角：${meta.protagonist}`,
      `- 金手指：${meta.cheatType}`,
      `- 背景：${meta.setting}`,
      '',
    );
  }

  if (world) {
    parts.push(`### 世界观设定`, world, '');
  }

  if (powerSystem) {
    parts.push(`### 力量体系`, powerSystem, '');
  }

  if (characters.length > 0) {
    parts.push(
      `### 已有人物`,
      ...characters.map(c => {
        const lines = [`**${c.name}**（${c.role}）`];
        if (c.age) lines.push(`  年龄：${c.age}`);
        if (c.appearance) lines.push(`  外貌：${c.appearance}`);
        if (c.personality) lines.push(`  性格：${c.personality}`);
        if (c.innerConflict) lines.push(`  内心矛盾：${c.innerConflict}`);
        if (c.quirk) lines.push(`  记忆点：${c.quirk}`);
        if (c.background) lines.push(`  背景：${c.background}`);
        if (c.abilities) lines.push(`  能力：${c.abilities}`);
        if (c.currentRealm) lines.push(`  境界：${c.currentRealm}`);
        if (c.relationshipToProtagonist) lines.push(`  与主角关系：${c.relationshipToProtagonist}`);
        if (c.narrativeFunction) lines.push(`  叙事功能：${c.narrativeFunction}`);
        if (c.hiddenSecret) lines.push(`  隐藏秘密：${c.hiddenSecret}`);
        if (c.firstAppearance) lines.push(`  首次出现：第${c.firstAppearance}章`);
        return lines.join('\n');
      }),
      '',
    );
  }

  if (outline) {
    // 找当前所在 arc
    const currentArc = outline.arcs.find(
      a => chapterN >= a.chapterRange[0] && chapterN <= a.chapterRange[1],
    );
    if (currentArc) {
      parts.push(
        `### 当前故事弧：${currentArc.name}`,
        currentArc.summary,
        '',
      );
    }
  }

  if (memory) {
    parts.push(`### 故事记忆（最新状态）`, formatMemory(memory), '');
  }

  if (prevSummary) {
    parts.push(`### 前几章内容`, prevSummary, '');
  }

  if (plan) {
    parts.push(
      `### 本章计划（第${chapterN}章：${plan.title}）`,
      `**视角**：${plan.pov}`,
      `**地点**：${plan.location}`,
      `**摘要**：${plan.summary}`,
      `**张力类型**：${plan.tensionType}`,
      `**情节节拍**：`,
      ...plan.beats.map((b, i) => `${i + 1}. ${b}`),
      `**角色弧光**：${Object.entries(plan.characterArcs).map(([k, v]) => `${k}：${v}`).join('；')}`,
      plan.foreshadowPlanted ? `**本章伏笔**：${plan.foreshadowPlanted}` : '',
      plan.foreshadowHarvested ? `**回收伏笔**：${plan.foreshadowHarvested}` : '',
      `**结尾钩子**：${plan.endingHook}`,
      `**目标字数**：约 ${plan.wordTarget} 字`,
      '',
    );
  }

  return parts.filter(Boolean).join('\n');
}

/**
 * 构建通用故事上下文（用于非写作任务）
 */
export function buildGeneralContext(id: string): string {
  const meta = getMeta(id);
  const world = getWorld(id);
  const powerSystem = getPowerSystem(id);
  const characters = getCharacters(id);

  const parts: string[] = [];

  if (meta) {
    parts.push(
      `### 小说信息`,
      `- 标题：${meta.title}，主角：${meta.protagonist}`,
      `- 金手指：${meta.cheatType}，背景：${meta.setting}`,
      `- 目标章节数：${meta.targetChapters}章`,
      '',
    );
  }
  if (world) parts.push(`### 世界观`, world, '');
  if (powerSystem) parts.push(`### 力量体系`, powerSystem, '');
  if (characters.length > 0) {
    parts.push(
      `### 已有人物`,
      ...characters.map(c => {
        const lines = [`**${c.name}**（${c.role}）`];
        if (c.age) lines.push(`  年龄：${c.age}`);
        if (c.appearance) lines.push(`  外貌：${c.appearance}`);
        if (c.personality) lines.push(`  性格：${c.personality}`);
        if (c.innerConflict) lines.push(`  内心矛盾：${c.innerConflict}`);
        if (c.quirk) lines.push(`  记忆点：${c.quirk}`);
        if (c.background) lines.push(`  背景：${c.background}`);
        if (c.abilities) lines.push(`  能力：${c.abilities}`);
        if (c.currentRealm) lines.push(`  境界：${c.currentRealm}`);
        if (c.relationshipToProtagonist) lines.push(`  与主角关系：${c.relationshipToProtagonist}`);
        if (c.narrativeFunction) lines.push(`  叙事功能：${c.narrativeFunction}`);
        if (c.hiddenSecret) lines.push(`  隐藏秘密：${c.hiddenSecret}`);
        if (c.firstAppearance) lines.push(`  首次出现：第${c.firstAppearance}章`);
        return lines.join('\n');
      }),
      '',
    );
  }

  return parts.filter(Boolean).join('\n');
}

// ─── 流水线进度 ─────────────────────────────────────────────────────────────

export interface PipelineProgress {
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  completedSteps: string[];
  currentStep: string | null;
  failedStep: string | null;
  failedError: string | null;
  startedAt: string;
  updatedAt: string;
}

export function getGenerateProgress(id: string): PipelineProgress | null {
  const file = progressFile(id);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as PipelineProgress;
}

export function saveGenerateProgress(id: string, progress: PipelineProgress): void {
  fs.writeFileSync(progressFile(id), JSON.stringify(progress, null, 2));
}

export function interruptRunningPipelines(reason = '后端已重启，生成任务已中断，请点击继续生成'): number {
  let interruptedCount = 0;

  for (const novel of listNovels()) {
    const progress = getGenerateProgress(novel.id);
    if (!progress || progress.status !== 'running') continue;

    progress.status = 'interrupted';
    progress.failedStep = progress.failedStep ?? progress.currentStep;
    progress.failedError = reason;
    progress.currentStep = null;
    progress.updatedAt = new Date().toISOString();
    saveGenerateProgress(novel.id, progress);
    interruptedCount += 1;
  }

  return interruptedCount;
}


export function deleteGenerateProgress(id: string): void {
  const file = progressFile(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

// ─── 导出 ─────────────────────────────────────────────────────────────────────

export function exportNovel(id: string): string {
  const meta = getMeta(id);
  if (!meta) return '';

  const parts: string[] = [`# ${meta.title}\n`];

  for (let i = 1; i <= meta.currentChapter; i++) {
    const content = getChapter(id, i);
    if (content) parts.push(`\n\n${content}`);
  }

  return parts.join('');
}

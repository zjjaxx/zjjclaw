// ─── 小说模版 ──────────────────────────────────────────────────────────────────

export type NovelTemplate =
  | 'urban-supernatural'   // 都市异能
  | 'xianxia'              // 玄幻修真
  | 'post-apocalyptic';    // 末世重生

export const TEMPLATE_LABELS: Record<NovelTemplate, string> = {
  'urban-supernatural': '都市异能',
  'xianxia': '玄幻修真',
  'post-apocalyptic': '末世重生',
};

// ─── 小说元数据 ──────────────────────────────────────────────────────────────

export interface NovelMeta {
  id: string;
  title: string;
  template: NovelTemplate;   // 模版类型
  genre: string;
  setting: string;           // 背景（城市/世界名称）
  protagonist: string;       // 主角名
  cheatType: string;         // 金手指类型
  targetChapters: number;
  wordsPerChapter: number;
  status: NovelStatus;
  currentChapter: number;
  createdAt: string;
  updatedAt: string;
}

export type NovelStatus =
  | 'init'
  | 'world-built'
  | 'power-system-designed'
  | 'characters-created'
  | 'outlined'
  | 'writing'
  | 'completed';

// ─── 人物 ────────────────────────────────────────────────────────────────────

export type CharacterRole =
  | 'protagonist'
  | 'female_lead'
  | 'antagonist'
  | 'villain_boss'
  | 'supporting'
  | 'cannon_fodder';   // 路人/炮灰反派

export interface Character {
  name: string;
  role: CharacterRole;
  age?: number;
  appearance: string;
  personality: string;
  innerConflict?: string;       // 内心矛盾/未解决的心结
  quirk?: string;               // 口癖/怪癖/标志性行为
  background: string;
  abilities?: string;
  currentRealm?: string;        // 当前境界
  relationshipToProtagonist?: string;
  narrativeFunction?: string;   // 叙事功能（搞笑担当/中二担当/情感锚点等）
  hiddenSecret?: string;        // 其他角色不知道的秘密
  firstAppearance?: number;     // 首次出现章节
}

// ─── 大纲 ────────────────────────────────────────────────────────────────────

export interface Foreshadowing {
  planted: string[];           // 本弧埋入的伏笔
  harvested: string[];         // 本弧回收的之前伏笔
}

export interface PlotArc {
  name: string;
  chapterRange: [number, number];
  summary: string;
  coreConflict: string;        // 本弧的核心矛盾/困局
  protagonistArc: string;      // 主角在本弧的内在变化
  majorEvents: string[];
  keyTurningPoint: string;     // 本弧最大的转折点
  foreshadowing: Foreshadowing;
  emotionalBeat: string;       // 本弧的情感高潮场景
  newCharacterHints?: Character[];
}

export interface GoldenFinger {
  description: string;         // 金手指/异能详细说明
  limitation: string;          // 限制条件
  cost: string;                // 使用代价或获得代价
}

export interface Outline {
  premise: string;
  thematicQuestion: string;    // 故事探讨的核心问题
  goldenFinger: GoldenFinger;
  arcs: PlotArc[];
  overallConflict: string;     // 主线矛盾（含价值观碰撞）
  endingVision: string;        // 结局愿景（意料之外情理之中）
}

// ─── 章节计划 ────────────────────────────────────────────────────────────────

export interface ChapterPlan {
  chapterNumber: number;
  title: string;
  pov: string;                 // 主视角角色名
  location: string;            // 场景地点
  summary: string;             // 一句话概括（包含核心矛盾或变化）
  beats: string[];             // 情节节拍（3-5个，标注类型如"铺垫：""碰撞："等）
  tensionType: string;         // 张力类型：困局反转|认知颠覆|关系深化|势力博弈|成长蜕变|日常暗涌
  characterArcs: Record<string, string>; // 角色名 → 本章内在变化（一句话）
  foreshadowPlanted: string | null;      // 本章埋入的伏笔（如无则null）
  foreshadowHarvested: string | null;    // 本章回收的伏笔（引用来源章节，如无则null）
  endingHook: string;          // 最后一句话/镜头（50字以内，具体可写）
  wordTarget: number;
}

// ─── 故事记忆 ────────────────────────────────────────────────────────────────

export interface PlotThread {
  thread: string;
  status: 'active' | 'resolved' | 'pending';
  hintChapter?: number;
}

export interface ForeshadowingThread {
  content: string;             // 伏笔内容
  plantedChapter: number;      // 埋入章节
  status: 'planted' | 'harvested';
  harvestedChapter?: number;   // 回收章节
}

export interface StoryMemory {
  lastUpdatedChapter: number;
  chapterContext: {
    title: string;
    pov: string;
    primaryLocation: string;
    timeAnchor: string;
  };
  continuity: {
    facts: string[];
    openConstraints: string[];
  };
  protagonistState: {
    name: string;
    realm: string;
    abilities: Array<{
      name: string;
      levelOrMastery: string;
      limitation: string;
      costOrSideEffect: string;
    }>;
    resources: {
      cash: string;
      items: string[];
      intel: string[];
      debts: string[];
    };
    injuriesAndSideEffects: Array<{
      description: string;
      sinceChapter: number;
      status: 'new' | 'ongoing' | 'resolved';
      impact: string;
    }>;
    currentIntent: string;
  };
  characterStates: Array<{
    name: string;
    role: 'protagonist' | 'female_lead' | 'antagonist' | 'supporting';
    currentStance: string;
    recentChange: string;
    knownSecrets: string[];
    unknownToProtagonist: string[];
  }>;
  relationships: {
    edges: Array<{
      from: string;
      to: string;
      type:
        | 'trust'
        | 'distrust'
        | 'debt'
        | 'leverage'
        | 'alliance'
        | 'rivalry'
        | 'affection'
        | 'suspicion';
      status: 'strengthened' | 'weakened' | 'new' | 'unchanged';
      evidenceChapter: number;
      note: string;
    }>;
  };
  factions: Array<{
    name: string;
    alignmentToProtagonist: 'friendly' | 'neutral' | 'hostile';
    currentGoal: string;
    pressureOrThreat: string;
  }>;
  debtsAndLeverage: Array<{
    holder: string;
    target: string;
    what: string;
    createdOrUpdatedChapter: number;
    canBeCashedInAs: string;
  }>;
  activeConflicts: Array<{
    conflict: string;
    sides: string[];
    stakes: string;
    timer: string;
  }>;
  plotThreads: Array<{
    thread: string;
    status: 'active' | 'pending' | 'resolved';
    introducedChapter: number;
    lastProgressChapter: number;
    currentState: string;
    nextLikelyStep: string;
  }>;
  choicesAndCosts: Array<{
    choice: string;
    cost: string;
    consequence: string;
  }>;
  informationLedger: {
    revealed: Array<{
      info: string;
      scope: 'world' | 'faction' | 'character' | 'goldenFinger';
      whoKnows: string[];
    }>;
    hidden: Array<{
      gap: string;
      whyItMatters: string;
    }>;
    implied: Array<{
      hint: string;
      evidence: string;
    }>;
  };
  foreshadowing: {
    planted: Array<{
      seed: string;
      chapter: number;
      type: 'dialogue' | 'object' | 'behavior' | 'information';
      horizon: 'in_arc' | 'cross_arc' | 'global';
    }>;
    harvested: Array<{
      seed: string;
      plantedChapter: number;
      harvestChapter: number;
      payoff: string;
    }>;
  };
  unansweredQuestions: string[];
  recentEvents: string[];
}

// ─── Skill 系统 ───────────────────────────────────────────────────────────────

export interface Skill {
  name: string;
  description: string;
  content: string;    // SKILL.md body（触发后加载）
  filePath: string;
}

// ─── API 请求/响应 ────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MarketChatRequest {
  messages: ChatMessage[];
  /** 若为 true，且 AI 回复中包含小说创建 JSON，则自动调用 createNovel 并返回 novel_created 事件 */
  autoCreate?: boolean;
}
export interface CreateNovelRequest {
  title: string;
  template?: NovelTemplate; // 模版类型，默认 urban-supernatural
  setting?: string;         // 背景，如"上海"/"苍云大陆"/"2024年末日"
  protagonist?: string;     // 主角名
  cheatType?: string;       // 金手指类型，如"系统"/"传承"/"神器"/"重生记忆"
  targetChapters?: number;
  themes?: string[];        // 主题标签
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GenerateRequest {
  prompt?: string;          // 额外的提示/要求
}

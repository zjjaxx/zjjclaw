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
  background: string;
  abilities?: string;
  currentRealm?: string;      // 当前境界
  relationshipToProtagonist?: string;
  faceSlapped?: boolean;      // 是否已被打脸
  firstAppearance?: number;   // 首次出现章节
}

// ─── 大纲 ────────────────────────────────────────────────────────────────────

export interface PlotArc {
  name: string;
  chapterRange: [number, number];
  summary: string;
  majorEvents: string[];
  faceSlapTargets: string[];   // 本弧需要打脸的对象
  realmBreakthrough?: string; // 本弧主角突破的境界
  newCharacterHints?: string[]; // 本弧需要新增的角色提示（由 plot-architect 产出）
}

export interface Outline {
  premise: string;
  goldenFinger: string;        // 金手指详细说明
  arcs: PlotArc[];
  overallConflict: string;     // 主线矛盾
  endingVision: string;        // 结局愿景
}

// ─── 章节计划 ────────────────────────────────────────────────────────────────

export interface ChapterPlan {
  chapterNumber: number;
  title: string;
  pov: string;                 // 视角人物（通常主角）
  location: string;            // 场景地点
  summary: string;
  beats: string[];             // 情节节拍（分步骤）
  faceSlapMoment?: string;     // 打脸情节（如有）
  breakthroughMoment?: string; // 突破情节（如有）
  romanceMoment?: string;      // 感情线推进（如有）
  endingHook: string;          // 结尾悬念钩子
  wordTarget: number;
}

// ─── 故事记忆 ────────────────────────────────────────────────────────────────

export interface PendingFaceSlap {
  target: string;
  offense: string;             // 做了什么事/说了什么话
  offenseChapter: number;
}

export interface PlotThread {
  thread: string;
  status: 'active' | 'resolved' | 'pending';
  hintChapter?: number;
}

export interface StoryMemory {
  lastUpdatedChapter: number;
  protagonistState: {
    realm: string;             // 当前境界
    abilities: string[];       // 已掌握能力
    currentGoal: string;       // 当前目标
    location: string;          // 当前位置
    relationships: Record<string, string>; // 与各人物关系状态
  };
  activeConflicts: string[];
  pendingFaceSlaps: PendingFaceSlap[];
  resolvedFaceSlaps: Array<{ target: string; resolvedChapter: number }>;
  plotThreads: PlotThread[];
  romanceProgress: Array<{ character: string; stage: string }>;
  recentEvents: string[];      // 最近3-5章的关键事件摘要
  foreshadowing: string[];     // 已埋下的伏笔
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

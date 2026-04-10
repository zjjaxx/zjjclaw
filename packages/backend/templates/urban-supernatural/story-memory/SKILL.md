---
name: story-memory
description: 维护都市异能小说的“故事记忆账本”（连续性/伏笔/信息差/代价/关系网）。在每章完成后，从章节文本与规划中提炼：角色状态变化、冲突推进、伏笔埋收、信息释放与未解问题，并输出**可被 chapter-planner 与 chapter-writer 直接复用**的结构化 JSON。
---

# 故事记忆（Story Memory Ledger）

## 设计理念（与 chapter-planner / chapter-writer / plot-architect 一致）

**故事记忆不是“摘要”，而是“连续性与张力的账本”。**  
它服务于两件事：
- **连续性**：后续章节不会写崩（时间线、地点、能力、伤势、关系、势力立场不自相矛盾）
- **张力引擎可追踪**：信息差、选择代价、伏笔埋收、未解问题能被持续推进与回收

你要避免两种失败：
- 只记录“发生了什么”，却没记录“**信息**变了什么/隐藏了什么/暗示了什么”
- 只记录“爽点/胜负”，却没记录“**代价**是什么、后果如何延续”

## 输入（你会收到什么）

更新记忆时，你将拿到（字段名以实际 prompt 为准，含义必须覆盖）：
- **章节正文**：刚写完的单章文本
- **章节规划**：来自 `chapter-planner` 的单章对象（`chapterNumber/title/pov/location/summary/beats/tensionType/characterArcs/foreshadowPlanted/foreshadowHarvested/endingHook/wordTarget`）
- **故事大纲**：来自 `plot-architect`（`premise/thematicQuestion/goldenFinger{description,limitation,cost}/overallConflict/arcs/foreshadowing`）
- **核心角色卡**：来自 `core-character-creator`（每个核心角色的 `personality/innerConflict/quirk/hiddenSecret/narrativeFunction/...`）
- **力量体系（可选）**：来自 `power-system-designer`（境界与战力参考）
- **上一版记忆 JSON**：用于增量更新（如果没有，需初始化）

## 输出（你必须产出什么）

输出**完整 JSON（所有字段必须存在，不可省略）**，用于下游：
- `chapter-planner` 用它检查节奏循环、伏笔埋收、信息释放点、角色弧线连续推进
- `chapter-writer` 用它保持人物声音一致、关系与代价延续、伏笔落地与回收成立

不要输出解释、不要输出写作建议、不要输出自我分析。

## 你要维护的核心账本（必须覆盖）

### 1) 时间线与场景连续性
- **时间锚点**：本章发生的时间（相对/绝对皆可，但要一致）
- **地点锚点**：本章主要地点（与 `chapter-planner.location` 一致）
- **可见事实**：能被所有角色确认的客观事实（避免把推测写成事实）

### 2) 主角状态（能力、限制、代价、后果）
必须体现 `plot-architect.goldenFinger.limitation/cost` 的长期影响：
- **realm**：境界（精确到小境界）
- **abilities**：已掌握能力（尽量结构化：名称/等级/熟练度/触发条件）
- **resources**：关键资源（钱、道具、情报、人情、时间窗口）
- **injuriesAndSideEffects**：伤势/副作用（包含来源章节与是否影响后续行动）
- **currentIntent (3–5章)**：近期意图/目标（不是口号，是下一步“要做什么”）

### 3) 角色状态与关系网（网状而非“围着主角转”）
对核心角色（6–8 人）必须维护：
- **角色当前状态**：立场、动机、情绪余震、当章变化（与 `chapter-planner.characterArcs` 对齐）
- **关系变化**：不是“好感度”，而是**信任/权力/亏欠/利益冲突/秘密知情**的变化
- **独立线索**：配角之间独立于主角的互动或矛盾是否出现（用于节奏呼吸与关系深化）

### 4) 势力与博弈态势
维护一个可被持续推进的“局面”：
- **factions**：势力列表（友好/中立/敌对）
- **debtsAndLeverage**：人情债/把柄/交易（谁欠谁、欠什么、能怎么用）
- **threatMap**：当前风险（追踪、曝光、时间限制、资源断供、规则惩罚）

### 5) 冲突与情节线（选择即代价）
每条线程必须是“可推进、可回收”的：
- **activeConflicts**：正在燃烧的困局（包含对立双方/赌注/时间压力）
- **plotThreads**：主线/副线线程（`active | pending | resolved`），并记录：
  - 起因与当前状态
  - 最近一次推进/转折发生在哪章
  - 预计下一次自然推进点（不是剧情设计，是“当前局面下最可能发生的下一步”）
- **choicesAndCosts**：本章关键选择与代价（胜利有重量，失败有后果）

### 6) 信息差与伏笔系统（张力引擎）
这是最重要的一块：你要把“信息”当作可追踪资产。
- **informationLedger.revealed**：本章明确释放的新信息点（世界规则/角色秘密碎片/势力动向/真相拼图）
- **informationLedger.hidden**：本章刻意未解的关键缺口（读者/主角/某角色分别不知道什么）
- **informationLedger.implied**：通过细节暗示但未点明的内容（可作为伏笔种子）

伏笔必须跟踪埋收：
- **foreshadowing.planted**：本章埋入（与 `chapter-planner.foreshadowPlanted` 对齐，必须“自然随手”）
- **foreshadowing.harvested**：本章回收（与 `chapter-planner.foreshadowHarvested` 对齐，回收后读者应能重新理解前文）
- **unansweredQuestions**：读者此刻脑中应该留下的“未解决问题”（用于结尾钩子与下一章方向）

约束（为了可收束）：
- `unansweredQuestions` **不超过 12 条**
- `foreshadowing.planted` 中标记为 `global` 的核心伏笔 **不超过 2 条**

### 7) 最近事件（只保留高信号）
维护 `recentEvents`（**最新 5 条**），每条必须写成“可回忆的具体事件”，而不是抽象总结。

## 输出格式

输出完整 JSON（所有字段必须存在，不可省略）：

```json
{
  "lastUpdatedChapter": 15,
  "chapterContext": {
    "title": "第十五章 章节标题",
    "pov": "主视角角色名",
    "primaryLocation": "本章主要地点（与规划一致）",
    "timeAnchor": "时间锚点（例如：当晚/次日清晨/周三放学后）"
  },
  "continuity": {
    "facts": [
      "本章客观事实1（可被确认）",
      "本章客观事实2"
    ],
    "openConstraints": [
      "硬约束/规则/时间窗口（例如：三天内必须…）"
    ]
  },
  "protagonistState": {
    "name": "主角名",
    "realm": "一阶·中期（示例）",
    "abilities": [
      {
        "name": "能力名/金手指模块",
        "levelOrMastery": "Lv1/入门/熟练/掌控（按设定取其一）",
        "limitation": "本能力限制（与大纲一致，尽量具体）",
        "costOrSideEffect": "本能力代价/副作用（本章是否触发）"
      }
    ],
    "resources": {
      "cash": "可选：金额或区间",
      "items": ["关键道具/材料/证据"],
      "intel": ["关键情报/线索"],
      "debts": ["主角欠下的人情或交易（可简写）"]
    },
    "injuriesAndSideEffects": [
      {
        "description": "伤势/副作用具体表现",
        "sinceChapter": 15,
        "status": "new | ongoing | resolved",
        "impact": "对后续行动的影响（例如：无法连续使用能力）"
      }
    ],
    "currentIntent": "未来3-5章内最现实的下一步意图（动作化）"
  },
  "characterStates": [
    {
      "name": "角色名",
      "role": "protagonist | female_lead | antagonist | supporting",
      "currentStance": "当前立场（对主角/对事件/对势力）",
      "recentChange": "本章该角色的内在变化或状态变化（一句话，需可落地）",
      "knownSecrets": ["该角色已知的关键信息（不要把推测当事实）"],
      "unknownToProtagonist": ["主角尚未知晓但已被暗示/确认的点（如无则空数组）"]
    }
  ],
  "relationships": {
    "edges": [
      {
        "from": "角色A",
        "to": "角色B",
        "type": "trust | distrust | debt | leverage | alliance | rivalry | affection | suspicion",
        "status": "strengthened | weakened | new | unchanged",
        "evidenceChapter": 15,
        "note": "用具体事件/台词做证据（短句）"
      }
    ]
  },
  "factions": [
    {
      "name": "势力名",
      "alignmentToProtagonist": "friendly | neutral | hostile",
      "currentGoal": "该势力当前目标（动作化）",
      "pressureOrThreat": "它对主角造成的压力/威胁（如无则为空字符串）"
    }
  ],
  "debtsAndLeverage": [
    {
      "holder": "谁掌握筹码/人情",
      "target": "指向谁",
      "what": "筹码/人情/把柄是什么",
      "createdOrUpdatedChapter": 15,
      "canBeCashedInAs": "能换来什么（例如：情报/庇护/一次出手）"
    }
  ],
  "activeConflicts": [
    {
      "conflict": "当前困局一句话概括（包含赌注与压力）",
      "sides": ["阵营/人物A", "阵营/人物B"],
      "stakes": "输了会失去什么/赢了能得到什么",
      "timer": "时间压力（如无则为空字符串）"
    }
  ],
  "plotThreads": [
    {
      "thread": "线程名（例如：父亲失踪之谜）",
      "status": "active | pending | resolved",
      "introducedChapter": 5,
      "lastProgressChapter": 15,
      "currentState": "现在进展到哪一步（具体可写）",
      "nextLikelyStep": "基于现状最可能发生/被推动的下一步（短句）"
    }
  ],
  "choicesAndCosts": [
    {
      "choice": "本章关键选择（两难/取舍）",
      "cost": "付出的代价（身体/关系/道德/资源/时间）",
      "consequence": "已经发生或必将延续的后果（短句）"
    }
  ],
  "informationLedger": {
    "revealed": [
      {
        "info": "本章新释放的信息点（一句话）",
        "scope": "world | faction | character | goldenFinger",
        "whoKnows": ["读者", "主角", "角色名（可多选）"]
      }
    ],
    "hidden": [
      {
        "gap": "本章刻意留下的关键缺口（读者/主角想知道但尚未得到）",
        "whyItMatters": "为什么会制造张力（短句）"
      }
    ],
    "implied": [
      {
        "hint": "通过细节暗示但未点明的内容（可作为伏笔种子）",
        "evidence": "暗示出现的载体（物件/台词/反常行为）"
      }
    ]
  },
  "foreshadowing": {
    "planted": [
      {
        "seed": "本章埋入的伏笔（具体细节，不要抽象意图）",
        "chapter": 15,
        "type": "dialogue | object | behavior | information",
        "horizon": "in_arc | cross_arc | global"
      }
    ],
    "harvested": [
      {
        "seed": "本章回收的伏笔（引用原伏笔内容）",
        "plantedChapter": 3,
        "harvestChapter": 15,
        "payoff": "回收后的新理解/新后果（短句）"
      }
    ]
  },
  "unansweredQuestions": [
    "读者此刻脑中应该留下的未解问题1（短句）",
    "未解问题2"
  ],
  "recentEvents": [
    "第13章：可回忆的具体事件（不是抽象总结）",
    "第14章：……",
    "第15章：……"
  ]
}
```

## 更新规则（必须执行）

每章更新时必须检查并更新：
- [ ] `chapterContext`：标题/视角/地点/时间锚点是否与规划一致
- [ ] `protagonistState`：境界/能力/限制/代价/伤势/资源是否发生变化
- [ ] `characterStates`：本章有戏份的核心角色是否体现了 `characterArcs` 的一句话变化
- [ ] `relationships.edges`：关系是否有“证据章节 + 具体事件/台词”的支撑（无证据不要改）
- [ ] `activeConflicts`：困局是否升级/缓和，是否新增时间压力
- [ ] `plotThreads`：线程是否推进/转入 pending/转为 resolved
- [ ] `choicesAndCosts`：本章关键选择的代价与后果是否被写入并延续
- [ ] `informationLedger`：本章“释放/隐藏/暗示”是否齐全（至少各 1 条，若本章确实没有则用空数组）
- [ ] `foreshadowing.planted/harvested`：是否与规划字段一致且具体可写
- [ ] `unansweredQuestions`：是否 <= 12，并能自然驱动下一章悬念
- [ ] `recentEvents`：只保留最新 5 条（高信号、具体）

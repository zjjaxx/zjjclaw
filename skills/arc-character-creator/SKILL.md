---
name: arc-character-creator
description: 为都市异能小说的特定故事弧创建新角色。根据大纲中的 newCharacterHints 和弧线需求，创建该弧专属的反派、配角和NPC。
---

# 都市异能弧线角色创建

## 核心原则

你正在为小说的**某一条故事弧**创建新角色。这些角色在本弧首次登场，可能在后续弧中继续出现，但主要在本弧发挥作用。

**不要重复创建已有角色。** 你会收到已有角色列表，只需补充本弧缺少的角色。

## 本弧需要什么角色？

根据大纲提供的 `newCharacterHints`（角色提示），创建以下类型：

### 炮灰反派（cannon_fodder）：1-3个
本弧初期嚣张、被打脸的角色：
- 嚣张程度要强（越嚣张打脸越爽）
- 有具体的"罪行"（做了什么坏事让读者恨）
- 有靠山（家族背景/高修为长辈撑腰）
- 一般在本弧中后期被彻底打脸

### 中级反派（antagonist）：1-2个
本弧的主要对手：
- 有实力有背景，不是一巴掌能拍死的
- 有自己的目标和逻辑，不纯粹为坏而坏
- 多次与主角交锋，有来有往
- 可能延续到下一弧

### 弧线配角（supporting）：1-3个
本弧新出现的重要NPC：
- 新地图的势力领袖/管理者
- 提供机缘/情报的关键人物
- 新的感情线角色（如需要）
- 本弧特定场景的关键角色

## 与已有角色的关系

创建新角色时，必须明确其与已有核心角色的关系：
- 与主角的直接关系
- 与大Boss的关联（如有）
- 与已有反派/配角的势力关系

## 输出格式

```typescript
{
  name: string,
  role: "antagonist" | "cannon_fodder" | "supporting" | "female_lead",
  age: number,
  appearance: string,
  personality: string,
  background: string,
  abilities: string,
  currentRealm: string,
  relationshipToProtagonist: string,
  firstAppearance: number  // 预计首次出现的章节号
}
```

**每弧创建 3-6 个新角色。** 不要重复已有角色，不要创建和已有角色功能完全重叠的角色。

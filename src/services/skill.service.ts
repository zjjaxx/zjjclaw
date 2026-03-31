import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Skill } from '../types/index.js';

const SKILLS_DIR = path.join(process.cwd(), 'skills');

// 简单内存缓存
let skillsCache: Skill[] | null = null;

/**
 * 扫描 skills/ 目录，解析所有 SKILL.md 文件
 */
export function loadSkills(): Skill[] {
  if (skillsCache) return skillsCache;

  if (!fs.existsSync(SKILLS_DIR)) {
    console.warn('[SkillService] skills/ 目录不存在');
    return [];
  }

  const skills: Skill[] = [];
  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of dirs) {
    const skillPath = path.join(SKILLS_DIR, dir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    try {
      const raw = fs.readFileSync(skillPath, 'utf-8');
      const { data, content } = matter(raw);

      if (data.name && data.description) {
        skills.push({
          name: data.name as string,
          description: data.description as string,
          content: content.trim(),
          filePath: skillPath,
        });
        console.log(`[SkillService] 已加载 skill: ${data.name as string}`);
      }
    } catch (e) {
      console.error(`[SkillService] 解析失败: ${skillPath}`, e);
    }
  }

  skillsCache = skills;
  return skills;
}

/**
 * 按名称获取 Skill
 */
export function getSkill(name: string): Skill | undefined {
  return loadSkills().find(s => s.name === name);
}

/**
 * 获取 Skill 的完整 Markdown 正文（注入 system prompt 用）
 */
export function getSkillContent(name: string): string {
  const skill = getSkill(name);
  if (!skill) {
    console.warn(`[SkillService] 未找到 skill: ${name}`);
    return '';
  }
  return skill.content;
}

/**
 * 生成可供 Claude 扫描的 available_skills 列表（元数据摘要）
 */
export function buildAvailableSkillsBlock(): string {
  const skills = loadSkills();
  const items = skills.map(s =>
    `  <skill name="${s.name}">\n    <description>${s.description}</description>\n  </skill>`
  );
  return `<available_skills>\n${items.join('\n')}\n</available_skills>`;
}

/**
 * 构建 System Prompt：
 *   1. 基础角色设定
 *   2. 匹配 skill 的完整指令（已触发，直接注入 body）
 *   3. 故事上下文（world / characters / memory 等）
 */
export function buildSystemPrompt(
  skillName: string,
  storyContext: string = '',
): string {
  const skillContent = getSkillContent(skillName);

  const parts: string[] = [
    '你是一位专业的都市异能网文写作 AI 助手，擅长创作引人入胜的网络小说。',
    '',
  ];

  if (skillContent) {
    parts.push('## 当前任务指令', '', skillContent, '');
  }

  if (storyContext.trim()) {
    parts.push('## 故事背景上下文', '', storyContext.trim(), '');
  }

  return parts.join('\n');
}

/**
 * 重置 Skill 缓存（测试或热重载时使用）
 */
export function clearSkillsCache(): void {
  skillsCache = null;
}

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { NovelTemplate, Skill } from '../types/index.js';

const SKILLS_DIR = path.join(process.cwd(), 'skills');       // 默认 urban-supernatural
const TEMPLATES_DIR = path.join(process.cwd(), 'templates'); // 模版专属技能

// 每个模版独立缓存
const skillsCacheMap = new Map<string, Skill[]>();

const TEMPLATE_ROLES: Record<NovelTemplate, string> = {
  'urban-supernatural': '你是一位专业的都市异能网文写作 AI 助手，擅长创作引人入胜的网络小说。',
  'xianxia':           '你是一位专业的玄幻修真网文写作 AI 助手，擅长创作气势磅礴的修仙小说。',
  'post-apocalyptic':  '你是一位专业的末世重生网文写作 AI 助手，擅长创作紧张刺激的末日生存小说。',
};

/**
 * 扫描技能目录：优先加载模版专属技能，缺失时回退到 skills/ 默认技能
 */
export function loadSkills(template: NovelTemplate = 'urban-supernatural'): Skill[] {
  if (skillsCacheMap.has(template)) return skillsCacheMap.get(template)!;

  const templateDir = path.join(TEMPLATES_DIR, template);
  const hasTemplateDir = template !== 'urban-supernatural' && fs.existsSync(templateDir);

  // 收集所有技能名（先模版目录，再默认目录）
  const skillNames = new Set<string>();

  if (hasTemplateDir) {
    fs.readdirSync(templateDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .forEach(d => skillNames.add(d.name));
  }

  if (fs.existsSync(SKILLS_DIR)) {
    fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .forEach(d => skillNames.add(d.name));
  }

  const skills: Skill[] = [];

  for (const name of skillNames) {
    // 优先用模版专属，回退到默认
    const templateSkillPath = path.join(templateDir, name, 'SKILL.md');
    const rootSkillPath = path.join(SKILLS_DIR, name, 'SKILL.md');

    const skillPath =
      (hasTemplateDir && fs.existsSync(templateSkillPath))
        ? templateSkillPath
        : rootSkillPath;

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
        console.log(`[SkillService][${template}] 已加载 skill: ${data.name as string}`);
      }
    } catch (e) {
      console.error(`[SkillService] 解析失败: ${skillPath}`, e);
    }
  }

  skillsCacheMap.set(template, skills);
  return skills;
}

/**
 * 按名称获取 Skill
 */
export function getSkill(name: string, template: NovelTemplate = 'urban-supernatural'): Skill | undefined {
  return loadSkills(template).find(s => s.name === name);
}

/**
 * 获取 Skill 的完整 Markdown 正文（注入 system prompt 用）
 */
export function getSkillContent(name: string, template: NovelTemplate = 'urban-supernatural'): string {
  const skill = getSkill(name, template);
  if (!skill) {
    console.warn(`[SkillService] 未找到 skill: ${name} (template: ${template})`);
    return '';
  }
  return skill.content;
}

/**
 * 生成可供 Claude 扫描的 available_skills 列表（元数据摘要）
 */
export function buildAvailableSkillsBlock(template: NovelTemplate = 'urban-supernatural'): string {
  const skills = loadSkills(template);
  const items = skills.map(s =>
    `  <skill name="${s.name}">\n    <description>${s.description}</description>\n  </skill>`
  );
  return `<available_skills>\n${items.join('\n')}\n</available_skills>`;
}

/**
 * 构建 System Prompt：
 *   1. 模版专属基础角色设定
 *   2. 匹配 skill 的完整指令（已触发，直接注入 body）
 *   3. 故事上下文（world / characters / memory 等）
 */
export function buildSystemPrompt(
  skillName: string,
  storyContext: string = '',
  template: NovelTemplate = 'urban-supernatural',
): string {
  const skillContent = getSkillContent(skillName, template);
  const baseRole = TEMPLATE_ROLES[template] ?? TEMPLATE_ROLES['urban-supernatural'];

  const parts: string[] = [baseRole, ''];

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
  skillsCacheMap.clear();
}

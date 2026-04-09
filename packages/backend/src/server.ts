import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router as novelsRouter } from './routes/novels.js';
import { loadSkills } from './services/skill.service.js';
import { interruptRunningPipelines } from './services/novel.service.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 7879;

// ─── 中间件 ───────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── 路由 ─────────────────────────────────────────────────────────────────────
app.use('/api/novels', novelsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── 启动 ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const skills = loadSkills();
  const interruptedPipelines = interruptRunningPipelines();
  console.log(`\n🚀 zjjclaw 服务启动成功`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   已加载 Skills: ${skills.map(s => s.name).join(', ')}`);
  if (interruptedPipelines > 0) {
    console.log(`   已中断遗留生成任务: ${interruptedPipelines} 个`);
  }
  console.log(`\n📖 API 端点:`);
  console.log(`   POST   /api/novels                       创建小说项目`);
  console.log(`   GET    /api/novels                       列出所有项目`);
  console.log(`   GET    /api/novels/:id                   项目详情`);
  console.log(`   POST   /api/novels/:id/world             生成世界观 (SSE)`);
  console.log(`   POST   /api/novels/:id/power-system      设计力量体系 (SSE)`);
  console.log(`   POST   /api/novels/:id/characters        创建人物 (SSE)`);
  console.log(`   POST   /api/novels/:id/outline           生成大纲 (SSE)`);
  console.log(`   POST   /api/novels/:id/chapters/plan     规划章节 (SSE)`);
  console.log(`   POST   /api/novels/:id/chapters/:n/write 写章节 (SSE)`);
  console.log(`   POST   /api/novels/:id/generate          全自动写作 (SSE，支持断点续传)`);
  console.log(`   GET    /api/novels/:id/generate/status   查看流水线进度`);
  console.log(`   GET    /api/novels/:id/status            查看进度`);
  console.log(`   POST   /api/novels/:id/chapters/:n/review 审校章节 (SSE)`);
  console.log(`   GET    /api/novels/:id/export            导出小说\n`);
});

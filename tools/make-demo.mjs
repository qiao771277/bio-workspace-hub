#!/usr/bin/env node
/**
 * 生成 examples/ 下的示例工作区（三台虚构机器 / 12 个项目 / 两轮历史快照）。
 *
 *   node tools/make-demo.mjs
 *
 * 目的：让 `node tools/build.mjs --demo` 开箱就有一份看得懂的演示数据。
 * 所有机器名、路径、项目都是虚构的，不含任何真实数据。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "examples", "workspaces");

const P = (o) => Object.assign({
  kind: "code", status: "active", category: "other",
  tech: [], tags: [], relations: [], risks: [], next_steps: [],
  evidence: [], key_files: [], entry_points: [],
  size: { files: 10, bytes: 1024 * 1024 },
  data: { summary: "", in_repo: false, assets: [], total_bytes: 0 },
  activity: { last_modified: "2026-10-01T00:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
  git: { is_repo: false, remote: "", default_branch: "" },
  origin: { type: "scratch", from: "", evidence: "目录结构" },
  confidence: "medium", hidden: false
}, o);

const laptop = {
  schema_version: "1.0",
  run: { run_id: "2026-11-02T02-00-00Z", started_at: "2026-11-02T01:45:00Z", finished_at: "2026-11-02T02:00:00Z", tool: "opencode", model: "demo", mode: "incremental", budget_cut: false, previous_run_id: "2026-10-20T09-00-00Z" },
  workspace: {
    id: "laptop", label: "笔记本 · Windows", machine: "DEMO-PC", os: "windows",
    root: "C:\\Users\\demo\\projects", root_display: "~/projects",
    extra_roots: [], counts: { projects: 5, loose_assets: 2, files_scanned: 1200, bytes: 3_400_000_000 },
    disk: { total_bytes: 1_000_000_000_000, free_bytes: 180_000_000_000 },
    notes: "示例数据：一台 Windows 笔记本，主要跑分析脚本、写论文图、做文献整理。"
  },
  projects: [
    P({
      id: "laptop--amp-candidates", name: "候选抗菌肽筛选", path: "C:\\Users\\demo\\projects\\amp-candidates",
      rel_path: "amp-candidates", kind: "mixed", status: "active", category: "amp-candidate",
      one_liner: "从 smORF 库里打分、筛出候选肽并排序",
      story: "整个课题的主入口：把 Ribo-seq 预测出来的小 ORF 转成肽段，按理化性质、保守性和预测活性打分，最后挑出一批送合成。脚本是边写边改的，`rank_v3.py` 是当前在用的版本，v1/v2 留着对照。候选表每周手动更新一次，没有版本控制。",
      origin: { type: "scratch", from: "本课题自建", evidence: "无 .git，脚本 mtime 连续" },
      tech: ["python", "pandas", "rdkit"], tags: ["科研", "抗菌肽", "筛选"],
      entry_points: ["python scripts/rank_v3.py --input candidates.csv"],
      key_files: [{ path: "scripts/rank_v3.py", why: "当前使用的排序脚本" }, { path: "candidates.csv", why: "候选总表" }],
      data: { summary: "候选表约 12 万行，2.4 GB 的中间特征缓存在本地，可重算。", in_repo: true, assets: [{ path: "candidates.csv", type: "csv", size_bytes: 8_400_000, note: "候选与打分", sensitive: true }], total_bytes: 8_400_000 },
      activity: { last_modified: "2026-10-28T09:12:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 96, bytes: 2_400_000_000 },
      relations: [{ type: "depends_on", target: "lab-server--riboseq-pipeline", note: "候选来自服务器上的 Ribo-seq 流程" }],
      risks: ["无版本控制，rank_v3 与 v2 的差异说不清", "候选表靠手工更新，容易忘"],
      next_steps: ["把 rank_v3 收进 git", "把每周更新做成脚本"],
      confidence: "high", tags: ["科研", "抗菌肽", "筛选"],
      evidence: [{ claim: "脚本三版并存", source: "scripts/rank_v1.py, rank_v2.py, rank_v3.py" }]
    }),
    P({
      id: "laptop--antifungal-mic", name: "抗真菌肽 MIC 实验", path: "C:\\Users\\demo\\projects\\antifungal-mic",
      rel_path: "antifungal-mic", kind: "experiment", status: "active", category: "antifungal",
      one_liner: "抗真菌肽的 MIC/MFC 测定与曲线拟合",
      story: "湿实验侧：候选抗真菌肽做梯度稀释，读 OD600 出生长曲线，再拟合成 MIC。原始读板数据是 xlsx，一个肽一个 sheet；`fit_curve.R` 统一出图。两批实验间隔三周，第二批换了培养基，结果还没对齐。",
      origin: { type: "scratch", from: "本课题湿实验", evidence: "xlsx 与读板记录" },
      tech: ["r", "excel"], tags: ["科研", "抗真菌", "湿实验"],
      entry_points: ["Rscript fit_curve.R"],
      key_files: [{ path: "fit_curve.R", why: "MIC 曲线拟合与出图" }],
      data: { summary: "两批读板数据约 40 MB，在本地；原始酶标仪文件没有备份。", in_repo: true, assets: [{ path: "mic_raw.xlsx", type: "excel", size_bytes: 24_000_000, note: "两批读板原始值", sensitive: true }], total_bytes: 24_000_000 },
      activity: { last_modified: "2026-11-01T15:30:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 31, bytes: 48_000_000 },
      relations: [{ type: "depends_on", target: "laptop--amp-candidates", note: "测的肽来自候选筛选" }],
      risks: ["第二批换了培养基，结果不可直接合并", "原始文件只有一份"],
      next_steps: ["确认两批是否需要重做对照组"],
      confidence: "high",
      evidence: [{ claim: "两批实验间隔三周", source: "mic_raw.xlsx 的 sheet 命名" }]
    }),
    P({
      id: "laptop--crop-sorf", name: "作物 sORF 注释整理", path: "C:\\Users\\demo\\projects\\crop-sorf",
      rel_path: "crop-sorf", kind: "data", status: "paused", category: "crop-amp",
      one_liner: "把三种作物的 sORF 预测结果统一成一张表",
      story: "三个物种的预测结果格式各不相同（GFF、BED、CSV 各一套），这里写了一个转换脚本统一成 `species/chrom/start/end/seq`。小麦那批坐标是 0-based，和另外两个不一致，转换时专门做了 +1。统一后的表已经交给质谱那边做库。",
      origin: { type: "imported", from: "三个物种的预测结果（合作方提供）", evidence: "输入文件命名 spec_a/spec_b/spec_c" },
      tech: ["python", "bedtools"], tags: ["科研", "作物", "sORF"],
      entry_points: ["python convert.py"],
      key_files: [{ path: "convert.py", why: "三种格式归一化" }],
      data: { summary: "统一表 1.2 GB，本地；原始预测结果在合作方那里。", in_repo: true, assets: [], total_bytes: 1_200_000_000 },
      activity: { last_modified: "2026-09-18T11:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 42, bytes: 1_200_000_000 },
      relations: [{ type: "shares_data_with", target: "lab-server--crop-ms-search", note: "统一表是质谱搜索的输入库" }],
      risks: ["坐标体系不一致靠注释提醒，没有自动校验"],
      next_steps: ["加一个坐标自检脚本"],
      confidence: "medium",
      evidence: [{ claim: "小麦坐标 0-based", source: "convert.py 第 38 行注释" }]
    }),
    P({
      id: "laptop--defensin-screen", name: "防御素候选筛选", path: "C:\\Users\\demo\\projects\\defensin-screen",
      rel_path: "defensin-screen", kind: "data", status: "active", category: "defensin",
      one_liner: "按半胱氨酸模式从大表里筛 β-防御素类似序列",
      story: "以六个经典人 β-防御素的半胱氨酸间距为模板，从十几万条候选里筛相似的。规则写在 `rules.md` 里：必须恰好 6 个 Cys、C1-C6 连接模式一致、长度 36-50 aa。筛完一轮后调过阈值，但没记录改了哪一版。",
      origin: { type: "scratch", from: "本课题规则", evidence: "rules.md" },
      tech: ["python"], tags: ["科研", "防御素", "筛选"],
      entry_points: ["python screen.py --rules rules.md"],
      key_files: [{ path: "rules.md", why: "筛选规则说明" }],
      data: { summary: "输入表 300 MB，结果 12 MB；都在本地。", in_repo: true, assets: [], total_bytes: 312_000_000 },
      activity: { last_modified: "2026-10-30T10:20:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 18, bytes: 312_000_000 },
      relations: [{ type: "shares_data_with", target: "wsl--signalp-batch", note: "筛出的序列送到 WSL 批量跑 SignalP" }],
      risks: ["阈值改过但没留版本"],
      next_steps: ["把阈值写进 rules.md 并标注版本"],
      confidence: "medium",
      evidence: [{ claim: "规则是 6 个 Cys + C1-C6", source: "rules.md 第 2 节" }]
    }),
    P({
      id: "laptop--manuscript-figs", name: "论文图与投稿材料", path: "C:\\Users\\demo\\projects\\manuscript-figs",
      rel_path: "manuscript-figs", kind: "doc", status: "active", category: "paper",
      one_liner: "论文 4 张主图的源文件与投稿附件",
      story: "四张主图的 Illustrator/PPT 源文件 + 导出 PDF，按投稿要求统一成 300 dpi、RGB。图 2 的显著性标记换过一次字体，旧版还留在 backup/ 里。审稿意见要求补一张补充图，还没开始。",
      origin: { type: "scratch", from: "本课题投稿", evidence: "fig1..fig4 目录" },
      tech: ["illustrator", "pdf"], tags: ["论文", "图"],
      data: { summary: "约 900 MB 源文件与导出图。", in_repo: true, assets: [], total_bytes: 900_000_000 },
      activity: { last_modified: "2026-10-25T18:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 64, bytes: 900_000_000 },
      risks: ["源文件没有版本控制，回退靠 backup/ 手工拷"],
      next_steps: ["补审稿要求的补充图 S5"],
      confidence: "high",
      evidence: [{ claim: "四张主图 + backup 旧版", source: "目录结构" }]
    })
  ],
  loose_assets: [
    { path: "meeting-notes.md", kind: "document", what: "组会记录的零散笔记，未归入任何项目", belongs_to: "", size_bytes: 24_000, last_modified: "2026-10-29T00:00:00Z", keep: "review" },
    { path: "old_rank.py", kind: "script", what: "早期排序脚本，已被 scripts/rank_v3.py 取代", belongs_to: "laptop--amp-candidates", size_bytes: 8_000, last_modified: "2026-05-12T00:00:00Z", keep: "delete" }
  ],
  cross_project: [],
  gaps: [
    { severity: "medium", about: "laptop--crop-sorf", text: "小麦坐标体系与另外两个物种不一致，转换时手工 +1，没有自动校验。" },
    { severity: "low", about: "laptop--defensin-screen", text: "筛选阈值调整过，但没有记录版本。" }
  ]
};

// 上一轮快照：少两个项目、状态不同，用来演示「变化」页
const laptopPrev = JSON.parse(JSON.stringify(laptop));
laptopPrev.run = { run_id: "2026-10-20T09-00-00Z", started_at: "2026-10-20T08:45:00Z", finished_at: "2026-10-20T09:00:00Z", tool: "opencode", model: "demo", mode: "full", budget_cut: false, previous_run_id: null };
laptopPrev.projects = laptopPrev.projects.filter(p => p.id !== "laptop--antifungal-mic" && p.id !== "laptop--manuscript-figs");
laptopPrev.projects.find(p => p.id === "laptop--crop-sorf").status = "active";

const server = {
  schema_version: "1.0",
  run: { run_id: "2026-11-01T20-00-00Z", started_at: "2026-11-01T19:40:00Z", finished_at: "2026-11-01T20:00:00Z", tool: "opencode", model: "demo", mode: "full", budget_cut: false, previous_run_id: null },
  workspace: {
    id: "lab-server", label: "实验室服务器 · Linux", machine: "demo-server", os: "linux",
    root: "/home/demo/work", root_display: "/home/demo/work",
    extra_roots: ["/data/scratch"], counts: { projects: 4, loose_assets: 1, files_scanned: 48000, bytes: 1_800_000_000_000 },
    disk: { total_bytes: 8_000_000_000_000, free_bytes: 900_000_000_000 },
    notes: "示例数据：一台 Linux 计算服务器，跑 Ribo-seq、质谱搜索和公共数据下载；磁盘常年在 90% 以上。"
  },
  projects: [
    P({
      id: "lab-server--riboseq-pipeline", name: "Ribo-seq 分析流程", path: "/home/demo/work/riboseq",
      rel_path: "riboseq", kind: "code", status: "active", category: "mouse-riboseq",
      one_liner: "从 fastq 到 ORF 定量的 S 步骤流水线",
      story: "一条 shell 流水线，按 s1_fastqc → s6_quant 命名，支持断点续跑：每一步写完就留标记，重跑会跳过。STAR 索引和人/鼠参考放在 ref/ 下。最近在把 ORFquant 换成自写脚本，两条并行跑，结果还没对齐。",
      origin: { type: "scratch", from: "本组自建", evidence: "s1..s6 脚本 + 运行日志" },
      tech: ["shell", "star", "fastqc", "r"], tags: ["科研", "Ribo-seq", "流程"],
      entry_points: ["bash run.sh --sample S1"],
      key_files: [{ path: "run.sh", why: "总入口，带断点续跑" }, { path: "config.sh", why: "路径与参数" }],
      data: { summary: "40 个样本的 bam 约 1.2 TB，在 /data/scratch；fastq 已删，可从公共库重下。", in_repo: false, assets: [{ path: "/data/scratch/riboseq/bam", type: "binary", size_bytes: 1_200_000_000_000, note: "比对结果", sensitive: false }], total_bytes: 1_200_000_000_000 },
      activity: { last_modified: "2026-11-01T12:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 3200, bytes: 1_400_000_000_000 },
      relations: [{ type: "shares_data_with", target: "wsl--orf-quant", note: "ORF 定量在 WSL 上试新方法" }],
      risks: ["/data/scratch 没有备份", "config.sh 里路径写死"],
      next_steps: ["把 config.sh 改成环境变量"],
      confidence: "high",
      evidence: [{ claim: "六步流水线 + 标记文件", source: "run.sh 第 20-60 行" }]
    }),
    P({
      id: "lab-server--crop-ms-search", name: "作物 sORF 质谱搜索", path: "/home/demo/work/crop-ms",
      rel_path: "crop-ms", kind: "experiment", status: "active", category: "crop-amp",
      one_liner: "三种作物 sORF 库的 DIA 搜索与假阳性过滤",
      story: "把笔记本上统一好的作物 sORF 表转成蛋白库，用 DIA-NN 搜三批数据，再用诱饵库估 FDR。目前只跑完两个物种，第三个的库还没建。搜索参数写在 `params.txt`，换过一次 precursor 容差。",
      origin: { type: "derived", from: "laptop--crop-sorf 的统一表", evidence: "输入路径指向共享目录" },
      tech: ["dia-nn", "python"], tags: ["科研", "作物", "质谱"],
      entry_points: ["bash search.sh --species rice"],
      key_files: [{ path: "params.txt", why: "DIA-NN 参数" }],
      data: { summary: "搜索中间产物 380 GB，在 /data/scratch；原始 raw 在质谱机房。", in_repo: false, assets: [], total_bytes: 380_000_000_000 },
      activity: { last_modified: "2026-10-30T08:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 890, bytes: 380_000_000_000 },
      relations: [{ type: "depends_on", target: "laptop--crop-sorf", note: "库来自笔记本上的统一表" }],
      risks: ["第三个物种没跑", "参数改过但没记录"],
      next_steps: ["补齐第三个物种", "记录参数版本"],
      confidence: "medium",
      evidence: [{ claim: "只完成两个物种", source: "results/ 下两个物种目录" }]
    }),
    P({
      id: "lab-server--public-datasets", name: "公共数据下载与整理", path: "/home/demo/work/public-data",
      rel_path: "public-data", kind: "data", status: "paused", category: "infra",
      one_liner: "下载的公共组学数据集与清单",
      story: "按项目号分目录存放下载的公共数据（转录组、蛋白组），根目录一个 `manifest.tsv` 记录来源、体积、下载日期和用途。最近一次下载是两个月前，manifest 有一半没填用途。",
      origin: { type: "imported", from: "公共数据库", evidence: "manifest.tsv" },
      tech: ["shell", "sra"], tags: ["数据", "公共"],
      data: { summary: "约 40 GB，本地；都能重下，但要几天。", in_repo: false, assets: [{ path: "manifest.tsv", type: "tsv", size_bytes: 40_000, note: "下载清单", sensitive: false }], total_bytes: 40_000_000_000 },
      activity: { last_modified: "2026-09-02T00:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 240, bytes: 40_000_000_000 },
      risks: ["manifest 用途列大量空缺", "重复下载风险"],
      next_steps: ["补齐 manifest 的用途列"],
      confidence: "medium",
      evidence: [{ claim: "manifest 有空行", source: "manifest.tsv" }]
    }),
    P({
      id: "lab-server--cluster-templates", name: "集群作业模板", path: "/home/demo/work/slurm-templates",
      rel_path: "slurm-templates", kind: "infra", status: "active", category: "infra",
      one_liner: "Slurm 提交脚本模板与常用环境加载",
      story: "几个 sbatch 模板：CPU 密集、GPU、长时低优先。每个模板里写死了分区名和账户，换集群要手改。`env.sh` 统一加载 conda 环境和模块。",
      origin: { type: "scratch", from: "日常积累", evidence: "模板文件" },
      tech: ["slurm", "shell"], tags: ["基建", "集群"],
      key_files: [{ path: "gpu.sbatch", why: "GPU 作业模板" }],
      data: { summary: "1 MB，纯脚本。", in_repo: true, assets: [], total_bytes: 1_000_000 },
      activity: { last_modified: "2026-08-14T00:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 14, bytes: 1_000_000 },
      risks: ["分区/账户写死"],
      next_steps: ["用变量替换写死的分区名"],
      confidence: "high",
      evidence: [{ claim: "模板里写死 partition", source: "gpu.sbatch 第 3 行" }]
    })
  ],
  loose_assets: [
    { path: "/data/scratch/tmp", kind: "dataset", what: "跑完没清的中转目录，约 60 GB", belongs_to: "lab-server--riboseq-pipeline", size_bytes: 60_000_000_000, last_modified: "2026-10-31T00:00:00Z", keep: "review" }
  ],
  cross_project: [],
  gaps: [
    { severity: "high", about: "/data/scratch", text: "scratch 盘只剩 900 GB（约 11%），再跑两批就会满；这里的 bam 没有备份。" }
  ]
};

const wsl = {
  schema_version: "1.0",
  run: { run_id: "2026-11-01T22-00-00Z", started_at: "2026-11-01T21:45:00Z", finished_at: "2026-11-01T22:00:00Z", tool: "opencode", model: "demo", mode: "full", budget_cut: false, previous_run_id: null },
  workspace: {
    id: "wsl", label: "WSL · Ubuntu", machine: "DEMO-PC (WSL2)", os: "wsl",
    root: "/home/demo", root_display: "/home/demo",
    extra_roots: [], counts: { projects: 3, loose_assets: 1, files_scanned: 9000, bytes: 21_000_000_000 },
    disk: { total_bytes: 250_000_000_000, free_bytes: 40_000_000_000 },
    notes: "示例数据：和笔记本同一台机器的 WSL2 发行版，放序列工具和小规模批处理。"
  },
  projects: [
    P({
      id: "wsl--signalp-batch", name: "SignalP 批量预测", path: "/home/demo/signalp-batch",
      rel_path: "signalp-batch", kind: "experiment", status: "active", category: "defensin",
      one_liner: "对防御素候选批量跑信号肽预测",
      story: "把笔记本筛出来的防御素候选按 500 条一批送 SignalP 6，结果汇总成 `signalp.tsv`。slow 模式单条约 2 分钟，全量要跑一整晚。脚本用 nohup 挂着跑，日志按批号分文件。",
      origin: { type: "derived", from: "laptop--defensin-screen 的输出", evidence: "输入路径" },
      tech: ["python", "signalp6"], tags: ["科研", "防御素"],
      entry_points: ["bash run_batch.sh"],
      key_files: [{ path: "run_batch.sh", why: "分批提交与断点续跑" }],
      data: { summary: "结果 2 GB，本地；模型权重另装。", in_repo: true, assets: [], total_bytes: 2_000_000_000 },
      activity: { last_modified: "2026-11-01T23:30:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 620, bytes: 2_000_000_000 },
      relations: [{ type: "depends_on", target: "laptop--defensin-screen", note: "输入来自笔记本筛选结果" }],
      risks: ["slow 模式太慢，全量要 10 小时", "模型权重不在仓库里"],
      next_steps: ["试试 fast 模式看能否接受"],
      confidence: "high",
      evidence: [{ claim: "按 500 条分批", source: "run_batch.sh" }]
    }),
    P({
      id: "wsl--orf-quant", name: "ORF 定量新方法对比", path: "/home/demo/orf-quant",
      rel_path: "orf-quant", kind: "experiment", status: "experiment", category: "mouse-riboseq",
      one_liner: "拿两种 ORF 定量方法在同一批 bam 上对比",
      story: "服务器上两套定量结果不一致，这里用同一批 bam 重跑做对照：一套现成工具，一套自写脚本。目前跑完 6 个样本，两套的重叠率约 72%，差异还没查。目录里同时留着两个方法的原始输出，方便逐条对。",
      origin: { type: "scratch", from: "对服务器结果做交叉验证", evidence: "bam 路径指向服务器" },
      tech: ["r", "python", "bedtools"], tags: ["科研", "Ribo-seq", "方法"],
      data: { summary: "18 GB，本地；bam 来自服务器共享盘。", in_repo: true, assets: [], total_bytes: 18_000_000_000 },
      activity: { last_modified: "2026-10-29T00:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 480, bytes: 18_000_000_000 },
      relations: [{ type: "depends_on", target: "lab-server--riboseq-pipeline", note: "bam 来自服务器流程" }],
      risks: ["两套结果不一致，原因未查"],
      next_steps: ["挑 20 条差异最大的 ORF 手工核对"],
      confidence: "medium",
      evidence: [{ claim: "重叠率约 72%", source: "compare.tsv" }]
    }),
    P({
      id: "wsl--seq-tools", name: "序列小工具", path: "/home/demo/seq-tools",
      rel_path: "seq-tools", kind: "code", status: "paused", category: "infra",
      one_liner: "FASTA 去重、长度过滤、六框翻译的小脚本",
      story: "日常用的几个一次性脚本，后来攒成一个目录：去重、按长度过滤、六框翻译、统计氨基酸组成。没有测试，也没有 README，靠文件名认。",
      origin: { type: "scratch", from: "日常积累", evidence: "脚本命名" },
      tech: ["python", "biopython"], tags: ["基建", "工具"],
      data: { summary: "不到 1 MB。", in_repo: true, assets: [], total_bytes: 500_000 },
      activity: { last_modified: "2026-07-20T00:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 9, bytes: 500_000 },
      risks: ["无测试无文档"],
      next_steps: ["加一个 README 说明每个脚本干什么"],
      confidence: "low",
      evidence: [{ claim: "9 个脚本，无 README", source: "目录结构" }]
    })
  ],
  loose_assets: [
    { path: "miniconda3", kind: "binary", what: "Python 环境（约 6 GB），不属于研究内容", belongs_to: "", size_bytes: 6_000_000_000, last_modified: "2026-01-01T00:00:00Z", keep: "keep" }
  ],
  cross_project: [],
  gaps: []
};

function write(ws, history) {
  const dir = join(OUT, ws.workspace.id);
  mkdirSync(join(dir, "history"), { recursive: true });
  writeFileSync(join(dir, "latest.json"), JSON.stringify(ws, null, 2) + "\n", "utf8");
  for (const h of history || []) writeFileSync(join(dir, "history", h.run.run_id + ".json"), JSON.stringify(h, null, 2) + "\n", "utf8");
}

write(laptop, [laptopPrev]);
write(server, []);
write(wsl, []);
console.log("✓ examples/workspaces: laptop(+1 history) / lab-server / wsl");

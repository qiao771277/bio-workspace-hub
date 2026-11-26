#!/usr/bin/env node
/**
 * 生成 examples/ 下的示例工作区（三台虚构机器 / 13 个项目 / 两轮历史快照）。
 *
 *   node tools/make-demo.mjs
 *
 * 目的：让 `node tools/build.mjs --demo` 开箱就有一份看得懂的演示数据。
 * 机器名、路径、项目、数据全部虚构，不对应任何真实课题或个人。
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
    extra_roots: [], counts: { projects: 5, loose_assets: 2, files_scanned: 1420, bytes: 3_400_000_000 },
    disk: { total_bytes: 1_000_000_000_000, free_bytes: 180_000_000_000 },
    notes: "示例数据：一台 Windows 笔记本，主要写分析脚本、画图、整理实验记录和文献。"
  },
  projects: [
    P({
      id: "laptop--rnaseq-de", name: "转录组差异分析", path: "C:\\Users\\demo\\projects\\rnaseq-de",
      rel_path: "rnaseq-de", kind: "code", status: "active", category: "rnaseq",
      one_liner: "三批 RNA-seq 的差异分析与火山图",
      story: "DESeq2 的标准流程：读 count 矩阵 → 过滤低表达 → 差异检验 → 出火山图和热图。三个批次各有一份 `config.yaml` 记录分组，最近的批次改了过滤阈值，旧结果没重跑。脚本 `de_v3.R` 是当前版本，v1/v2 留着对照。",
      origin: { type: "scratch", from: "本组数据分析", evidence: "无 .git，脚本 mtime 连续" },
      tech: ["r", "deseq2", "ggplot2"], tags: ["科研", "转录组"],
      entry_points: ["Rscript de_v3.R --config config.yaml"],
      key_files: [{ path: "de_v3.R", why: "当前使用的差异分析脚本" }, { path: "config.yaml", why: "批次与分组配置" }],
      data: { summary: "count 矩阵约 40 MB，本地；原始 fastq 在服务器上。", in_repo: true, assets: [{ path: "counts.tsv", type: "tsv", size_bytes: 41_000_000, note: "基因 × 样本 count 矩阵", sensitive: false }], total_bytes: 41_000_000 },
      activity: { last_modified: "2026-10-28T09:12:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 84, bytes: 320_000_000 },
      relations: [{ type: "depends_on", target: "lab-server--rnaseq-pipeline", note: "count 来自服务器上的比对流程" }],
      risks: ["三批数据参数不一致，结果不能直接合并", "无版本控制"],
      next_steps: ["把三批 config 统一，重跑一遍"],
      confidence: "high",
      evidence: [{ claim: "脚本三版并存", source: "de_v1.R / de_v2.R / de_v3.R" }]
    }),
    P({
      id: "laptop--singlecell-cluster", name: "单细胞聚类调参", path: "C:\\Users\\demo\\projects\\singlecell-cluster",
      rel_path: "singlecell-cluster", kind: "experiment", status: "experiment", category: "singlecell",
      one_liner: "在公开数据集上比较几组聚类分辨率参数",
      story: "拿一份公开的单细胞数据试聚类参数：分辨率从 0.4 到 1.2 各跑一遍，看簇数和 marker 稳定性。结果写在 `compare.md` 里，0.8 看起来最稳。只是方法试验，还没有接自己的数据。",
      origin: { type: "derived", from: "公开数据集 + Seurat 官方流程", evidence: "README 里的数据来源链接" },
      tech: ["r", "seurat"], tags: ["科研", "单细胞", "方法"],
      entry_points: ["Rscript cluster.R --res 0.8"],
      key_files: [{ path: "compare.md", why: "不同分辨率的结果对比" }],
      data: { summary: "公开数据约 1.2 GB，本地缓存；可重下。", in_repo: false, assets: [], total_bytes: 1_200_000_000 },
      activity: { last_modified: "2026-10-15T16:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 42, bytes: 1_200_000_000 },
      risks: ["只是参数试验，没有下游注释"],
      next_steps: ["接自己的数据前先定好 marker 列表"],
      confidence: "medium",
      evidence: [{ claim: "试了 0.4-1.2 五档分辨率", source: "compare.md 表格" }]
    }),
    P({
      id: "laptop--fig2-panel", name: "论文图 2 拼图", path: "C:\\Users\\demo\\projects\\fig2-panel",
      rel_path: "fig2-panel", kind: "doc", status: "active", category: "paper",
      one_liner: "图 2 的四个子图与最终拼版",
      story: "图 2 由四个子图拼成：A 是热图、B 是火山图、C 是箱线图、D 是示意图。前三个从 R 导出 PDF，示意图在 Illustrator 里画，最后在 `fig2.ai` 拼版导出 300 dpi TIFF。投稿要求宽度 180 mm，目前是 190 mm，还要改。",
      origin: { type: "scratch", from: "本组投稿", evidence: "fig2.ai + 子图目录" },
      tech: ["illustrator", "r", "pdf"], tags: ["论文", "图"],
      data: { summary: "约 600 MB 源文件与导出图。", in_repo: true, assets: [], total_bytes: 600_000_000 },
      activity: { last_modified: "2026-10-25T18:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 38, bytes: 600_000_000 },
      risks: ["拼版宽度超投稿要求", "源文件无版本控制"],
      next_steps: ["按 180 mm 重排一次"],
      confidence: "high",
      evidence: [{ claim: "四个子图 + 拼版文件", source: "目录结构" }]
    }),
    P({
      id: "laptop--wetlab-log", name: "湿实验记录与试剂", path: "C:\\Users\\demo\\projects\\wetlab-log",
      rel_path: "wetlab-log", kind: "doc", status: "active", category: "admin",
      one_liner: "实验记录模板、试剂批号和订购清单",
      story: "实验室日常用的记录模板（`template.docx`）、试剂批号登记表（`reagents.xlsx`）和订购清单。试剂表按月份分 sheet，最近一次更新是十月。没有和项目本身关联，属于后勤。",
      origin: { type: "scratch", from: "日常积累", evidence: "模板与登记表" },
      tech: ["word", "excel"], tags: ["行政", "实验"],
      data: { summary: "约 30 MB 文档。", in_repo: true, assets: [], total_bytes: 30_000_000 },
      activity: { last_modified: "2026-11-01T09:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 26, bytes: 30_000_000 },
      risks: ["试剂批号靠手填，容易漏"],
      next_steps: ["把批号登记改成扫码/下拉"],
      confidence: "high",
      evidence: [{ claim: "模板 + 试剂表", source: "目录结构" }]
    }),
    P({
      id: "laptop--reading-notes", name: "文献阅读笔记", path: "C:\\Users\\demo\\projects\\reading-notes",
      rel_path: "reading-notes", kind: "doc", status: "active", category: "learning",
      one_liner: "按主题整理的论文笔记与 PDF",
      story: "按主题分文件夹的论文笔记，每篇一个 md：一句话结论、方法要点、能不能用到自己课题。PDF 也放在一起，命名是「年份_期刊_关键词」。最近三个月只记了六篇。",
      origin: { type: "imported", from: "日常阅读", evidence: "目录结构" },
      tech: ["markdown", "pdf"], tags: ["学习", "文献"],
      data: { summary: "约 800 MB PDF 与笔记。", in_repo: true, assets: [], total_bytes: 800_000_000 },
      activity: { last_modified: "2026-10-30T21:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 132, bytes: 800_000_000 },
      risks: ["笔记和 PDF 混放，找起来慢"],
      next_steps: ["给每篇加统一 front-matter，方便检索"],
      confidence: "medium",
      evidence: [{ claim: "按主题分目录", source: "目录结构" }]
    })
  ],
  loose_assets: [
    { path: "meeting-notes.md", kind: "document", what: "组会记录的零散笔记，未归入任何项目", belongs_to: "", size_bytes: 24_000, last_modified: "2026-10-29T00:00:00Z", keep: "review" },
    { path: "old_de.R", kind: "script", what: "早期差异分析脚本，已被 de_v3.R 取代", belongs_to: "laptop--rnaseq-de", size_bytes: 6_000, last_modified: "2026-05-12T00:00:00Z", keep: "delete" }
  ],
  cross_project: [],
  gaps: [
    { severity: "medium", about: "laptop--rnaseq-de", text: "三个批次的过滤阈值不一致，合并前要先统一。" },
    { severity: "low", about: "laptop--fig2-panel", text: "拼版宽度 190 mm，超过投稿要求的 180 mm。" }
  ]
};

const laptopPrev = JSON.parse(JSON.stringify(laptop));
laptopPrev.run = { run_id: "2026-10-20T09-00-00Z", started_at: "2026-10-20T08:45:00Z", finished_at: "2026-10-20T09:00:00Z", tool: "opencode", model: "demo", mode: "full", budget_cut: false, previous_run_id: null };
laptopPrev.projects = laptopPrev.projects.filter(p => p.id !== "laptop--fig2-panel" && p.id !== "laptop--wetlab-log");
laptopPrev.projects.find(p => p.id === "laptop--singlecell-cluster").status = "active";

const server = {
  schema_version: "1.0",
  run: { run_id: "2026-11-01T20-00-00Z", started_at: "2026-11-01T19:40:00Z", finished_at: "2026-11-01T20:00:00Z", tool: "opencode", model: "demo", mode: "full", budget_cut: false, previous_run_id: null },
  workspace: {
    id: "lab-server", label: "实验室服务器 · Linux", machine: "demo-server", os: "linux",
    root: "/home/demo/work", root_display: "/home/demo/work",
    extra_roots: ["/data/scratch"], counts: { projects: 5, loose_assets: 1, files_scanned: 48000, bytes: 1_800_000_000_000 },
    disk: { total_bytes: 8_000_000_000_000, free_bytes: 900_000_000_000 },
    notes: "示例数据：一台 Linux 计算服务器，跑批量比对、变异检测和公共数据下载；磁盘常年在 90% 以上。"
  },
  projects: [
    P({
      id: "lab-server--rnaseq-pipeline", name: "批量 RNA-seq 流程", path: "/home/demo/work/rnaseq",
      rel_path: "rnaseq", kind: "code", status: "active", category: "rnaseq",
      one_liner: "从 fastq 到 count 矩阵的 Snakemake 流程",
      story: "Snakemake 写的批量流程：质控 → 去接头 → STAR 比对 → featureCounts。规则在 `Snakefile`，每个样本的配置在 `samples.tsv`。支持断点续跑，最近把比对索引换成了新版本，旧结果还在。",
      origin: { type: "scratch", from: "本组自建", evidence: "Snakefile + 运行日志" },
      tech: ["snakemake", "star", "fastqc", "shell"], tags: ["科研", "转录组", "流程"],
      entry_points: ["snakemake -j 16"],
      key_files: [{ path: "Snakefile", why: "流程主体" }, { path: "samples.tsv", why: "样本与分组" }],
      data: { summary: "比对结果约 1.2 TB，在 /data/scratch；原始 fastq 在测序公司交付盘。", in_repo: false, assets: [{ path: "/data/scratch/rnaseq/bam", type: "binary", size_bytes: 1_200_000_000_000, note: "比对结果", sensitive: false }], total_bytes: 1_200_000_000_000 },
      activity: { last_modified: "2026-11-01T12:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 3200, bytes: 1_400_000_000_000 },
      relations: [{ type: "shares_data_with", target: "laptop--rnaseq-de", note: "count 矩阵交给笔记本做差异分析" }],
      risks: ["/data/scratch 没有备份", "索引升级后旧结果未重跑"],
      next_steps: ["用新索引把旧样本重跑一遍"],
      confidence: "high",
      evidence: [{ claim: "Snakemake 四步流程", source: "Snakefile 的 rule 定义" }]
    }),
    P({
      id: "lab-server--variant-calling", name: "外显子变异检测", path: "/home/demo/work/wes-variants",
      rel_path: "wes-variants", kind: "code", status: "active", category: "genomics",
      one_liner: "WES 数据的 GATK 最佳实践流程",
      story: "按 GATK 最佳实践搭的流程：BWA → markdup → BQSR → HaplotypeCaller → 过滤。样本 24 个，跑完一轮约 18 小时。`filter.sh` 里的硬过滤阈值是按文献抄的，还没用自己的数据调。",
      origin: { type: "derived", from: "GATK 官方流程", evidence: "README 里的流程链接" },
      tech: ["gatk", "bwa", "shell"], tags: ["科研", "基因组"],
      entry_points: ["bash run.sh --sample S01"],
      key_files: [{ path: "filter.sh", why: "硬过滤阈值" }],
      data: { summary: "vcf 与 bam 约 380 GB，在 /data/scratch。", in_repo: false, assets: [], total_bytes: 380_000_000_000 },
      activity: { last_modified: "2026-10-30T08:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 890, bytes: 380_000_000_000 },
      relations: [{ type: "depends_on", target: "lab-server--ref-db", note: "用 ref/ 下的参考基因组与已知位点" }],
      risks: ["过滤阈值照抄文献", "只在 24 个样本上跑过"],
      next_steps: ["用已知真阳性的样本评估过滤阈值"],
      confidence: "medium",
      evidence: [{ claim: "五步 GATK 流程", source: "run.sh 与日志" }]
    }),
    P({
      id: "lab-server--ref-db", name: "参考基因组与注释镜像", path: "/home/demo/work/ref",
      rel_path: "ref", kind: "data", status: "paused", category: "data",
      one_liner: "常用物种的参考序列、注释与预建索引",
      story: "三个人/鼠/模式的参考基因组，每个目录下统一放 fasta、gtf、BWA 与 STAR 索引。`manifest.tsv` 记录版本与下载日期。索引是别人建好拷过来的，具体参数没留。",
      origin: { type: "imported", from: "Ensembl / UCSC", evidence: "manifest.tsv" },
      tech: ["fasta", "star", "bwa"], tags: ["数据", "参考库"],
      data: { summary: "约 300 GB，本地；可重下但索引重建很慢。", in_repo: false, assets: [], total_bytes: 300_000_000_000 },
      activity: { last_modified: "2026-09-12T00:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 61, bytes: 300_000_000_000 },
      relations: [{ type: "shares_data_with", target: "lab-server--variant-calling", note: "变异检测用它的人参考" }],
      risks: ["索引参数没记录", "版本升级要重建"],
      next_steps: ["把每个索引的构建命令写进 manifest"],
      confidence: "medium",
      evidence: [{ claim: "三个物种 + manifest", source: "ref/ 目录结构" }]
    }),
    P({
      id: "lab-server--public-data", name: "公共数据下载清单", path: "/home/demo/work/public-data",
      rel_path: "public-data", kind: "data", status: "paused", category: "data",
      one_liner: "下载的公共组学数据集与用途登记",
      story: "按项目号分目录存公共数据，根目录 `manifest.tsv` 记录来源、体积、下载日期和用途。最近一次下载是两个月前，manifest 有一半没填用途。",
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
      id: "lab-server--slurm-templates", name: "集群作业模板", path: "/home/demo/work/slurm-templates",
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
    { path: "/data/scratch/tmp", kind: "dataset", what: "跑完没清的中转目录，约 60 GB", belongs_to: "lab-server--rnaseq-pipeline", size_bytes: 60_000_000_000, last_modified: "2026-10-31T00:00:00Z", keep: "review" }
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
    notes: "示例数据：和笔记本同一台机器的 WSL2 发行版，放命令行工具和小规模批处理。"
  },
  projects: [
    P({
      id: "wsl--tools-env", name: "生信工具环境记录", path: "/home/demo/tools-env",
      rel_path: "tools-env", kind: "infra", status: "active", category: "infra",
      one_liner: "conda 环境清单与工具安装笔记",
      story: "记录这台 WSL 装了什么：几个 conda 环境（`envs/*.yml` 导出）、常用命令行工具的版本、以及踩过的坑（比如某个工具必须用旧版 glibc）。换机器时按这个目录重建。",
      origin: { type: "scratch", from: "日常积累", evidence: "envs/*.yml" },
      tech: ["conda", "shell"], tags: ["基建", "环境"],
      entry_points: ["conda env create -f envs/main.yml"],
      key_files: [{ path: "envs/main.yml", why: "主环境导出" }, { path: "notes.md", why: "安装踩坑记录" }],
      data: { summary: "不到 10 MB。", in_repo: true, assets: [], total_bytes: 10_000_000 },
      activity: { last_modified: "2026-10-18T00:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 22, bytes: 10_000_000 },
      risks: ["部分工具是手工编译的，yml 里没有"],
      next_steps: ["把手工编译的步骤补进 notes.md"],
      confidence: "high",
      evidence: [{ claim: "环境导出 + 笔记", source: "envs/ 与 notes.md" }]
    }),
    P({
      id: "wsl--fastq-tools", name: "fastq 小工具集", path: "/home/demo/fastq-tools",
      rel_path: "fastq-tools", kind: "code", status: "paused", category: "methods",
      one_liner: "抽样、拆分、算长度分布的一次性脚本",
      story: "日常用的几个小脚本：按比例抽样、按 barcode 拆分、统计读长分布、转 fasta。后来攒成一个目录，没有测试也没有 README，靠文件名认。",
      origin: { type: "scratch", from: "日常积累", evidence: "脚本命名" },
      tech: ["python", "seqkit"], tags: ["工具", "fastq"],
      data: { summary: "不到 1 MB。", in_repo: true, assets: [], total_bytes: 500_000 },
      activity: { last_modified: "2026-07-20T00:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 9, bytes: 500_000 },
      risks: ["无测试无文档"],
      next_steps: ["加一个 README 说明每个脚本干什么"],
      confidence: "low",
      evidence: [{ claim: "9 个脚本，无 README", source: "目录结构" }]
    }),
    P({
      id: "wsl--qc-report", name: "质控报告汇总", path: "/home/demo/qc-report",
      rel_path: "qc-report", kind: "experiment", status: "active", category: "methods",
      one_liner: "把每批样本的 FastQC 结果汇总成一张表",
      story: "每批测序跑完，把 FastQC 的 html/json 收集起来，用脚本抽成一张表（读长、Q30、GC、重复率），再画趋势图。表在 `qc_summary.tsv`，图和脚本各一份。",
      origin: { type: "scratch", from: "本组质控", evidence: "qc_summary.tsv" },
      tech: ["python", "multiqc"], tags: ["质控", "流程"],
      entry_points: ["python collect.py --dir ../qc"],
      key_files: [{ path: "qc_summary.tsv", why: "历次质控汇总" }],
      data: { summary: "汇总表 2 MB，原始 FastQC 报告不保留。", in_repo: true, assets: [{ path: "qc_summary.tsv", type: "tsv", size_bytes: 2_000_000, note: "质控指标汇总", sensitive: false }], total_bytes: 2_000_000 },
      activity: { last_modified: "2026-10-29T00:00:00Z", last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
      size: { files: 18, bytes: 2_000_000 },
      relations: [{ type: "depends_on", target: "lab-server--rnaseq-pipeline", note: "质控对象是流程的输入样本" }],
      risks: ["原始 FastQC 报告没留，无法复查"],
      next_steps: ["保留每批的 json 原始报告"],
      confidence: "medium",
      evidence: [{ claim: "汇总表 + 收集脚本", source: "目录结构" }]
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

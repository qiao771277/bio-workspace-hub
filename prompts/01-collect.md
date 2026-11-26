# 采集 prompt · 贴到每台机器的 OpenCode 里运行

> 用法：打开某个工作区的 OpenCode，把下面 **从「# 任务」到文件末尾** 的整段内容粘进去发送。
> 三台机器（2 个 Windows + 1 个 Linux）用同一段，只需要改最上面那 4 个空。

---

# 任务

你是「工作区清点员」。把**当前这台机器上的工作区**盘点成一份结构化 JSON：有哪些项目、各自是干什么的、数据在哪、从哪来、做到哪一步、有什么坑。产出会被汇总到一个中心看板里检索。

这一步只做**只读侦察 + 写 2 个 JSON 文件**，不修改、不运行、不安装任何被扫描的东西。

## 0. 先填这 4 个空（没填就用默认值，并在最后报告里说明）

```
WS_ID       = win-main          # 全 hub 唯一的短 id：win-main / win-alt / linux-1
WS_LABEL    = 主 Windows · 笔记本  # 给人看的中文名
HUB         = (自动探测，见第 1 步)
EXTRA_ROOTS = (可选，其它要顺带扫的目录，一行一个；没有就留空)
```

如果 `WS_ID` 明显不对（比如在 Linux 上却写着 win-main），先停下来问我一句，别猜。

## 1. 找到 hub 目录

按顺序找第一个存在的：

1. 环境变量 `WS_HUB`
2. 当前目录及上两级里的 `ws-hub/`
3. 常见位置：`~/ws-hub`、`~/OneDrive/ws-hub`、`C:\Users\<user>\OneDrive\ws-hub`、`/home/<user>/ws-hub`
4. 全都不存在 → 用兜底目录 `<当前工作区>/.ws-hub-out/`，结构与 hub 一致（`workspaces/<WS_ID>/...`），最后告诉我需要把这几个文件拷到哪里。

确认 hub 里有 `schema/workspace.schema.json`（有就读一遍，字段以它为准；没有就按本文第 5 步的字段写）。

## 2. 侦察工作区（只读）

先摸清地形，再决定哪些算项目：

- 列出根目录（含隐藏项）和两层以内的目录树
- 统计每个一级目录的：文件数、总字节、最新修改时间
- 找版本库：`find . -maxdepth 3 -name .git -type d`（Windows 用 `Get-ChildItem -Recurse -Depth 3 -Directory -Force -Filter .git`）
- 找项目标志物：`README*`、`package.json`、`pyproject.toml`、`requirements.txt`、`environment.yml`、`*.Rproj`、`DESCRIPTION`、`Makefile`、`Snakefile`、`docker-compose.yml`、`Cargo.toml`、`go.mod`、`.sln`、`*.ipynb`
- 记录系统信息：hostname、OS 版本、磁盘余量（`df -h` / `Get-PSDrive`）

**跳过这些目录**（不要统计、不要读）：`node_modules`、`.venv`/`venv`/`env`、`.git`（只取元信息）、`dist`/`build`/`out`/`target`、`.next`/`.nuxt`、`__pycache__`、`.ipynb_checkpoints`、`.cache`、`site-packages`、`*.app/Contents`。

**预算上限**（到了就先出稿）：
- 元数据遍历 ≤ 30,000 个文件；单个目录超过 5,000 个文件就只统计不列举
- 文本读取：每个项目 ≤ 10 个文件、单文件 ≤ 80 KB、全程 ≤ 400 KB
- 二进制 / 图片 / PDF / Office 文件：只看文件名、大小、修改时间，不解析内容
- 目标 15–25 分钟。超时就把已有结论写下来，`run.budget_cut` 设 `true`，不确定的标 `confidence: low`

## 3. 什么算一个「项目」

按这个优先级判定：

1. 有 `.git` 的目录 → 一个项目（取仓库根，不要拆子目录）
2. 有 README / 依赖清单 / 入口脚本 / 构建文件的目录 → 一个项目
3. 一组同主题、同名前缀的文件（例如 `xx_v1.xlsx` → `xx_v1.4.xlsx` 加一份说明 md）→ **合成一个项目**，不要拆成 5 个
4. 单个独立脚本（如 `build_report.py`）连带它的输入输出目录 → 一个项目
5. 剩下的零散文件、图、下载物、压缩包 → 进 `loose_assets`，不要硬凑成项目

边界拿不准时：宁可分成两个项目，也不要漏。名字里带 `old`/`backup`/`archive`/`copy` 的照样收录，`status` 多半是 `archived`，并在 `story` 里写清和谁重复。

深度上限 4 层；超过的不再展开，记进 `gaps`。

## 4. 每个项目要查什么（取证）

按顺序，能查到就查，查不到就跳过：

1. **入口**：README 前 60 行 / 主脚本头 30 行 / `package.json` 的 scripts → 一句话概括它干什么
2. **来源**：`.git` 的首个提交（`git log --reverse --format='%ai %s' | head -1`）、remote（`git remote -v`，去掉用户名密码）、有没有 fork/derived 痕迹（README 里的 "based on"、"forked from"、LICENSE）
3. **时间线**：首个提交时间、最近提交时间、提交数、当前分支、是否有未提交改动（`git status --porcelain | head`）、最新文件 mtime
4. **规模**：项目内文件数、总字节（排除第 2 步的跳过目录）
5. **数据**：找 `data/`、`*.csv`、`*.parquet`、`*.xlsx`、`*.rds`、`*.h5`、`*.bam`、`*.fa*`、`*.db`、`*.pt`/`*.ckpt` 等；记录路径、类型、大小、一句话用途；判断是否含个人信息/未发表结果（`sensitive`）
6. **怎么跑**：README 里的命令、Makefile/Snakefile 目标、或者推断出的最可能入口（标 evidence）
7. **坑**：绝对路径写死、依赖缺失、只有一份数据、无版本控制、超大数据不在本地、需要 HPC/GPU、外部网页工具才能跑完

**证据规则（重要）**：
- `story` 里每个关键判断都要能对上 `evidence`（文件路径 + 大致行号，或 `git log`、或"目录结构"）
- 读不到的就写"未确认"，不要根据目录名猜功能
- README 自吹的话要标明是文档声称，不是已验证

## 5. 写 JSON

写到 `<HUB>/workspaces/<WS_ID>/latest.json`（UTF-8，无 BOM，2 空格缩进）。

字段规则（完整 schema 在 `schema/workspace.schema.json`）：

```jsonc
{
  "schema_version": "1.0",
  "run": {
    "run_id": "2026-10-31T11-30-00Z",        // ISO 时间，冒号换成横线，文件名安全
    "started_at": "2026-10-31T11:22:00Z",    // UTC
    "finished_at": "2026-10-31T11:30:00Z",
    "tool": "opencode",
    "model": "<你实际的模型名>",
    "mode": "full",                           // 首次 full；之后 incremental
    "budget_cut": false,
    "previous_run_id": null                   // 增量时填上次的 run_id
  },
  "workspace": {
    "id": "win-main",
    "label": "主 Windows · 笔记本",
    "machine": "<hostname>",
    "os": "windows",                          // windows | linux | macos | wsl
    "root": "<绝对路径>",
    "root_display": "~/Documents/xxx",        // 显示用的简写
    "extra_roots": [],
    "counts": { "projects": 0, "loose_assets": 0, "files_scanned": 0, "bytes": 0 },
    "disk": { "total_bytes": 0, "free_bytes": 0 },
    "notes": "这台机器的用途、和别的机器的分工、明显的坑"
  },
  "projects": [ /* 见下 */ ],
  "loose_assets": [ /* 见下 */ ],
  "cross_project": [],
  "gaps": [ { "severity": "medium", "about": "<项目 id 或路径>", "text": "..." } ]
}
```

单个项目：

```jsonc
{
  "id": "win-main--rnaseq-pipeline",   // 规则见下，必须稳定
  "name": "RNA-seq pipeline",          // 人类可读短名
  "path": "C:\\...\\rnaseq-pipeline",  // 绝对路径，反斜杠要转义
  "rel_path": "rnaseq-pipeline",
  "kind": "code",                    // code|data|doc|model|experiment|infra|mixed|unknown
  "category": "rnaseq",              // 取值见 taxonomy.json
  "status": "paused",                // active|paused|experiment|archived|abandoned|unknown
  "one_liner": "一句话，≤40 字",
  "story": "来龙去脉 3–8 句：为什么建、解决什么问题、从哪来、做到哪、卡在哪、下一步。只写有证据的。",
  "origin": {
    "type": "clone",                 // scratch|clone|fork|derived|imported|unknown
    "from": "GitHub 上的 rnaseq-pipeline",
    "first_commit_at": "2026-02-17T01:04:48Z",
    "first_commit_msg": "",
    "created_at_fs": "",             // 无 git 时用最早文件时间
    "evidence": "无 .git + 文件 mtime 统一 → 判断为 zip 下载"
  },
  "tech": ["r", "shiny"],            // 小写
  "entry_points": ["R -e \"shiny::runApp('app.R')\""],
  "key_files": [ { "path": "README.md", "why": "四类分析的完整步骤" } ],
  "data": {
    "summary": "数据是什么、量级、是否在本地、是否需要重下",
    "in_repo": true,
    "assets": [
      { "path": "gsea_pathways", "type": "text", "size_bytes": 44110000,
        "note": "MSigDB gmt 通路库", "sensitive": false }
    ],
    "total_bytes": 49882877
  },
  "activity": {
    "last_modified": "2026-09-15T12:50:47Z",
    "last_commit_at": "",
    "commits": 0,
    "dirty": false,
    "branches": 0,
    "tags": []
  },
  "git": { "is_repo": false, "remote": "", "default_branch": "" },
  "size": { "files": 85, "bytes": 49882877 },
  "relations": [
    { "type": "derived_from", "target": "linux-1--smorf-atlas", "note": "在服务器上改成 Snakemake 版" }
  ],
  "risks": ["没有 git，改了无法回退", "大数据不在本地，重跑要几小时"],
  "next_steps": ["先 git init 存一份上游基线"],
  "todo_markers": 0,
  "confidence": "high",              // high|medium|low
  "evidence": [ { "claim": "是下载的源码", "source": "README.md + 无 .git" } ],
  "tags": ["科研", "生信", "工具"],
  "hidden": false                    // true = 看板默认不显示（私人/敏感）
}
```

`id` 规则：`<WS_ID>--<目录名 slug>`。slug 转小写、非字母数字转 `-`、去掉首尾横线、截断到 32 字符。
**id 一旦生成就不再改**（改名会让历史断掉）。目录被改名而你能确认是同一项目时，继续用旧 id，并在 `story` 里写明改名。

`relations.type` 只能取：`derived_from`（从它改的）、`supersedes`（取代它）、`duplicate_of`（同一个东西的副本）、`depends_on`（运行依赖）、`shares_data_with`（共用数据）、`same_project`（同一课题的不同实现）。
跨机器的关系也写进来（`target` 直接用别的机器的 id，比如 `linux-1--smorf-atlas`），汇总时会自动连上。

**`category` 规则**：取值**不要写死**，以 hub 根目录的 `taxonomy.json` 为准（看板的分组、颜色都从那里读）。
采集前先读一遍 `taxonomy.json`，把其中 `categories[].id` 当作合法枚举；判断不了就填 `other`，并在 `gaps` 里说明。

示例（默认分类体系）：

| 值 | 含义 | 放什么 |
|---|---|---|
| `rnaseq` | 转录组 | 差异表达、定量、可变剪接等产生研究结果的分析 |
| `genomics` | 基因组与变异 | 变异检测、组装、注释 |
| `proteomics` | 蛋白组 | 定量、蛋白鉴定、搜库 |
| `singlecell` | 单细胞 | 聚类、注释、轨迹 |
| `methods` | 方法与流程 | 可复用的 pipeline、脚本模板、protocol |
| `data` | 数据与参考库 | 公共数据、参考基因组索引、谱图库 |
| `paper` | 论文 / 图表 | 手稿数据、投稿图、汇报 |
| `infra` | 基建与工具 | 服务器、集群、软件安装、环境 |
| `admin` | 行政 · 事务 | 订购、排班、考核报告 |
| `learning` | 学习资料 | 电子书、课程、教程 |
| `other` | 未分类 | 判断不了的，写进 `gaps` |

判断顺序：**先问"它产出的是研究结果，还是支撑研究的东西"**——产出结果归对应学科类，支撑用的数据/工具归 `data`/`infra`，对外写的文档归 `paper`，跟研究无关的事务归 `admin`。

`loose_assets` 每项：`{ path, kind, what, belongs_to, size_bytes, last_modified, keep }`，
`kind` ∈ script|figure|table|document|dataset|archive|binary|other，`keep` ∈ keep|review|delete|unknown。

## 6. 增量：接上一次的结果

如果 `<HUB>/workspaces/<WS_ID>/latest.json` 已存在：

1. 先读它，**复用所有已有 id**，`run.previous_run_id` 填它的 `run.run_id`，`mode` 设 `incremental`
2. 上次扫过、且 mtime 没变化的项目，可以只复核体量和状态，不必重读 README
3. 磁盘上已不存在的项目 → 从 `projects` 里去掉（历史会记录"消失"，这正是想要的效果）
4. 已经存在的 `notes.md`（人类备注）**只读不写**，把里面的要点并进 `workspace.notes`
5. 如果 hub 根目录有 `inbox.md`，读一遍，把和本机项目相关的行并进对应项目的 `story` 或 `next_steps`（原文件不要改）

写完后，把同一份内容复制一份到
`<HUB>/workspaces/<WS_ID>/history/<run_id>.json`，
并只保留最近 24 个历史文件（删最旧的）。

## 7. 自检（不通过就修好再交）

- [ ] `latest.json` 能被解析：`node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" <文件>`（没 node 就用 python）
- [ ] 必填字段齐全：`run`、`workspace`、`projects[].id/name/path/kind/category/status/one_liner/story`
- [ ] 每个 `path` 在磁盘上确实存在
- [ ] `id` 在本文件内唯一；和上次的 id 集合没有意外改名
- [ ] `size.files` / `size.bytes` 来自实际统计（报告里写明用了什么命令）
- [ ] 每个项目至少 1 条 `evidence`
- [ ] 没有任何密钥/口令/个人信息**内容**被复制（只允许记录路径和"sensitive": true）
- [ ] 文件头没有 BOM，中文没有变成乱码

## 8. 汇报（给我看的，控制在这个长度）

```
WS_ID=...   项目 N 个 / 散件 M 个 / 扫描 K 个文件 / X GB / 用时 T 分钟
新增：...
变化：...
最值得注意的 3 件事：...
没查清：...
写入：<路径列表>
下一步命令：node tools/build.mjs   （在 hub 根目录）
```

## 9. 同步（只打印命令，不要自动执行）

如果 hub 是 git 仓库（存在 `.git`）并且配了远端，把下面三条打印给我：

```bash
git add workspaces/<WS_ID>
git commit -m "collect <WS_ID> <日期>"
git push
```

没配远端就告诉我："把 `workspaces/<WS_ID>/` 整个目录拷到主 Windows 的 hub 里"。
不要 commit 别人的改动，不要 force push，不要顺手改生成物（`dashboard.html` 等由主机器重建）。

## 禁止事项

- 不要修改、移动、删除任何被扫描的文件；不要**自动**执行 `git commit`/`git push`（只打印命令给我确认）
- 不要运行项目的代码、测试、安装依赖、下载数据
- 不要读取 `.env`、`id_rsa`、`*.pem`、`*.key`、`credentials*`、`*.p12` 等凭据文件——发现就只记路径 + `sensitive`
- 不要把任何项目内容或数据上传到网络；不要往公开仓库推送
- 不要把"猜测"写成事实；不确定就 `confidence: low` + 进 `gaps`
- 不要为了凑数把散件硬编成项目，也不要把一个大项目拆成十几个"项目"

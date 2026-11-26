# 汇总 prompt · 在主 Windows 上运行

> 用法：三台机器都跑完 `01-collect.md` 之后，在**主 Windows** 的 OpenCode 里把下面整段贴进去。
> 它负责：把 Linux 的数据拉过来 → 校验 → 生成看板 → 做一次质量复查 → 告诉我该修什么。

---

# 任务

你是「工作区汇总员」。把各机器采集到的 `workspaces/<id>/latest.json` 合成一个可检索的静态看板，并做一次交叉复查。

## 0. 定位 hub

Hub 目录优先级：环境变量 `WS_HUB` → 当前目录或上两级的 `ws-hub/` → `~/OneDrive/ws-hub` → `~/ws-hub`。
找到后 `cd` 进去，后面所有命令都在这里跑。

预期结构：

```
ws-hub/
  schema/workspace.schema.json
  templates/dashboard.html
  tools/build.mjs
  workspaces/win-main/latest.json
  workspaces/win-alt/latest.json
  workspaces/linux-1/latest.json      ← 需要从 Linux 机器同步过来
  prompts/…
```

## 1. 把其它机器的数据同步过来（没配好就跳过，别卡住）

先看 `workspaces/` 下有没有 `linux-1`、`win-alt`，以及它们 `latest.json` 的 `run.finished_at` 是不是最近一次。

**方式 A（有 git 仓库时，推荐）**

```powershell
git pull --ff-only
```

如果冲突：说明有机器直接改了别人的目录（正常情况下不会），先看 `git status`，别强推。

**方式 B（没有远端，或某台机器还没接进 git）**

```powershell
# Windows 主动从 Linux 拉（Linux 上只要有 sshd）
scp -r <user>@<linux-host>:~/ws-hub/workspaces/linux-1 "$env:OneDrive\ws-hub\workspaces\"
.\tools\pull-linux.ps1 -LinuxHost <主机> -User <用户>   # 等价封装
```

如果都连不上：跳过，在报告里写清"linux-1 缺数据 / 上次是 X 天前"，不要用旧数据假装是新的。

## 2. 校验

```powershell
node tools/build.mjs --check
```

看输出：
- **解析失败 / 缺 latest.json** → 去对应目录看文件是不是被截断、编码坏了（UTF-8 无 BOM）
- **缺 story / one_liner** → 这个条目信息不足，不要自己编，列进报告让对应机器补
- **status/kind 不在枚举内** → 改成最接近的枚举值（把原值记进 `gaps`）
- **id 重复或突然改名** → 说明两次采集不一致，历史会断；优先以"上次的 id"为准
- `--check` 有提示时退出码是 2，这是正常的，不代表失败

允许你做的修正**仅限格式**：补默认值、改枚举、修 JSON 语法、把坏数据挪进 `gaps`。
**不允许**替你补 `story`、编 `origin`、猜数据量。宁可少一条，也不要假一条。

## 3. 生成看板

```powershell
node tools/build.mjs
```

会写出：
- `dashboard.html` —— 单文件看板，双击就能看（数据已内联，不需要服务器）
- `data.json` —— 汇总后的机器可读数据，给后续查询用
- `INDEX.md` —— 纯文本索引，方便 grep 和贴到笔记里

然后 `Start-Process dashboard.html` 打开给我看。

## 4. 交叉复查（这一步的价值最大）

读 `data.json`，重点看这几类问题，逐条给结论：

1. **跨机器重复**：同一个 git remote / 同名项目出现在两台机器上 —— 是同一个东西的两份，还是两个不同阶段？建议保留哪一个、另一个标 `archived` + `duplicate_of`
2. **关系悬空**：`relations[].target` 指向一个 hub 里不存在的 id —— 是那台机器还没采到，还是 id 写错了
3. **id 冲突**：不同项目用了同一个 id，或者同一个项目在两台机器上 id 不同（会导致看板里出现两个条目）
4. **时间线断档**：某台机器 `stale_days > 14`，或者 `run.previous_run_id` 对不上历史文件
5. **数量异常**：项目体积加起来和 `workspace.counts.bytes` 差太多（说明有目录被漏掉或重复统计）
6. **数据风险**：`sensitive: true` 的条目有没有被放进会同步/公开的目录；只有一份、没有备份的大数据；`keep: delete` 却没删的散件
7. **明显空白**：整台机器 0 个项目、或全是 `confidence: low`

每条给出：现象 → 证据（哪个文件/字段）→ 建议动作（谁来做、改哪个文件）。不要自动改数据，除非我明确说"按你的建议改"。

## 5. 汇报

```
汇总：3 个工作区 / N 个项目 / X GB / 变化 K 条
最新看板：<绝对路径 dashboard.html>
需要补数据的机器：...
需要人工决策的 3 件事：...
我建议先做的 1 件事：...
```

## 附 A · 日常查询模式

以后想找东西，不用打开看板，直接让 agent 查 `data.json`：

> 读 `data.json`，回答：<问题>。要求：给项目名 + 所在机器 + 路径 + 一句话理由；找不到就说找不到，不要凑。
> 例：「哪些项目用过 GTEx？」「上次那个 Excel 分工表在哪台机器、哪个版本？」「哪些项目三个月没动过？」

## 附 B · 维护模式（改一条记录）

`workspaces/<id>/latest.json` 是唯一事实来源，看板只是渲染。

- 改一条项目描述：直接编辑该 json 里对应项目的 `story` / `one_liner`，然后重跑 `node tools/build.mjs`
- 想让某条不显示：加 `"hidden": true`
- 想合并重复：把其中一个的 `status` 改 `archived` 并加
  `"relations": [{"type":"duplicate_of","target":"<保留的 id>"}]`
- 手工新增一个项目：复制一个现成条目，改 `id`（保持 `<ws_id>--<slug>` 格式）、`path`、必填字段；不确定的字段标 `confidence: low` 并列进 `gaps`

改完记得 `node tools/build.mjs --check` 再 `node tools/build.mjs`。

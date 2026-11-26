# 贡献指南 · Contributing

感谢你愿意参与。这个仓库有两个身份：**一个可以公开复用的工具**，和维护者自己的**私有工作区实例**。
下面先说清楚两者的关系，再给出日常改动、同步和发布检查的流程。

---

## 1. 两个仓库的关系

| | 私有仓库（维护者自己） | 公开仓库（本仓库） |
|---|---|---|
| 内容 | 真实采集数据 `workspaces/`、`data.json`、`dashboard.html` | 只有工具、模板、schema、prompt 和**虚构示例** |
| 历史 | 每次采集一个提交 | 只有功能提交 |
| 同步方向 | → 单向复制工具文件到公开仓库 | ← 不回流 |

**永远不要把私有仓库的 `git remote` 指到公开仓库**，也不要 `git push --mirror`。
公开版是用「复制文件 + 重新生成示例」的方式做出来的，不从私有历史里切分支。

公开仓库里被 `.gitignore` 挡住的路径（不要强行 `git add -f`）：

```
workspaces/      # 真实采集结果
data.json        # 汇总产物（含真实路径）
dashboard.html   # 真实看板
INDEX.md
decisions.json
serve.config.json
```

---

## 2. 目录约定

```
prompts/    给 AI 的采集 / 汇总 prompt（改这里等于改采集行为）
schema/     latest.json 的数据契约
templates/  看板前端（单文件，原生 JS，无构建）
tools/      build.mjs（汇总+生成）、serve.mjs（本地服务）、make-demo.mjs（示例数据）
examples/   示例工作区（虚构）
taxonomy.json  分类体系
```

---

## 3. 日常改动

```bash
# 改完模板或工具后
node tools/build.mjs --demo      # 用示例数据构建，检查渲染
node tools/make-demo.mjs         # 如果改了示例数据本身
npm run serve                    # 本地起服务，手动点一遍（编辑/新建/删除要试）
```

改动 `templates/dashboard.html` 时注意：

- 只读模式（`file://`）不能依赖任何网络请求；所有编辑控件必须在 `EDIT === false` 时隐藏
- 新增字段时，同时更新 `schema/workspace.schema.json`、`tools/build.mjs` 的默认值、`prompts/01-collect.md` 的字段说明
- 新增**分类**只改 `taxonomy.json`，不要动模板；`id` 一旦发布就不要再改

---

## 4. 从私有版同步到公开版

维护者的固定流程（5 步）：

**① 复制工具文件**（不含数据）

```powershell
$src = "D:\work\ws-hub"          # 私有仓库
$dst = "D:\work\bio-workspace-hub"  # 公开仓库

Copy-Item "$src\tools\*.mjs","$src\tools\*.ps1","$src\tools\*.ico" "$dst\tools\" -Force
Copy-Item "$src\templates\dashboard.html" "$dst\templates\" -Force
Copy-Item "$src\schema\workspace.schema.json" "$dst\schema\" -Force
Copy-Item "$src\prompts\*.md" "$dst\prompts\" -Force
Copy-Item "$src\taxonomy.json" "$dst\" -Force
```

> `README.md` 和 `examples/` **不要直接复制**：README 是公开版专用文案，示例必须是虚构数据。

**② 重新生成示例看板**

```powershell
cd $dst
node tools/make-demo.mjs
node tools/build.mjs --demo
```

**③ 泄漏扫描**（这一步不能省）

```powershell
$paths = Get-ChildItem . -Recurse -File -Include *.md,*.mjs,*.json,*.ps1,*.html |
         ForEach-Object { $_.FullName }
$pats = @('你的用户名','C:\Users\你的名字','D:\你的目录','你的主机名','同事名字',
          '公司/实验室名','未发表项目关键词','token','password')
foreach ($p in $pats) {
  $h = Select-String -Path $paths -Pattern $p -SimpleMatch -ErrorAction SilentlyContinue
  if ($h) { "$p -> $($h.Count) 处"; $h | Select-Object -First 3 }
}
```

同时在 GitHub 网页上确认：仓库 Settings → 里没有误提交的 `workspaces/`。

**④ 构建一次真实数据做对比**（可选）

```powershell
node tools/build.mjs            # 用私有 workspaces/ 构建，确认功能没坏
```

**⑤ 提交并推送**

```powershell
git add -A
git status                      # 确认只有预期的文件
git commit -m "sync: <一句话说明改了什么>"
git push
```

---

## 5. 发布前检查清单

- [ ] `npm run demo` 能生成 `dashboard-demo.html`，打开无报错
- [ ] 首页「课题」页签分组正常，点进课题能看到项目/散件/待补/变化
- [ ] 编辑模式（`npm run serve`）下：改状态、改字段、新建、删除都能生效
- [ ] `git status` 里没有 `workspaces/`、`data.json`、`dashboard.html`
- [ ] 泄漏扫描 0 命中
- [ ] README 的截图（`docs/screenshot.jpg`）是最新的
- [ ] 首次使用路径（clone → demo）跑通

---

## 6. 提交信息

```
feat:     新功能
fix:      修 bug
docs:     文档
demo:     示例数据 / 截图
sync:     从私有版同步工具代码
chore:    杂项
```

示例：

```
feat: topic tiles landing + per-topic detail
fix: AI panel 超时后按钮不复位
sync: build.mjs 支持 taxonomy.json 自定义分组
```

---

## 7. 想要的方向

欢迎 issue / PR：

- 更多语言与框架的项目识别规则（R / Python / Snakemake / Nextflow / Quarto）
- 时间线视图（项目状态随时间的曲线）
- 导出到 Obsidian / Notion / SQLite
- 英文界面
- 大仓库（>500 项目）的渲染性能

提交 PR 前请先开 issue 说明场景，避免做完发现方向不对。

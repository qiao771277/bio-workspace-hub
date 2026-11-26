#!/usr/bin/env node
/**
 * ws-hub 汇总器（零依赖，Node 18+）
 *
 *   node tools/build.mjs                     # 读 workspaces/ 生成 dashboard.html + data.json + INDEX.md
 *   node tools/build.mjs --demo              # 读 examples/ 生成 dashboard-demo.html（演示数据）
 *   node tools/build.mjs --check             # 只校验，不写文件
 *   node tools/build.mjs --source <dir> --out <file> --no-index
 *
 * 它只读 workspaces/<id>/{latest.json,history/*.json}，从不改动你的项目文件。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HUB = resolve(HERE, "..");

const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const DEMO = flag("--demo");
const CHECK_ONLY = flag("--check");
const SOURCE = resolve(HUB, opt("--source", DEMO ? "examples" : "."));
const OUT = resolve(HUB, opt("--out", DEMO ? "dashboard-demo.html" : "dashboard.html"));

const warnings = [];
const warn = m => warnings.push(m);

/* ---------- helpers ---------- */
const readJson = f => JSON.parse(readFileSync(f, "utf8").replace(/^\uFEFF/, ""));
const isDir = d => { try { return statSync(d).isDirectory(); } catch { return false; } };
const safeList = d => { try { return readdirSync(d); } catch { return []; } };
const iso = d => (d ? new Date(d).toISOString().replace(/\.\d+Z$/, "Z") : null);
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 864e5);

const STATUS = new Set(["active", "paused", "experiment", "archived", "abandoned", "unknown"]);
const KIND = new Set(["code", "data", "doc", "model", "experiment", "infra", "mixed", "unknown"]);

/* ---------- 分类体系：读 hub 根目录的 taxonomy.json，没有就用默认 ---------- */
const DEFAULT_TAXONOMY = {
  groups: { core: "核心课题", collab: "合作课题", other: "其他" },
  aliases: {},
  categories: [
    { id: "research", label: "研究主线", short: "研究", color: "#E64B35", group: "core" },
    { id: "experiment", label: "实验与数据", short: "实验", color: "#B2182B", group: "core" },
    { id: "analysis", label: "数据分析", short: "分析", color: "#3C5488", group: "core" },
    { id: "writing", label: "论文与汇报", short: "论文", color: "#00A087", group: "collab" },
    { id: "infra", label: "数据与工具", short: "工具", color: "#8491B4", group: "other" },
    { id: "admin", label: "行政与事务", short: "行政", color: "#E18727", group: "other" },
    { id: "learning", label: "学习资料", short: "学习", color: "#91D1C2", group: "other" },
    { id: "other", label: "未归类", short: "未归类", color: "#8B95A1", group: "other" }
  ]
};
function loadTaxonomy() {
  const f = join(HUB, "taxonomy.json");
  if (!existsSync(f)) return DEFAULT_TAXONOMY;
  try {
    const t = readJson(f);
    if (!Array.isArray(t.categories) || !t.categories.length) {
      warn("taxonomy.json 没有 categories，使用默认分类");
      return DEFAULT_TAXONOMY;
    }
    return {
      groups: t.groups || DEFAULT_TAXONOMY.groups,
      aliases: t.aliases || {},
      categories: t.categories
    };
  } catch (e) {
    warn("taxonomy.json 解析失败，使用默认分类: " + e.message);
    return DEFAULT_TAXONOMY;
  }
}
const TAXONOMY = loadTaxonomy();
const TOPICS = {};
for (const c of TAXONOMY.categories) TOPICS[c.id] = { cn: c.label, group: c.group || "other" };
const TOPIC_ALIAS = TAXONOMY.aliases || {};
const GROUP_CN = TAXONOMY.groups;
const CATEGORY = new Set(Object.keys(TOPICS));
const topicOf = k => TOPICS[k] || { cn: k || "未归类", group: "other" };
const ST_CN = { active: "进行中", paused: "暂停", experiment: "试验中", archived: "归档", abandoned: "放弃", unknown: "未知" };
const CAT_ORDER = Object.keys(TOPICS);

/* ---------- load snapshots ---------- */
function loadWorkspaces(root) {
  const base = join(root, "workspaces");
  if (!isDir(base)) { warn(`找不到目录: ${base}`); return []; }
  const out = [];
  for (const id of safeList(base)) {
    const dir = join(base, id);
    if (!isDir(dir)) continue;
    const f = join(dir, "latest.json");
    if (!existsSync(f)) { warn(`${id}: 缺少 latest.json`); continue; }
    let snap;
    try { snap = readJson(f); } catch (e) { warn(`${id}: latest.json 解析失败 — ${e.message}`); continue; }
    out.push({ dir, snap, history: loadHistory(join(dir, "history")) });
  }
  return out;
}
function loadHistory(dir) {
  if (!isDir(dir)) return [];
  const snaps = [];
  for (const f of safeList(dir).filter(x => x.endsWith(".json"))) {
    try {
      const s = readJson(join(dir, f));
      const rid = (s.run && s.run.run_id) || basename(f, ".json");
      snaps.push({ rid, snap: s });
    } catch (e) { warn(`history/${f}: 解析失败 — ${e.message}`); }
  }
  return snaps.sort((a, b) => String(a.rid).localeCompare(String(b.rid)));
}

/* ---------- validate + normalize ---------- */
function normalize(entry) {
  const { snap, dir } = entry;
  const ws = snap.workspace || {};
  const id = ws.id || basename(dir);
  if (!ws.id) warn(`${id}: workspace.id 缺失，用目录名代替`);
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(id)) warn(`${id}: workspace.id 建议只用小写字母/数字/横线`);
  const scanned = iso((snap.run && (snap.run.finished_at || snap.run.started_at)) || null);
  if (!scanned) warn(`${id}: run.finished_at 缺失，无法判断新鲜度`);

  const projects = (Array.isArray(snap.projects) ? snap.projects : []).map(p => {
    const pid = p.id || `${id}--${String(p.name || p.path || "unnamed").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")}`;
    if (!p.id) warn(`${id}: 项目缺 id，用 "${pid}" 代替`);
    if (!p.story) warn(`${id}/${p.name || pid}: 缺 story（来龙去脉）`);
    if (!p.one_liner) warn(`${id}/${p.name || pid}: 缺 one_liner`);
    if (p.status && !STATUS.has(p.status)) warn(`${id}/${p.name || pid}: status="${p.status}" 不在枚举内`);
    if (p.kind && !KIND.has(p.kind)) warn(`${id}/${p.name || pid}: kind="${p.kind}" 不在枚举内`);
    if (p.category && !CATEGORY.has(p.category) && !TOPIC_ALIAS[p.category]) warn(`${id}/${p.name || pid}: category="${p.category}" 不在枚举内`);
    if (!p.category) warn(`${id}/${p.name || pid}: 缺 category（会被归到"未归类"）`);
    const cat = TOPIC_ALIAS[p.category] || p.category || "other";
    return Object.assign({
      kind: "unknown", status: "unknown", category: "other", tech: [], tags: [], relations: [],
      risks: [], next_steps: [], evidence: [], key_files: [], entry_points: [],
      size: { files: 0, bytes: 0 }, data: { assets: [] }
    }, p, {
      id: pid,
      category: cat,
      category_group: topicOf(cat).group,
      category_label: topicOf(cat).cn,
      ws_id: id,
      ws_label: ws.label || id,
      ws_os: ws.os || "unknown",
      ws_machine: ws.machine || "",
      scanned_at: scanned
    });
  });

  const seen = new Set();
  for (const p of projects) {
    if (seen.has(p.id)) warn(`${id}: 项目 id 重复 "${p.id}"（会导致历史混乱）`);
    seen.add(p.id);
  }

  return {
    id,
    label: ws.label || id,
    machine: ws.machine || "",
    os: ws.os || "unknown",
    root: ws.root || "",
    root_display: ws.root_display || ws.root || "",
    extra_roots: ws.extra_roots || [],
    notes: ws.notes || "",
    scanned_at: scanned,
    run_id: (snap.run && snap.run.run_id) || null,
    previous_run_id: (snap.run && snap.run.previous_run_id) || null,
    budget_cut: !!(snap.run && snap.run.budget_cut),
    counts: ws.counts || {},
    disk: ws.disk || null,
    projects,
    loose_assets: (snap.loose_assets || []).map(a => Object.assign({}, a, { ws_id: id, ws_label: ws.label || id })),
    gaps: (snap.gaps || []).map(g => Object.assign({}, g, { ws_id: id, ws_label: ws.label || id })),
    history: entry.history
  };
}

/* ---------- changes ---------- */
function diffProjects(prev, cur) {
  const evs = [];
  const P = new Map((prev || []).map(p => [p.id, p]));
  const C = new Map((cur || []).map(p => [p.id, p]));
  for (const [id, p] of C) {
    if (!P.has(id)) { evs.push({ type: "add", project_id: id, name: p.name, detail: "新增项目" }); continue; }
    const o = P.get(id);
    if (o.name !== p.name) evs.push({ type: "edit", project_id: id, name: p.name, detail: `改名：${o.name} → ${p.name}` });
    if (o.status !== p.status) evs.push({ type: "status", project_id: id, name: p.name, detail: `状态：${ST_CN[o.status] || o.status} → ${ST_CN[p.status] || p.status}` });
    if (o.one_liner !== p.one_liner) evs.push({ type: "edit", project_id: id, name: p.name, detail: "描述有更新" });
    const a = (o.size && o.size.bytes) || 0, b = (p.size && p.size.bytes) || 0;
    if (Math.abs(b - a) > 10 * 1024 * 1024 && a > 0 && Math.abs(b - a) / a > 0.3) {
      evs.push({ type: "edit", project_id: id, name: p.name, detail: `体积：${mb(a)} → ${mb(b)}` });
    }
  }
  for (const [id, p] of P) if (!C.has(id)) evs.push({ type: "remove", project_id: id, name: p.name, detail: "从工作区消失（移动/删除/改名？）" });
  return evs;
}
const mb = n => (n / 1024 / 1024).toFixed(1) + " MB";
const human = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB");
const humanSize = n => {
  n = Number(n) || 0;
  if (n < 1024) return n + " B";
  const u = ["KB", "MB", "GB", "TB"]; let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return (n >= 100 ? n.toFixed(0) : n.toFixed(1)) + " " + u[i];
};

function buildChanges(ws) {
  const chain = [];
  const ids = new Set();
  for (const h of ws.history) {
    if (ids.has(h.rid)) continue;
    ids.add(h.rid);
    chain.push({ rid: h.rid, snap: h.snap });
  }
  const last = chain[chain.length - 1];
  if (!last || last.rid !== ws.run_id) chain.push({ rid: ws.run_id, snap: { projects: ws.projects, run: { finished_at: ws.scanned_at } } });

  const evs = [];
  for (let i = 1; i < chain.length; i++) {
    const at = iso((chain[i].snap.run && (chain[i].snap.run.finished_at || chain[i].snap.run.started_at)) || ws.scanned_at);
    const prevP = ((chain[i - 1].snap && chain[i - 1].snap.projects) || []).map(p => Object.assign({}, p, { id: p.id || `${ws.id}--${p.name}` }));
    const curP = ((chain[i].snap && chain[i].snap.projects) || []).map(p => Object.assign({}, p, { id: p.id || `${ws.id}--${p.name}` }));
    for (const e of diffProjects(prevP, curP)) evs.push(Object.assign({ at, ws_id: ws.id, ws_label: ws.label }, e));
  }
  return evs;
}

/* ---------- duplicate detection across machines ---------- */
function findDuplicates(projects) {
  const out = [];
  // 保留中日韩文字，只去掉符号空格；否则纯中文名会被压成空串，互相误判
  const norm = s => String(s || "").toLowerCase().replace(/\.git$/, "").replace(/[^\p{L}\p{N}]+/gu, "");
  const byRemote = new Map(), byName = new Map();
  for (const p of projects) {
    const r = p.git && p.git.remote ? norm(p.git.remote) : "";
    if (r && r.length > 8) {
      if (!byRemote.has(r)) byRemote.set(r, []);
      byRemote.get(r).push(p);
    }
    const n = norm(p.name);
    if (n.length >= 5) {
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n).push(p);
    }
  }
  const pack = (reason, group) => {
    const wsSet = new Set(group.map(p => p.ws_id));
    if (wsSet.size < 2) return;
    out.push({ reason, items: group.map(p => ({ id: p.id, name: p.name, ws_id: p.ws_id, ws_label: p.ws_label })) });
  };
  for (const [, g] of byRemote) if (g.length > 1) pack("同一个 git 远端，可能多台机器各留了一份", g);
  for (const [, g] of byName) if (g.length > 1) pack("同名项目，确认是同一课题还是重名", g);
  return out;
}

/* ---------- main ---------- */
const entries = loadWorkspaces(SOURCE);
if (!entries.length) {
  console.error(`\n✗ ${join(SOURCE, "workspaces")} 里没有可用的 latest.json`);
  console.error(`  先把各机器采集的 workspaces/<id>/latest.json 放进来，再运行一次。\n`);
  process.exit(1);
}

const wss = entries.map(normalize);
const projects = wss.flatMap(w => w.projects);
const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
for (const w of wss) w.stale_days = DEMO ? null : (w.scanned_at ? Math.max(0, daysBetween(now, w.scanned_at)) : null);

const changes = wss.flatMap(buildChanges).sort((a, b) => String(b.at).localeCompare(String(a.at)));

const byStatus = {};
for (const p of projects) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
const byCategory = {};
for (const p of projects) byCategory[p.category || "other"] = (byCategory[p.category || "other"] || 0) + 1;

/* ---------- 人工决策（decisions.json）：不写进采集结果，重新采集也不会丢 ---------- */
const DEC_FILE = join(HUB, "decisions.json");
let DECISIONS = { assets: {}, gaps: {} };
try {
  if (existsSync(DEC_FILE)) DECISIONS = Object.assign({ assets: {}, gaps: {} }, readJson(DEC_FILE));
} catch (e) { warn("decisions.json 解析失败（忽略）: " + e.message); }
const shortHash = s => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0").slice(0, 8);
};

const DATA = {
  schema_version: "1.0",
  built_at: now,
  hub_path: DEMO ? "" : HUB,
  demo: DEMO,
  taxonomy: TAXONOMY,
  stats: {
    workspaces: wss.length,
    projects: projects.length,
    bytes: projects.reduce((a, p) => a + ((p.size && p.size.bytes) || 0), 0),
    files: projects.reduce((a, p) => a + ((p.size && p.size.files) || 0), 0),
    by_status: byStatus,
    by_category: byCategory
  },
  workspaces: wss.map(w => ({
    id: w.id, label: w.label, machine: w.machine, os: w.os, root: w.root,
    root_display: w.root_display, extra_roots: w.extra_roots, notes: w.notes,
    scanned_at: w.scanned_at, run_id: w.run_id, previous_run_id: w.previous_run_id,
    budget_cut: w.budget_cut, stale_days: w.stale_days, disk: w.disk,
    project_count: w.projects.length,
    bytes: w.projects.reduce((a, p) => a + ((p.size && p.size.bytes) || 0), 0)
  })),
  projects,
  changes,
  gaps: wss.flatMap(w => w.gaps).map(g => {
    const key = g.ws_id + "::" + shortHash(String(g.text || ""));
    const d = (DECISIONS.gaps && DECISIONS.gaps[key]) || {};
    return Object.assign({}, g, { key, status: d.status || "open", note: d.note || "", decided_at: d.at || "" });
  }),
  loose_assets: wss.flatMap(w => w.loose_assets).map(a => {
    const key = a.ws_id + "::" + String(a.path || "");
    const d = (DECISIONS.assets && DECISIONS.assets[key]) || {};
    return Object.assign({}, a, { key, keep: d.keep || a.keep || "unknown", note: d.note || a.note || "", decided_at: d.at || "" });
  }),
  duplicates: findDuplicates(projects)
};

/* ---------- report ---------- */
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
console.log("\nWS-HUB  构建 " + now);
console.log("─".repeat(72));
for (const w of wss) {
  console.log(`  ${pad(w.id, 12)} ${w.label}  ${String(w.projects.length).padStart(3)} 项目  ${w.os}`
    + `  ${w.scanned_at ? w.scanned_at.slice(0, 10) : "?"}`
    + (w.stale_days > 14 ? "  ⚠ 陈旧 " + w.stale_days + " 天" : ""));
}
console.log("─".repeat(72));
console.log(`  合计 ${projects.length} 个项目 · ${DATA.stats.files} 个文件 · ${mb(DATA.stats.bytes)}`);
console.log(`  变化事件 ${changes.length} · 待补 ${DATA.gaps.length} · 散件 ${DATA.loose_assets.length} · 疑似重复 ${DATA.duplicates.length}`);
if (warnings.length) {
  console.log(`\n  校验提示 (${warnings.length}):`);
  warnings.slice(0, 12).forEach(w => console.log("   · " + w));
  if (warnings.length > 12) console.log(`   · ...还有 ${warnings.length - 12} 条`);
}
if (CHECK_ONLY) { console.log("\n(--check 模式，未写文件)\n"); process.exit(warnings.length ? 2 : 0); }

/* ---------- write ---------- */
const tplPath = join(HUB, "templates", "dashboard.html");
if (!existsSync(tplPath)) { console.error("✗ 缺少 templates/dashboard.html"); process.exit(1); }
const json = JSON.stringify(DATA).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const html = readFileSync(tplPath, "utf8").replace("/*__DATA__*/null", json);
writeFileSync(OUT, html, "utf8");

const dataName = DEMO ? "data-demo.json" : "data.json";
writeFileSync(join(HUB, dataName), JSON.stringify(DATA, null, 2), "utf8");

function indexMd() {
  const lines = [];
  lines.push("# 工作区总索引", "");
  lines.push(`> 由 \`node tools/build.mjs\` 生成，最后更新 ${now.slice(0, 10)}。手改会在下次构建时被覆盖。`, "");
  lines.push(`共 **${wss.length}** 个工作区、**${projects.length}** 个项目、**${humanSize(DATA.stats.bytes)}**。`, "");

  lines.push("## 课题总览", "", "| 归属 | 课题 | 项目 | 体积 |", "|---|---|---|---|");
  for (const k of CAT_ORDER) {
    const ps = projects.filter(p => (p.category || "other") === k);
    if (!ps.length) continue;
    const t = topicOf(k);
    lines.push(`| ${GROUP_CN[t.group]} | ${t.cn} | ${ps.length} | ${humanSize(ps.reduce((a, p) => a + ((p.size && p.size.bytes) || 0), 0))} |`);
  }
  lines.push("");

  lines.push("## 课题索引", "");
  for (const g of ["core", "collab", "other"]) {
    const ks = CAT_ORDER.filter(k => topicOf(k).group === g && projects.some(p => (p.category || "other") === k));
    if (!ks.length) continue;
    lines.push(`### ${GROUP_CN[g]}`, "");
    for (const k of ks) {
      const ps = projects.filter(p => (p.category || "other") === k);
      lines.push(`#### ${topicOf(k).cn}（${ps.length}）`, "");
      for (const p of ps.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "zh"))) {
        lines.push(`- ${p.name} — \`${p.ws_id}\` — ${ST_CN[p.status] || p.status}`);
      }
      lines.push("");
    }
  }
  for (const w of wss) {
    lines.push(`## ${w.label}  \`${w.id}\``, "");
    lines.push(`- 机器：\`${w.machine || "?"}\` · 系统：${w.os} · 根目录：\`${w.root_display || w.root}\``);
    lines.push(`- 上次扫描：${w.scanned_at ? w.scanned_at.slice(0, 10) : "?"}${w.previous_run_id ? ` · 基线 ${w.previous_run_id}` : ""}`);
    if (w.notes) lines.push(`- ${w.notes}`);
    lines.push("");
    if (!w.projects.length) { lines.push("_没有项目_", ""); continue; }
    lines.push("| 项目 | 状态 | 类型 | 规模 | 最近改动 | 一句话 |", "|---|---|---|---|---|---|");
    for (const p of w.projects.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "zh"))) {
      lines.push(`| **${p.name}** | ${p.status} | ${p.kind} | ${human((p.size && p.size.bytes) || 0)} | `
        + `${(p.activity && p.activity.last_modified || p.scanned_at || "").slice(0, 10)} | ${p.one_liner.replace(/\|/g, "\\|")} |`);
    }
    lines.push("");
    if (w.loose_assets.length) {
      lines.push("散件：", "");
      for (const a of w.loose_assets) lines.push(`- \`${a.path}\` — ${a.what || a.kind}`);
      lines.push("");
    }
  }
  if (DATA.changes.length) {
    lines.push("## 最近变化", "");
    for (const c of DATA.changes.slice(0, 25)) lines.push(`- ${c.at.slice(0, 10)} \`${c.ws_label}\` **${c.name}** — ${c.detail}`);
    lines.push("");
  }
  if (DATA.gaps.length || DATA.duplicates.length) {
    lines.push("## 待补", "");
    for (const d of DATA.duplicates) lines.push(`- 疑似重复（${d.reason}）：` + d.items.map(i => `${i.name}@${i.ws_label}`).join(" / "));
    for (const g of DATA.gaps) lines.push(`- [${g.severity || "low"}] ${g.text}${g.about ? `（${g.about}）` : ""} — ${g.ws_label}`);
    lines.push("");
  }
  return lines.join("\n");
}
if (!flag("--no-index") && !DEMO) writeFileSync(join(HUB, "INDEX.md"), indexMd(), "utf8");

console.log(`\n✓ 写出 ${OUT.replace(HUB + "\\", "").replace(HUB + "/", "")}`);
console.log(`✓ 写出 ${dataName}${flag("--no-index") || DEMO ? "" : " + INDEX.md"}`);
console.log(`\n双击打开即可：${OUT}\n`);

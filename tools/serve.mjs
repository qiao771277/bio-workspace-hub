#!/usr/bin/env node
/**
 * WS-HUB 本地编辑服务（零依赖，仅监听 127.0.0.1）
 *
 *   node tools/serve.mjs            # 默认 http://127.0.0.1:8766
 *   WS_HUB_PORT=9000 node tools/serve.mjs
 *
 * 职责：
 *   GET  /                  → 看板（注入编辑开关 + 本次运行的随机 token）
 *   GET  /api/ping          → 存活探测
 *   POST /api/project       → 修改一个项目的字段，写回 workspaces/<id>/latest.json，然后重建
 *   POST /api/rebuild       → 只重建
 *
 * 安全：只绑 127.0.0.1；所有写操作必须带本次运行随机生成的 X-WS-Hub-Token，
 *       防止本地其它网页用 CSRF 改你的数据。服务只改 workspaces 下各机器的 latest.json，
 *       不碰你的项目文件。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync, execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HUB = path.resolve(HERE, "..");
const START_PORT = Number(process.env.WS_HUB_PORT || 8766);
const TOKEN = crypto.randomBytes(16).toString("hex");
const LOG = path.join(HERE, "serve.log");
const MODEL = (() => {
  if (process.env.WS_HUB_MODEL) return process.env.WS_HUB_MODEL;
  try {
    const f = path.join(HUB, "serve.config.json");
    if (fs.existsSync(f)) {
      const c = JSON.parse(fs.readFileSync(f, "utf8"));
      if (c && typeof c.model === "string") return c.model;
    }
  } catch {}
  return "";
})();

const ALLOWED = new Set([
  "name", "path", "one_liner", "story", "status", "category", "kind",
  "tags", "next_steps", "risks", "tech", "entry_points", "hidden"
]);
/* 分类允许值来自 hub 根目录的 taxonomy.json（与看板一致） */
const categoryIds = (() => {
  let cache = null;
  return () => {
    if (cache) return cache;
    const ids = new Set(["other"]);
    try {
      const f = path.join(HUB, "taxonomy.json");
      if (fs.existsSync(f)) {
        const t = JSON.parse(fs.readFileSync(f, "utf8"));
        for (const c of t.categories || []) if (c.id) ids.add(c.id);
        for (const a of Object.values(t.aliases || {})) ids.add(a);
      }
    } catch {}
    cache = ids;
    return ids;
  };
})();

const ENUM = {
  status: new Set(["active", "paused", "experiment", "archived", "abandoned", "unknown"]),
  category: { has: v => categoryIds().has(v) },
  kind: new Set(["code", "data", "doc", "model", "experiment", "infra", "mixed", "unknown"])
};
const ARRAYS = new Set(["tags", "next_steps", "risks", "tech", "entry_points"]);

function log(msg) {
  const line = `[${new Date().toISOString().replace(/\.\d+Z$/, "Z")}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + "\n"); } catch {}
}

function snapshotFiles() {
  const base = path.join(HUB, "workspaces");
  return fs.readdirSync(base)
    .map(w => path.join(base, w, "latest.json"))
    .filter(f => fs.existsSync(f));
}

function patchProject(id, fields) {
  for (const file of snapshotFiles()) {
    const snap = JSON.parse(fs.readFileSync(file, "utf8"));
    const p = (snap.projects || []).find(x => x.id === id);
    if (!p) continue;

    const applied = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!ALLOWED.has(k)) continue;
      if (ENUM[k]) {
        if (!ENUM[k].has(v)) throw new Error(`${k} 的取值不合法: ${v}`);
        p[k] = v;
      } else if (ARRAYS.has(k)) {
        p[k] = Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : [];
      } else if (k === "hidden") {
        p[k] = !!v;
      } else {
        p[k] = String(v);
      }
      applied[k] = p[k];
    }

    fs.writeFileSync(file, JSON.stringify(snap, null, 2));
    return { file: path.relative(HUB, file), applied };
  }
  throw new Error("找不到项目: " + id);
}

function createProject(body) {
  const wsId = String(body.ws_id || "").trim();
  const name = String(body.name || "").trim();
  const projPath = String(body.path || "").trim();
  if (!wsId || !name || !projPath) throw new Error("需要 ws_id、name、path");

  const file = path.join(HUB, "workspaces", wsId, "latest.json");
  if (!fs.existsSync(file)) throw new Error("找不到工作区: " + wsId);
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(wsId)) throw new Error("工作区 id 不合法: " + wsId);

  const slug = (name.toLowerCase().match(/[a-z0-9]+/g) || []).join("-").slice(0, 24) || "manual";
  const snap = JSON.parse(fs.readFileSync(file, "utf8"));
  snap.projects = Array.isArray(snap.projects) ? snap.projects : [];
  const taken = new Set(snap.projects.map(x => x.id));
  let id = `${wsId}--manual-${slug}`;
  for (let i = 2; taken.has(id); i++) id = `${wsId}--manual-${slug}-${i}`;

  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const story = String(body.story || "").trim() || `手动添加的记录（${now.slice(0, 10)}）。细节还没采集，下次跑 collect 会自动补全。`;
  const item = {
    id,
    name,
    path: projPath,
    rel_path: path.basename(projPath),
    kind: ENUM.kind.has(body.kind) ? body.kind : "unknown",
    status: ENUM.status.has(body.status) ? body.status : "active",
    category: ENUM.category.has(body.category) ? body.category : "other",
    one_liner: String(body.one_liner || "").slice(0, 60) || "手动添加，待补充",
    story,
    origin: { type: "unknown", from: "", evidence: "手动添加（dashboard 编辑模式）" },
    tech: [], entry_points: [], key_files: [],
    data: { summary: "", in_repo: false, assets: [], total_bytes: 0 },
    activity: { last_modified: now, last_commit_at: "", commits: 0, dirty: false, branches: 0, tags: [] },
    git: { is_repo: false, remote: "", default_branch: "" },
    size: { files: 0, bytes: 0 },
    relations: [], risks: [], next_steps: [], todo_markers: 0,
    confidence: "low",
    evidence: [{ claim: "手动添加，未采集", source: "dashboard /api/project/create" }],
    tags: ["手动添加"], hidden: false
  };

  snap.projects.push(item);
  fs.writeFileSync(file, JSON.stringify(snap, null, 2));
  return { id, file: path.relative(HUB, file) };
}

function deleteProject(id) {
  for (const file of snapshotFiles()) {
    const snap = JSON.parse(fs.readFileSync(file, "utf8"));
    const list = Array.isArray(snap.projects) ? snap.projects : [];
    const i = list.findIndex(x => x.id === id);
    if (i < 0) continue;
    const [gone] = list.splice(i, 1);
    fs.writeFileSync(file, JSON.stringify(snap, null, 2));
    return { name: gone.name, file: path.relative(HUB, file) };
  }
  throw new Error("找不到项目: " + id);
}

/* 在资源管理器 / Finder / 文件管理器里打开某个项目（或散件）的目录 */
function revealPath(target, base) {
  const norm = s => String(s || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const raw = String(target || "").trim();
  if (!raw) throw new Error("空路径");
  const abs = base && !path.isAbsolute(raw) ? path.resolve(String(base), raw) : raw;

  const data = JSON.parse(fs.readFileSync(path.join(HUB, "data.json"), "utf8"));
  const projectPaths = new Set((data.projects || []).map(x => norm(x.path)).filter(Boolean));
  const assetPaths = new Set((data.loose_assets || []).map(a => norm(a.path)).filter(Boolean));

  const t = norm(abs);
  let allowed = projectPaths.has(t) || assetPaths.has(t) || assetPaths.has(norm(raw));
  if (!allowed && base) {
    // 条目里存的是相对路径，用 base 反推出绝对路径再比
    for (const a of assetPaths) {
      if (norm(path.resolve(String(base), a)) === t) { allowed = true; break; }
    }
  }
  if (!allowed) {
    // 项目内部的子路径（例如 data/raw）
    for (const k of projectPaths) {
      if (k && t.startsWith(k + "/")) { allowed = true; break; }
    }
  }
  if (!allowed) throw new Error("这个路径不在索引里，拒绝打开");

  let dir = abs;
  try {
    if (fs.statSync(abs).isFile()) dir = path.dirname(abs);
  } catch {
    throw new Error("路径不存在：" + abs);
  }

  if (process.platform === "win32") {
    // 不要加 windowsHide，否则资源管理器窗口会被隐藏
    spawn("explorer.exe", [dir], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [dir], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [dir], { detached: true, stdio: "ignore" }).unref();
  }
  return dir;
}

function rebuild() {
  return execFileSync(process.execPath, [path.join(HERE, "build.mjs")], {
    cwd: HUB, encoding: "utf8"
  });
}

/* ---------------- AI 问答 ---------------- */

function findOpencode() {
  if (process.env.WS_HUB_OPENCODE && fs.existsSync(process.env.WS_HUB_OPENCODE)) return process.env.WS_HUB_OPENCODE;
  const cands = [
    path.join(process.env.LOCALAPPDATA || "", "Programs", "@opencode-aidesktop", "resources", "opencode-cli.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "opencode", "opencode.exe"),
    "/usr/local/bin/opencode",
    "/usr/bin/opencode",
    path.join(os.homedir(), ".opencode", "bin", "opencode")
  ];
  for (const c of cands) { try { if (c && fs.existsSync(c)) return c; } catch {} }
  return null;
}
const OPENCODE = findOpencode();

const human = n => {
  n = Number(n) || 0;
  if (n < 1024) return n + " B";
  const u = ["KB", "MB", "GB", "TB"]; let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return (n >= 100 ? n.toFixed(0) : n.toFixed(1)) + " " + u[i];
};

function buildDigest(question, projectId) {
  const data = JSON.parse(fs.readFileSync(path.join(HUB, "data.json"), "utf8"));
  const projects = data.projects || [];
  const out = [];
  out.push(`共 ${projects.length} 个项目，${(data.workspaces || []).length} 个工作区，总体积 ${human(data.stats && data.stats.bytes)}。`);
  const cats = (data.stats && data.stats.by_category) || {};
  out.push("分类统计: " + Object.entries(cats).map(([k, v]) => `${k}=${v}`).join(", "));
  out.push("");
  out.push("项目清单（id | 名称 | 机器 | 分类 | 状态 | 体积 | 一句话）:");
  for (const p of projects) {
    out.push(`${p.id} | ${p.name} | ${p.ws_label} | ${p.category || "other"} | ${p.status} | ${human(p.size && p.size.bytes)} | ${p.one_liner || ""}`);
  }

  const toks = String(question || "").toLowerCase().split(/[\s,，。？?！!、]+/).filter(t => t.length >= 2);
  const scored = projects.map(p => {
    const hay = (p.name + " " + p.one_liner + " " + p.story + " " + (p.tags || []).join(" ") + " " + p.path).toLowerCase();
    let s = 0;
    for (const t of toks) if (hay.includes(t)) s++;
    return { p, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6).map(x => x.p);

  const focus = projectId ? projects.find(p => p.id === projectId) : null;
  if (focus && !scored.some(p => p.id === focus.id)) scored.unshift(focus);

  if (scored.length) {
    out.push("", "相关项目详情:");
    for (const p of scored) {
      out.push(`- ${p.id} ｜ ${p.name}（${p.status} / ${p.category}）`);
      out.push(`  路径: ${p.path}`);
      out.push(`  来龙去脉: ${p.story || ""}`);
      if ((p.risks || []).length) out.push(`  风险: ${p.risks.join("；")}`);
      if ((p.next_steps || []).length) out.push(`  下一步: ${p.next_steps.join("；")}`);
      if (p.data && p.data.summary) out.push(`  数据: ${p.data.summary}`);
    }
  }
  return out.join("\n");
}

function askOpenCode(prompt, session, attachPath) {
  return new Promise((resolve, reject) => {
    if (!OPENCODE) return reject(new Error("找不到 opencode CLI，设置环境变量 WS_HUB_OPENCODE 指向它"));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wshub-ask-"));
    const outFile = path.join(tmp, "out.json");
    const promptFile = path.join(tmp, "prompt.txt");
    fs.writeFileSync(promptFile, prompt, "utf8");

    const started = Date.now();
    const ps = path.join(HERE, "ask.ps1");
    const args = [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps,
      "-Session", session, "-PromptFile", promptFile,
      "-OutFile", outFile
    ];
    if (MODEL) args.push("-Model", MODEL);
    if (attachPath) args.push("-Attach", attachPath);

    // Windows：CLI 在没有控制台/管道 stdin 时会挂住，必须走 ask.ps1（Start-Process + 重定向）
    // 其它平台：直接 execFile 即可
    const isWin = process.platform === "win32";
    const cmd = isWin ? "powershell.exe" : OPENCODE;
    const cmdArgs = isWin ? args : (() => {
      const a = ["run", "--format", "json", "--session", session, "--title", "WS-HUB 问答"];
      if (MODEL) a.push("--model", MODEL);
      if (attachPath) a.push("--file", attachPath);
      a.push(prompt);
      return a;
    })();
    const opts = { cwd: HUB, timeout: 110000, maxBuffer: 20 * 1024 * 1024, windowsHide: true };
    if (!isWin) opts.stdio = ["ignore", "pipe", "pipe"];

    execFile(cmd, cmdArgs, opts, (err, stdout, stderr) => {
      const cleanup = () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} };
      const raw = isWin
        ? (fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : "")
        : String(stdout || "");
      if (!raw) {
        cleanup();
        const msg = (stderr || "") + " " + (err ? err.message : "");
        return reject(new Error("opencode 没有输出：" + msg.slice(0, 300)));
      }
      const parts = [];
      const errs = [];
      for (const line of raw.split(/\r?\n/)) {
        const s = line.trim();
        if (!s.startsWith("{")) continue;
        try {
          const ev = JSON.parse(s);
          if (ev.type === "text" && ev.part && typeof ev.part.text === "string") parts.push(ev.part.text);
          else if (ev.type === "error") {
            const m = (ev.error && (ev.error.message || ev.error.type)) || "未知错误";
            errs.push(m);
          }
        } catch {}
      }
      cleanup();
      if (!parts.length) {
        const hint = errs.length ? errs[0] : (raw ? raw.slice(0, 200) : "没有输出");
        return reject(new Error(hint + "（可在 serve.config.json 或 WS_HUB_MODEL 里换一个模型）"));
      }
      resolve({ text: parts.join(""), elapsed: Date.now() - started });
    });
  });
}

const ACTION_RE = /```ws-hub-action\s*([\s\S]*?)```/i;
const EDIT_FIELDS = new Set(["name", "one_liner", "story", "status", "category", "kind", "tags", "next_steps", "risks"]);
const ARRAY_FIELDS = new Set(["tags", "next_steps", "risks", "tech", "entry_points"]);

async function answer(question, session, projectId) {
  const digest = buildDigest(question, projectId);
  const digestFile = path.join(os.tmpdir(), `wshub-digest-${crypto.randomBytes(4).toString("hex")}.md`);
  fs.writeFileSync(digestFile, digest, "utf8");

  const prompt = [
    "你是 WS-HUB（个人工作区索引）的助手。附件是当前数据快照，只依据附件回答，中文、简洁，不要编造项目或数字。",
    "如果用户要求修改某个项目，在回答最后单独加几行（不要放进代码块），每行一条：",
    "MODIFY <项目id> <字段>=<值>",
    "例如：MODIFY laptop--demo-app status=archived",
    "可改字段: status(active/paused/experiment/archived/abandoned/unknown)、category(amp/data-tools/paper/admin/learning/other)、kind、name、one_liner、story、tags、next_steps、risks。",
    "值里不要有换行；tags/next_steps/risks 多个值用逗号分隔。只能使用附件里出现过的 id。不要调用任何工具。",
    "",
    "用户问题：" + question
  ].join("\n");

  let text = "", elapsed = 0;
  try {
    const r = await askOpenCode(prompt, session, digestFile);
    text = r.text;
    elapsed = r.elapsed;
  } finally {
    try { fs.unlinkSync(digestFile); } catch {}
  }

  let clean = text.trim();
  let applied = [];
  let actionError = null;

  // 1) 行协议：MODIFY <id> <field>=<value>
  const lineRe = /^[ \t]*MODIFY[ \t]+(\S+)[ \t]+([A-Za-z_]+)=(.*)$/gm;
  const mods = [...clean.matchAll(lineRe)];
  if (mods.length) {
    clean = clean.replace(lineRe, "").replace(/\n{3,}/g, "\n\n").trim();
    const grouped = new Map();
    for (const [, id, key, rawVal] of mods) {
      if (!EDIT_FIELDS.has(key)) continue;
      if (!grouped.has(id)) grouped.set(id, {});
      const v = String(rawVal).trim().replace(/^["'“]|["'”]$/g, "");
      grouped.get(id)[key] = ARRAY_FIELDS.has(key)
        ? v.split(/[,，;；]/).map(s => s.trim()).filter(Boolean)
        : v;
    }
    for (const [id, fields] of grouped) {
      if (!Object.keys(fields).length) continue;
      try {
        patchProject(id, fields);
        applied.push({ id, fields });
      } catch (e) {
        actionError = e.message;
        log("action failed for " + id + ": " + e.message);
      }
    }
  } else {
    // 2) 兼容 JSON 代码块
    const m = clean.match(ACTION_RE);
    if (m) {
      clean = clean.replace(ACTION_RE, "").trim();
      const body = m[1].trim();
      let spec = null;
      try {
        spec = JSON.parse(body);
      } catch (e1) {
        const brace = body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1);
        try {
          spec = JSON.parse(brace);
        } catch (e2) {
          actionError = "修改指令不是合法 JSON";
          log("action parse failed: " + e1.message + " raw=" + body.slice(0, 240).replace(/\s+/g, " "));
        }
      }
      if (spec) {
        for (const u of spec.updates || []) {
          if (!u || !u.id || typeof u.fields !== "object") continue;
          const fields = {};
          for (const [k, v] of Object.entries(u.fields)) if (EDIT_FIELDS.has(k)) fields[k] = v;
          if (!Object.keys(fields).length) continue;
          try {
            patchProject(u.id, fields);
            applied.push({ id: u.id, fields });
          } catch (e) { log("action failed for " + u.id + ": " + e.message); }
        }
      }
    }
  }
  if (applied.length) rebuild();

  return { answer: clean, applied, actionError, elapsed };
}

const readBody = req => new Promise((resolve, reject) => {
  let buf = "";
  req.on("data", c => {
    buf += c;
    if (buf.length > 1e6) { reject(new Error("body too large")); req.destroy(); }
  });
  req.on("end", () => resolve(buf));
  req.on("error", reject);
});

const send = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const p = url.pathname;

  try {
    if (p === "/api/ping") return send(res, 200, { ok: true, hub: HUB, ai: !!OPENCODE, model: MODEL });

    if (p === "/api/rebuild" && req.method === "POST") {
      if (req.headers["x-ws-hub-token"] !== TOKEN) return send(res, 403, { error: "bad token" });
      const out = rebuild();
      log("rebuild ok");
      return send(res, 200, { ok: true, output: out.split("\n").slice(-6).join("\n") });
    }

    if (p === "/api/decision" && req.method === "POST") {
      if (req.headers["x-ws-hub-token"] !== TOKEN) return send(res, 403, { error: "bad token" });
      const body = JSON.parse((await readBody(req)) || "{}");
      const type = body.type === "gap" ? "gaps" : (body.type === "asset" ? "assets" : null);
      const key = String(body.key || "");
      if (!type || !key) return send(res, 400, { error: "需要 type(asset|gap) 和 key" });
      const fields = body.fields && typeof body.fields === "object" ? body.fields : {};
      if (fields.keep && !["keep", "review", "delete", "unknown"].includes(fields.keep)) {
        return send(res, 400, { error: "keep 取值不合法" });
      }
      if (fields.status && !["open", "resolved", "ignored"].includes(fields.status)) {
        return send(res, 400, { error: "status 取值不合法" });
      }
      const clean = {};
      if (fields.keep) clean.keep = fields.keep;
      if (fields.status) clean.status = fields.status;
      if (typeof fields.note === "string") clean.note = fields.note.slice(0, 300);

      const f = path.join(HUB, "decisions.json");
      let d = { assets: {}, gaps: {} };
      try { if (fs.existsSync(f)) d = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
      d[type] = d[type] || {};
      d[type][key] = Object.assign({}, d[type][key] || {}, clean, { at: new Date().toISOString() });
      fs.writeFileSync(f, JSON.stringify(d, null, 2));
      rebuild();
      log(`decision ${type} ${key} ${JSON.stringify(clean)}`);
      return send(res, 200, { ok: true });
    }

    if (p === "/api/reveal" && req.method === "POST") {
      if (req.headers["x-ws-hub-token"] !== TOKEN) return send(res, 403, { error: "bad token" });
      const body = JSON.parse((await readBody(req)) || "{}");
      const target = String(body.path || "").trim();
      if (!target) return send(res, 400, { error: "需要 path" });
      const dir = revealPath(target, body.base || "");
      log(`reveal ${dir}`);
      return send(res, 200, { ok: true, dir });
    }

    if (p === "/api/ask" && req.method === "POST") {
      if (req.headers["x-ws-hub-token"] !== TOKEN) return send(res, 403, { error: "bad token" });
      const body = JSON.parse((await readBody(req)) || "{}");
      const question = String(body.question || "").trim();
      if (!question) return send(res, 400, { error: "缺少 question" });
      const session = (String(body.session || "ses_wshub_default").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60)) || "ses_wshub_default";
      log(`ask [${session}] ${question.slice(0, 80)}`);
      try {
        const r = await answer(question.slice(0, 2000), session, body.projectId || null);
        log(`ask done ${r.elapsed}ms applied=${r.applied.length}`);
        return send(res, 200, Object.assign({ ok: true }, r));
      } catch (e) {
        log("ask failed: " + e.message);
        return send(res, 502, { error: e.message });
      }
    }

    if (p === "/api/project/create" && req.method === "POST") {
      if (req.headers["x-ws-hub-token"] !== TOKEN) return send(res, 403, { error: "bad token" });
      const body = JSON.parse(await readBody(req) || "{}");
      const made = createProject(body);
      const out = rebuild();
      log(`create ${made.id} -> ${made.file}`);
      return send(res, 200, { ok: true, id: made.id, output: out.split("\n").slice(-6).join("\n") });
    }

    if (p === "/api/project/delete" && req.method === "POST") {
      if (req.headers["x-ws-hub-token"] !== TOKEN) return send(res, 403, { error: "bad token" });
      const body = JSON.parse(await readBody(req) || "{}");
      if (!body.id) return send(res, 400, { error: "需要 id" });
      const gone = deleteProject(body.id);
      const out = rebuild();
      log(`delete ${body.id} -> ${gone.file}`);
      return send(res, 200, { ok: true, name: gone.name, output: out.split("\n").slice(-6).join("\n") });
    }

    if (p === "/api/project" && req.method === "POST") {
      if (req.headers["x-ws-hub-token"] !== TOKEN) return send(res, 403, { error: "bad token" });
      const body = JSON.parse(await readBody(req) || "{}");
      if (!body.id || typeof body.fields !== "object") return send(res, 400, { error: "需要 id 和 fields" });
      const r = patchProject(body.id, body.fields);
      const out = rebuild();
      log(`patch ${body.id} -> ${r.file} ${JSON.stringify(Object.keys(r.applied))}`);
      return send(res, 200, {
        ok: true,
        applied: r.applied,
        warnings: (out.match(/校验提示.*/s) || [""])[0].slice(0, 400)
      });
    }

    if (p === "/" || p === "/dashboard.html") {
      const file = path.join(HUB, "dashboard.html");
      if (!fs.existsSync(file)) return send(res, 500, { error: "dashboard.html 不存在，先跑 node tools/build.mjs" });
      let html = fs.readFileSync(file, "utf8");
      const inject = `<script>window.__WS_HUB_EDIT__=true;window.__WS_HUB_TOKEN__=${JSON.stringify(TOKEN)};</script>`;
      html = html.replace("<head>", "<head>" + inject);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(html);
    }

    if (p === "/favicon.ico") {
      const ico = path.join(HERE, "ws-hub.ico");
      if (fs.existsSync(ico)) {
        res.writeHead(200, { "Content-Type": "image/x-icon", "Cache-Control": "max-age=3600" });
        return res.end(fs.readFileSync(ico));
      }
      res.writeHead(204);
      return res.end();
    }

    send(res, 404, { error: "not found" });
  } catch (e) {
    log("ERROR " + e.message);
    send(res, 500, { error: e.message });
  }
});

function listen(port, left) {
  server.once("error", err => {
    if (err.code === "EADDRINUSE" && left > 0) { listen(port + 1, left - 1); }
    else { log("listen failed: " + err.message); process.exit(1); }
  });
  server.listen(port, "127.0.0.1", () => {
    log(`serving ${HUB} on http://127.0.0.1:${port}/`);
    try {
      fs.writeFileSync(path.join(HERE, ".server.json"), JSON.stringify({ port, pid: process.pid }, null, 2));
    } catch {}
  });
}

listen(START_PORT, 8);

/**
 * Dynamic QA Checklist — Full App
 *
 * Setup:
 *   npm install @supabase/supabase-js xlsx
 *
 * Vercel env vars:
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=your-anon-key
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

// ─── Supabase ────────────────────────────────────────────────
const sb = createClient(
  (import.meta as any).env.VITE_SUPABASE_URL as string,
  (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string
);

// ─── Types ───────────────────────────────────────────────────
type Status = "pass" | "fail" | "untested";
type Priority = "Critical" | "High" | "Medium" | "Low";
type AppView = "login" | "checklist" | "admin";
type Role = "Student" | "Teacher" | "Admin";

const ALL_ROLES: Role[] = ["Student", "Teacher", "Admin"];

const ROLE_CFG: Record<Role, { color: string; bg: string; icon: string }> = {
  Student: { color: "#38bdf8", bg: "#0c2a3f", icon: "🎓" },
  Teacher: { color: "#a78bfa", bg: "#1e1040", icon: "📖" },
  Admin:   { color: "#fb923c", bg: "#2d1506", icon: "🔧" },
};

interface TestCase {
  id: string;
  section: string;
  title: string;
  procedure?: string;
  expected_result?: string;
  priority: Priority;
  link_required: boolean;
  is_active: boolean;
  roles: Role[];   // multi-value, stored as text[] in Supabase
}

interface TestResult {
  id?: string;
  user_name: string;
  user_email: string;
  test_id: string;
  status: Status;
  notes: string;
  updated_at: string;
}

interface UserSummary {
  user_name: string;
  user_email: string;
  passed: number;
  failed: number;
  skipped: number;
  total_tested: number;
  pass_rate: number;
  last_active: string;
}

interface TestCoverage {
  id: string;
  section: string;
  title: string;
  priority: Priority;
  pass_count: number;
  fail_count: number;
  untested_count: number;
  tester_count: number;
  testers: string;
}

// ─── Constants ───────────────────────────────────────────────
const PRIORITY_CFG: Record<Priority, { color: string; bg: string }> = {
  Critical: { color: "#ef4444", bg: "#450a0a" },
  High:     { color: "#f97316", bg: "#431407" },
  Medium:   { color: "#eab308", bg: "#422006" },
  Low:      { color: "#22c55e", bg: "#052e16" },
};

const STATUS_CFG = {
  pass:     { color: "#4ade80", bg: "#14532d", label: "PASS",    icon: "✓" },
  fail:     { color: "#f87171", bg: "#450a0a", label: "FAIL",    icon: "✗" },
  untested: { color: "#64748b", bg: "#1e293b", label: "UNTESTED",icon: "–" },
};

// ─── Tiny helpers ────────────────────────────────────────────
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function Badge({ status }: { status: Status }) {
  const c = STATUS_CFG[status];
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, fontFamily: "monospace", whiteSpace: "nowrap" }}>
      {c.icon} {c.label}
    </span>
  );
}

function PriBadge({ p }: { p: Priority }) {
  const c = PRIORITY_CFG[p];
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, fontFamily: "monospace" }}>{p}</span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const c = ROLE_CFG[role];
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, fontFamily: "monospace", display: "inline-flex", alignItems: "center", gap: 3 }}>
      {c.icon} {role}
    </span>
  );
}

function RoleToggle({ value, onChange }: { value: Role[]; onChange: (r: Role[]) => void }) {
  const toggle = (r: Role) =>
    onChange(value.includes(r) ? value.filter(x => x !== r) : [...value, r]);
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {ALL_ROLES.map(r => {
        const on = value.includes(r);
        const c = ROLE_CFG[r];
        return (
          <button key={r} onClick={() => toggle(r)} style={{ padding: "3px 10px", borderRadius: 999, border: `1px solid ${on ? c.color : "#1e3a5f"}`, background: on ? c.bg : "transparent", color: on ? c.color : "#334155", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", transition: "all .15s" }}>
            {c.icon} {r}
          </button>
        );
      })}
    </div>
  );
}


function MiniBar({ pass, fail, total }: { pass: number; fail: number; total: number }) {
  const pp = pct(pass, total), fp = pct(fail, total);
  return (
    <div style={{ height: 6, background: "#1e293b", borderRadius: 999, overflow: "hidden", display: "flex" }}>
      <div style={{ width: `${pp}%`, background: "#22c55e", transition: "width .4s" }} />
      <div style={{ width: `${fp}%`, background: "#ef4444", transition: "width .4s" }} />
    </div>
  );
}

// ─── Login ───────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (n: string, e: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  const go = () => {
    if (!name.trim()) { setErr("Name required."); return; }
    if (!email.includes("@")) { setErr("Valid email required."); return; }
    onLogin(name.trim(), email.trim().toLowerCase());
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backgroundImage: "radial-gradient(ellipse at 20% 50%, rgba(14,165,233,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 50%)" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", marginBottom: 16, fontSize: 30 }}>📋</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#f8fafc", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.03em" }}>QA Checklist</h1>
          <p style={{ margin: "8px 0 0", color: "#475569", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Enter your details to start testing</p>
        </div>

        <div style={{ background: "#0f1a2e", border: "1px solid #1e3a5f", borderRadius: 16, padding: "28px 24px" }}>
          {["Name", "Email"].map((label, i) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.09em" }}>{label}</label>
              <input
                value={i === 0 ? name : email}
                type={i === 1 ? "email" : "text"}
                placeholder={i === 0 ? "Sarah Johnson" : "sarah@org.com"}
                onChange={e => i === 0 ? setName(e.target.value) : setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && go()}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #1e3a5f", background: "#060d1a", color: "#f1f5f9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}
          {err && <p style={{ color: "#f87171", fontSize: 12, margin: "0 0 12px", fontFamily: "'DM Sans', sans-serif" }}>{err}</p>}
          <button onClick={go} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Syne', sans-serif", letterSpacing: "0.02em" }}>
            Start Testing →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin view ──────────────────────────────────────────────
function AdminView({
  onBack, testCases, onCasesReloaded,
}: {
  onBack: () => void;
  testCases: TestCase[];
  onCasesReloaded: () => void;
}) {
  const [tab, setTab] = useState<"upload" | "analytics" | "coverage">("analytics");
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [coverage, setCoverage] = useState<TestCoverage[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [uploadState, setUploadState] = useState<"idle" | "parsing" | "uploading" | "done" | "error">("idle");
  const [uploadMsg, setUploadMsg] = useState("");
  const [preview, setPreview] = useState<TestCase[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      sb.from("v_user_summary").select("*"),
      sb.from("v_test_coverage").select("*"),
    ]).then(([u, c]) => {
      setUsers((u.data ?? []) as UserSummary[]);
      setCoverage((c.data ?? []) as TestCoverage[]);
      setLoadingAnalytics(false);
    });
  }, []);

  // ── xlsx upload ──
  const handleFile = async (file: File) => {
    setUploadState("parsing");
    setPreview([]);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

      const cases: TestCase[] = rows.map((r) => {
        const rawRoles = String(r.roles ?? "").trim();
        const parsedRoles: Role[] = rawRoles
          ? rawRoles.split(",").map(s => s.trim()).filter((s): s is Role => ALL_ROLES.includes(s as Role))
          : [];
        return {
          id: String(r.id ?? "").trim(),
          section: String(r.section ?? "").trim(),
          title: String(r.title ?? "").trim(),
          procedure: String(r.procedure ?? "").trim(),
          expected_result: String(r.expected_result ?? "").trim(),
          priority: (["Critical","High","Medium","Low"].includes(r.priority) ? r.priority : "Medium") as Priority,
          link_required: String(r.link_required ?? "").toUpperCase() === "TRUE",
          roles: parsedRoles,
          is_active: true,
        };
      }).filter(c => c.id && c.title);

      if (!cases.length) throw new Error("No valid rows found. Check column headers match the template.");
      setPreview(cases);
      setUploadState("idle");
      setUploadMsg(`✓ Parsed ${cases.length} test cases. Review below and confirm upload.`);
    } catch (e: any) {
      setUploadState("error");
      setUploadMsg(e.message ?? "Parse error");
    }
  };

  const confirmUpload = async () => {
    if (!preview.length) return;
    setUploadState("uploading");
    // Deactivate old cases not in new set
    const newIds = preview.map(c => c.id);
    await sb.from("test_cases").update({ is_active: false }).not("id", "in", `(${newIds.map(i => `"${i}"`).join(",")})`)
    const { error } = await sb.from("test_cases").upsert(preview, { onConflict: "id" });
    if (error) { setUploadState("error"); setUploadMsg(error.message); return; }
    setUploadState("done");
    setUploadMsg(`✓ ${preview.length} test cases uploaded successfully!`);
    setPreview([]);
    onCasesReloaded();
  };

  // ── analytics numbers ──
  const totalUsers = users.length;
  const totalPass = users.reduce((a, u) => a + Number(u.passed), 0);
  const totalFail = users.reduce((a, u) => a + Number(u.failed), 0);
  const totalTests = testCases.length;
  const coveredTests = coverage.filter(c => c.tester_count > 0).length;

  const TABS = [
    { key: "analytics", label: "📊 Analytics" },
    { key: "coverage",  label: "🗂 Coverage" },
    { key: "upload",    label: "📤 Upload Cases" },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "14px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onBack} style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>← Back</button>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 18, color: "#f1f5f9" }}>Admin Panel</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tab === t.key ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "#1e293b", color: tab === t.key ? "#fff" : "#64748b", fontFamily: "'DM Sans', sans-serif" }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px 48px" }}>

        {/* ── Analytics tab ── */}
        {tab === "analytics" && (
          <div>
            {/* KPI cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
              {[
                { label: "Total Testers", value: totalUsers, color: "#0ea5e9", icon: "👥" },
                { label: "Test Cases", value: totalTests, color: "#a78bfa", icon: "📋" },
                { label: "Total Passes", value: totalPass, color: "#22c55e", icon: "✓" },
                { label: "Total Failures", value: totalFail, color: "#ef4444", icon: "✗" },
                { label: "Coverage", value: `${coveredTests}/${totalTests}`, color: "#f59e0b", icon: "🎯" },
              ].map(k => (
                <div key={k.label} style={{ background: "#0f1a2e", border: "1px solid #1e3a5f", borderRadius: 14, padding: "18px 20px" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{k.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: k.color, fontFamily: "'Syne', sans-serif" }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Per-user table */}
            <div style={{ background: "#0f1a2e", border: "1px solid #1e3a5f", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e3a5f" }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>👥 Testers</h3>
              </div>
              {loadingAnalytics ? (
                <div style={{ padding: 24, color: "#475569", textAlign: "center" }}>Loading…</div>
              ) : users.length === 0 ? (
                <div style={{ padding: 24, color: "#475569", textAlign: "center" }}>No testers yet.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#0a1628" }}>
                        {["Tester","Email","Pass","Fail","Tested","Pass Rate","Progress","Last Active"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u.user_email} style={{ borderTop: "1px solid #1e3a5f", background: i % 2 === 0 ? "#0f1a2e" : "#0a1628" }}>
                          <td style={{ padding: "10px 14px", fontSize: 13, color: "#f1f5f9", fontWeight: 600, whiteSpace: "nowrap" }}>{u.user_name}</td>
                          <td style={{ padding: "10px 14px", fontSize: 12, color: "#475569" }}>{u.user_email}</td>
                          <td style={{ padding: "10px 14px" }}><span style={{ color: "#4ade80", fontWeight: 700, fontSize: 13 }}>{u.passed}</span></td>
                          <td style={{ padding: "10px 14px" }}><span style={{ color: "#f87171", fontWeight: 700, fontSize: 13 }}>{u.failed}</span></td>
                          <td style={{ padding: "10px 14px", fontSize: 12, color: "#94a3b8" }}>{u.total_tested}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ color: Number(u.pass_rate) >= 80 ? "#4ade80" : Number(u.pass_rate) >= 50 ? "#fbbf24" : "#f87171", fontWeight: 700, fontSize: 13 }}>{u.pass_rate ?? 0}%</span>
                          </td>
                          <td style={{ padding: "10px 14px", minWidth: 100 }}>
                            <MiniBar pass={Number(u.passed)} fail={Number(u.failed)} total={Number(u.total_tested)} />
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 11, color: "#334155", whiteSpace: "nowrap" }}>{u.last_active ? new Date(u.last_active).toLocaleDateString() : "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Coverage tab ── */}
        {tab === "coverage" && (
          <div style={{ background: "#0f1a2e", border: "1px solid #1e3a5f", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e3a5f" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>🗂 Test Coverage — who tested what</h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0a1628" }}>
                    {["ID","Section","Title","Priority","Roles","✓ Pass","✗ Fail","Testers","Tested By"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: "1px solid #1e3a5f", background: i % 2 === 0 ? "#0f1a2e" : "#0a1628" }}>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{c.id}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#7dd3fc" }}>{c.section}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#f1f5f9", maxWidth: 200 }}>{c.title}</td>
                      <td style={{ padding: "10px 14px" }}><PriBadge p={c.priority} /></td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {((c as any).roles as Role[] ?? []).map((r: Role) => <RoleBadge key={r} role={r} />)}
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#4ade80", fontWeight: 700, fontSize: 13 }}>{c.pass_count}</td>
                      <td style={{ padding: "10px 14px", color: "#f87171", fontWeight: 700, fontSize: 13 }}>{c.fail_count}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#94a3b8" }}>{c.tester_count}</td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "#475569", maxWidth: 200, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.testers ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Upload tab ── */}
        {tab === "upload" && (
          <div>
            {/* Instructions */}
            <div style={{ background: "#0f1a2e", border: "1px solid #1e3a5f", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#f1f5f9" }}>📄 xlsx Column Headers</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                {[
                  ["id","Unique key, e.g. lti-1"],
                  ["section","Group / category"],
                  ["title","Short test name"],
                  ["procedure","Testing steps"],
                  ["expected_result","What should happen"],
                  ["priority","Critical/High/Medium/Low"],
                  ["link_required","TRUE or FALSE"],
                  ["roles","Comma-separated: Student, Teacher, Admin"],
                ].map(([col, desc]) => (
                  <div key={col} style={{ background: "#0a1628", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#0ea5e9", fontWeight: 700 }}>{col}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              style={{ border: "2px dashed #1e3a5f", borderRadius: 14, padding: "40px 20px", textAlign: "center", cursor: "pointer", background: "#0f1a2e", marginBottom: 20, transition: "border-color .2s" }}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <div style={{ fontSize: 36, marginBottom: 8 }}>📤</div>
              <div style={{ fontWeight: 700, color: "#7dd3fc", fontFamily: "'Syne', sans-serif", fontSize: 15 }}>Drop your .xlsx here or click to browse</div>
              <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>Replaces existing test cases on confirm</div>
            </div>

            {uploadMsg && (
              <div style={{ background: uploadState === "error" ? "#450a0a" : "#0f2a1a", border: `1px solid ${uploadState === "error" ? "#ef4444" : "#22c55e"}`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: uploadState === "error" ? "#f87171" : "#4ade80", fontFamily: "monospace" }}>
                {uploadMsg}
              </div>
            )}

            {/* Preview table */}
            {preview.length > 0 && (
              <div style={{ background: "#0f1a2e", border: "1px solid #1e3a5f", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid #1e3a5f", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Preview — {preview.length} cases</span>
                  <button onClick={confirmUpload} disabled={uploadState === "uploading"} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    {uploadState === "uploading" ? "Uploading…" : "✓ Confirm & Upload"}
                  </button>
                </div>
                <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0, background: "#0a1628" }}>
                      <tr>
                        {["ID","Section","Title","Priority","Roles","Link?"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((c, i) => (
                        <tr key={c.id} style={{ borderTop: "1px solid #1e3a5f", background: i % 2 === 0 ? "#0f1a2e" : "#0a1628" }}>
                          <td style={{ padding: "8px 12px", fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{c.id}</td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: "#7dd3fc" }}>{c.section}</td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: "#f1f5f9" }}>{c.title}</td>
                          <td style={{ padding: "8px 12px" }}><PriBadge p={c.priority} /></td>
                          <td style={{ padding: "8px 12px" }}>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {c.roles.length ? c.roles.map(r => <RoleBadge key={r} role={r} />) : <span style={{ fontSize: 10, color: "#334155" }}>—</span>}
                            </div>
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: c.link_required ? "#fb923c" : "#334155" }}>{c.link_required ? "⚠ Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Test row ────────────────────────────────────────────────
function TestRow({
  tc, myResult, otherResults, onSave, saving,
}: {
  tc: TestCase;
  myResult: TestResult | null;
  otherResults: TestResult[];
  onSave: (testId: string, status: Status, notes: string) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(myResult?.status ?? "untested");
  const [notes, setNotes] = useState(myResult?.notes ?? "");
  const [dirty, setDirty] = useState(false);
  const [editingRoles, setEditingRoles] = useState(false);
  const [localRoles, setLocalRoles] = useState<Role[]>(tc.roles ?? []);
  const [rolesSaving, setRolesSaving] = useState(false);

  useEffect(() => {
    if (myResult) { setStatus(myResult.status); setNotes(myResult.notes ?? ""); setDirty(false); }
  }, [myResult]);

  useEffect(() => { setLocalRoles(tc.roles ?? []); }, [tc.roles]);

  const saveRoles = async () => {
    setRolesSaving(true);
    await sb.from("test_cases").update({ roles: localRoles }).eq("id", tc.id);
    tc.roles = localRoles; // optimistic local update
    setEditingRoles(false);
    setRolesSaving(false);
  };

  const others = otherResults.filter(r => r.status !== "untested");
  const borderCol = status === "pass" ? "#22c55e33" : status === "fail" ? "#ef444433" : "#1e3a5f";
  const rowBg = status === "pass" ? "#0a1a10" : status === "fail" ? "#1a0a0a" : "#0f1a2e";

  return (
    <div style={{ background: rowBg, border: `1px solid ${borderCol}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", cursor: "pointer" }} onClick={() => setOpen(v => !v)}>
        <Badge status={status} />
        <PriBadge p={tc.priority} />
        {localRoles.length > 0 && (
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            {localRoles.map(r => <RoleBadge key={r} role={r} />)}
          </div>
        )}
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif" }}>{tc.title}</span>
        {tc.link_required && <span style={{ fontSize: 10, background: "#431407", color: "#fb923c", padding: "2px 7px", borderRadius: 999, fontWeight: 700, flexShrink: 0 }}>⚠ LINK</span>}
        {others.length > 0 && <span style={{ fontSize: 11, color: "#334155", flexShrink: 0 }}>{others.length} tester{others.length > 1 ? "s" : ""}</span>}
        <span style={{ color: "#334155", fontSize: 14, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>▾</span>
      </div>

      {open && (
        <div style={{ padding: "0 14px 16px", borderTop: "1px solid #1e3a5f" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "12px 0" }}>
            {[["📋 Procedure", tc.procedure], ["✅ Expected", tc.expected_result]].map(([label, text]) => (
              <div key={label as string}>
                <div style={{ fontSize: 10, fontWeight: 700, color: label?.includes("Procedure") ? "#0ea5e9" : "#22c55e", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{text || "—"}</p>
              </div>
            ))}
          </div>

          {/* Role labels + inline editor */}
          <div style={{ background: "#060d1a", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>👤 Applies To</div>
              {!editingRoles
                ? <button onClick={() => setEditingRoles(true)} style={{ fontSize: 10, color: "#475569", background: "transparent", border: "1px solid #1e3a5f", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>Edit</button>
                : <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={saveRoles} disabled={rolesSaving} style={{ fontSize: 10, color: "#4ade80", background: "#14532d", border: "none", borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontWeight: 700 }}>{rolesSaving ? "…" : "Save"}</button>
                    <button onClick={() => { setLocalRoles(tc.roles ?? []); setEditingRoles(false); }} style={{ fontSize: 10, color: "#475569", background: "transparent", border: "1px solid #1e3a5f", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>Cancel</button>
                  </div>
              }
            </div>
            {editingRoles
              ? <RoleToggle value={localRoles} onChange={setLocalRoles} />
              : <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {localRoles.length
                    ? localRoles.map(r => <RoleBadge key={r} role={r} />)
                    : <span style={{ fontSize: 11, color: "#334155", fontStyle: "italic" }}>No roles assigned — click Edit</span>}
                </div>
            }
          </div>

          {others.length > 0 && (
            <div style={{ background: "#060d1a", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>👥 Other Testers</div>
              {others.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: i < others.length - 1 ? 5 : 0 }}>
                  <Badge status={r.status} />
                  <div>
                    <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>{r.user_name}</span>
                    <span style={{ fontSize: 11, color: "#334155", marginLeft: 6 }}>{new Date(r.updated_at).toLocaleDateString()}</span>
                    {r.notes && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#475569", fontStyle: "italic", fontFamily: "'DM Sans', sans-serif" }}>{r.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* My result */}
          <div style={{ background: "#060d1a", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>📝 My Result</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {(["pass", "fail", "untested"] as Status[]).map(s => (
                <button key={s} onClick={() => { setStatus(s); setDirty(true); }} style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11, fontFamily: "monospace", transition: "all .15s", background: status === s ? (s === "pass" ? "#15803d" : s === "fail" ? "#b91c1c" : "#334155") : "#1e293b", color: status === s ? "#fff" : "#334155" }}>
                  {s === "pass" ? "✓ PASS" : s === "fail" ? "✗ FAIL" : "– SKIP"}
                </button>
              ))}
            </div>
            <textarea value={notes} onChange={e => { setNotes(e.target.value); setDirty(true); }} placeholder="Notes, observations, bug details…" rows={2} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #1e3a5f", background: "#0f1a2e", color: "#f1f5f9", fontSize: 12, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
            <button onClick={() => { onSave(tc.id, status, notes); setDirty(false); }} disabled={saving || (!dirty && !!myResult)} style={{ marginTop: 8, padding: "7px 18px", borderRadius: 8, border: "none", cursor: dirty || !myResult ? "pointer" : "default", background: dirty || !myResult ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "#1e293b", color: dirty || !myResult ? "#fff" : "#334155", fontWeight: 700, fontSize: 11, fontFamily: "monospace", transition: "all .15s" }}>
              {saving ? "Saving…" : myResult && !dirty ? "✓ Saved" : "Save Result"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Checklist view ──────────────────────────────────────────
function ChecklistView({
  user, testCases, onAdmin, onSignOut,
}: {
  user: { name: string; email: string };
  testCases: TestCase[];
  onAdmin: () => void;
  onSignOut: () => void;
}) {
  const [myResults, setMyResults] = useState<Record<string, TestResult>>({});
  const [allResults, setAllResults] = useState<Record<string, TestResult[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [filterSection, setFilterSection] = useState("All");
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");
  const [filterRole, setFilterRole] = useState<Role | "all">("all");

  const load = useCallback(async () => {
    const { data } = await sb.from("test_results").select("*");
    const all: Record<string, TestResult[]> = {};
    const mine: Record<string, TestResult> = {};
    (data ?? []).forEach((r: TestResult) => {
      if (!all[r.test_id]) all[r.test_id] = [];
      all[r.test_id].push(r);
      if (r.user_email === user.email) mine[r.test_id] = r;
    });
    setAllResults(all);
    setMyResults(mine);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (testId: string, status: Status, notes: string) => {
    setSaving(testId);
    await sb.from("test_results").upsert({ user_name: user.name, user_email: user.email, test_id: testId, status, notes, updated_at: new Date().toISOString() }, { onConflict: "user_email,test_id" });
    await load();
    setSaving(null);
  };

  // Group by section
  const sections = Array.from(new Set(testCases.map(t => t.section)));
  const sectionColors: Record<string, string> = {};
  const palette = ["#0ea5e9","#f59e0b","#8b5cf6","#10b981","#ef4444","#06b6d4","#f97316","#64748b","#ec4899","#a3e635"];
  sections.forEach((s, i) => { sectionColors[s] = palette[i % palette.length]; });

  const active = testCases.filter(t => t.is_active);
  const done = active.filter(t => myResults[t.id] && myResults[t.id].status !== "untested").length;
  const passed = active.filter(t => myResults[t.id]?.status === "pass").length;
  const failed = active.filter(t => myResults[t.id]?.status === "fail").length;
  const progress = pct(done, active.length);

  const filtered = active.filter(t =>
    (filterSection === "All" || t.section === filterSection) &&
    (filterStatus === "all" || (myResults[t.id]?.status ?? "untested") === filterStatus) &&
    (filterRole === "all" || (t.roles ?? []).includes(filterRole))
  );

  const grouped: Record<string, TestCase[]> = {};
  filtered.forEach(t => { if (!grouped[t.section]) grouped[t.section] = []; grouped[t.section].push(t); });

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "#0a1628", borderBottom: "1px solid #1e3a5f", padding: "12px 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>📋</span>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 15, color: "#f1f5f9" }}>QA Checklist</div>
                <div style={{ fontSize: 11, color: "#334155" }}>Testing as <strong style={{ color: "#7dd3fc" }}>{user.name}</strong></div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ background: "#14532d", color: "#4ade80", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>✓ {passed}</span>
              <span style={{ background: "#450a0a", color: "#f87171", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>✗ {failed}</span>
              <span style={{ color: "#7dd3fc", fontWeight: 700, fontSize: 12, fontFamily: "monospace" }}>{progress}%</span>
              <button onClick={onAdmin} style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>📊 Admin</button>
              <button onClick={onSignOut} style={{ background: "transparent", border: "1px solid #1e3a5f", color: "#334155", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 11 }}>Sign Out</button>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ marginTop: 8, height: 3, background: "#0f172a", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: progress === 100 ? "#22c55e" : "linear-gradient(90deg,#0ea5e9,#6366f1)", borderRadius: 999, transition: "width .4s" }} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px 48px" }}>
        {active.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#334155" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 900, color: "#1e3a5f" }}>No test cases yet</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Ask an admin to upload test cases via the Admin panel.</div>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #1e3a5f", background: "#0f1a2e", color: "#94a3b8", fontSize: 12, cursor: "pointer", outline: "none" }}>
                <option value="All">All Sections</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {(["all","pass","fail","untested"] as const).map(f => (
                <button key={f} onClick={() => setFilterStatus(f)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: filterStatus === f ? (f === "pass" ? "#15803d" : f === "fail" ? "#b91c1c" : f === "untested" ? "#334155" : "linear-gradient(135deg,#0ea5e9,#6366f1)") : "#1e293b", color: filterStatus === f ? "#fff" : "#475569", fontFamily: "monospace" }}>
                  {f === "all" ? "All" : f.toUpperCase()}
                </button>
              ))}
              {/* Role filter */}
              <div style={{ width: 1, background: "#1e3a5f", margin: "0 2px" }} />
              <button onClick={() => setFilterRole("all")} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: filterRole === "all" ? "#334155" : "#1e293b", color: filterRole === "all" ? "#fff" : "#475569", fontFamily: "monospace" }}>
                All Roles
              </button>
              {ALL_ROLES.map(r => {
                const c = ROLE_CFG[r];
                const active = filterRole === r;
                return (
                  <button key={r} onClick={() => setFilterRole(r)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${active ? c.color : "transparent"}`, cursor: "pointer", fontSize: 11, fontWeight: 600, background: active ? c.bg : "#1e293b", color: active ? c.color : "#475569", fontFamily: "monospace" }}>
                    {c.icon} {r}
                  </button>
                );
              })}
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#334155", alignSelf: "center" }}>{filtered.length} tests</span>
            </div>

            {Object.entries(grouped).map(([sec, cases]) => {
              const col = sectionColors[sec] ?? "#0ea5e9";
              const sp = cases.filter(c => myResults[c.id]?.status === "pass").length;
              const sf = cases.filter(c => myResults[c.id]?.status === "fail").length;
              return (
                <div key={sec} style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${col}22` }}>
                    <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: col, fontFamily: "'Syne', sans-serif" }}>{sec}</h2>
                    <div style={{ display: "flex", gap: 6 }}>
                      {sp > 0 && <span style={{ background: "#14532d", color: "#4ade80", padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>✓ {sp}</span>}
                      {sf > 0 && <span style={{ background: "#450a0a", color: "#f87171", padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>✗ {sf}</span>}
                      <span style={{ color: "#1e3a5f", fontSize: 10 }}>{cases.length}</span>
                    </div>
                  </div>
                  {cases.map(tc => (
                    <TestRow key={tc.id} tc={tc} myResult={myResults[tc.id] ?? null} otherResults={(allResults[tc.id] ?? []).filter(r => r.user_email !== user.email)} onSave={handleSave} saving={saving === tc.id} />
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<AppView>("login");
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  const loadCases = useCallback(async () => {
    const { data } = await sb.from("test_cases").select("*").eq("is_active", true).order("section").order("id");
    setTestCases((data ?? []) as TestCase[]);
  }, []);

  const handleLogin = (name: string, email: string) => {
    setUser({ name, email });
    loadCases();
    setView("checklist");
  };

  if (view === "login") return <LoginScreen onLogin={handleLogin} />;
  if (view === "admin") return <AdminView onBack={() => setView("checklist")} testCases={testCases} onCasesReloaded={loadCases} />;
  return <ChecklistView user={user!} testCases={testCases} onAdmin={() => setView("admin")} onSignOut={() => { setUser(null); setView("login"); }} />;
}
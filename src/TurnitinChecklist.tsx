/**
 * Turnitin LTI 1.3 QA Checklist
 *
 * Setup:
 *  1. Run supabase_schema.sql in your Supabase SQL Editor
 *  2. Create a .env file (or Vercel env vars):
 *       VITE_SUPABASE_URL=https://xxxx.supabase.co
 *       VITE_SUPABASE_ANON_KEY=your-anon-key
 *  3. npm install @supabase/supabase-js
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client ──────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

// ── Types ────────────────────────────────────────────────────
type Status = "pass" | "fail" | "untested";

interface TestItem {
  id: string;
  title: string;
  procedure: string;
  expected: string;
  linkRequired?: boolean;
}

interface Section {
  section: string;
  color: string;
  items: TestItem[];
}

interface TestResult {
  test_id: string;
  status: Status;
  notes: string;
  test_title?: string;
  user_name: string;
  user_email: string;
  updated_at: string;
}

interface AllResults {
  [testId: string]: TestResult[];
}

// ── Checklist data ───────────────────────────────────────────
const CHECKLIST: Section[] = [
  {
    section: "LTI 1.3 Integration Setup",
    color: "#0ea5e9",
    items: [
      { id: "lti-1", title: "LTI 1.3 Tool Launch", procedure: "From your LMS course, click the Turnitin assignment link. Verify it launches without errors and you land on the Turnitin interface.", expected: "Tool launches successfully via LTI 1.3 handshake." },
      { id: "lti-2", title: "Role Mapping — Instructor", procedure: "Log in as an Instructor in the LMS, open a Turnitin assignment. Confirm you see the instructor dashboard (inbox, settings).", expected: "Instructor role correctly passed; instructor view shown." },
      { id: "lti-3", title: "Role Mapping — Student", procedure: "Log in as a Student, open the same assignment. Confirm you see the student submission view, not instructor controls.", expected: "Student role correctly passed; student view shown." },
      { id: "lti-4", title: "Deep Linking / Content Item Return", procedure: "Create a new Turnitin assignment directly from within the LMS using the LTI content picker. Save and verify the link appears in the course.", expected: "Assignment created and linked back to LMS successfully." },
    ],
  },
  {
    section: "Assignment & Grade Visibility",
    color: "#f59e0b",
    items: [
      { id: "grade-1", title: "Grades Visible Prior to Post Date", procedure: "Open the TII assignment link where grades are visible before the post date. As a student, check if grade/mark is visible before the post date.", expected: "Investigate — grades should NOT be visible before post date. This is a bug if they are.", linkRequired: true },
      { id: "grade-2", title: "Grades Hidden Before Post Date", procedure: "Set a post date in the future. Submit as a student. Check the grade column in LMS — grade should be hidden/unreleased.", expected: "Grade not visible to student until post date is reached." },
      { id: "grade-3", title: "Grade Passback to LMS Gradebook", procedure: "As instructor, mark a submission in Turnitin Feedback Studio. Wait, then check the LMS gradebook for that student.", expected: "Grade passed back automatically via LTI Advantage AGS." },
      { id: "grade-4", title: "Late Submission Handling", procedure: "Submit a paper after the due date. Check if TII marks it as late and whether it's accepted or blocked per assignment settings.", expected: "Late submissions handled per configured policy." },
    ],
  },
  {
    section: "Assignment Copy Tool",
    color: "#8b5cf6",
    items: [
      { id: "copy-1", title: "Copy Assignment — Same Course", procedure: "Use the 'Copy Assignment' or duplicate option within the same course. Verify all settings (due date, post date, rubric, originality settings) are preserved.", expected: "Assignment duplicated with all settings intact." },
      { id: "copy-2", title: "Copy Assignment — Different Course", procedure: "Copy a Turnitin assignment to a different course. Launch the copied assignment and verify settings transferred correctly.", expected: "Assignment copies across courses; settings preserved." },
      { id: "copy-3", title: "Rubric Preserved After Copy", procedure: "Attach a rubric to an assignment, then copy it. Open the copied assignment and confirm the rubric is still attached.", expected: "Rubric carried over with the assignment copy." },
    ],
  },
  {
    section: "Rubric Management",
    color: "#10b981",
    items: [
      { id: "rubric-1", title: "Import a Rubric", procedure: "In the Turnitin assignment, go to Optional Settings → Rubric. Select 'Import Rubric'. Upload a valid .rbc or Excel rubric file. Save and attach it.", expected: "Rubric imported and attached without errors." },
      { id: "rubric-2", title: "Create a New Rubric", procedure: "Inside the rubric manager, click 'Create New Rubric'. Add 3 criteria and 3 scale levels. Set point values. Save and attach it to an assignment.", expected: "Rubric created, saved, and attached successfully." },
      { id: "rubric-3", title: "Rubric Visible to Students (Before Submission)", procedure: "Enable 'Allow students to view rubric before submission'. Log in as student, open the assignment and look for the rubric icon/link.", expected: "Students can view the rubric before submitting." },
      { id: "rubric-4", title: "Rubric Displays Correctly to Students", procedure: "As a student, click to view the rubric. Check all criteria, scale levels, descriptions, and point values render correctly on desktop and mobile.", expected: "Rubric renders fully and is readable across device sizes." },
      { id: "rubric-5", title: "Rubric Used in Grading — Instructor View", procedure: "Open a submission in Feedback Studio as instructor. Click the rubric icon. Score each criterion. Verify total score calculates and can be saved.", expected: "Rubric scoring works; total auto-calculates correctly." },
      { id: "rubric-6", title: "Graded Rubric Visible to Student", procedure: "After instructor scores the rubric and the post date has passed, log in as student and open the feedback. Verify the completed rubric is visible.", expected: "Student sees scored rubric with criterion-level feedback." },
    ],
  },
  {
    section: "Submission Deletion & Privacy",
    color: "#ef4444",
    items: [
      { id: "del-1", title: "Instructor Deletes a Student Submission", procedure: "In the assignment inbox, locate a student submission. Click the delete/trash icon. Confirm the deletion prompt. Verify the submission is removed from the inbox.", expected: "Submission deleted from inbox; student can re-submit if allowed." },
      { id: "del-2", title: "Student Re-submission After Deletion", procedure: "After deleting a student's submission, log in as that student and attempt to re-submit a paper.", expected: "Student is able to re-submit after instructor deletes their original." },
      { id: "del-3", title: "Request Permanent Deletion of a Student Paper", procedure: "In the assignment inbox, locate the submission. Find 'Request Permanent Deletion' option (may be under a kebab menu). Submit the request with a valid reason.", expected: "Permanent deletion request submitted; confirmation message shown." },
      { id: "del-4", title: "Permanent Deletion — Paper Removed from Repository", procedure: "After Turnitin processes the deletion request, submit the same paper again to a test assignment. Check the Similarity Report — paper should not match itself.", expected: "Paper removed from Turnitin's repository; no self-match on re-submission." },
    ],
  },
  {
    section: "Submission & Similarity",
    color: "#06b6d4",
    items: [
      { id: "sub-1", title: "Student File Upload Submission", procedure: "As student, submit a Word (.docx) file. Verify the submission receipt is shown and the paper appears in the instructor inbox.", expected: "File accepted; submission receipt displayed." },
      { id: "sub-2", title: "Student Text-Only Submission", procedure: "As student, use the text box submission option. Paste at least 200 words and submit. Verify it processes.", expected: "Text submission accepted and processed." },
      { id: "sub-3", title: "Similarity Report Generates", procedure: "Wait for the Similarity Report to generate. Open the report as instructor. Verify score and highlighted sources appear.", expected: "Similarity Report generated; score and sources visible." },
      { id: "sub-4", title: "Student Views Own Similarity Report", procedure: "If configured to show reports to students, log in as student and open the submission. Verify they can see the Similarity Report.", expected: "Student sees similarity score per assignment settings." },
    ],
  },
  {
    section: "Feedback Studio",
    color: "#f97316",
    items: [
      { id: "fb-1", title: "Inline Comments", procedure: "Open a submission in Feedback Studio. Highlight text and add an inline comment. Save. Reopen and verify the comment persists.", expected: "Inline comment saved and displayed on re-open." },
      { id: "fb-2", title: "QuickMarks", procedure: "In Feedback Studio, drag a QuickMark from the sidebar onto the paper. Verify it attaches to the correct location.", expected: "QuickMark placed and saved correctly." },
      { id: "fb-3", title: "Voice Comments", procedure: "Click the microphone icon in Feedback Studio. Record a short voice comment. Save. Verify it appears on the submission.", expected: "Voice comment recorded and playable." },
      { id: "fb-4", title: "General Feedback / Summary", procedure: "In the general comments area, type overall feedback. Save. Check as student (post post-date) that the general comment is visible.", expected: "General feedback saved and visible to student after release." },
    ],
  },
  {
    section: "Additional Checks",
    color: "#64748b",
    items: [
      { id: "misc-1", title: "Anonymous Marking Mode", procedure: "Enable anonymous marking in assignment settings. As instructor, open the inbox — verify student names are hidden. Grade a paper. Unmask after grading.", expected: "Student identities hidden during anonymous marking phase." },
      { id: "misc-2", title: "Originality Check Settings", procedure: "In assignment settings, verify 'Check against: Student paper repository, Web, Publications' options. Adjust and save. Submit a test paper and verify the report reflects configured sources.", expected: "Similarity checked against configured sources only." },
      { id: "misc-3", title: "Resubmission Policy", procedure: "Set resubmission policy to 'Allow resubmissions until due date'. As student, submit once, then resubmit. Verify the new submission replaces the old.", expected: "Resubmission policy respected; latest submission shown." },
      { id: "misc-4", title: "Accessibility — Keyboard Navigation", procedure: "Navigate the Turnitin interface using only keyboard (Tab, Enter, Arrow keys). Test the submission form, inbox, and Feedback Studio.", expected: "All interactive elements reachable and operable by keyboard." },
      { id: "misc-5", title: "Email Notifications", procedure: "After submission, check if the student receives a submission confirmation email. After grading and post date, check if a grade-released notification is sent.", expected: "Submission and grade-release emails received by student per settings." },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────
const ALL_IDS = CHECKLIST.flatMap((s) => s.items.map((i) => i.id));

function StatusBadge({ status }: { status: Status }) {
  const cfg = {
    pass: { bg: "#dcfce7", color: "#15803d", label: "PASS", icon: "✓" },
    fail: { bg: "#fee2e2", color: "#b91c1c", label: "FAIL", icon: "✗" },
    untested: { bg: "#f1f5f9", color: "#64748b", label: "UNTESTED", icon: "–" },
  }[status];
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, fontFamily: "monospace", letterSpacing: "0.05em" }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── User Login Screen ────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (name: string, email: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) { setErr("Please enter your name."); return; }
    if (!email.trim() || !email.includes("@")) { setErr("Please enter a valid email."); return; }
    onLogin(name.trim(), email.trim().toLowerCase());
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#1e293b", borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 420, boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f1f5f9", fontFamily: "'DM Sans', sans-serif" }}>Turnitin QA Checklist</h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>LTI 1.3 Integration Testing</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sarah Johnson"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Email Address</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. sarah@yourorg.com"
            type="email"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {err && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>{err}</p>}

        <button
          onClick={handleSubmit}
          style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #0ea5e9, #38bdf8)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
        >
          Start Testing →
        </button>
      </div>
    </div>
  );
}

// ── Test Row ─────────────────────────────────────────────────
function TestRow({
  item, section, color, myResult, allResults, onSave, saving,
}: {
  item: TestItem; section: string; color: string;
  myResult: TestResult | null; allResults: TestResult[];
  onSave: (id: string, section: string, title: string, status: Status, notes: string) => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<Status>(myResult?.status ?? "untested");
  const [notes, setNotes] = useState(myResult?.notes ?? "");
  const [dirty, setDirty] = useState(false);


  const otherTesters = allResults.filter((r) => r.status !== "untested");

  const borderColor = status === "pass" ? "#22c55e" : status === "fail" ? "#ef4444" : "#334155";
  const rowBg = status === "pass" ? "#0f2a1a" : status === "fail" ? "#2a0f0f" : "#1e293b";

  return (
    <div style={{ background: rowBg, border: `1px solid ${borderColor}`, borderRadius: 12, marginBottom: 8, overflow: "hidden", transition: "all 0.2s" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>
        <StatusBadge status={status} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#f1f5f9", fontFamily: "'DM Sans', sans-serif" }}>{item.title}</span>
        {item.linkRequired && (
          <span style={{ fontSize: 11, background: "#451a03", color: "#fb923c", padding: "2px 8px", borderRadius: 999, fontWeight: 700, flexShrink: 0 }}>⚠ LINK NEEDED</span>
        )}
        {otherTesters.length > 0 && (
          <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>{otherTesters.length} tester{otherTesters.length > 1 ? "s" : ""}</span>
        )}
        <span style={{ color: "#475569", fontSize: 16, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>▾</span>
      </div>

      {expanded && (
        <div style={{ padding: "0 14px 16px", borderTop: "1px solid #334155" }}>
          {/* Procedure + Expected */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "12px 0" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#0ea5e9", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>📋 Procedure</div>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{item.procedure}</p>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#10b981", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>✅ Expected</div>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{item.expected}</p>
            </div>
          </div>

          {/* Other testers */}
          {otherTesters.length > 0 && (
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>👥 Other Testers</div>
              {otherTesters.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: i < otherTesters.length - 1 ? 6 : 0 }}>
                  <StatusBadge status={r.status} />
                  <div>
                    <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{r.user_name}</span>
                    <span style={{ fontSize: 11, color: "#475569", marginLeft: 6 }}>{new Date(r.updated_at).toLocaleDateString()}</span>
                    {r.notes && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b", fontStyle: "italic", fontFamily: "'DM Sans', sans-serif" }}>{r.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* My result */}
          <div style={{ background: "#0f172a", borderRadius: 8, padding: "12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>📝 My Result</div>

            {/* Status buttons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {(["pass", "fail", "untested"] as Status[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setDirty(true); }}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "monospace",
                    background: status === s ? (s === "pass" ? "#15803d" : s === "fail" ? "#b91c1c" : "#334155") : "#1e293b",
                    color: status === s ? "#fff" : "#475569",
                    transition: "all 0.15s",
                  }}
                >
                  {s === "pass" ? "✓ PASS" : s === "fail" ? "✗ FAIL" : "– SKIP"}
                </button>
              ))}
            </div>

            {/* Notes */}
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
              placeholder="Add notes, observations, or bug details…"
              rows={2}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#f1f5f9", fontSize: 12, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" }}
            />

            {/* Save button */}
            <button
              onClick={() => { onSave(item.id, section, item.title, status, notes); setDirty(false); }}
              disabled={saving || (!dirty && !!myResult)}
              style={{
                marginTop: 8, padding: "8px 20px", borderRadius: 8, border: "none", cursor: dirty || !myResult ? "pointer" : "default",
                background: dirty || !myResult ? color : "#1e293b",
                color: dirty || !myResult ? "#fff" : "#334155",
                fontWeight: 700, fontSize: 12, fontFamily: "monospace", transition: "all 0.15s",
              }}
            >
              {saving ? "Saving…" : myResult && !dirty ? "✓ Saved" : "Save Result"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin / Summary View ─────────────────────────────────────
function AdminView({ onBack }: { onBack: () => void }) {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("test_results").select("*").then(({ data }) => {
      setResults(data ?? []);
      setLoading(false);
    });
  }, []);

  // Group by user
  const byUser: Record<string, TestResult[]> = {};
  results.forEach((r) => {
    const key = r.user_email;
    if (!byUser[key]) byUser[key] = [];
    byUser[key].push(r);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", padding: 24 }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={onBack} style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>← Back</button>
          <h2 style={{ margin: 0, color: "#f1f5f9", fontSize: 20, fontFamily: "'DM Sans', sans-serif" }}>📊 Testing Summary</h2>
        </div>

        {loading ? (
          <p style={{ color: "#475569", fontFamily: "'DM Sans', sans-serif" }}>Loading results…</p>
        ) : Object.keys(byUser).length === 0 ? (
          <p style={{ color: "#475569", fontFamily: "'DM Sans', sans-serif" }}>No results recorded yet.</p>
        ) : (
          Object.entries(byUser).map(([email, rows]) => {
            const pass = rows.filter((r) => r.status === "pass").length;
            const fail = rows.filter((r) => r.status === "fail").length;
            const name = rows[0].user_name;
            return (
              <div key={email} style={{ background: "#1e293b", borderRadius: 14, marginBottom: 16, overflow: "hidden", border: "1px solid #334155" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 15, fontFamily: "'DM Sans', sans-serif" }}>{name}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{email}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ background: "#14532d", color: "#4ade80", padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>✓ {pass} PASS</span>
                    <span style={{ background: "#450a0a", color: "#f87171", padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>✗ {fail} FAIL</span>
                    <span style={{ background: "#1e293b", color: "#64748b", padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, border: "1px solid #334155" }}>{rows.length} total</span>
                  </div>
                </div>
                <div style={{ padding: "10px 18px 14px" }}>
                  {rows.filter((r) => r.status !== "untested").map((r) => (
                    <div key={r.test_id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0", borderBottom: "1px solid #0f172a" }}>
                      <StatusBadge status={r.status} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, color: "#cbd5e1", fontFamily: "'DM Sans', sans-serif" }}>
                          {r.test_title}
                        </span>                        {r.notes && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#475569", fontStyle: "italic", fontFamily: "'DM Sans', sans-serif" }}>{r.notes}</p>}
                      </div>
                      <span style={{ fontSize: 11, color: "#334155", flexShrink: 0 }}>{new Date(r.updated_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [myResults, setMyResults] = useState<Record<string, TestResult>>({});
  const [allResults, setAllResults] = useState<AllResults>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [view, setView] = useState<"checklist" | "admin">("checklist");

  // Load results once user is known
  const loadResults = useCallback(async (email: string) => {
    const { data: all } = await supabase.from("test_results").select("*");
    const allMap: AllResults = {};
    (all ?? []).forEach((r: TestResult) => {
      if (!allMap[r.test_id]) allMap[r.test_id] = [];
      allMap[r.test_id].push(r);
    });
    setAllResults(allMap);

    const mine: Record<string, TestResult> = {};
    (all ?? []).filter((r: TestResult) => r.user_email === email).forEach((r: TestResult) => { mine[r.test_id] = r; });
    setMyResults(mine);
  }, []);

  const handleLogin = (name: string, email: string) => {
    setUser({ name, email });
    loadResults(email);
  };

  const handleSave = async (testId: string, section: string, title: string, status: Status, notes: string) => {
    if (!user) return;
    setSaving(testId);
    await supabase.from("test_results").upsert({
      user_name: user.name, user_email: user.email,
      test_id: testId, section, test_title: title,
      status, notes, updated_at: new Date().toISOString(),
    }, { onConflict: "user_email,test_id" });
    await loadResults(user.email);
    setSaving(null);
  };

  if (!user) return <LoginScreen onLogin={handleLogin} />;
  if (view === "admin") return <AdminView onBack={() => setView("checklist")} />;

  // Progress
  const done = ALL_IDS.filter((id) => myResults[id] && myResults[id].status !== "untested").length;
  const passed = ALL_IDS.filter((id) => myResults[id]?.status === "pass").length;
  const failed = ALL_IDS.filter((id) => myResults[id]?.status === "fail").length;
  const pct = Math.round((done / ALL_IDS.length) * 100);

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "16px 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>🎓</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>Turnitin LTI 1.3 QA</div>
                <div style={{ fontSize: 12, color: "#475569" }}>Testing as <strong style={{ color: "#7dd3fc" }}>{user.name}</strong></div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ background: "#14532d", color: "#4ade80", padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>✓ {passed}</span>
              <span style={{ background: "#450a0a", color: "#f87171", padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>✗ {failed}</span>
              <span style={{ color: "#7dd3fc", fontWeight: 700, fontSize: 13 }}>{pct}%</span>
              <button onClick={() => setView("admin")} style={{ background: "#334155", border: "none", color: "#94a3b8", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📊 All Testers</button>
              <button onClick={() => setUser(null)} style={{ background: "#1e293b", border: "1px solid #334155", color: "#64748b", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Sign Out</button>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 10, height: 4, background: "#0f172a", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#22c55e" : "linear-gradient(90deg,#0ea5e9,#38bdf8)", borderRadius: 999, transition: "width 0.4s" }} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 48px" }}>
        {/* Warn banner */}
        <div style={{ background: "#431407", border: "1px solid #9a3412", borderRadius: 10, padding: "10px 16px", marginBottom: 24, fontSize: 13, color: "#fdba74" }}>
          <strong>⚠ Action required:</strong> Please share the TII assignment link where grades appear before the post date — needed for test <strong>grade-1</strong>.
        </div>

        {CHECKLIST.map((sec) => {
          const secPass = sec.items.filter((i) => myResults[i.id]?.status === "pass").length;
          const secFail = sec.items.filter((i) => myResults[i.id]?.status === "fail").length;
          return (
            <div key={sec.section} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, borderBottom: `2px solid ${sec.color}33`, paddingBottom: 8 }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: sec.color, fontFamily: "'DM Sans', sans-serif" }}>
                  {sec.section}
                </h2>
                <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
                  {secPass > 0 && <span style={{ background: "#14532d", color: "#4ade80", padding: "1px 8px", borderRadius: 999, fontWeight: 700 }}>✓ {secPass}</span>}
                  {secFail > 0 && <span style={{ background: "#450a0a", color: "#f87171", padding: "1px 8px", borderRadius: 999, fontWeight: 700 }}>✗ {secFail}</span>}
                  <span style={{ color: "#334155", padding: "1px 8px" }}>{sec.items.length} tests</span>
                </div>
              </div>
              {sec.items.map((item) => (
                <TestRow
                  key={item.id}
                  item={item}
                  section={sec.section}
                  color={sec.color}
                  myResult={myResults[item.id] ?? null}
                  allResults={allResults[item.id] ?? []}
                  onSave={handleSave}
                  saving={saving === item.id}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
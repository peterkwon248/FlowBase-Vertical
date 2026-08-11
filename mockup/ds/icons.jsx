// icons.jsx — Vector workflow iconography + fake data
// Status & priority icons are custom inline SVG (geometry carries meaning).
// Everything else uses Lucide (loaded via CDN in index.html).

const STATUS = {
  backlog:  { color: "#8A8F98", label: "Backlog" },
  todo:     { color: "#9CA0A8", label: "Todo" },
  progress: { color: "#F2C94C", label: "In Progress" },
  review:   { color: "#4CB782", label: "In Review" },
  done:     { color: "#4C8DFF", label: "Done" },
  canceled: { color: "#62666D", label: "Canceled" },
};
const STATUS_CYCLE = ["todo", "progress", "review", "done", "backlog"];

function StatusIcon({ status = "todo", size = 14 }) {
  const c = (STATUS[status] || STATUS.todo).color;
  const common = { width: size, height: size, viewBox: "0 0 14 14" };
  if (status === "backlog")
    return <svg {...common}><circle cx="7" cy="7" r="5.5" fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="1.6 1.8"/></svg>;
  if (status === "todo")
    return <svg {...common}><circle cx="7" cy="7" r="5.5" fill="none" stroke={c} strokeWidth="1.5"/></svg>;
  if (status === "progress")
    return <svg {...common}><circle cx="7" cy="7" r="5.5" fill="none" stroke={c} strokeWidth="1.5"/><circle cx="7" cy="7" r="3" fill="none" stroke={c} strokeWidth="6" strokeDasharray="7.5 100" transform="rotate(-90 7 7)"/></svg>;
  if (status === "review")
    return <svg {...common}><circle cx="7" cy="7" r="5.5" fill="none" stroke={c} strokeWidth="1.5"/><circle cx="7" cy="7" r="3" fill="none" stroke={c} strokeWidth="6" strokeDasharray="14 100" transform="rotate(-90 7 7)"/></svg>;
  if (status === "done")
    return <svg {...common}><circle cx="7" cy="7" r="6" fill={c}/><path d="M4.3 7.1l1.8 1.8 3.4-3.6" stroke="#0A0A0B" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return <svg {...common}><circle cx="7" cy="7" r="6" fill={c}/><path d="M5 5l4 4M9 5l-4 4" stroke="#0A0A0B" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}

function PriorityIcon({ priority = "none", size = 16 }) {
  const on = "var(--priority-bar-on)", off = "var(--priority-bar-off)";
  const common = { width: size, height: size, viewBox: "0 0 16 16" };
  if (priority === "urgent")
    return <svg {...common}><rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#F2994A"/><rect x="7" y="4" width="2" height="5" rx="1" fill="#0A0A0B"/><rect x="7" y="10.5" width="2" height="2" rx="1" fill="#0A0A0B"/></svg>;
  if (priority === "high" || priority === "medium" || priority === "low") {
    const n = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
    return <svg {...common}>
      <rect x="2" y="9" width="3" height="5" rx="1" fill={n >= 1 ? on : off}/>
      <rect x="6.5" y="6" width="3" height="8" rx="1" fill={n >= 2 ? on : off}/>
      <rect x="11" y="3" width="3" height="11" rx="1" fill={n >= 3 ? on : off}/>
    </svg>;
  }
  return <svg {...common}><rect x="2" y="7" width="3" height="2" rx="1" fill="var(--priority-none)"/><rect x="6.5" y="7" width="3" height="2" rx="1" fill="var(--priority-none)"/><rect x="11" y="7" width="3" height="2" rx="1" fill="var(--priority-none)"/></svg>;
}

// ---------------------------------------------------------------
// RESERVED ICONS — Vector originals that Lucide must never replace.
// Any Lucide name on the left is intercepted and rendered as the
// Vector SVG instead, so a stray <Lic name="panel-left"/> anywhere
// in any consuming app still draws the real Vector mark.
// Add to this map whenever a new signature icon is created.
// ---------------------------------------------------------------
const VECTOR_RESERVED = {
  "panel-left":        (p) => <PanelIcon side="left"  {...p} />,
  "panel-left-open":   (p) => <PanelIcon side="left"  {...p} />,
  "panel-left-close":  (p) => <PanelIcon side="left"  {...p} />,
  "panel-right":       (p) => <PanelIcon side="right" {...p} />,
  "panel-right-open":  (p) => <PanelIcon side="right" {...p} />,
  "panel-right-close": (p) => <PanelIcon side="right" {...p} />,
  "sidebar":           (p) => <PanelIcon side="left"  {...p} />,
  "sidebar-open":      (p) => <PanelIcon side="left"  {...p} />,
  "sidebar-close":     (p) => <PanelIcon side="left"  {...p} />,
  // workflow marks — geometry carries meaning, never a generic circle
  "circle-dashed":     (p) => <StatusIcon status="backlog"  {...p} />,
  "circle-dot":        (p) => <StatusIcon status="progress" {...p} />,
  "circle-check":      (p) => <StatusIcon status="done"     {...p} />,
  "circle-check-big":  (p) => <StatusIcon status="done"     {...p} />,
  "check-circle-2":    (p) => <StatusIcon status="done"     {...p} />,
  "circle-x":          (p) => <StatusIcon status="canceled" {...p} />,
  "signal-high":       (p) => <PriorityIcon priority="high"   {...p} />,
  "signal-medium":     (p) => <PriorityIcon priority="medium" {...p} />,
  "signal-low":        (p) => <PriorityIcon priority="low"    {...p} />,
};

// Lucide icon wrapper -> renders an <i data-lucide> then asks lucide to swap it.
// Reserved names are hard-redirected to the Vector original.
function Lic({ name, size = 16, cls = "icon", color }) {
  const ref = React.useRef(null);
  const reserved = VECTOR_RESERVED[name];
  React.useEffect(() => {
    if (reserved) return;                       // Vector SVG rendered below
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const i = document.createElement("i");
      i.setAttribute("data-lucide", name);
      ref.current.appendChild(i);
      window.lucide.createIcons({ attrs: { width: size, height: size }, nodes: [i] });
    }
  }, [name, size, reserved]);
  if (reserved) {
    if (typeof console !== "undefined" && !Lic._warned?.[name]) {
      (Lic._warned = Lic._warned || {})[name] = 1;
      console.warn(`[Vector] "${name}" is a Vector signature icon — rendered the Vector SVG instead of Lucide. Import it directly (PanelIcon / StatusIcon / PriorityIcon).`);
    }
    return <span className={cls} style={{ display: "inline-flex", color, width: size, height: size }}>{reserved({ size, color: color || "currentColor" })}</span>;
  }
  return <span ref={ref} className={cls} style={{ display: "inline-flex", color, width: size, height: size }} />;
}

function Avatar({ from = "#4CB782", to = "#2D9CDB", text, size = 20 }) {
  return <span className="avatar" style={{ width: size, height: size, background: `linear-gradient(135deg, ${from}, ${to})`, display:"flex", alignItems:"center", justifyContent:"center", font:"600 10px Inter", color:"#0A0A0B" }}>{text}</span>;
}

// Rounded "panel" toggle icons — softer corners than Lucide's, closer to Linear's.
function PanelIcon({ side = "left", size = 16, color = "currentColor" }) {
  const railLeft = side === "left";
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="3" width="14" height="12" rx="4" stroke={color} strokeWidth="1.6"/>
      <line x1={railLeft ? "7" : "11"} y1="3.6" x2={railLeft ? "7" : "11"} y2="14.4" stroke={color} strokeWidth="1.6"/>
      <rect x={railLeft ? "2.8" : "11.2"} y="3.8" width="4" height="10.4" rx="2.4" fill={color} opacity="0.18"/>
    </svg>
  );
}

const LABELS = {
  Bug:         { color: "#EB5757" },
  Feature:     { color: "#BB6BD9" },
  Improvement: { color: "#2D9CDB" },
};

// ---- fake data ----
const SEED_ISSUES = [
  { id: "VEC-1", title: "Get familiar with Vector",   team: "VEC", status: "todo",     priority: "none",   created: "Feb 26", updated: "Feb 26", project: null, labels: [], assignee: null, source: null, subscribers: ["김혁규"], hasDescription: true, hasLinks: false, dueDate: null, overdue: false },
  { id: "VEC-3", title: "Connect your tools",         team: "VEC", status: "progress", priority: "high",   created: "Feb 26", updated: "May 3",  project: "Design system", labels: ["Improvement"], assignee: "김혁규", source: "github", subscribers: ["김혁규"], hasDescription: true, hasLinks: true, dueDate: "Jun 15", overdue: false, cycle: "c2", estimate: 3 },
  { id: "VEC-2", title: "Set up your teams",          team: "VEC", status: "todo",     priority: "medium", created: "Feb 26", updated: "Feb 26", project: null, labels: [], assignee: "김혁규", source: null, subscribers: [], hasDescription: false, hasLinks: false, dueDate: null, overdue: false },
  { id: "VEC-4", title: "Import your data",           team: "VEC", status: "todo",     priority: "low",    created: "Feb 26", updated: "Feb 26", project: null, labels: ["Feature"], assignee: null, source: "github", subscribers: ["김혁규"], hasDescription: true, hasLinks: true, dueDate: "May 20", overdue: true },
  { id: "VEC-5", title: "Invite your teammates",      team: "VEC", status: "todo",     priority: "urgent", created: "Feb 27", updated: "Feb 27", project: null, labels: ["Bug"], assignee: null, source: null, subscribers: [], hasDescription: true, hasLinks: false, dueDate: "Jun 30", overdue: false, cycle: "c2", estimate: 1 },
  { id: "VEC-8", title: "Polish onboarding copy",     team: "VEC", status: "review",   priority: "high",   created: "Mar 2",  updated: "May 6",  project: "Q3 Platform revamp", labels: ["Feature"], assignee: "김혁규", source: "github", subscribers: ["김혁규"], hasDescription: true, hasLinks: true, dueDate: null, overdue: false, cycle: "c2", estimate: 2 },
  { id: "VEC-6", title: "Refactor auth module",       team: "VEC", status: "backlog",  priority: "medium", created: "Feb 20", updated: "Apr 18", project: null, labels: ["Improvement"], assignee: "김혁규", source: null, subscribers: ["김혁규"], hasDescription: false, hasLinks: false, dueDate: null, overdue: false },
  { id: "VEC-7", title: "Clean up legacy endpoints",  team: "VEC", status: "backlog",  priority: "low",    created: "Feb 18", updated: "Mar 9",  project: null, labels: [], assignee: null, source: null, subscribers: [], hasDescription: false, hasLinks: false, dueDate: null, overdue: false },
  { id: "ENG-1", title: "Migrate CI to new runners",  team: "ENG", status: "progress", priority: "high",   created: "Apr 1",  updated: "May 4",  project: "Mobile app v2", labels: ["Improvement"], assignee: "김혁규", source: "github", subscribers: ["김혁규"], hasDescription: true, hasLinks: true, dueDate: "Jun 20", overdue: false, cycle: "ec2", estimate: 3 },
  { id: "ENG-2", title: "Add rate limiting to API",   team: "ENG", status: "todo",     priority: "urgent", created: "Apr 3",  updated: "Apr 3",  project: null, labels: ["Bug"], assignee: null, source: null, subscribers: [], hasDescription: true, hasLinks: false, dueDate: null, overdue: false, cycle: "ec2", estimate: 1 },
  { id: "ENG-3", title: "Upgrade to Node 22",         team: "ENG", status: "backlog",  priority: "medium", created: "Mar 28", updated: "Mar 28", project: null, labels: [], assignee: "김혁규", source: null, subscribers: ["김혁규"], hasDescription: false, hasLinks: false, dueDate: null, overdue: false },
  { id: "DSGN-1", title: "Redesign settings nav",     team: "DSGN", status: "todo",    priority: "medium", created: "Apr 10", updated: "Apr 10", project: "Design system", labels: ["Feature"], assignee: "김혁규", source: null, subscribers: ["김혁규"], hasDescription: true, hasLinks: false, dueDate: null, overdue: false },
  { id: "DSGN-2", title: "Audit color contrast",      team: "DSGN", status: "done",    priority: "low",    created: "Mar 15", updated: "Apr 2",  project: "Design system", labels: ["Improvement"], assignee: "김혁규", source: null, subscribers: [], hasDescription: true, hasLinks: false, dueDate: null, overdue: false },
];

const PROJECTS = [
  { id: "p1", name: "Q3 Platform revamp", team: "VEC", status: "backlog",  health: "onTrack", priority: "high",   lead: "김혁규", target: "Sep 30", start: "Jul 8",  issues: 12, progress: 0,   members: 3, deps: 0, created: "Feb 27", updated: "Mar 4",  completed: null,  labels: [] },
  { id: "p2", name: "Mobile app v2",      team: "ENG", status: "progress", health: "atRisk",  priority: "urgent", lead: "김혁규", target: "Aug 15", start: "May 1", issues: 8,  progress: 42,  members: 4, deps: 1, created: "Jan 10", updated: "May 2",  completed: null,  labels: ["Feature"] },
  { id: "p3", name: "Billing migration",  team: "ENG", status: "planned",  health: "onTrack", priority: "medium", lead: null,     target: "Oct 20", start: "Sep 1", issues: 5,  progress: 0,   members: 2, deps: 0, created: "Mar 1",  updated: "Mar 1",  completed: null,  labels: [] },
  { id: "p4", name: "Design system",      team: "DSGN", status: "progress", health: "onTrack", priority: "high",   lead: "김혁규", target: "Jul 1",  start: "Apr 2", issues: 20, progress: 68,  members: 5, deps: 2, created: "Apr 2",  updated: "May 6",  completed: null,  labels: ["Improvement"] },
  { id: "p5", name: "Q1 retro actions",   team: "VEC", status: "done",     health: "onTrack", priority: "low",    lead: "김혁규", target: "Jun 1",  start: "Mar 1", issues: 6,  progress: 100, members: 2, deps: 0, created: "Mar 1",  updated: "Jun 1",  completed: "Jun 1", labels: [] },
];
const PROJECT_STATUS = {
  backlog:  { key: "backlog",  label: "Backlog" },
  planned:  { key: "todo",     label: "Planned" },
  progress: { key: "progress", label: "In Progress" },
  done:     { key: "done",     label: "Completed" },
  canceled: { key: "canceled", label: "Canceled" },
};
const PROJECT_STATUS_ORDER = ["backlog", "planned", "progress", "done", "canceled"];
const HEALTH = {
  onTrack:  { label: "On track",  color: "#4CB782" },
  atRisk:   { label: "At risk",   color: "#F2C94C" },
  offTrack: { label: "Off track", color: "#EB5757" },
};
const PROJECT_PROPS_ALL = ["Priority", "Status", "Health", "Lead", "Members", "Dependencies", "Start date", "Target date", "Issues", "Created", "Updated", "Completed", "Labels"];
const PROJECT_PROPS_DEFAULT = ["Health", "Priority", "Lead", "Target date", "Issues", "Status", "Created", "Updated"];

// ---- helpers shared across views ----
const PRIORITIES = ["urgent", "high", "medium", "low", "none"];
const priorityLabel = (p) => p === "none" ? "No priority" : p[0].toUpperCase() + p.slice(1);
const statusLabel = (s) => (STATUS[s] || STATUS.todo).label;
// status → workflow type, used by Active / Backlog / All tabs
const STATUS_TYPE = { backlog: "backlog", todo: "active", progress: "active", review: "active", done: "completed", canceled: "canceled" };
const ASSIGNEES = ["Unassigned", "김혁규", "Current user"];

// ---- teams ----
const TEAMS = [
  { id: "VEC", name: "vector-team", color: "#C026D3", icon: "user" },
  { id: "ENG", name: "Engineering", color: "#2D9CDB", icon: "code" },
  { id: "DSGN", name: "Design", color: "#BB6BD9", icon: "palette" },
];

Object.assign(window, { TEAMS });

// ---- cycles (sprints) ----
const CYCLES = [
  { id: "c1", num: 1, team: "VEC", name: "Cycle 1", start: "May 12", end: "May 26", state: "completed", scope: 8, completed: 8 },
  { id: "c2", num: 2, team: "VEC", name: "Cycle 2", start: "May 26", end: "Jun 9", state: "active", scope: 6, completed: 2 },
  { id: "c3", num: 3, team: "VEC", name: "Cycle 3", start: "Jun 9", end: "Jun 23", state: "upcoming", scope: 3, completed: 0 },
  { id: "c4", num: 4, team: "VEC", name: "Cycle 4", start: "Jun 23", end: "Jul 7", state: "upcoming", scope: 0, completed: 0 },
  { id: "ec1", num: 1, team: "ENG", name: "Cycle 1", start: "May 19", end: "Jun 2", state: "completed", scope: 6, completed: 5 },
  { id: "ec2", num: 2, team: "ENG", name: "Cycle 2", start: "Jun 2", end: "Jun 16", state: "active", scope: 4, completed: 1 },
  { id: "ec3", num: 3, team: "ENG", name: "Cycle 3", start: "Jun 16", end: "Jun 30", state: "upcoming", scope: 2, completed: 0 },
];
// ---- triage queue (unclassified incoming issues) ----
const TRIAGE_SEED = [
  { id: "VEC-21", title: "App crashes on logout (mobile)", team: "VEC", priority: "urgent", labels: ["Bug"], source: "Customer · Slack", desc: "Reported by 3 users — logout throws on iOS 17.", created: "2h", assignee: null, status: "triage" },
  { id: "VEC-22", title: "Add dark mode to email digests", team: "VEC", priority: "none", labels: ["Feature"], source: "Email", desc: "Several requests for dark-themed notification emails.", created: "5h", assignee: null, status: "triage" },
  { id: "VEC-23", title: "Typo on pricing page footer", team: "VEC", priority: "low", labels: [], source: "GitHub", desc: "“Recieve” → “Receive”.", created: "1d", assignee: null, status: "triage" },
  { id: "ENG-21", title: "API returns 500 on empty payload", team: "ENG", priority: "urgent", labels: ["Bug"], source: "Sentry", desc: "Unhandled exception when POST body is empty.", created: "1h", assignee: null, status: "triage" },
  { id: "ENG-22", title: "Add OpenTelemetry tracing", team: "ENG", priority: "medium", labels: ["Improvement"], source: "GitHub", desc: "Proposed in RFC-14 for cross-service tracing.", created: "6h", assignee: null, status: "triage" },
];
Object.assign(window, { TRIAGE_SEED });

Object.assign(window, { CYCLES });

Object.assign(window, { PRIORITIES, priorityLabel, statusLabel, STATUS_TYPE, ASSIGNEES, PROJECT_STATUS, PROJECT_STATUS_ORDER, HEALTH, PROJECT_PROPS_ALL, PROJECT_PROPS_DEFAULT });

Object.assign(window, { STATUS, STATUS_CYCLE, StatusIcon, PriorityIcon, Lic, Avatar, PanelIcon, VECTOR_RESERVED, LABELS, SEED_ISSUES, PROJECTS });

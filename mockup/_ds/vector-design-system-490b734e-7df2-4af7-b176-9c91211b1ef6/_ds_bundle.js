/* @ds-bundle: {"format":4,"namespace":"VectorDesignSystem_490b73","components":[{"name":"Avatar","sourcePath":"package/src/primitives/Avatar.tsx"},{"name":"Button","sourcePath":"package/src/primitives/Button.tsx"},{"name":"LucideIcon","sourcePath":"package/src/primitives/LucideIcon.tsx"},{"name":"Menu","sourcePath":"package/src/primitives/Menu.tsx"},{"name":"MenuItem","sourcePath":"package/src/primitives/Menu.tsx"},{"name":"PriorityIcon","sourcePath":"package/src/primitives/PriorityIcon.tsx"},{"name":"StatusIcon","sourcePath":"package/src/primitives/StatusIcon.tsx"},{"name":"Tag","sourcePath":"package/src/primitives/Tag.tsx"}],"sourceHashes":{"icon_kit/build/build.mjs":"524d4121fb0c","icon_kit/build/svgo.config.mjs":"16a9d0cfe1cd","icon_kit/src/Icon.jsx":"c220e5fe3b33","package/src/index.ts":"647f7cec214d","package/src/primitives/Avatar.tsx":"10079e706415","package/src/primitives/Button.tsx":"db30f5a39023","package/src/primitives/LucideIcon.tsx":"d6833cdbd6f2","package/src/primitives/Menu.tsx":"3a242ebffb88","package/src/primitives/PriorityIcon.tsx":"e79f5a621ad5","package/src/primitives/StatusIcon.tsx":"07148a5c874e","package/src/primitives/Tag.tsx":"49895ac31358","package/tsup.config.ts":"c8869156e2e7","ui_kits/app/AdaptiveShell.jsx":"9283cc09e1b0","ui_kits/app/App.jsx":"51ec511ce77d","ui_kits/app/CRM.jsx":"a5151c7fe8fc","ui_kits/app/Calendar.jsx":"0dec8325d706","ui_kits/app/Canvas.jsx":"bfa1dde0ce47","ui_kits/app/Changelog.jsx":"b5ae244449ee","ui_kits/app/Chat.jsx":"f090e974ee3d","ui_kits/app/CoachMarks.jsx":"24d5bd9d9e67","ui_kits/app/CreateIssueModal.jsx":"662e945bce42","ui_kits/app/Cycles.jsx":"32d20d96882d","ui_kits/app/Database.jsx":"98421728fd07","ui_kits/app/Docs.jsx":"2d671fa94a5a","ui_kits/app/Forms.jsx":"cee72de30782","ui_kits/app/Graph.jsx":"371ded78965b","ui_kits/app/ImportFlow.jsx":"70cb0b27d8ef","ui_kits/app/Inbox.jsx":"e0e1c69d384b","ui_kits/app/Insights.jsx":"73111d4cff8c","ui_kits/app/IssueDetail.jsx":"5ba9240bbfc3","ui_kits/app/Menus.jsx":"00addcdf7166","ui_kits/app/Mobile.jsx":"5f4deaf553d3","ui_kits/app/MyIssues.jsx":"bd43f5740f89","ui_kits/app/NavHoverActions.jsx":"5cbbc94617a9","ui_kits/app/Overlays.jsx":"6651d3ed1c53","ui_kits/app/Panels.jsx":"a2cffcf3070e","ui_kits/app/ProjectsView.jsx":"dee0c4ef2738","ui_kits/app/RichTooltip.jsx":"668f96fe4f58","ui_kits/app/Settings.jsx":"992e32101572","ui_kits/app/Sidebar.jsx":"62a7c3e96eaf","ui_kits/app/SidebarCustomize.jsx":"a1ee54b4c2e3","ui_kits/app/StatStrip.jsx":"4bb10fe7392f","ui_kits/app/Support.jsx":"5fe2e1e0c7e6","ui_kits/app/Triage.jsx":"4661663b7136","ui_kits/app/Views.jsx":"d1c59813bc44","ui_kits/app/Wiki.jsx":"51bf0cd6833b","ui_kits/app/adaptive.jsx":"513c602cbd89","ui_kits/app/aggregate.jsx":"81decb7debe7","ui_kits/app/build/codemod.mjs":"4d2c0faebfe0","ui_kits/app/build/vite.config.js":"4cc65c20a4c7","ui_kits/app/charts.jsx":"3fc6eaa50a1e","ui_kits/app/dnd.jsx":"3b134e29e33e","ui_kits/app/formula.jsx":"ec3b11f3a2cf","ui_kits/app/icons.jsx":"acfe0715ee87","ui_kits/app/modules.jsx":"456af0577fdc","ui_kits/app/numerics.js":"7f50f04f744b","ui_kits/app/parse.jsx":"944591f8859e","ui_kits/app/store.jsx":"4345195fcaba"},"inlinedExternals":[],"unexposedExports":[{"name":"config","sourcePath":"ui_kits/app/build/vite.config.js"}]} */

(() => {

const __ds_ns = (window.VectorDesignSystem_490b73 = window.VectorDesignSystem_490b73 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// icon_kit/build/build.mjs
try { (() => {
// build.mjs — Vector icon kit production build. (Node-only script — run locally.)
//
// Reads the OFFLINE @iconify/json dataset (every open-source set, no network) and
// emits one tree-shakeable React component per icon you actually use, plus a barrel
// index. Run locally in Claude Code or CI:
//
//   npm install
//   npm run build            # builds icons listed in used-icons.txt + all aliases
//   npm run build -- --all-lucide   # also include the entire Lucide set
//
// Output: src/icons/<Set><Name>.jsx and src/icons/index.js
//
// Why offline: @iconify/json ships the full JSON for ~150 sets (~200k icons) in
// node_modules, so the heavy work runs on your machine and produces a normal
// npm-publishable package.
//
// Imports are dynamic (inside main) so design-system tooling that scans the
// project for browser code can parse this file without resolving node/npm deps.

async function main() {
  const {
    readFile,
    writeFile,
    mkdir,
    rm
  } = await import("node:fs/promises");
  const {
    existsSync
  } = await import("node:fs");
  const path = (await import("node:path")).default;
  const {
    optimize
  } = await import("svgo");
  const svgoConfig = (await import("./svgo.config.mjs")).default;

  // ROOT = icon_kit/ — `npm run build` executes from there (see package.json),
  // so cwd-based resolution avoids import.meta (keeps the file parseable as script).
  const ROOT = process.cwd();
  const OUT = path.join(ROOT, "src", "icons");
  const config = JSON.parse(await readFile(path.join(ROOT, "icons.config.json"), "utf8"));
  const aliases = JSON.parse(await readFile(path.join(ROOT, "aliases.json"), "utf8"));
  const argAll = process.argv.includes("--all-lucide");

  // Collect the icon names to build: every alias target + the explicit used-icons list.
  const wanted = new Set(Object.values(aliases).filter(v => v.includes(":")));
  const usedPath = path.join(ROOT, "used-icons.txt");
  if (existsSync(usedPath)) {
    (await readFile(usedPath, "utf8")).split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#") && s.includes(":")).forEach(s => wanted.add(s));
  }

  // Load a set's JSON from @iconify/json (offline).
  const setCache = {};
  async function loadSet(prefix) {
    if (setCache[prefix]) return setCache[prefix];
    const p = path.join(ROOT, "node_modules", "@iconify", "json", "json", prefix + ".json");
    if (!existsSync(p)) {
      console.warn(`! set "${prefix}" not found — install @iconify/json`);
      return null;
    }
    const data = JSON.parse(await readFile(p, "utf8"));
    if (argAll && prefix === "lucide") Object.keys(data.icons).forEach(n => wanted.add("lucide:" + n));
    return setCache[prefix] = data;
  }
  const pascal = s => s.replace(/(^|[-:])(\w)/g, (_, __, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "");

  // Build a single icon → SVG body → optimized → React component string.
  function toComponent(setData, prefix, name) {
    const icon = setData.icons[name] || setData.aliases && setData.aliases[name] && setData.icons[setData.aliases[name].parent];
    if (!icon) {
      console.warn(`! missing ${prefix}:${name}`);
      return null;
    }
    const w = icon.width || setData.width || 24,
      h = icon.height || setData.height || 24;
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${icon.body}</svg>`;
    const {
      data
    } = optimize(raw, svgoConfig);
    const body = data.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    const comp = pascal(prefix) + pascal(name);
    return {
      comp,
      code: `// @generated from ${prefix}:${name} — do not edit
import React from "react";
export const ${comp} = ({ size = ${config.tokens.defaultSize}, color = "currentColor", title, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 ${w} ${h}" fill="none" stroke={color}
       strokeWidth={${config.tokens.strokeWidth}} strokeLinecap="round" strokeLinejoin="round"
       role={title ? "img" : undefined} aria-hidden={title ? undefined : true} {...p}>
    {title ? <title>{title}</title> : null}
    ${body}
  </svg>
);
`
    };
  }
  await rm(OUT, {
    recursive: true,
    force: true
  });
  await mkdir(OUT, {
    recursive: true
  });
  const exports = [];
  for (const full of [...wanted].sort()) {
    const [prefix, name] = full.split(":");
    const setData = await loadSet(prefix);
    if (!setData) continue;
    const built = toComponent(setData, prefix, name);
    if (!built) continue;
    await writeFile(path.join(OUT, built.comp + ".jsx"), built.code);
    exports.push(`export { ${built.comp} } from "./${built.comp}.jsx";`);
  }
  await writeFile(path.join(OUT, "index.js"), exports.join("\n") + "\n");
  console.log(`✓ built ${exports.length} icon components → src/icons/`);
}
if (typeof process !== "undefined" && process.versions && process.versions.node) main();
})(); } catch (e) { __ds_ns.__errors.push({ path: "icon_kit/build/build.mjs", error: String((e && e.message) || e) }); }

// icon_kit/build/svgo.config.mjs
try { (() => {
// svgo.config.mjs — keep geometry, strip set-specific stroke/fill so our component
// can apply the kit's stroke/color tokens uniformly across all sources.
let __ds_default_icon_kit_build_svgo_config_13avaw6;
try {
  __ds_default_icon_kit_build_svgo_config_13avaw6 = {
    multipass: true,
    plugins: [{
      name: "preset-default",
      params: {
        overrides: {
          removeViewBox: false
        }
      }
    }, {
      name: "removeDimensions"
    }, {
      name: "convertStyleToAttrs"
    },
    // strip baked stroke/fill colours & widths → inherit from the React component
    {
      name: "removeAttrs",
      params: {
        attrs: ["stroke", "fill", "stroke-width"]
      }
    }]
  };
} catch {}
Object.assign(__ds_scope, { __ds_default_icon_kit_build_svgo_config_13avaw6 });
})(); } catch (e) { __ds_ns.__errors.push({ path: "icon_kit/build/svgo.config.mjs", error: String((e && e.message) || e) }); }

// icon_kit/src/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Icon.jsx — Vector multi-source icon component
//
// Runtime resolution over Iconify (150+ open-source sets via one API):
//   <Icon name="lucide:box" />            explicit set:icon
//   <Icon name="action.search" />          semantic alias (see aliases.json)
//   <Icon name="cube" />                   bare name → resolved against resolutionOrder
//
// In the BROWSER (demo / prototypes): renders the <iconify-icon> web component,
// which lazy-loads any icon on demand from the Iconify API. Load once in <head>:
//   <script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script>
//
// In PRODUCTION: run `npm run build` (see build/build.mjs) to emit tree-shakeable
// React components from the OFFLINE @iconify/json data, then point CONFIG.mode = "build"
// and import from ./src/icons. No network, no runtime fetch.

const ICON_ALIASES = window.__VECTOR_ICON_ALIASES__ || {};
const ICON_CONFIG = window.__VECTOR_ICON_CONFIG__ || {
  defaultSize: 16,
  strokeWidth: 1.75,
  resolutionOrder: ["lucide", "radix-icons", "tabler", "ph", "heroicons", "material-symbols"]
};
function resolveIconName(name) {
  if (!name) return "lucide:help-circle";
  if (ICON_ALIASES[name]) return ICON_ALIASES[name]; // semantic alias
  if (name.includes(":")) return name; // explicit set:icon
  // bare name → first set in resolution order (Iconify resolves missing gracefully)
  return ICON_CONFIG.resolutionOrder[0] + ":" + name;
}
function Icon({
  name,
  size,
  color = "currentColor",
  strokeWidth,
  className = "",
  style = {},
  title,
  ...rest
}) {
  const px = size || ICON_CONFIG.defaultSize;
  const icon = resolveIconName(name);
  return /*#__PURE__*/React.createElement("iconify-icon", _extends({
    icon: icon,
    width: px,
    height: px,
    style: {
      color,
      display: "inline-flex",
      verticalAlign: "middle",
      ...style
    },
    className: className,
    "aria-label": title || undefined,
    "aria-hidden": title ? undefined : "true"
  }, rest));
}

// Convenience: a sized inline glyph that inherits text color (the common case).
function Glyph({
  name,
  size = 16,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Icon, _extends({
    name: name,
    size: size
  }, rest));
}
if (typeof window !== "undefined") Object.assign(window, {
  Icon,
  Glyph,
  resolveIconName
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "icon_kit/src/Icon.jsx", error: String((e && e.message) || e) }); }

// package/src/primitives/Avatar.tsx
try { (() => {
/** Gradient initial avatar (matches Vector app). */
function Avatar({
  text,
  from = "#4CB782",
  to = "#2D9CDB",
  size = 20
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: 6,
      flex: "none",
      background: `linear-gradient(135deg, ${from}, ${to})`,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      font: "600 10px var(--font-sans)",
      color: "#0A0A0B"
    }
  }, text);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "package/src/primitives/Avatar.tsx", error: String((e && e.message) || e) }); }

// package/src/primitives/Button.tsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const base = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--sp-3)",
  height: "var(--control-h-lg)",
  padding: "0 12px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)",
  background: "transparent",
  color: "var(--fg-2)",
  font: "var(--fw-medium) var(--fs-body) var(--font-sans)",
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap",
  transition: "background .12s ease, border-color .12s ease, opacity .12s ease"
};
const variants = {
  default: {},
  primary: {
    background: "var(--accent)",
    borderColor: "transparent",
    color: "var(--fg-on-accent)",
    fontWeight: 600
  },
  ghost: {
    borderColor: "transparent",
    background: "transparent"
  }
};

/** Vector button. Uses design tokens from tokens.css. */
const Button = React.forwardRef(({
  variant = "default",
  style,
  ...rest
}, ref) => /*#__PURE__*/React.createElement("button", _extends({
  ref: ref,
  style: {
    ...base,
    ...variants[variant],
    ...style
  }
}, rest)));
Button.displayName = "Button";
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "package/src/primitives/Button.tsx", error: String((e && e.message) || e) }); }

// package/src/primitives/LucideIcon.tsx
try { (() => {
/** Thin wrapper around a Lucide icon (peer `lucide-react`). Renamed from `Icon`
 * to avoid a namespace collision with the icon_kit's <Icon>.
 *   import { Inbox } from "lucide-react";
 *   <LucideIcon as={Inbox} size={16} />
 */

function LucideIcon({
  as: C,
  size = 16,
  color = "currentColor"
}) {
  return /*#__PURE__*/React.createElement(C, {
    size: size,
    color: color,
    strokeWidth: 1.75
  });
}
Object.assign(__ds_scope, { LucideIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "package/src/primitives/LucideIcon.tsx", error: String((e && e.message) || e) }); }

// package/src/primitives/Menu.tsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Floating menu surface (popover container). Position it via wrapper. */
function Menu({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--r-md)",
      boxShadow: "var(--shadow-popover)",
      padding: "var(--sp-2)",
      minWidth: 180,
      ...style
    }
  }, rest), children);
}
function MenuItem({
  icon,
  shortcut,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)",
      height: 30,
      padding: "0 8px",
      borderRadius: "var(--r-xs)",
      font: "var(--fw-medium) var(--fs-body) var(--font-sans)",
      color: hover ? "var(--fg)" : "var(--fg-2)",
      background: hover ? "var(--bg-hover)" : "transparent",
      cursor: "pointer",
      ...style
    }
  }, rest), icon, /*#__PURE__*/React.createElement("span", null, children), shortcut && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      color: "var(--fg-4)",
      fontSize: "var(--fs-meta)"
    }
  }, shortcut));
}
Object.assign(__ds_scope, { Menu, MenuItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "package/src/primitives/Menu.tsx", error: String((e && e.message) || e) }); }

// package/src/primitives/PriorityIcon.tsx
try { (() => {
const ON = "#C9CCD1",
  OFF = "#3A3D42";
/** Priority glyph: dashes / orange-! / signal bars (matches Vector app). */
function PriorityIcon({
  priority = "none",
  size = 16
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 16 16"
  };
  if (priority === "urgent") return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
    x: "1.5",
    y: "1.5",
    width: "13",
    height: "13",
    rx: "3",
    fill: "#F2994A"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7",
    y: "4",
    width: "2",
    height: "5",
    rx: "1",
    fill: "#0A0A0B"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7",
    y: "10.5",
    width: "2",
    height: "2",
    rx: "1",
    fill: "#0A0A0B"
  }));
  if (priority === "high" || priority === "medium" || priority === "low") {
    const n = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
    return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
      x: "2",
      y: "9",
      width: "3",
      height: "5",
      rx: "1",
      fill: n >= 1 ? ON : OFF
    }), /*#__PURE__*/React.createElement("rect", {
      x: "6.5",
      y: "6",
      width: "3",
      height: "8",
      rx: "1",
      fill: n >= 2 ? ON : OFF
    }), /*#__PURE__*/React.createElement("rect", {
      x: "11",
      y: "3",
      width: "3",
      height: "11",
      rx: "1",
      fill: n >= 3 ? ON : OFF
    }));
  }
  return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "7",
    width: "3",
    height: "2",
    rx: "1",
    fill: "#62666D"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "6.5",
    y: "7",
    width: "3",
    height: "2",
    rx: "1",
    fill: "#62666D"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "11",
    y: "7",
    width: "3",
    height: "2",
    rx: "1",
    fill: "#62666D"
  }));
}
Object.assign(__ds_scope, { PriorityIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "package/src/primitives/PriorityIcon.tsx", error: String((e && e.message) || e) }); }

// package/src/primitives/StatusIcon.tsx
try { (() => {
/** Workflow status keys shared across Vector. */

const COLOR = {
  backlog: "#8A8F98",
  todo: "#9CA0A8",
  progress: "#F2C94C",
  review: "#4CB782",
  done: "#4C8DFF",
  canceled: "#62666D"
};
/** Custom inline-SVG status glyph — geometry carries meaning (matches Vector app). */
function StatusIcon({
  status = "todo",
  size = 14
}) {
  const c = COLOR[status] ?? COLOR.todo;
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 14 14"
  };
  if (status === "backlog") return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5.5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.5",
    strokeDasharray: "1.6 1.8"
  }));
  if (status === "todo") return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5.5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.5"
  }));
  if (status === "progress") return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5.5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "3",
    fill: "none",
    stroke: c,
    strokeWidth: "6",
    strokeDasharray: "7.5 100",
    transform: "rotate(-90 7 7)"
  }));
  if (status === "review") return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5.5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "3",
    fill: "none",
    stroke: c,
    strokeWidth: "6",
    strokeDasharray: "14 100",
    transform: "rotate(-90 7 7)"
  }));
  if (status === "done") return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "6",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4.3 7.1l1.8 1.8 3.4-3.6",
    stroke: "#0A0A0B",
    strokeWidth: "1.4",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
  return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "6",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 5l4 4M9 5l-4 4",
    stroke: "#0A0A0B",
    strokeWidth: "1.3",
    strokeLinecap: "round"
  }));
}
Object.assign(__ds_scope, { StatusIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "package/src/primitives/StatusIcon.tsx", error: String((e && e.message) || e) }); }

// package/src/primitives/Tag.tsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Pill-shaped label/tag. `soft` tints with the color, `solid` fills it. */
function Tag({
  color,
  tone = "outline",
  children,
  style,
  ...rest
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 20,
    padding: "0 8px",
    borderRadius: "var(--r-pill)",
    font: "var(--fw-medium) 11px var(--font-sans)",
    whiteSpace: "nowrap"
  };
  const toneStyle = tone === "solid" && color ? {
    background: color,
    color: "#0A0A0B"
  } : tone === "soft" && color ? {
    background: color + "26",
    color
  } : {
    border: "1px solid var(--border-strong)",
    color: "var(--fg-3)"
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      ...base,
      ...toneStyle,
      ...style
    }
  }, rest), color && tone === "outline" && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: color
    }
  }), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "package/src/primitives/Tag.tsx", error: String((e && e.message) || e) }); }

// package/tsup.config.ts
try { (() => {
// tsup build config. Plain object export (no `defineConfig` import) so the
// in-browser design checker has no npm import to resolve; tsup reads this fine.
/** @type {import("tsup").Options} */
let __ds_default_package_tsup_config_l7wb5c;
try {
  __ds_default_package_tsup_config_l7wb5c = {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["react", "react-dom"]
  };
} catch {}
Object.assign(__ds_scope, { __ds_default_package_tsup_config_l7wb5c });
})(); } catch (e) { __ds_ns.__errors.push({ path: "package/tsup.config.ts", error: String((e && e.message) || e) }); }

// ui_kits/app/AdaptiveShell.jsx
try { (() => {
// AdaptiveShell.jsx — one shell, three layouts. Modules render unchanged inside.
// compact  (<640)  : bottom TabBar + NavStack push nav + BottomSheet for "More"
// medium   (640-1023): 72px NavRail + SplitPane (list/detail)
// expanded (>=1024) : existing desktop Sidebar layout (App.jsx renders it)

const MOBILE_TABS = [{
  key: "inbox",
  label: "Inbox",
  icon: "inbox"
}, {
  key: "my",
  label: "My issues",
  icon: "crosshair"
}, {
  key: "issues",
  label: "Issues",
  icon: "copy"
}, {
  key: "projects",
  label: "Projects",
  icon: "box"
}];
const RAIL_ITEMS = [{
  key: "inbox",
  label: "Inbox",
  icon: "inbox"
}, {
  key: "my",
  label: "My",
  icon: "crosshair"
}, {
  key: "issues",
  label: "Issues",
  icon: "copy"
}, {
  key: "projects",
  label: "Projects",
  icon: "box"
}, {
  key: "cycles",
  label: "Cycles",
  icon: "refresh-cw"
}, {
  key: "docs",
  label: "Docs",
  icon: "file-text"
}, {
  key: "database",
  label: "Roadmap",
  icon: "table-2"
}];

// every module, grouped — used by the "More" sheet (mobile) and rail overflow (tablet)
const ALL_MODULES = [["Personal", [["inbox", "Inbox", "inbox"], ["reviews", "Reviews", "git-pull-request"], ["my", "My issues", "crosshair"], ["triage", "Triage", "shield-alert"]]], ["Workspace", [["issues", "Issues", "copy"], ["projects", "Projects", "box"], ["views", "Views", "layers"], ["cycles", "Cycles", "refresh-cw"], ["insights", "Insights", "bar-chart-3"]]], ["Docs & data", [["docs", "Documents", "file-text"], ["wiki", "Wiki", "book-open"], ["database", "Roadmap", "table-2"], ["canvas", "Whiteboard", "pen-tool"], ["graph", "Graph", "share-2"], ["import", "Import", "download"]]], ["Apps", [["chat", "Chat", "message-square"], ["crm", "CRM", "contact"], ["calendar", "Calendar", "calendar"], ["forms", "Forms", "clipboard-list"], ["support", "Support", "life-buoy"], ["changelog", "Changelog", "megaphone"]]], ["Account", [["settings", "Settings", "settings-2"]]]];
function ModuleGrid({
  onPick,
  active
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "v-modgrid"
  }, ALL_MODULES.map(([cap, items]) => /*#__PURE__*/React.createElement("div", {
    key: cap
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-modgrid-cap"
  }, cap), /*#__PURE__*/React.createElement("div", {
    className: "v-modgrid-items"
  }, items.map(([k, label, icon]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "v-modtile" + (active === k ? " active" : ""),
    onClick: () => onPick(k)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: icon,
    size: 20,
    cls: "icon"
  }), /*#__PURE__*/React.createElement("span", null, label)))))));
}

// Overflow sheet — the mobile/tablet equivalent of the desktop's sidebar extras,
// status bar and header actions. Every desktop-only affordance gets a resident path here.
function OverflowSheet({
  open,
  onClose,
  items
}) {
  return /*#__PURE__*/React.createElement(BottomSheet, {
    open: open,
    onClose: onClose,
    title: "Actions",
    height: "auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-ovf-list"
  }, (items || []).map((it, i) => it.sep ? /*#__PURE__*/React.createElement("div", {
    className: "v-ovf-sep",
    key: "s" + i
  }) : /*#__PURE__*/React.createElement("button", {
    className: "v-ovf-item",
    key: it.label,
    onClick: () => {
      it.run();
      onClose();
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: it.icon,
    size: 18,
    cls: "icon"
  }), /*#__PURE__*/React.createElement("span", null, it.label), it.value && /*#__PURE__*/React.createElement("span", {
    className: "v-ovf-val"
  }, it.value)))));
}

// Segmented control used for view-mode and tab switching on touch surfaces.
function TouchSegmented({
  items,
  active,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "v-tseg"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.key,
    className: "v-tseg-btn" + (active === it.key ? " active" : ""),
    onClick: () => onSelect(it.key)
  }, it.icon && /*#__PURE__*/React.createElement(Lic, {
    name: it.icon,
    size: 15,
    cls: "icon-sm"
  }), /*#__PURE__*/React.createElement("span", null, it.label))));
}

// Mobile: title bar + optional toolbar row + body + bottom tabs.
function MobileShell({
  view,
  title,
  onNav,
  onSearch,
  onCompose,
  onFilter,
  onDisplay,
  showViewTools,
  onBack,
  canBack,
  menuItems,
  toolbar,
  children
}) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [ovfOpen, setOvfOpen] = React.useState(false);
  const inTabs = MOBILE_TABS.some(t => t.key === view);
  return /*#__PURE__*/React.createElement("div", {
    className: "v-mobile"
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-mob-bar"
  }, canBack ? /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onBack,
    title: "Back"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-left",
    size: 19
  })) : /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setMoreOpen(true),
    title: "All modules"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "menu",
    size: 18
  })), /*#__PURE__*/React.createElement("span", {
    className: "v-mob-title"
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 2
    }
  }, showViewTools && /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onFilter,
    title: "Filter"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "list-filter",
    size: 18
  })), showViewTools && /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onDisplay,
    title: "Display"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "sliders-horizontal",
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onSearch,
    title: "Search"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "search",
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onCompose,
    title: "New issue"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "square-pen",
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setOvfOpen(true),
    title: "More actions"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "more-horizontal",
    size: 18
  })))), toolbar && /*#__PURE__*/React.createElement("div", {
    className: "v-mob-toolbar"
  }, toolbar), /*#__PURE__*/React.createElement("div", {
    className: "v-mob-body"
  }, children), /*#__PURE__*/React.createElement(TabBar, {
    items: [...MOBILE_TABS, {
      key: "__more",
      label: "More",
      icon: "layout-grid"
    }].map(t => ({
      ...t,
      icon: /*#__PURE__*/React.createElement(Lic, {
        name: t.icon,
        size: 19,
        cls: "icon"
      })
    })),
    active: inTabs ? view : moreOpen ? "__more" : null,
    onSelect: k => k === "__more" ? setMoreOpen(true) : onNav(k)
  }), /*#__PURE__*/React.createElement(BottomSheet, {
    open: moreOpen,
    onClose: () => setMoreOpen(false),
    title: "All modules",
    height: "78vh"
  }, /*#__PURE__*/React.createElement(ModuleGrid, {
    active: view,
    onPick: k => {
      onNav(k);
      setMoreOpen(false);
    }
  })), /*#__PURE__*/React.createElement(OverflowSheet, {
    open: ovfOpen,
    onClose: () => setOvfOpen(false),
    items: menuItems
  }));
}

// Tablet: icon rail + content; same affordances, popovers instead of full sheets where it fits.
function TabletShell({
  view,
  title,
  onNav,
  onSearch,
  onCompose,
  onFilter,
  onDisplay,
  showViewTools,
  onBack,
  canBack,
  onForward,
  canFwd,
  menuItems,
  toolbar,
  brand,
  splitList,
  children
}) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [ovfOpen, setOvfOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "v-tablet"
  }, /*#__PURE__*/React.createElement(NavRail, {
    brand: brand,
    items: RAIL_ITEMS.map(t => ({
      ...t,
      icon: /*#__PURE__*/React.createElement(Lic, {
        name: t.icon,
        size: 20,
        cls: "icon"
      })
    })),
    active: view,
    onSelect: onNav,
    onMore: () => setMoreOpen(true)
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-tablet-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-mob-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "navbtns",
    style: {
      marginRight: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onBack,
    disabled: !canBack,
    style: {
      opacity: canBack ? 1 : .35
    },
    title: "Back"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-left",
    size: 17
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onForward,
    disabled: !canFwd,
    style: {
      opacity: canFwd ? 1 : .35
    },
    title: "Forward"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 17
  }))), /*#__PURE__*/React.createElement("span", {
    className: "v-mob-title"
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 2
    }
  }, showViewTools && /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onFilter,
    title: "Filter"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "list-filter",
    size: 18
  })), showViewTools && /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onDisplay,
    title: "Display"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "sliders-horizontal",
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onSearch,
    title: "Search"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "search",
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onCompose,
    title: "New issue"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "square-pen",
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setOvfOpen(true),
    title: "More actions"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "more-horizontal",
    size: 18
  })))), toolbar && /*#__PURE__*/React.createElement("div", {
    className: "v-mob-toolbar"
  }, toolbar), splitList ? /*#__PURE__*/React.createElement(SplitPane, {
    side: splitList
  }, children) : /*#__PURE__*/React.createElement("div", {
    className: "v-mob-body"
  }, children)), /*#__PURE__*/React.createElement(BottomSheet, {
    open: moreOpen,
    onClose: () => setMoreOpen(false),
    title: "All modules",
    height: "70vh"
  }, /*#__PURE__*/React.createElement(ModuleGrid, {
    active: view,
    onPick: k => {
      onNav(k);
      setMoreOpen(false);
    }
  })), /*#__PURE__*/React.createElement(OverflowSheet, {
    open: ovfOpen,
    onClose: () => setOvfOpen(false),
    items: menuItems
  }));
}
Object.assign(window, {
  MOBILE_TABS,
  RAIL_ITEMS,
  ALL_MODULES,
  ModuleGrid,
  MobileShell,
  TabletShell,
  OverflowSheet,
  TouchSegmented
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/AdaptiveShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/App.jsx
try { (() => {
// App.jsx — composes the Vector workspace and wires interactions
const ISSUE_STATUSES = ["backlog", "todo", "progress", "review", "done", "canceled"];
const PROJ_STATUSES = ["backlog", "planned", "progress", "done", "canceled"];

// localStorage-backed state — now delegates to the shared VECTOR_STORE
// (see store.jsx). Same [value, setValue] API; state lives in one observable
// store so components can subscribe directly instead of prop-drilling.
function usePersist(key, initial) {
  return useStore(key, initial);
}
function useIsMobileViewport() {
  const [m, setM] = React.useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639.98px)");
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on);
    };
  }, []);
  return m;
}
function App() {
  const isMobileViewport = useIsMobileViewport();
  const sizeClass = useSizeClass();
  const [view, setView] = React.useState("issues");
  const [loading, setLoading] = React.useState(false);
  const loadTimer = React.useRef(null);
  const flashLoad = () => {
    setLoading(true);
    clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => setLoading(false), 120);
  };
  const [issueMode, setIssueMode] = usePersist("issueMode", "list");
  const [projMode, setProjMode] = usePersist("projMode", "board");
  const [tab, setTab] = React.useState("Active");
  const [issues, setIssues] = usePersist("issues_v3", SEED_ISSUES);
  const [triage, setTriage] = usePersist("triage_v3", TRIAGE_SEED);
  const [docs, setDocs] = usePersist("docs_v3", DOC_SEED);
  const [wikiPages, setWikiPages] = usePersist("wiki_v1", WIKI_SEED);
  const [importHistory, setImportHistory] = usePersist("imphist_v1", []);
  const [database, setDatabase] = usePersist("db_v2", DB_SEED);
  const [dashWidgets, setDashWidgets] = usePersist("dash_v1", DEFAULT_WIDGETS);
  const [cycWidgets, setCycWidgets] = usePersist("cycw_v1", {
    progress: true,
    breakdown: true,
    stats: true,
    sparkline: true,
    list: true
  });
  const [canvasDoc, setCanvasDoc] = usePersist("canvas_v1", CANVAS_SEED);
  const updateCanvas = (id, patch) => setCanvasDoc(prev => ({
    ...prev,
    ...patch
  }));
  const [chatData, setChatData] = usePersist("chat_v1", CHAT_SEED);
  const [crmData, setCrmData] = usePersist("crm_v1", CRM_SEED);
  const [calData, setCalData] = usePersist("cal_v1", CAL_SEED);
  const [formData, setFormData] = usePersist("forms_v1", FORM_SEED);
  const [supportData, setSupportData] = usePersist("support_v1", SUPPORT_SEED);
  const [changelogData, setChangelogData] = usePersist("changelog_v1", CHANGELOG_SEED);
  const updateDoc = (id, patch) => setDocs(prev => prev.map(d => d.id === id ? {
    ...d,
    ...patch
  } : d));
  const deleteDoc = id => setDocs(prev => prev.filter(d => d.id !== id));
  const createDoc = () => {
    const id = "d" + Date.now();
    setDocs(prev => [...prev, {
      id,
      team: activeTeam,
      title: "Untitled",
      icon: "file-text",
      blocks: [{
        type: "heading",
        props: {
          level: 1
        },
        text: ""
      }, {
        type: "paragraph",
        text: ""
      }]
    }]);
    return id;
  };
  const [projects, setProjects] = usePersist("projects_v2", PROJECTS);
  const [showCompose, setShowCompose] = React.useState(false);
  const [composeStatus, setComposeStatus] = React.useState("todo");
  const [showNewProject, setShowNewProject] = React.useState(false);
  const [panel, setPanel] = React.useState(null);
  const [filters, setFilters] = React.useState([{
    type: "Status",
    values: ["Todo"]
  }]);
  const [opts, setOpts] = React.useState({
    subissues: true,
    empty: false,
    recency: true,
    grouping: "Status",
    subgrouping: "Project",
    ordering: "Priority",
    props: ["ID", "Status", "Assignee", "Priority", "Created", "Updated", "Labels"]
  });
  const [popts, setPopts] = React.useState({
    grouping: "Status",
    ordering: "Manual",
    empty: false,
    showList: true,
    weeks: false,
    props: [...PROJECT_PROPS_DEFAULT]
  });
  const [selected, setSelected] = React.useState(null);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showCmd, setShowCmd] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);
  const [showWsMenu, setShowWsMenu] = React.useState(false);
  const [rightOpen, setRightOpen] = React.useState(false);
  const [rightW, setRightW] = usePersist("rightW", 300);
  const [rightTab, setRightTab] = React.useState("filters");
  const [facetSheet, setFacetSheet] = React.useState(false);
  const [keysSheet, setKeysSheet] = React.useState(false);
  const [tlSel, setTlSel] = React.useState(null); // {kind, id} selected timeline bar
  const [projFilter, setProjFilter] = React.useState({});
  const [sel, setSel] = React.useState(new Set());
  const [selProject, setSelProject] = React.useState(null);
  const openProject = p => {
    pushRecent({
      type: "project",
      id: p.id,
      label: p.name
    });
    setSelProject(p);
  };
  const [showImport, setShowImport] = React.useState(false);
  const [showInvite, setShowInvite] = React.useState(false);
  const [moreAnchor, setMoreAnchor] = React.useState(null);
  const [showCustomize, setShowCustomize] = React.useState(false);
  const [sidebarCfg, setSidebarCfg] = usePersist("sidebarCfg", {
    inbox: true,
    my: true,
    projects: true,
    views: true
  });
  const [sbW, setSbW] = usePersist("sbW", 232);
  const [sbCollapsed, setSbCollapsed] = React.useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches);
  const [sbPeek, setSbPeek] = React.useState(false);
  const [recents, setRecents] = React.useState([]);
  const [recentsAnchor, setRecentsAnchor] = React.useState(null);
  const [savedViews, setSavedViews] = usePersist("savedViews", [{
    id: "v1",
    kind: "issues",
    name: "Active issues",
    desc: "Status is Todo, In Progress, In Review",
    icon: "layers",
    filters: [],
    mode: "list",
    tab: "Active"
  }, {
    id: "v2",
    kind: "issues",
    name: "Urgent bugs",
    desc: "Priority is Urgent · Label is Bug",
    icon: "alert-triangle",
    filters: [{
      type: "Priority",
      values: ["Urgent"]
    }, {
      type: "Labels",
      values: ["Bug"]
    }],
    mode: "list",
    tab: "All issues"
  }]);
  const nextView = React.useRef(3);
  const saveCurrentView = () => {
    const id = "v" + nextView.current++;
    const desc = filters.length ? filters.map(f => `${f.type} is ${f.values.join(", ")}`).join(" · ") : "All issues";
    setSavedViews(prev => [...prev, {
      id,
      kind: "issues",
      name: "View " + id.slice(1),
      desc,
      icon: "layers",
      filters: JSON.parse(JSON.stringify(filters)),
      mode: issueMode,
      tab
    }]);
    navTo("views");
  };
  const openSavedView = v => {
    if (v.kind === "issues") {
      setFilters(JSON.parse(JSON.stringify(v.filters || [])));
      setIssueMode(v.mode || "list");
      setTab(v.tab || "Active");
      navTo("issues");
    } else navTo("projects");
  };
  const createBlankView = kind => {
    const id = "v" + nextView.current++;
    setSavedViews(prev => [...prev, {
      id,
      kind,
      name: "New " + kind + " view",
      desc: "Custom view",
      icon: "layers",
      filters: [],
      mode: kind === "issues" ? "list" : "board",
      tab: "All issues"
    }]);
  };
  const deleteView = id => setSavedViews(prev => prev.filter(v => v.id !== id));
  const [favorites, setFavorites] = usePersist("favorites", ["v1"]);
  const toggleFav = id => setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const renameView = v => {
    const name = window.prompt("View name", v.name);
    if (name && name.trim()) setSavedViews(prev => prev.map(x => x.id === v.id ? {
      ...x,
      name: name.trim()
    } : x));
  };
  const duplicateView = v => {
    const id = "v" + nextView.current++;
    setSavedViews(prev => [...prev, {
      ...v,
      id,
      name: v.name + " copy"
    }]);
  };
  const copyViewLink = v => {
    try {
      navigator.clipboard.writeText("https://vector.app/view/" + v.id);
    } catch (e) {}
    setToast("View link copied");
  };
  const toggleSubscribeView = id => setSavedViews(prev => prev.map(x => x.id === id ? {
    ...x,
    subscribed: !x.subscribed
  } : x));
  const [toast, setToast] = React.useState(null);
  React.useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 1800);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const pushRecent = r => setRecents(prev => [r, ...prev.filter(x => x.id !== r.id)].slice(0, 8));
  const [tabs, setTabs] = React.useState([{
    id: "t1",
    view: "projects",
    label: "Projects",
    icon: "box"
  }, {
    id: "t2",
    view: "issues",
    label: "Active issues",
    icon: "copy"
  }]);
  const [activeTab, setActiveTab] = React.useState("t2");
  const [theme, setTheme] = React.useState(() => localStorage.getItem("vector-theme") || "dark");
  const [teams, setTeams] = usePersist("teams", TEAMS);
  const [activeTeam, setActiveTeam] = usePersist("activeTeam", "VEC");
  const [teamMenu, setTeamMenu] = React.useState(null);
  const curTeam = teams.find(t => t.id === activeTeam) || teams[0];
  const addTeam = () => {
    const id = "TEAM" + (teams.length + 1);
    const t = {
      id,
      name: "New team " + (teams.length + 1),
      color: "#4CB782",
      icon: "users"
    };
    setTeams(prev => [...prev, t]);
    setActiveTeam(id);
    setTeamMenu(null);
    navTo("issues");
  };
  const [hist, setHist] = React.useState({
    stack: [{
      view: "issues",
      sel: null
    }],
    idx: 0
  });
  const nextNum = React.useRef(9);
  const nextProj = React.useRef(6);
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vector-theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const hoverIssue = React.useRef(null);
  const [focusId, setFocusId] = React.useState(null);
  const displayedRef = React.useRef([]);
  React.useEffect(() => {
    window.__vSetHover = id => {
      hoverIssue.current = id;
    };
  }, []);
  React.useEffect(() => {
    let gPending = false,
      gTimer = null;
    const h = e => {
      const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable;
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowCmd(v => !v);
        return;
      }
      if (e.key === "Escape") {
        setShowCmd(false);
        setShowSearch(false);
        setShowCompose(false);
        setShowNewProject(false);
        setShowHelp(false);
        setShowWsMenu(false);
        setPanel(null);
        return;
      }
      if (typing) return;
      if (gPending) {
        gPending = false;
        clearTimeout(gTimer);
        const map = {
          i: "inbox",
          e: "issues",
          p: "projects",
          v: "views",
          m: "my",
          r: "reviews",
          s: "settings"
        };
        if (map[e.key]) {
          e.preventDefault();
          navTo(map[e.key]);
          return;
        }
      }
      if (e.key === "g") {
        gPending = true;
        gTimer = setTimeout(() => {
          gPending = false;
        }, 900);
        return;
      }
      // ---- issue hotkeys: act on the focused detail issue, else the hovered row ----
      const targetId = selected ? selected.id : hoverIssue.current;
      if (targetId && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const prio = {
          "0": "none",
          "1": "urgent",
          "2": "high",
          "3": "medium",
          "4": "low"
        };
        if (prio[e.key] !== undefined) {
          e.preventDefault();
          patchIssue(targetId, {
            priority: prio[e.key]
          });
          return;
        }
        const stat = {
          backlog: "backlog",
          t: "todo",
          x: "canceled",
          d: "done",
          r: "review",
          w: "progress"
        };
        if (stat[e.key]) {
          e.preventDefault();
          patchIssue(targetId, {
            status: stat[e.key]
          });
          return;
        }
        if (e.key === "s") {
          e.preventDefault();
          cycle(targetId);
          return;
        }
      }
      // ---- Raycast-style list focus nav (issues list view) ----
      if (isIssues && issueMode === "list" && !selected) {
        const ids = displayedRef.current.map(i => i.id);
        if (e.key === "ArrowDown" || e.key === "j") {
          e.preventDefault();
          setFocusId(cur => {
            const idx = ids.indexOf(cur);
            return ids[Math.min(ids.length - 1, idx + 1)] || ids[0] || null;
          });
          return;
        }
        if (e.key === "ArrowUp" || e.key === "k") {
          e.preventDefault();
          setFocusId(cur => {
            const idx = ids.indexOf(cur);
            return idx <= 0 ? ids[0] : ids[idx - 1];
          });
          return;
        }
        if (e.key === "Enter" && focusId) {
          e.preventDefault();
          const it = displayedRef.current.find(i => i.id === focusId);
          if (it) openIssue(it);
          return;
        }
      }
      if (e.key === "/") {
        e.preventDefault();
        navTo("search");
        return;
      }
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        openCompose("todo");
        return;
      }
      if (e.key === "f") {
        e.preventDefault();
        setPanel(p => p === "filter" ? null : "filter");
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        setSbCollapsed(c => !c);
        return;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [hist, view, issues, activeTeam, selected, issueMode, focusId]);

  // ---- history navigation ----
  const applyRoute = r => {
    setView(r.view);
    setSelected(r.sel ? issues.find(i => i.id === r.sel) : null);
    setPanel(null);
    setSel(new Set());
    setSelProject(null);
  };
  const navTo = (v, selId = null) => {
    if (v !== view) flashLoad();
    applyRoute({
      view: v,
      sel: selId
    });
    setHist(h => {
      const stack = h.stack.slice(0, h.idx + 1);
      stack.push({
        view: v,
        sel: selId
      });
      return {
        stack,
        idx: stack.length - 1
      };
    });
  };
  const back = () => {
    if (hist.idx > 0) {
      const ni = hist.idx - 1;
      applyRoute(hist.stack[ni]);
      setHist({
        ...hist,
        idx: ni
      });
    }
  };
  const forward = () => {
    if (hist.idx < hist.stack.length - 1) {
      const ni = hist.idx + 1;
      applyRoute(hist.stack[ni]);
      setHist({
        ...hist,
        idx: ni
      });
    }
  };
  const canBack = hist.idx > 0,
    canFwd = hist.idx < hist.stack.length - 1;
  const openIssue = issue => {
    pushRecent({
      type: "issue",
      id: issue.id,
      label: issue.title,
      status: issue.status
    });
    navTo("issues", issue.id);
  };

  // ---- tabs ----
  const VIEW_META = {
    issues: {
      label: "Issues",
      icon: "copy"
    },
    projects: {
      label: "Projects",
      icon: "box"
    },
    views: {
      label: "Views",
      icon: "layers"
    },
    inbox: {
      label: "Inbox",
      icon: "inbox"
    },
    my: {
      label: "My issues",
      icon: "crosshair"
    },
    reviews: {
      label: "Reviews",
      icon: "git-pull-request"
    }
  };
  const addTab = () => {
    const id = "t" + Date.now();
    setTabs(prev => [...prev, {
      id,
      view: "issues",
      label: "Issues",
      icon: "copy"
    }]);
    setActiveTab(id);
    navTo("issues");
  };
  const addTabFor = v => {
    const m = VIEW_META[v] || VIEW_META.issues;
    const id = "t" + Date.now();
    setTabs(prev => [...prev, {
      id,
      view: v,
      label: m.label,
      icon: m.icon
    }]);
    setActiveTab(id);
    navTo(v);
  };
  const openTab = t => {
    setActiveTab(t.id);
    navTo(t.view);
  };
  const closeTab = (id, e) => {
    e.stopPropagation();
    setTabs(prev => prev.length > 1 ? prev.filter(t => t.id !== id) : prev);
  };
  const [tabDrop, setTabDrop] = React.useState(false);
  const acceptTriage = id => {
    const t = triage.find(x => x.id === id);
    if (t) setIssues(prev => [{
      ...t,
      status: "todo",
      project: null,
      subscribers: [],
      hasDescription: true,
      hasLinks: false,
      dueDate: null,
      overdue: false,
      updated: "Jun 1"
    }, ...prev]);
    setTriage(prev => prev.filter(x => x.id !== id));
  };
  const declineTriage = id => setTriage(prev => prev.filter(t => t.id !== id));
  const setTriagePriority = (id, p) => setTriage(prev => prev.map(t => t.id === id ? {
    ...t,
    priority: p
  } : t));
  const openCompose = status => {
    setComposeStatus(ISSUE_STATUSES.includes(status) ? status : "todo");
    setShowCompose(true);
  };
  const createIssue = ({
    title,
    status
  }) => {
    const prefix = activeTeam;
    const maxN = issues.filter(i => i.team === activeTeam).reduce((m, i) => {
      const n = parseInt(i.id.split("-")[1] || "0");
      return n > m ? n : m;
    }, 0);
    const id = prefix + "-" + (maxN + 1);
    setIssues(prev => [{
      id,
      title,
      team: activeTeam,
      status: status || "todo",
      priority: "none",
      created: "Jun 1",
      updated: "Jun 1",
      project: null,
      labels: [],
      assignee: null,
      source: null,
      subscribers: [],
      hasDescription: false,
      hasLinks: false,
      dueDate: null,
      overdue: false
    }, ...prev]);
  };
  const createProject = ({
    name,
    status
  }) => {
    const maxN = projects.reduce((m, p) => {
      const n = parseInt(p.id.replace("p", "") || "0");
      return n > m ? n : m;
    }, 0);
    setProjects(prev => [...prev, {
      id: "p" + (maxN + 1),
      name,
      team: activeTeam,
      status: PROJ_STATUSES.includes(status) ? status : "backlog",
      health: "onTrack",
      priority: "none",
      lead: null,
      target: "—",
      start: "—",
      issues: 0,
      progress: 0,
      members: 1,
      deps: 0,
      created: "Jun 1",
      updated: "Jun 1",
      completed: null,
      labels: []
    }]);
  };
  const quickAddProject = statusKey => createProject({
    name: "New project",
    status: statusKey
  });
  const patchIssue = (id, patch) => {
    setIssues(prev => prev.map(i => i.id === id ? {
      ...i,
      ...patch
    } : i));
    setSelected(s => s && s.id === id ? {
      ...s,
      ...patch
    } : s);
  };
  const cycle = id => setIssues(prev => prev.map(i => {
    if (i.id !== id) return i;
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(i.status) + 1) % STATUS_CYCLE.length];
    setSelected(s => s && s.id === id ? {
      ...s,
      status: next
    } : s);
    return {
      ...i,
      status: next
    };
  }));

  // ---- filters ----
  const toggleFilter = (type, value) => setFilters(prev => {
    const f = prev.find(x => x.type === type);
    if (!f) return [...prev, {
      type,
      values: [value]
    }];
    const has = f.values.includes(value);
    const values = has ? f.values.filter(v => v !== value) : [...f.values, value];
    if (values.length === 0) return prev.filter(x => x.type !== type);
    return prev.map(x => x.type === type ? {
      ...x,
      values
    } : x);
  });
  const removeFilter = type => setFilters(prev => prev.filter(x => x.type !== type));
  const matchesFilters = i => filters.every(f => {
    const v = f.values;
    switch (f.type) {
      case "Status":
        return v.includes(statusLabel(i.status));
      case "Priority":
        return v.includes(priorityLabel(i.priority));
      case "Labels":
      case "Suggested label":
        return i.labels.some(l => v.includes(l));
      case "Assignee":
        return v.some(x => x === "No assignee" ? !i.assignee : i.assignee === x || x === "Current user" && i.assignee === "김혁규");
      case "Project":
        return v.some(x => x === "No project" ? !i.project : i.project === x);
      case "External source":
        return v.some(x => x === "No source" ? !i.source : x === "GitHub" && i.source === "github");
      case "Subscribers":
        return v.some(x => x === "No subscribers" ? !(i.subscribers || []).length : (i.subscribers || []).includes(x) || x === "Current user" && (i.subscribers || []).includes("김혁규"));
      case "Links":
        return v.some(x => x === "No links" ? !i.hasLinks : x === "GitHub" && i.hasLinks);
      case "Content":
        return v.some(x => x === "Has description" ? i.hasDescription : x === "Has attachments" ? i.hasAttachment : true);
      case "Template":
        return v.some(x => x === "No template" ? !i.template : i.template === x);
      case "Dates":
        return v.some(x => x === "Has due date" ? !!i.dueDate : x === "No due date" ? !i.dueDate : x === "Overdue" ? !!i.overdue : true);
      case "Auto-closed":
        return !!i.autoClosed;
      default:
        return true;
      // Agent, Creator, Relations, Status type, Project properties — cosmetic
    }
  });
  const matchesTab = i => tab === "All issues" ? true : tab === "Active" ? STATUS_TYPE[i.status] === "active" : STATUS_TYPE[i.status] === "backlog";
  const displayed = issues.filter(i => i.team === activeTeam && matchesTab(i) && matchesFilters(i));
  displayedRef.current = displayed;

  // ---- project facet filtering ----
  const toggleProjFilter = (type, value) => setProjFilter(prev => {
    const cur = prev[type] || [];
    const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
    return {
      ...prev,
      [type]: next
    };
  });
  const matchesProject = p => Object.entries(projFilter).every(([type, vals]) => {
    if (!vals.length) return true;
    if (type === "Lead") return vals.includes(p.lead || "No lead");
    if (type === "Priority") return vals.includes(priorityLabel(p.priority));
    if (type === "Health") return vals.includes(HEALTH[p.health].label);
    if (type === "Status") return vals.includes(PROJECT_STATUS[p.status].label);
    return true;
  });
  const displayedProjects = projects.filter(p => p.team === activeTeam && matchesProject(p));

  // ---- multi-select + bulk actions ----
  const toggleSel = id => setSel(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const clearSel = () => setSel(new Set());
  const bulkSetStatus = s => {
    setIssues(prev => prev.map(i => sel.has(i.id) ? {
      ...i,
      status: s
    } : i));
    clearSel();
  };
  const bulkSetPriority = p => {
    setIssues(prev => prev.map(i => sel.has(i.id) ? {
      ...i,
      priority: p
    } : i));
    clearSel();
  };
  const bulkDelete = () => {
    if (view === "projects") setProjects(prev => prev.filter(p => !sel.has(p.id)));else setIssues(prev => prev.filter(i => !sel.has(i.id)));
    clearSel();
  };
  const bulkActions = view === "projects" ? {
    items: [{
      icon: "trash-2",
      label: "Delete projects",
      sub: "⌫",
      run: bulkDelete
    }]
  } : {
    items: [{
      icon: "circle-check",
      label: "Mark as Done",
      run: () => bulkSetStatus("done")
    }, {
      icon: "signal-high",
      label: "Set priority Urgent",
      run: () => bulkSetPriority("urgent")
    }, {
      icon: "circle-dashed",
      label: "Move to Backlog",
      run: () => bulkSetStatus("backlog")
    }, {
      icon: "trash-2",
      label: "Delete issues",
      sub: "⌫",
      run: bulkDelete
    }]
  };
  const isIssues = view === "issues";
  const isProjects = view === "projects";
  const titleMap = MODULE_TITLE;
  const iconMap = MODULE_ICON;
  const overlays = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(BottomSheet, {
    open: keysSheet,
    onClose: () => setKeysSheet(false),
    title: "Keyboard shortcuts",
    height: "72vh"
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-keys"
  }, [["Navigate", [["G then I", "Inbox"], ["G then E", "Issues"], ["G then P", "Projects"], ["G then M", "My issues"], ["G then V", "Views"], ["G then S", "Settings"]]], ["Act", [["C", "New issue"], ["/", "Search"], ["\u2318 K", "Command palette"], ["F", "Filter"], ["[", "Toggle sidebar"]]], ["On the focused issue", [["J / K", "Move focus down / up"], ["Enter", "Open issue"], ["1 \u2013 4", "Set priority"], ["S", "Cycle status"], ["X", "Select"]]]].map(([cap, rows]) => /*#__PURE__*/React.createElement("div", {
    key: cap
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-keys-cap"
  }, cap), rows.map(([k, label]) => /*#__PURE__*/React.createElement("div", {
    className: "v-keys-row",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-keys-key"
  }, k), /*#__PURE__*/React.createElement("span", null, label))))), /*#__PURE__*/React.createElement("div", {
    className: "v-keys-note"
  }, "Works on any surface with a keyboard attached \\u2014 including tablets."))), /*#__PURE__*/React.createElement(BottomSheet, {
    open: facetSheet,
    onClose: () => setFacetSheet(false),
    title: isProjects ? "Filter projects" : "Filter issues",
    height: "72vh"
  }, isProjects ? /*#__PURE__*/React.createElement(ProjectFacetBody, {
    projects: projects,
    projFilter: projFilter,
    onToggle: toggleProjFilter
  }) : /*#__PURE__*/React.createElement(FacetBody, {
    issues: displayed,
    filters: filters,
    onToggle: toggleFilter
  })), panel && /*#__PURE__*/React.createElement("div", {
    className: "overlay",
    onClick: () => setPanel(null)
  }), panel === "filter" && /*#__PURE__*/React.createElement(FilterMenu, {
    onClose: () => setPanel(null),
    filters: filters,
    onToggle: toggleFilter
  }), panel === "display" && (isProjects ? /*#__PURE__*/React.createElement(DisplayPanel, {
    context: "projects",
    mode: projMode,
    setMode: setProjMode,
    opts: popts,
    setOpts: setPopts
  }) : /*#__PURE__*/React.createElement(DisplayPanel, {
    context: "issues",
    mode: issueMode,
    setMode: setIssueMode,
    opts: opts,
    setOpts: setOpts
  })), showCompose && /*#__PURE__*/React.createElement(CreateIssueModal, {
    onClose: () => setShowCompose(false),
    onCreate: createIssue,
    initialStatus: composeStatus
  }), showNewProject && /*#__PURE__*/React.createElement(NewProjectModal, {
    onClose: () => setShowNewProject(false),
    onCreate: createProject
  }), showSearch && /*#__PURE__*/React.createElement(SearchModal, {
    issues: issues,
    onClose: () => setShowSearch(false),
    onOpenIssue: i => openIssue(i)
  }), showCmd && /*#__PURE__*/React.createElement(CommandMenu, {
    onClose: () => setShowCmd(false),
    onCompose: () => openCompose("todo"),
    onNav: navTo,
    onSearch: () => navTo("search"),
    onToggleTheme: toggleTheme,
    theme: theme,
    onNewProject: () => setShowNewProject(true),
    ctxIssue: selected || (hoverIssue.current ? issues.find(i => i.id === hoverIssue.current) : null),
    onIssueAction: (id, patch) => {
      if (patch.__delete) {
        setIssues(prev => prev.filter(i => i.id !== id));
        if (selected && selected.id === id) setSelected(null);
      } else patchIssue(id, patch);
    }
  }), showHelp && /*#__PURE__*/React.createElement(HelpMenu, {
    onClose: () => setShowHelp(false),
    onNav: navTo
  }), showWsMenu && /*#__PURE__*/React.createElement(WorkspaceMenu, {
    onClose: () => setShowWsMenu(false),
    onNav: navTo
  }), moreAnchor && /*#__PURE__*/React.createElement(MoreMenu, {
    anchor: moreAnchor,
    onClose: () => setMoreAnchor(null),
    onNav: navTo,
    onCustomize: () => setShowCustomize(true)
  }), recentsAnchor && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "overlay",
    style: {
      zIndex: 48
    },
    onClick: () => setRecentsAnchor(null)
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-menu",
    style: {
      position: "fixed",
      top: recentsAnchor.bottom + 6,
      left: recentsAnchor.left,
      width: 240,
      zIndex: 49
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cmd-cap",
    style: {
      padding: "6px 10px 4px"
    }
  }, "Recently viewed"), recents.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    style: {
      color: "var(--fg-4)"
    }
  }, "Nothing yet"), recents.map(r => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: r.id,
    onClick: () => {
      setRecentsAnchor(null);
      if (r.type === "issue") {
        const it = issues.find(i => i.id === r.id);
        if (it) openIssue(it);
      } else {
        const p = projects.find(x => x.id === r.id);
        if (p) {
          navTo("projects");
          openProject(p);
        }
      }
    }
  }, r.type === "issue" ? /*#__PURE__*/React.createElement(StatusIcon, {
    status: r.status || "todo",
    size: 14
  }) : /*#__PURE__*/React.createElement(Lic, {
    name: "box",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, r.label))))), showCustomize && /*#__PURE__*/React.createElement(CustomizeSidebarModal, {
    cfg: sidebarCfg,
    setCfg: setSidebarCfg,
    onClose: () => setShowCustomize(false)
  }), showImport && /*#__PURE__*/React.createElement(ImportModal, {
    onClose: () => setShowImport(false)
  }), showInvite && /*#__PURE__*/React.createElement(InviteModal, {
    onClose: () => setShowInvite(false)
  }), toast && /*#__PURE__*/React.createElement("div", {
    className: "toast"
  }, toast), /*#__PURE__*/React.createElement("div", {
    className: "help-btn",
    onClick: () => setShowHelp(true),
    title: "Help"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "help-circle",
    size: 15,
    cls: "icon-sm"
  })));
  const navbtns = /*#__PURE__*/React.createElement("div", {
    className: "navbtns"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: e => setRecentsAnchor(e.currentTarget.getBoundingClientRect()),
    title: "Recently viewed",
    style: {
      marginRight: 4
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "clock",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: back,
    style: {
      opacity: canBack ? 1 : .35
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-left",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: forward,
    style: {
      opacity: canFwd ? 1 : .35
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 16
  })));
  const statusbar = /*#__PURE__*/React.createElement("div", {
    className: "statusbar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sb-item",
    onClick: () => setShowCmd(true)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "navigation",
    size: 13,
    cls: "icon-sm"
  }), "Ask Vector"), /*#__PURE__*/React.createElement("span", {
    className: "sb-item",
    onClick: toggleTheme,
    title: "Toggle theme"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: theme === "dark" ? "sun" : "moon",
    size: 13,
    cls: "icon-sm"
  })), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "history",
    size: 13,
    cls: "icon-sm"
  })));
  if (isMobileViewport) {
    return /*#__PURE__*/React.createElement(MobileApp, {
      issues: issues,
      teams: teams,
      savedViews: savedViews,
      favorites: favorites,
      onCycle: cycle
    });
  }
  if (view === "settings") {
    return /*#__PURE__*/React.createElement("div", {
      className: "app" + (sbCollapsed ? "" : " nav-open")
    }, !sbCollapsed && /*#__PURE__*/React.createElement("div", {
      className: "nav-scrim",
      onClick: () => setSbCollapsed(true)
    }), /*#__PURE__*/React.createElement(Sidebar, {
      view: view,
      setView: navTo,
      onCompose: () => openCompose("todo"),
      onSearch: () => navTo("search"),
      onWsMenu: () => setShowWsMenu(true),
      onImport: () => setShowImport(true),
      onInvite: () => setShowInvite(true),
      onMore: r => setMoreAnchor(r),
      cfg: sidebarCfg,
      width: sbW,
      onResize: setSbW,
      collapsed: sbCollapsed,
      peek: sbPeek,
      setPeek: setSbPeek,
      onCollapse: () => setSbCollapsed(true),
      onExpand: () => {
        setSbCollapsed(false);
        setSbPeek(false);
      },
      onRecents: r => setRecentsAnchor(r),
      teams: teams,
      activeTeam: activeTeam,
      onSwitchTeam: id => {
        setActiveTeam(id);
        navTo('issues');
      },
      onAddTeam: addTeam,
      teamMenu: teamMenu,
      setTeamMenu: setTeamMenu,
      favoriteViews: savedViews.filter(v => favorites.includes(v.id)),
      onOpenView: openSavedView,
      onUnfavorite: toggleFav,
      onOpenTab: addTabFor,
      onHide: k => setSidebarCfg(c => ({
        ...c,
        [k]: "Don't show"
      }))
    }), /*#__PURE__*/React.createElement("div", {
      className: "main"
    }, /*#__PURE__*/React.createElement(Settings, {
      onBack: () => navTo("issues"),
      theme: theme,
      onToggleTheme: toggleTheme
    })), overlays);
  }
  if (selected) {
    return /*#__PURE__*/React.createElement("div", {
      className: "app" + (sbCollapsed ? "" : " nav-open")
    }, !sbCollapsed && /*#__PURE__*/React.createElement("div", {
      className: "nav-scrim",
      onClick: () => setSbCollapsed(true)
    }), /*#__PURE__*/React.createElement(Sidebar, {
      view: view,
      setView: navTo,
      onCompose: () => openCompose("todo"),
      onSearch: () => navTo("search"),
      onWsMenu: () => setShowWsMenu(true),
      onImport: () => setShowImport(true),
      onInvite: () => setShowInvite(true),
      onMore: r => setMoreAnchor(r),
      cfg: sidebarCfg,
      width: sbW,
      onResize: setSbW,
      collapsed: sbCollapsed,
      peek: sbPeek,
      setPeek: setSbPeek,
      onCollapse: () => setSbCollapsed(true),
      onExpand: () => {
        setSbCollapsed(false);
        setSbPeek(false);
      },
      onRecents: r => setRecentsAnchor(r),
      teams: teams,
      activeTeam: activeTeam,
      onSwitchTeam: id => {
        setActiveTeam(id);
        navTo('issues');
      },
      onAddTeam: addTeam,
      teamMenu: teamMenu,
      setTeamMenu: setTeamMenu,
      favoriteViews: savedViews.filter(v => favorites.includes(v.id)),
      onOpenView: openSavedView,
      onUnfavorite: toggleFav,
      onOpenTab: addTabFor,
      onHide: k => setSidebarCfg(c => ({
        ...c,
        [k]: "Don't show"
      }))
    }), /*#__PURE__*/React.createElement("div", {
      className: "main"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tabbar"
    }, navbtns, /*#__PURE__*/React.createElement("div", {
      className: "tab active"
    }, /*#__PURE__*/React.createElement(StatusIcon, {
      status: selected.status,
      size: 13
    }), /*#__PURE__*/React.createElement("span", {
      className: "tab-name"
    }, selected.id))), /*#__PURE__*/React.createElement(IssueDetail, {
      issue: selected,
      onBack: () => navTo("issues", null),
      onCycle: cycle,
      onUpdate: patchIssue,
      index: Math.max(0, displayed.findIndex(i => i.id === selected.id)),
      total: displayed.length || 1,
      onPrev: () => {
        const i = displayed.findIndex(x => x.id === selected.id);
        if (i > 0) setSelected(displayed[i - 1]);
      },
      onNext: () => {
        const i = displayed.findIndex(x => x.id === selected.id);
        if (i >= 0 && i < displayed.length - 1) setSelected(displayed[i + 1]);
      },
      projectNames: projects.filter(p => p.team === activeTeam).map(p => p.name)
    }), statusbar), overlays);
  }
  const bodyView = /*#__PURE__*/React.createElement("div", {
    className: "body-main",
    key: view + (selected ? ":" + selected.id : "") + (selProject ? ":" + selProject.id : "")
  }, view === "inbox" && /*#__PURE__*/React.createElement(Inbox, null), view === "my" && /*#__PURE__*/React.createElement(MyIssues, {
    issues: issues,
    onOpen: openIssue,
    onCycle: cycle,
    onCompose: openCompose
  }), isProjects && (selProject ? /*#__PURE__*/React.createElement(ProjectDetail, {
    project: selProject,
    onBack: () => setSelProject(null)
  }) : /*#__PURE__*/React.createElement(ProjectsView, {
    projects: displayedProjects,
    mode: projMode,
    opts: popts,
    onAdd: quickAddProject,
    sel: sel,
    onToggleSel: toggleSel,
    onOpen: openProject,
    onUpdateDates: (id, s, t) => setProjects(prev => prev.map(p => p.id === id ? {
      ...p,
      start: s,
      target: t
    } : p)),
    onSelectBar: projMode === "timeline" ? p => {
      setTlSel({
        kind: "project",
        id: p.id
      });
      setRightTab("details");
      setRightOpen(true);
    } : undefined,
    selectedId: tlSel && tlSel.kind === "project" ? tlSel.id : null
  })), view === "search" && /*#__PURE__*/React.createElement(SearchView, {
    issues: issues,
    projects: projects,
    onOpenIssue: openIssue,
    onOpenProject: p => {
      navTo("projects");
      setSelProject(p);
    }
  }), view === "reviews" && /*#__PURE__*/React.createElement(ReviewsScreen, null), view === "cycles" && /*#__PURE__*/React.createElement(Cycles, {
    cycles: CYCLES.filter(c => c.team === activeTeam),
    issues: issues.filter(i => i.team === activeTeam),
    onOpen: openIssue,
    onCycle: cycle,
    onSetStatus: (id, status) => patchIssue(id, {
      status
    }),
    cycWidgets: cycWidgets,
    onCycWidgets: setCycWidgets
  }), view === "insights" && /*#__PURE__*/React.createElement(Insights, {
    issues: issues.filter(i => i.team === activeTeam),
    cycles: CYCLES.filter(c => c.team === activeTeam),
    widgets: dashWidgets,
    onWidgets: setDashWidgets,
    database: database
  }), view === "docs" && /*#__PURE__*/React.createElement(Docs, {
    docs: docs,
    issues: issues,
    onUpdate: updateDoc,
    onCreate: createDoc,
    onOpenIssue: openIssue,
    onDelete: deleteDoc
  }), view === "database" && /*#__PURE__*/React.createElement(Database, {
    db: database,
    onUpdate: setDatabase
  }), view === "canvas" && /*#__PURE__*/React.createElement(Canvas, {
    doc: canvasDoc,
    onUpdate: updateCanvas
  }), view === "chat" && /*#__PURE__*/React.createElement(Chat, {
    data: chatData,
    onUpdate: setChatData
  }), view === "crm" && /*#__PURE__*/React.createElement(CRM, {
    data: crmData,
    onUpdate: setCrmData
  }), view === "calendar" && /*#__PURE__*/React.createElement(Calendar, {
    data: calData,
    onUpdate: setCalData
  }), view === "forms" && /*#__PURE__*/React.createElement(Forms, {
    data: formData,
    onUpdate: setFormData
  }), view === "support" && /*#__PURE__*/React.createElement(Support, {
    data: supportData,
    onUpdate: setSupportData
  }), view === "changelog" && /*#__PURE__*/React.createElement(Changelog, {
    data: changelogData,
    onUpdate: setChangelogData
  }), view === "graph" && /*#__PURE__*/React.createElement(Graph, {
    issues: issues.filter(i => i.team === activeTeam),
    projects: projects.filter(p => p.team === activeTeam),
    docs: docs.filter(d => d.team === activeTeam),
    onOpenIssue: openIssue
  }), view === "wiki" && /*#__PURE__*/React.createElement(Wiki, {
    pages: wikiPages,
    onUpdate: setWikiPages
  }), view === "import" && /*#__PURE__*/React.createElement(ImportFlow, {
    history: importHistory,
    onLog: s => setImportHistory(prev => [s, ...prev]),
    onImportToDb: file => {
      if (file.cols && file.rows) {
        // build real fields (with inferred types) + rows from parsed data
        const maps = file.maps || file.cols.map(() => "text");
        const fields = file.cols.map((c, i) => ({
          id: "f" + Date.now() + i,
          name: c || "col_" + (i + 1),
          type: i === 0 ? "title" : maps[i] === "num" ? "number" : maps[i] || "text"
        }));
        const rows = file.rows.map((row, ri) => {
          const r = {
            id: "r" + Date.now() + ri
          };
          fields.forEach((f, ci) => {
            r[f.id] = row[ci] ?? "";
          });
          return r;
        });
        setDatabase({
          id: "db" + Date.now(),
          team: activeTeam,
          name: file.name.split(".")[0],
          props: fields,
          rows
        });
        navTo("database");
      } else {
        setDatabase(db => ({
          ...db,
          rows: [...db.rows, ...(file.rows || []).map((row, i) => ({
            id: "r" + Date.now() + i,
            name: row[0]
          }))]
        }));
      }
    },
    onImportToDoc: file => {
      setDocs(prev => [{
        id: "d" + Date.now(),
        team: activeTeam,
        title: file.name.split(".")[0],
        icon: "file-text",
        blocks: [{
          type: "heading",
          props: {
            level: 1
          },
          text: file.name.split(".")[0]
        }, {
          type: "paragraph",
          text: "Imported from " + file.name + "."
        }]
      }, ...prev]);
    }
  }), view === "triage" && /*#__PURE__*/React.createElement(Triage, {
    queue: triage.filter(t => t.team === activeTeam),
    onAccept: acceptTriage,
    onDecline: declineTriage,
    onOpen: openIssue,
    onCycle: cycle,
    onSetPriority: setTriagePriority
  }), view === "views" && /*#__PURE__*/React.createElement(ViewsScreen, {
    savedViews: savedViews,
    favorites: favorites,
    onOpenView: openSavedView,
    onDeleteView: deleteView,
    onCreateView: createBlankView,
    onToggleFav: toggleFav,
    onRename: renameView,
    onDuplicate: duplicateView,
    onCopyLink: copyViewLink,
    onToggleSubscribe: toggleSubscribeView
  }), isIssues && (loading ? issueMode === "board" ? /*#__PURE__*/React.createElement(BoardSkeleton, null) : /*#__PURE__*/React.createElement(ListSkeleton, null) : issueMode === "board" ? /*#__PURE__*/React.createElement(BoardView, {
    issues: displayed,
    opts: opts,
    onCycle: cycle,
    onOpen: openIssue,
    onAdd: openCompose,
    onMove: (id, status) => patchIssue(id, {
      status
    })
  }) : issueMode === "timeline" ? /*#__PURE__*/React.createElement(IssuesTimeline, {
    issues: displayed,
    opts: opts,
    onCycle: cycle,
    onUpdate: patchIssue,
    onSelectBar: it => {
      setTlSel({
        kind: "issue",
        id: it.id
      });
      setRightTab("details");
      setRightOpen(true);
    },
    selectedId: tlSel && tlSel.kind === "issue" ? tlSel.id : null
  }) : /*#__PURE__*/React.createElement(IssueList, {
    issues: displayed,
    opts: opts,
    onCycle: cycle,
    onOpen: openIssue,
    onAdd: openCompose,
    sel: sel,
    onToggleSel: toggleSel,
    onMove: (id, groupKey) => {
      const g = opts.grouping;
      if (g === "Status") patchIssue(id, {
        status: groupKey
      });else if (g === "Priority") patchIssue(id, {
        priority: groupKey
      });else if (g === "Assignee") patchIssue(id, {
        assignee: groupKey === "noone" ? null : groupKey
      });
    },
    focusId: focusId
  })));

  // ---- adaptive: shared touch affordances (parity with the desktop chrome) ----
  const touchMenu = [{
    icon: "command",
    label: "Command palette",
    run: () => setShowCmd(true)
  }, {
    icon: "clock",
    label: "Recently viewed",
    run: () => setRecentsAnchor({
      bottom: 56,
      left: 12
    })
  }, {
    icon: "star",
    label: favorites.includes("view-" + view) ? "Unfavorite this view" : "Favorite this view",
    run: () => toggleFav("view-" + view)
  }, ...((isIssues || isProjects) && !selected ? [{
    icon: "filter",
    label: "Filter by facet",
    run: () => setFacetSheet(true)
  }] : []), {
    icon: "keyboard",
    label: "Keyboard shortcuts",
    run: () => setKeysSheet(true)
  }, {
    sep: true
  }, {
    icon: "users",
    label: "Switch team",
    value: curTeam.name,
    run: () => setShowWsMenu(true)
  }, {
    sep: true
  }, {
    icon: theme === "dark" ? "sun" : "moon",
    label: theme === "dark" ? "Light theme" : "Dark theme",
    run: toggleTheme
  }, {
    icon: "settings-2",
    label: "Settings",
    run: () => navTo("settings")
  }, {
    icon: "help-circle",
    label: "Help",
    run: () => setShowHelp(true)
  }];
  const modeItems = [{
    key: "list",
    label: "List",
    icon: "list"
  }, {
    key: "board",
    label: "Board",
    icon: "layout-grid"
  }, {
    key: "timeline",
    label: "Timeline",
    icon: "gantt-chart"
  }];
  const touchToolbar = (isIssues || isProjects) && !selected ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TouchSegmented, {
    items: modeItems,
    active: isIssues ? issueMode : projMode,
    onSelect: k => isIssues ? setIssueMode(k) : setProjMode(k)
  }), isIssues && /*#__PURE__*/React.createElement(TouchSegmented, {
    items: [{
      key: "All issues",
      label: "All"
    }, {
      key: "Active",
      label: "Active"
    }, {
      key: "Backlog",
      label: "Backlog"
    }],
    active: tab,
    onSelect: setTab
  }), isIssues && filters.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FilterPills, {
    filters: filters,
    onToggle: toggleFilter,
    onRemove: removeFilter
  }), /*#__PURE__*/React.createElement("span", {
    className: "linklike",
    onClick: () => setFilters([])
  }, "Clear"))) : null;

  // ---- adaptive: compact (mobile) & medium (tablet) shells ----
  if (sizeClass === "compact") {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MobileShell, {
      view: view,
      title: titleMap[view] || "Vector",
      onNav: navTo,
      onSearch: () => navTo("search"),
      onCompose: () => openCompose("todo"),
      showViewTools: (isIssues || isProjects) && !selected,
      onFilter: () => setPanel(p => p === "filter" ? null : "filter"),
      onDisplay: () => setPanel(p => p === "display" ? null : "display"),
      onBack: back,
      canBack: canBack,
      menuItems: touchMenu,
      toolbar: touchToolbar
    }, selected ? /*#__PURE__*/React.createElement(IssueDetail, {
      issue: selected,
      onBack: () => navTo("issues", null),
      onCycle: cycle,
      onUpdate: patchIssue,
      index: Math.max(0, displayed.findIndex(i => i.id === selected.id)),
      total: displayed.length || 1,
      onPrev: () => {
        const i = displayed.findIndex(x => x.id === selected.id);
        if (i > 0) setSelected(displayed[i - 1]);
      },
      onNext: () => {
        const i = displayed.findIndex(x => x.id === selected.id);
        if (i >= 0 && i < displayed.length - 1) setSelected(displayed[i + 1]);
      },
      projectNames: projects.filter(p => p.team === activeTeam).map(p => p.name)
    }) : bodyView), overlays);
  }
  if (sizeClass === "medium") {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TabletShell, {
      view: view,
      title: titleMap[view] || "Vector",
      onNav: navTo,
      onSearch: () => navTo("search"),
      onCompose: () => openCompose("todo"),
      showViewTools: (isIssues || isProjects) && !selected,
      onFilter: () => setPanel(p => p === "filter" ? null : "filter"),
      onDisplay: () => setPanel(p => p === "display" ? null : "display"),
      onBack: back,
      canBack: canBack,
      onForward: forward,
      canFwd: canFwd,
      menuItems: touchMenu,
      toolbar: touchToolbar,
      splitList: selected ? bodyView : null,
      brand: /*#__PURE__*/React.createElement("span", {
        className: "ws-av",
        style: {
          width: 26,
          height: 26,
          borderRadius: 7,
          marginBottom: 8
        }
      }, "VC")
    }, selected ? /*#__PURE__*/React.createElement(IssueDetail, {
      issue: selected,
      onBack: () => navTo("issues", null),
      onCycle: cycle,
      onUpdate: patchIssue,
      index: Math.max(0, displayed.findIndex(i => i.id === selected.id)),
      total: displayed.length || 1,
      onPrev: () => {
        const i = displayed.findIndex(x => x.id === selected.id);
        if (i > 0) setSelected(displayed[i - 1]);
      },
      onNext: () => {
        const i = displayed.findIndex(x => x.id === selected.id);
        if (i >= 0 && i < displayed.length - 1) setSelected(displayed[i + 1]);
      },
      projectNames: projects.filter(p => p.team === activeTeam).map(p => p.name)
    }) : bodyView), overlays);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "app" + (sbCollapsed ? "" : " nav-open")
  }, !sbCollapsed && /*#__PURE__*/React.createElement("div", {
    className: "nav-scrim",
    onClick: () => setSbCollapsed(true)
  }), /*#__PURE__*/React.createElement(Sidebar, {
    view: view,
    setView: navTo,
    onCompose: () => openCompose("todo"),
    onSearch: () => navTo("search"),
    onWsMenu: () => setShowWsMenu(true),
    onImport: () => setShowImport(true),
    onInvite: () => setShowInvite(true),
    onMore: r => setMoreAnchor(r),
    cfg: sidebarCfg,
    width: sbW,
    onResize: setSbW,
    collapsed: sbCollapsed,
    peek: sbPeek,
    setPeek: setSbPeek,
    onCollapse: () => setSbCollapsed(true),
    onExpand: () => {
      setSbCollapsed(false);
      setSbPeek(false);
    },
    onRecents: r => setRecentsAnchor(r),
    teams: teams,
    activeTeam: activeTeam,
    onSwitchTeam: id => {
      setActiveTeam(id);
      navTo('issues');
    },
    onAddTeam: addTeam,
    teamMenu: teamMenu,
    setTeamMenu: setTeamMenu,
    favoriteViews: savedViews.filter(v => favorites.includes(v.id)),
    onOpenView: openSavedView,
    onUnfavorite: toggleFav,
    onOpenTab: addTabFor,
    onHide: k => setSidebarCfg(c => ({
      ...c,
      [k]: "Don't show"
    }))
  }), /*#__PURE__*/React.createElement("div", {
    className: "main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tabbar" + (tabDrop ? " tabbar--drop" : ""),
    onDragOver: e => {
      if (e.dataTransfer.types.includes("text/vector-view")) {
        e.preventDefault();
        setTabDrop(true);
      }
    },
    onDragLeave: e => {
      if (!e.currentTarget.contains(e.relatedTarget)) setTabDrop(false);
    },
    onDrop: e => {
      const v = e.dataTransfer.getData("text/vector-view");
      setTabDrop(false);
      if (v) addTabFor(v);
    }
  }, sbCollapsed && /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => {
      setSbCollapsed(false);
      setSbPeek(false);
    },
    title: "Expand navigation sidebar",
    style: {
      marginRight: 2
    }
  }, /*#__PURE__*/React.createElement(PanelIcon, {
    side: "left",
    size: 16
  })), navbtns, tabs.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    className: "tab" + (activeTab === t.id ? " active" : ""),
    onClick: () => openTab(t)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: t.icon,
    size: 13,
    cls: "icon-sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "tab-name"
  }, t.label), tabs.length > 1 && /*#__PURE__*/React.createElement("span", {
    className: "tab-close",
    onClick: e => closeTab(t.id, e)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 12,
    cls: "icon-sm"
  })))), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn tab-add",
    onClick: addTab,
    title: "Create new view"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 15
  }))), view !== "inbox" && /*#__PURE__*/React.createElement("div", {
    className: "viewheader"
  }, /*#__PURE__*/React.createElement("div", {
    className: "viewtitle"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      cursor: "pointer"
    },
    onClick: () => setShowWsMenu(true)
  }, /*#__PURE__*/React.createElement("span", {
    className: "ws-av",
    style: {
      width: 18,
      height: 18,
      fontSize: 9,
      borderRadius: 5,
      background: curTeam.color
    }
  }, curTeam.id.slice(0, 2)), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fw-medium) 14px var(--font-sans)",
      color: "var(--fg-3)"
    }
  }, curTeam.name)), /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement(Lic, {
    name: iconMap[view] || "copy",
    size: 16
  }), /*#__PURE__*/React.createElement("h1", null, titleMap[view] || "Issues"), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    title: "Favorite this view",
    onClick: () => {
      const id = "view-" + view;
      toggleFav(id);
      if (!savedViews.find(v => v.id === id)) setSavedViews(prev => [...prev, {
        id,
        kind: view === "projects" ? "projects" : "issues",
        name: titleMap[view] || view,
        desc: "Saved from " + (titleMap[view] || view),
        icon: iconMap[view] || "layers",
        filters: JSON.parse(JSON.stringify(filters)),
        mode: issueMode,
        tab
      }]);
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "star",
    size: 15,
    color: favorites.includes("view-" + view) ? "#F2C94C" : "var(--fg-4)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "spacer"
  }), isIssues && /*#__PURE__*/React.createElement("div", {
    className: "segmented"
  }, ["All issues", "Active", "Backlog"].map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    className: "seg" + (tab === t ? " active" : ""),
    onClick: () => setTab(t)
  }, t))), (isIssues || isProjects) && /*#__PURE__*/React.createElement("div", {
    className: "toolbar-icons",
    style: {
      marginLeft: 10
    }
  }, isIssues && /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setPanel(panel === "filter" ? null : "filter")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "list-filter",
    size: 16
  })), isProjects && /*#__PURE__*/React.createElement("button", {
    className: "iconbtn" + (rightOpen && rightTab === "filters" ? " active" : ""),
    onClick: () => {
      setRightTab("filters");
      setRightOpen(true);
    },
    title: "Filter projects"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "list-filter",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn dot-badge",
    onClick: () => setPanel(panel === "display" ? null : "display")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "sliders-horizontal",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn" + (rightOpen ? " active" : ""),
    style: rightOpen ? {
      background: "var(--bg-active)",
      color: "var(--fg)"
    } : null,
    onClick: () => {
      setRightTab("filters");
      setRightOpen(o => !o);
    },
    title: "Toggle sidebar"
  }, /*#__PURE__*/React.createElement(PanelIcon, {
    side: "right",
    size: 16
  })), isProjects && /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setShowNewProject(true),
    title: "New project"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => navTo("inbox"),
    title: "Notifications"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "bell",
    size: 16
  })))), isIssues && filters.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "filterbar"
  }, /*#__PURE__*/React.createElement(FilterPills, {
    filters: filters,
    onToggle: toggleFilter,
    onRemove: removeFilter
  }), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn add-filter",
    onClick: () => setPanel("filter")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 14
  })), /*#__PURE__*/React.createElement("div", {
    className: "right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "linklike",
    onClick: () => setFilters([])
  }, "Clear"), /*#__PURE__*/React.createElement("span", {
    className: "linklike",
    onClick: saveCurrentView
  }, "Save"))), /*#__PURE__*/React.createElement("div", {
    className: "body-row"
  }, bodyView, rightOpen && (isIssues || isProjects) && (() => {
    const timelineMode = isIssues && issueMode === "timeline" || isProjects && projMode === "timeline";
    if (timelineMode) {
      let detail = null;
      if (tlSel) {
        const r = (label, val) => /*#__PURE__*/React.createElement("div", {
          className: "prop-line"
        }, /*#__PURE__*/React.createElement("span", {
          className: "pl-label"
        }, label), /*#__PURE__*/React.createElement("span", {
          className: "pl-value"
        }, val));
        if (tlSel.kind === "project") {
          const p = projects.find(x => x.id === tlSel.id);
          if (p) detail = /*#__PURE__*/React.createElement("div", {
            className: "trp-detail"
          }, /*#__PURE__*/React.createElement("div", {
            className: "trp-detail-head"
          }, /*#__PURE__*/React.createElement(Lic, {
            name: "box",
            size: 15,
            cls: "icon-sm",
            color: "var(--fg-3)"
          }), /*#__PURE__*/React.createElement("span", {
            className: "tl-detail-title"
          }, p.name), /*#__PURE__*/React.createElement("button", {
            className: "iconbtn",
            onClick: () => openProject(p),
            title: "Open full page"
          }, /*#__PURE__*/React.createElement(Lic, {
            name: "maximize-2",
            size: 14
          }))), /*#__PURE__*/React.createElement("div", {
            className: "side-group"
          }, r("Status", /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusIcon, {
            status: PROJECT_STATUS[p.status].key,
            size: 14
          }), PROJECT_STATUS[p.status].label)), r("Priority", /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PriorityIcon, {
            priority: p.priority,
            size: 15
          }), priorityLabel(p.priority))), r("Health", HEALTH[p.health].label), r("Lead", p.lead || "—"), r("Members", p.members + " members"), r("Issues", p.issues)), /*#__PURE__*/React.createElement("div", {
            className: "side-group"
          }, r("Start", p.start), r("Target", p.target), r("Progress", p.progress + "%")));
        } else {
          const it = issues.find(x => x.id === tlSel.id);
          if (it) detail = /*#__PURE__*/React.createElement("div", {
            className: "trp-detail"
          }, /*#__PURE__*/React.createElement("div", {
            className: "trp-detail-head"
          }, /*#__PURE__*/React.createElement(StatusIcon, {
            status: it.status,
            size: 15
          }), /*#__PURE__*/React.createElement("span", {
            className: "tl-detail-title"
          }, it.id, " ", it.title)), /*#__PURE__*/React.createElement("div", {
            className: "side-group"
          }, r("Status", /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusIcon, {
            status: it.status,
            size: 14
          }), statusLabel(it.status))), r("Priority", /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PriorityIcon, {
            priority: it.priority,
            size: 15
          }), priorityLabel(it.priority))), r("Assignee", it.assignee || "Unassigned")), /*#__PURE__*/React.createElement("div", {
            className: "side-group"
          }, r("Project", it.project || "No project"), r("Created", it.created), r("Due date", it.dueDate || "—")));
        }
      }
      const facet = isIssues ? /*#__PURE__*/React.createElement(FacetBody, {
        issues: displayed,
        filters: filters,
        onToggle: toggleFilter
      }) : /*#__PURE__*/React.createElement(ProjectFacetBody, {
        projects: projects,
        projFilter: projFilter,
        onToggle: toggleProjFilter
      });
      return /*#__PURE__*/React.createElement(TimelineRightPanel, {
        tab: rightTab,
        setTab: setRightTab,
        width: rightW,
        onResize: setRightW,
        detail: detail,
        facet: facet
      });
    }
    return isIssues ? /*#__PURE__*/React.createElement(RightSidebar, {
      issues: displayed,
      filters: filters,
      onToggle: toggleFilter,
      onClose: () => setRightOpen(false),
      width: rightW,
      onResize: setRightW
    }) : /*#__PURE__*/React.createElement(ProjectRightSidebar, {
      projects: projects,
      projFilter: projFilter,
      onToggle: toggleProjFilter,
      width: rightW,
      onResize: setRightW
    });
  })()), sel.size > 0 && /*#__PURE__*/React.createElement(FloatingToolbar, {
    count: sel.size,
    onClear: clearSel,
    onAction: bulkActions
  }), statusbar), overlays);
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/CRM.jsx
try { (() => {
// CRM.jsx — sales CRM (deal pipeline + contacts), Twenty-style (twentyhq/twenty)
const CRM_SEED = {
  stages: [{
    id: "new",
    name: "New",
    color: "#8A8F98"
  }, {
    id: "qualified",
    name: "Qualified",
    color: "#2D9CDB"
  }, {
    id: "proposal",
    name: "Proposal",
    color: "#F2C94C"
  }, {
    id: "won",
    name: "Won",
    color: "#4CB782"
  }, {
    id: "lost",
    name: "Lost",
    color: "#EB5757"
  }],
  deals: [{
    id: "d1",
    name: "Acme Corp — Enterprise",
    company: "Acme Corp",
    amount: 48000,
    stage: "qualified",
    owner: "김혁규",
    contact: "Jane Doe"
  }, {
    id: "d2",
    name: "Globex onboarding",
    company: "Globex",
    amount: 12000,
    stage: "new",
    owner: "Alex Park",
    contact: "John Roe"
  }, {
    id: "d3",
    name: "Initech renewal",
    company: "Initech",
    amount: 30000,
    stage: "proposal",
    owner: "김혁규",
    contact: "Mary Major"
  }, {
    id: "d4",
    name: "Umbrella expansion",
    company: "Umbrella",
    amount: 75000,
    stage: "won",
    owner: "Jordan Lee",
    contact: "Sam Smith"
  }, {
    id: "d5",
    name: "Soylent pilot",
    company: "Soylent",
    amount: 8000,
    stage: "new",
    owner: "김혁규",
    contact: "Lee Min"
  }]
};
const fmtMoney = n => "$" + (n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + "k" : n);
function CRM({
  data,
  onUpdate
}) {
  const [view, setView] = React.useState("pipeline");
  const move = (id, stage) => onUpdate({
    ...data,
    deals: data.deals.map(d => d.id === id ? {
      ...d,
      stage
    } : d)
  });
  const {
    dragId,
    overKey: over,
    grip
  } = useCardDrag({
    onDrop: (id, stage) => move(id, stage)
  });
  const addDeal = stage => onUpdate({
    ...data,
    deals: [...data.deals, {
      id: "d" + Date.now(),
      name: "New deal",
      company: "—",
      amount: 0,
      stage,
      owner: "김혁규",
      contact: "—"
    }]
  });
  const delDeal = id => onUpdate({
    ...data,
    deals: data.deals.filter(d => d.id !== id)
  });
  const setDeal = (id, patch) => onUpdate({
    ...data,
    deals: data.deals.map(d => d.id === id ? {
      ...d,
      ...patch
    } : d)
  });
  const stageTotal = sid => data.deals.filter(d => d.stage === sid).reduce((s, d) => s + d.amount, 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "content",
    style: {
      display: "flex",
      flexDirection: "column",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "db-toolbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "db-views"
  }, /*#__PURE__*/React.createElement("div", {
    className: "db-vtab" + (view === "pipeline" ? " active" : ""),
    onClick: () => setView("pipeline")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "kanban",
    size: 14,
    cls: "icon-sm"
  }), "Pipeline"), /*#__PURE__*/React.createElement("div", {
    className: "db-vtab" + (view === "contacts" ? " active" : ""),
    onClick: () => setView("contacts")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "users",
    size: 14,
    cls: "icon-sm"
  }), "Contacts")), /*#__PURE__*/React.createElement("span", {
    className: "crm-total"
  }, "Total \xB7 ", fmtMoney(data.deals.reduce((s, d) => s + d.amount, 0)))), view === "pipeline" ? /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "board"
  }, data.stages.map(st => {
    const deals = data.deals.filter(d => d.stage === st.id);
    return /*#__PURE__*/React.createElement("div", {
      className: "board-col" + (over === st.id ? " board-col--over" : ""),
      key: st.id,
      style: {
        width: 280
      },
      "data-drop": st.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "board-col-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "crm-dot",
      style: {
        background: st.color
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "bc-title"
    }, st.name), /*#__PURE__*/React.createElement("span", {
      className: "bc-count"
    }, deals.length), /*#__PURE__*/React.createElement("span", {
      className: "crm-stage-sum"
    }, fmtMoney(stageTotal(st.id))), /*#__PURE__*/React.createElement("span", {
      className: "bc-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "iconbtn",
      onClick: () => addDeal(st.id)
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "plus",
      size: 14
    })))), /*#__PURE__*/React.createElement("div", {
      className: "board-cards"
    }, deals.map(d => /*#__PURE__*/React.createElement("div", {
      className: "board-card" + (dragId === d.id ? " board-card--drag" : ""),
      key: d.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "bc-issue-title"
    }, /*#__PURE__*/React.createElement(DragGrip, grip(d.id)), /*#__PURE__*/React.createElement("input", {
      className: "crm-edit crm-edit-title",
      value: d.name,
      onChange: e => setDeal(d.id, {
        name: e.target.value
      })
    }), /*#__PURE__*/React.createElement("button", {
      className: "tree-del",
      style: {
        marginLeft: "auto",
        float: "right"
      },
      title: "Delete",
      onClick: e => {
        e.stopPropagation();
        delDeal(d.id);
      }
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "trash-2",
      size: 13
    }))), /*#__PURE__*/React.createElement("div", {
      className: "crm-amount"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-4)"
      }
    }, "$"), /*#__PURE__*/React.createElement("input", {
      className: "crm-edit crm-edit-amt",
      value: d.amount,
      onChange: e => setDeal(d.id, {
        amount: Number(e.target.value.replace(/[^0-9]/g, "")) || 0
      })
    })), /*#__PURE__*/React.createElement("div", {
      className: "bc-foot",
      style: {
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "bc-when"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "building-2",
      size: 12,
      cls: "icon-sm",
      color: "var(--fg-4)"
    }), /*#__PURE__*/React.createElement("input", {
      className: "crm-edit crm-edit-co",
      value: d.company,
      onChange: e => setDeal(d.id, {
        company: e.target.value
      })
    })), /*#__PURE__*/React.createElement(Avatar, {
      from: "#2D9CDB",
      to: "#4C8DFF",
      text: d.owner[0],
      size: 18
    }))))));
  }))) : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "db-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, /*#__PURE__*/React.createElement("span", {
    className: "db-th"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "user",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), "Contact")), /*#__PURE__*/React.createElement("th", null, /*#__PURE__*/React.createElement("span", {
    className: "db-th"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "building-2",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), "Company")), /*#__PURE__*/React.createElement("th", null, /*#__PURE__*/React.createElement("span", {
    className: "db-th"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "circle-dot",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), "Deal")), /*#__PURE__*/React.createElement("th", null, /*#__PURE__*/React.createElement("span", {
    className: "db-th"
  }, "Amount")), /*#__PURE__*/React.createElement("th", null, /*#__PURE__*/React.createElement("span", {
    className: "db-th"
  }, "Owner")))), /*#__PURE__*/React.createElement("tbody", null, data.deals.map(d => {
    const st = data.stages.find(s => s.id === d.stage);
    return /*#__PURE__*/React.createElement("tr", {
      key: d.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "db-td"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      from: "#4CB782",
      to: "#2D9CDB",
      text: d.contact[0],
      size: 20
    }), d.contact)), /*#__PURE__*/React.createElement("td", {
      className: "db-td"
    }, /*#__PURE__*/React.createElement("input", {
      className: "crm-edit",
      value: d.company,
      onChange: e => setDeal(d.id, {
        company: e.target.value
      })
    })), /*#__PURE__*/React.createElement("td", {
      className: "db-td"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7
      }
    }, /*#__PURE__*/React.createElement("input", {
      className: "crm-edit",
      value: d.name,
      onChange: e => setDeal(d.id, {
        name: e.target.value
      })
    }), /*#__PURE__*/React.createElement("span", {
      className: "db-pill",
      style: {
        background: st.color + "26",
        color: st.color
      }
    }, st.name))), /*#__PURE__*/React.createElement("td", {
      className: "db-td db-td-number"
    }, /*#__PURE__*/React.createElement("input", {
      className: "crm-edit crm-edit-amt2",
      value: d.amount,
      onChange: e => setDeal(d.id, {
        amount: Number(e.target.value.replace(/[^0-9]/g, "")) || 0
      })
    })), /*#__PURE__*/React.createElement("td", {
      className: "db-td"
    }, d.owner));
  })))));
}
Object.assign(window, {
  CRM,
  CRM_SEED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/CRM.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Calendar.jsx
try { (() => {
// Calendar.jsx — scheduling grid, Cal.com-style (calcom/cal.com): week view + events
const CAL_SEED = {
  events: [{
    id: "e1",
    title: "Standup",
    day: 1,
    start: 9,
    dur: 0.5,
    color: "#4C8DFF"
  }, {
    id: "e2",
    title: "Design review",
    day: 1,
    start: 14,
    dur: 1,
    color: "#BB6BD9"
  }, {
    id: "e3",
    title: "1:1 — Alex",
    day: 2,
    start: 11,
    dur: 0.5,
    color: "#4CB782"
  }, {
    id: "e4",
    title: "Cycle planning",
    day: 3,
    start: 10,
    dur: 1.5,
    color: "#F2994A"
  }, {
    id: "e5",
    title: "Customer call — Acme",
    day: 3,
    start: 15,
    dur: 1,
    color: "#2D9CDB"
  }, {
    id: "e6",
    title: "Sprint demo",
    day: 4,
    start: 13,
    dur: 1,
    color: "#4C8DFF"
  }, {
    id: "e7",
    title: "Retro",
    day: 4,
    start: 16,
    dur: 0.5,
    color: "#EB5757"
  }]
};
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DATES = [2, 3, 4, 5, 6]; // Jun 2026
const HOURS = Array.from({
  length: 11
}, (_, i) => 8 + i); // 8:00–18:00
const HOUR_H = 48;
function MonthGrid({
  events,
  baseMonth,
  onAddDay
}) {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const first = new Date(2026, baseMonth, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday-first
  const daysIn = new Date(2026, baseMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const evByDay = {};
  events.forEach(e => {
    if (e.monthDay != null && e.monthIdx === baseMonth) {
      (evByDay[e.monthDay] = evByDay[e.monthDay] || []).push(e);
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "cal-month"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cal-month-head"
  }, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => /*#__PURE__*/React.createElement("div", {
    key: d,
    className: "cal-mh-cell"
  }, d))), /*#__PURE__*/React.createElement("div", {
    className: "cal-month-grid"
  }, cells.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "cal-mcell" + (d == null ? " empty" : "") + (d === 1 && baseMonth === 5 ? " today" : ""),
    onClick: () => d && onAddDay(d)
  }, d && /*#__PURE__*/React.createElement("span", {
    className: "cal-mnum"
  }, d), d && (evByDay[d] || []).slice(0, 3).map((e, j) => /*#__PURE__*/React.createElement("span", {
    key: j,
    className: "cal-mevt",
    style: {
      background: e.color + "26",
      color: e.color
    }
  }, e.title))))));
}
function Calendar({
  data,
  onUpdate
}) {
  const [sel, setSel] = React.useState(null);
  const [weekOffset, setWeekOffset] = React.useState(0); // 0 = the seed week (Jun 1 2026 Mon)
  const [range, setRange] = React.useState("week"); // week | month
  const [rangeOpen, setRangeOpen] = React.useState(false);
  const [monthIdx, setMonthIdx] = React.useState(5); // Jun
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtH = h => {
    const hh = Math.floor(h),
      m = h % 1 * 60;
    return `${hh > 12 ? hh - 12 : hh}:${m ? m : "00"} ${hh >= 12 ? "PM" : "AM"}`;
  };
  // Monday of the displayed week, based on Jun 1 2026 (a Monday) + offset
  const monday = new Date(2026, 5, 1);
  monday.setDate(monday.getDate() + weekOffset * 7);
  const weekDates = DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const first = weekDates[0],
    last = weekDates[4];
  const rangeLabel = range === "month" ? `${MONTHS[monthIdx]} 2026` : `${MONTHS[first.getMonth()]} ${first.getDate()} – ${first.getMonth() === last.getMonth() ? last.getDate() : MONTHS[last.getMonth()] + " " + last.getDate()}`;
  const isToday = d => weekOffset === 0 && d.getDate() === 1 && d.getMonth() === 5;
  const addAt = (day, hour) => {
    const e = {
      id: "e" + Date.now(),
      title: "New event",
      day,
      start: hour,
      dur: 1,
      color: "#4C8DFF",
      week: weekOffset
    };
    onUpdate({
      ...data,
      events: [...data.events, e]
    });
    setSel(e.id);
  };
  const addDay = d => {
    const e = {
      id: "e" + Date.now(),
      title: "New event",
      monthDay: d,
      monthIdx,
      start: 10,
      dur: 1,
      color: "#4C8DFF",
      week: 0,
      day: 0
    };
    onUpdate({
      ...data,
      events: [...data.events, e]
    });
  };
  const del = id => {
    onUpdate({
      ...data,
      events: data.events.filter(e => e.id !== id)
    });
    setSel(null);
  };
  const eventsThisWeek = data.events.filter(e => (e.week || 0) === weekOffset && e.monthDay == null);
  const prev = () => range === "month" ? setMonthIdx(m => Math.max(0, m - 1)) : setWeekOffset(w => w - 1);
  const next = () => range === "month" ? setMonthIdx(m => Math.min(11, m + 1)) : setWeekOffset(w => w + 1);
  const today = () => {
    setWeekOffset(0);
    setMonthIdx(5);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "content cal-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cal-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cal-title"
  }, range === "month" ? MONTHS[monthIdx] : MONTHS[first.getMonth()], " 2026"), /*#__PURE__*/React.createElement("span", {
    className: "cal-week"
  }, rangeLabel), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 4,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: prev
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-left",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    style: {
      height: 28
    },
    onClick: today
  }, "Today"), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: next
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      marginLeft: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    style: {
      height: 28
    },
    onClick: () => setRangeOpen(!rangeOpen)
  }, range === "month" ? "Month" : "Week", " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 13,
    cls: "icon-sm"
  })), rangeOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: () => setRangeOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 34,
      right: 0,
      width: 130,
      zIndex: 45
    }
  }, [["week", "Week"], ["month", "Month"]].map(([k, l]) => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: k,
    onClick: () => {
      setRange(k);
      setRangeOpen(false);
    }
  }, l, range === k && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    style: {
      marginLeft: "auto"
    },
    color: "var(--accent)"
  })))))))), range === "month" ? /*#__PURE__*/React.createElement(MonthGrid, {
    events: data.events,
    baseMonth: monthIdx,
    onAddDay: addDay
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "cal-grid-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cal-gutter"
  }), DAYS.map((d, i) => /*#__PURE__*/React.createElement("div", {
    className: "cal-daycol-head",
    key: d
  }, /*#__PURE__*/React.createElement("span", {
    className: "cal-dayname"
  }, d), /*#__PURE__*/React.createElement("span", {
    className: "cal-daynum" + (isToday(weekDates[i]) ? " today" : "")
  }, weekDates[i].getDate())))), /*#__PURE__*/React.createElement("div", {
    className: "cal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cal-gutter"
  }, HOURS.map(h => /*#__PURE__*/React.createElement("div", {
    className: "cal-hour",
    key: h,
    style: {
      height: HOUR_H
    }
  }, /*#__PURE__*/React.createElement("span", null, h > 12 ? h - 12 : h, h >= 12 ? "p" : "a")))), DAYS.map((d, di) => /*#__PURE__*/React.createElement("div", {
    className: "cal-daycol",
    key: d
  }, HOURS.map(h => /*#__PURE__*/React.createElement("div", {
    className: "cal-slot",
    key: h,
    style: {
      height: HOUR_H
    },
    onClick: () => addAt(di, h)
  })), eventsThisWeek.filter(e => e.day === di).map(e => /*#__PURE__*/React.createElement("div", {
    className: "cal-event",
    key: e.id,
    style: {
      top: (e.start - 8) * HOUR_H + 1,
      height: e.dur * HOUR_H - 2,
      background: e.color + "26",
      borderLeft: "3px solid " + e.color
    },
    onClick: ev => {
      ev.stopPropagation();
      setSel(e.id);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "cal-event-title",
    style: {
      color: e.color
    }
  }, e.title), /*#__PURE__*/React.createElement("span", {
    className: "cal-event-time"
  }, fmtH(e.start)), sel === e.id && /*#__PURE__*/React.createElement("button", {
    className: "cal-event-del",
    onClick: ev => {
      ev.stopPropagation();
      del(e.id);
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 12
  })))), isToday(weekDates[di]) && /*#__PURE__*/React.createElement("div", {
    className: "cal-now",
    style: {
      top: (10.5 - 8) * HOUR_H
    }
  }))))));
}
Object.assign(window, {
  Calendar,
  CAL_SEED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Calendar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Canvas.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Canvas.jsx — infinite whiteboard. Tool & shape set mirrors tldraw's default
// shapes (draw, geo, arrow, line, note, text, frame). SVG-based canvas with
// pan/zoom, select/move, and per-shape color from the Vector palette.
const CANVAS_TOOLS = [{
  id: "select",
  icon: "mouse-pointer-2",
  title: "Select  V"
}, {
  id: "draw",
  icon: "pencil",
  title: "Draw  D"
}, {
  id: "rect",
  icon: "square",
  title: "Rectangle  R"
}, {
  id: "ellipse",
  icon: "circle",
  title: "Ellipse  O"
}, {
  id: "arrow",
  icon: "move-up-right",
  title: "Arrow  A"
}, {
  id: "line",
  icon: "minus",
  title: "Line  L"
}, {
  id: "note",
  icon: "sticky-note",
  title: "Note  N"
}, {
  id: "text",
  icon: "type",
  title: "Text  T"
}];
const CANVAS_COLORS = ["#4C8DFF", "#4CB782", "#F2C94C", "#F2994A", "#EB5757", "#BB6BD9", "#C9CCD1"];
function Canvas({
  doc,
  onUpdate
}) {
  const shapes = doc.shapes || [];
  const [tool, setTool] = React.useState("select");
  const [color, setColor] = React.useState("#4C8DFF");
  const [view, setView] = React.useState(doc.view || {
    x: 0,
    y: 0,
    z: 1
  });
  const [sel, setSel] = React.useState(null);
  const [draft, setDraft] = React.useState(null);
  const svgRef = React.useRef(null);
  const drag = React.useRef(null);
  const setShapes = ns => onUpdate(doc.id, {
    shapes: ns
  });
  const toWorld = e => {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - view.x) / view.z,
      y: (e.clientY - r.top - view.y) / view.z
    };
  };
  const uid = () => "s" + Date.now() + Math.floor(Math.random() * 99);
  const onWheel = e => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 0.9;
      setView(v => ({
        ...v,
        z: Math.max(0.2, Math.min(3, v.z * f))
      }));
    } else setView(v => ({
      ...v,
      x: v.x - e.deltaX,
      y: v.y - e.deltaY
    }));
  };
  const onDown = e => {
    const onBg = e.target === svgRef.current || e.target.getAttribute("data-cv-bg") != null;
    if (e.button === 1 || tool === "select" && onBg || e.altKey) {
      drag.current = {
        mode: "pan",
        sx: e.clientX,
        sy: e.clientY,
        ox: view.x,
        oy: view.y
      };
      if (tool === "select" && onBg) setSel(null);
      return;
    }
    const p = toWorld(e);
    if (tool === "select") {
      setSel(null);
      return;
    }
    if (tool === "draw") {
      setDraft({
        id: uid(),
        type: "draw",
        color,
        pts: [p.x, p.y]
      });
      drag.current = {
        mode: "draw"
      };
      return;
    }
    if (tool === "note") {
      const s = {
        id: uid(),
        type: "note",
        x: p.x - 80,
        y: p.y - 50,
        w: 160,
        h: 100,
        color,
        text: ""
      };
      setShapes([...shapes, s]);
      setSel(s.id);
      setTool("select");
      return;
    }
    if (tool === "text") {
      const s = {
        id: uid(),
        type: "text",
        x: p.x,
        y: p.y,
        color,
        text: "Text"
      };
      setShapes([...shapes, s]);
      setSel(s.id);
      setTool("select");
      return;
    }
    // rect / ellipse / arrow / line — drag to size
    setDraft({
      id: uid(),
      type: tool,
      x: p.x,
      y: p.y,
      x2: p.x,
      y2: p.y,
      color
    });
    drag.current = {
      mode: "create"
    };
  };
  const onMove = e => {
    if (!drag.current) return;
    if (drag.current.mode === "pan") {
      setView(v => ({
        ...v,
        x: drag.current.ox + (e.clientX - drag.current.sx),
        y: drag.current.oy + (e.clientY - drag.current.sy)
      }));
      return;
    }
    const p = toWorld(e);
    if (drag.current.mode === "draw") setDraft(d => ({
      ...d,
      pts: [...d.pts, p.x, p.y]
    }));else if (drag.current.mode === "create") setDraft(d => ({
      ...d,
      x2: p.x,
      y2: p.y
    }));else if (drag.current.mode === "move") setShapes(shapes.map(s => s.id === drag.current.id ? moveShape(s, p.x - drag.current.px, p.y - drag.current.py) : s)), drag.current.px = p.x, drag.current.py = p.y;
  };
  const onUp = () => {
    if (draft) {
      let s = draft;
      if (s.type === "rect" || s.type === "ellipse") s = {
        id: s.id,
        type: s.type,
        x: Math.min(s.x, s.x2),
        y: Math.min(s.y, s.y2),
        w: Math.abs(s.x2 - s.x) || 80,
        h: Math.abs(s.y2 - s.y) || 60,
        color: s.color
      };
      setShapes([...shapes, s]);
      setSel(s.id);
      setDraft(null);
      setTool("select");
    }
    drag.current = null;
  };
  const moveShape = (s, dx, dy) => {
    if (s.type === "draw") return {
      ...s,
      pts: s.pts.map((v, i) => i % 2 === 0 ? v + dx : v + dy)
    };
    if (s.type === "arrow" || s.type === "line") return {
      ...s,
      x: s.x + dx,
      y: s.y + dy,
      x2: s.x2 + dx,
      y2: s.y2 + dy
    };
    return {
      ...s,
      x: s.x + dx,
      y: s.y + dy
    };
  };
  const startMove = (e, s) => {
    if (tool !== "select") return;
    e.stopPropagation();
    const p = toWorld(e);
    drag.current = {
      mode: "move",
      id: s.id,
      px: p.x,
      py: p.y
    };
    setSel(s.id);
  };
  const delSel = () => {
    if (sel) {
      setShapes(shapes.filter(s => s.id !== sel));
      setSel(null);
    }
  };
  const setText = (id, t) => setShapes(shapes.map(s => s.id === id ? {
    ...s,
    text: t
  } : s));
  React.useEffect(() => {
    const h = e => {
      if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
      const map = {
        v: "select",
        d: "draw",
        r: "rect",
        o: "ellipse",
        a: "arrow",
        l: "line",
        n: "note",
        t: "text"
      };
      if (map[e.key]) setTool(map[e.key]);
      if ((e.key === "Backspace" || e.key === "Delete") && sel) {
        e.preventDefault();
        delSel();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sel, shapes]);
  const renderShape = (s, isDraft) => {
    const selected = sel === s.id;
    const sw = 2.5;
    const common = {
      onPointerDown: e => startMove(e, s),
      style: {
        cursor: tool === "select" ? "move" : "crosshair"
      }
    };
    if (s.type === "draw") {
      const d = s.pts.reduce((a, v, i) => i % 2 === 0 ? a + (i ? " L" : "M") + v.toFixed(1) : a + " " + v.toFixed(1), "");
      return /*#__PURE__*/React.createElement("path", _extends({
        key: s.id,
        d: d,
        fill: "none",
        stroke: s.color,
        strokeWidth: sw,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }, common));
    }
    if (s.type === "rect") {
      const x = s.w != null ? s.x : Math.min(s.x, s.x2),
        y = s.w != null ? s.y : Math.min(s.y, s.y2),
        w = s.w != null ? s.w : Math.abs(s.x2 - s.x),
        h = s.h != null ? s.h : Math.abs(s.y2 - s.y);
      return /*#__PURE__*/React.createElement("rect", _extends({
        key: s.id,
        x: x,
        y: y,
        width: w,
        height: h,
        rx: "6",
        fill: s.color + "1f",
        stroke: s.color,
        strokeWidth: sw
      }, common));
    }
    if (s.type === "ellipse") {
      const x = s.w != null ? s.x : Math.min(s.x, s.x2),
        y = s.w != null ? s.y : Math.min(s.y, s.y2),
        w = s.w != null ? s.w : Math.abs(s.x2 - s.x),
        h = s.h != null ? s.h : Math.abs(s.y2 - s.y);
      return /*#__PURE__*/React.createElement("ellipse", _extends({
        key: s.id,
        cx: x + w / 2,
        cy: y + h / 2,
        rx: w / 2,
        ry: h / 2,
        fill: s.color + "1f",
        stroke: s.color,
        strokeWidth: sw
      }, common));
    }
    if (s.type === "line") return /*#__PURE__*/React.createElement("line", _extends({
      key: s.id,
      x1: s.x,
      y1: s.y,
      x2: s.x2,
      y2: s.y2,
      stroke: s.color,
      strokeWidth: sw,
      strokeLinecap: "round"
    }, common));
    if (s.type === "arrow") {
      const ang = Math.atan2(s.y2 - s.y, s.x2 - s.x);
      const ah = 11;
      return /*#__PURE__*/React.createElement("g", _extends({
        key: s.id
      }, common), /*#__PURE__*/React.createElement("line", {
        x1: s.x,
        y1: s.y,
        x2: s.x2,
        y2: s.y2,
        stroke: s.color,
        strokeWidth: sw,
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M${s.x2} ${s.y2} L${s.x2 - ah * Math.cos(ang - 0.4)} ${s.y2 - ah * Math.sin(ang - 0.4)} M${s.x2} ${s.y2} L${s.x2 - ah * Math.cos(ang + 0.4)} ${s.y2 - ah * Math.sin(ang + 0.4)}`,
        stroke: s.color,
        strokeWidth: sw,
        strokeLinecap: "round",
        fill: "none"
      }));
    }
    if (s.type === "note") return /*#__PURE__*/React.createElement("g", _extends({
      key: s.id
    }, common), /*#__PURE__*/React.createElement("rect", {
      x: s.x,
      y: s.y,
      width: s.w,
      height: s.h,
      rx: "8",
      fill: s.color + "1f",
      stroke: s.color,
      strokeWidth: "1.5"
    }), /*#__PURE__*/React.createElement("foreignObject", {
      x: s.x,
      y: s.y,
      width: s.w,
      height: s.h
    }, /*#__PURE__*/React.createElement("textarea", {
      className: "cv-note-ta",
      style: {
        pointerEvents: selected ? "auto" : "none"
      },
      value: s.text,
      placeholder: "Note",
      onPointerDown: e => e.stopPropagation(),
      onChange: e => setText(s.id, e.target.value)
    })));
    if (s.type === "text") return /*#__PURE__*/React.createElement("g", _extends({
      key: s.id
    }, common), /*#__PURE__*/React.createElement("foreignObject", {
      x: s.x,
      y: s.y - 14,
      width: "240",
      height: "40"
    }, /*#__PURE__*/React.createElement("input", {
      className: "cv-text-in",
      style: {
        color: s.color,
        pointerEvents: selected ? "auto" : "none"
      },
      value: s.text,
      onPointerDown: e => e.stopPropagation(),
      onChange: e => setText(s.id, e.target.value)
    })));
    return null;
  };
  const selShape = shapes.find(s => s.id === sel);
  return /*#__PURE__*/React.createElement("div", {
    className: "content cv-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cv-toolbar"
  }, CANVAS_TOOLS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    className: "cv-tool" + (tool === t.id ? " active" : ""),
    title: t.title,
    onClick: () => setTool(t.id)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: t.icon,
    size: 17,
    cls: "icon"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cv-sep"
  }), CANVAS_COLORS.map(c => /*#__PURE__*/React.createElement("span", {
    key: c,
    className: "cv-color" + (color === c ? " on" : ""),
    style: {
      background: c
    },
    onClick: () => {
      setColor(c);
      if (selShape) setShapes(shapes.map(s => s.id === sel ? {
        ...s,
        color: c
      } : s));
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cv-zoom"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setView(v => ({
      ...v,
      z: Math.max(0.2, v.z * 0.9)
    }))
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "minus",
    size: 15
  })), /*#__PURE__*/React.createElement("span", {
    onClick: () => setView({
      x: 0,
      y: 0,
      z: 1
    }),
    title: "Reset"
  }, Math.round(view.z * 100), "%"), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setView(v => ({
      ...v,
      z: Math.min(3, v.z * 1.1)
    }))
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 15
  })), sel && /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: delSel,
    title: "Delete"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 15
  }))), /*#__PURE__*/React.createElement("svg", {
    ref: svgRef,
    className: "cv-svg",
    onWheel: onWheel,
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerCancel: onUp,
    onPointerLeave: onUp
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("pattern", {
    id: "cvgrid",
    width: 24 * view.z,
    height: 24 * view.z,
    patternUnits: "userSpaceOnUse",
    patternTransform: `translate(${view.x % (24 * view.z)} ${view.y % (24 * view.z)})`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "1",
    cy: "1",
    r: "1",
    fill: "var(--border-strong)"
  }))), /*#__PURE__*/React.createElement("rect", {
    width: "100%",
    height: "100%",
    fill: "url(#cvgrid)",
    "data-cv-bg": "1"
  }), /*#__PURE__*/React.createElement("g", {
    transform: `translate(${view.x} ${view.y}) scale(${view.z})`
  }, shapes.map(s => renderShape(s)), draft && renderShape(draft, true), selShape && (() => {
    const b = shapeBounds(selShape);
    return b ? /*#__PURE__*/React.createElement("rect", {
      x: b.x - 4,
      y: b.y - 4,
      width: b.w + 8,
      height: b.h + 8,
      fill: "none",
      stroke: "var(--accent)",
      strokeWidth: 1.5 / view.z,
      strokeDasharray: `${4 / view.z} ${3 / view.z}`,
      pointerEvents: "none"
    }) : null;
  })())));
}
function shapeBounds(s) {
  if (s.type === "draw") {
    const xs = s.pts.filter((_, i) => i % 2 === 0),
      ys = s.pts.filter((_, i) => i % 2 === 1);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys)
    };
  }
  if (s.type === "arrow" || s.type === "line") return {
    x: Math.min(s.x, s.x2),
    y: Math.min(s.y, s.y2),
    w: Math.abs(s.x2 - s.x),
    h: Math.abs(s.y2 - s.y)
  };
  if (s.type === "text") return {
    x: s.x,
    y: s.y - 14,
    w: 200,
    h: 28
  };
  return {
    x: s.x,
    y: s.y,
    w: s.w,
    h: s.h
  };
}
const CANVAS_SEED = {
  id: "cv1",
  team: "VEC",
  name: "Whiteboard",
  view: {
    x: 0,
    y: 0,
    z: 1
  },
  shapes: [{
    id: "n1",
    type: "note",
    x: 80,
    y: 80,
    w: 170,
    h: 110,
    color: "#F2C94C",
    text: "Sprint goals"
  }, {
    id: "n2",
    type: "note",
    x: 300,
    y: 120,
    w: 170,
    h: 110,
    color: "#4CB782",
    text: "Ship onboarding v2"
  }, {
    id: "a1",
    type: "arrow",
    x: 252,
    y: 135,
    x2: 298,
    y2: 160,
    color: "#C9CCD1"
  }, {
    id: "t1",
    type: "text",
    x: 90,
    y: 250,
    color: "#4C8DFF",
    text: "Q3 plan"
  }]
};
Object.assign(window, {
  Canvas,
  CANVAS_SEED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Canvas.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Changelog.jsx
try { (() => {
// Changelog.jsx — product changelog / posts, Ghost-style (TryGhost/Ghost)
const CHANGELOG_SEED = {
  posts: [{
    id: "p1",
    title: "Configurable Insights dashboards",
    tag: "New",
    date: "Jun 1, 2026",
    author: "김혁규",
    status: "published",
    excerpt: "Build your own dashboard — add metric cards, burndown, velocity, and distribution widgets, resize and reorder them.",
    body: "Insights is now a fully configurable dashboard. Add widgets from the menu, pick which metric each card shows, and toggle widths."
  }, {
    id: "p2",
    title: "Whiteboard for visual planning",
    tag: "New",
    date: "May 24, 2026",
    author: "Alex Park",
    status: "published",
    excerpt: "An infinite canvas with sticky notes, shapes, arrows, and freehand drawing — right inside your workspace.",
    body: "Plan visually without leaving Vector. Draw, drop sticky notes, and connect ideas with arrows."
  }, {
    id: "p3",
    title: "Timeline dependencies",
    tag: "Improved",
    date: "May 12, 2026",
    author: "김혁규",
    status: "published",
    excerpt: "Drag from the edge of any bar to link projects with finish-to-start dependencies.",
    body: "The project timeline now supports dependency arrows. Drag, resize, and connect."
  }, {
    id: "p4",
    title: "Faster command palette",
    tag: "Improved",
    date: "Apr 30, 2026",
    author: "Jordan Lee",
    status: "draft",
    excerpt: "⌘K now recognizes the issue you're on and offers contextual actions.",
    body: "Context-aware commands: open an issue, hit ⌘K, and change status/priority/assignee inline."
  }]
};
const TAG_COLOR = {
  New: "#4CB782",
  Improved: "#2D9CDB",
  Fixed: "#F2994A"
};
function Changelog({
  data,
  onUpdate
}) {
  const [selId, setSelId] = React.useState(data.posts[0] ? data.posts[0].id : null);
  const post = data.posts.find(p => p.id === selId);
  const setPost = patch => onUpdate({
    ...data,
    posts: data.posts.map(p => p.id === selId ? {
      ...p,
      ...patch
    } : p)
  });
  const newPost = () => {
    const id = "p" + Date.now();
    onUpdate({
      ...data,
      posts: [{
        id,
        title: "Untitled",
        tag: "New",
        date: "Jun 2, 2026",
        author: "김혁규",
        status: "draft",
        excerpt: "",
        body: ""
      }, ...data.posts]
    });
    setSelId(id);
  };
  const cycleTag = () => {
    const t = ["New", "Improved", "Fixed"];
    setPost({
      tag: t[(t.indexOf(post.tag) + 1) % 3]
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "docs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "docs-tree",
    style: {
      width: 300
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "docs-tree-head"
  }, /*#__PURE__*/React.createElement("span", null, "Changelog"), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: newPost
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 15
  }))), data.posts.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    className: "cl-item" + (selId === p.id ? " active" : ""),
    onClick: () => setSelId(p.id)
  }, /*#__PURE__*/React.createElement("div", {
    className: "cl-item-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cl-tag",
    style: {
      background: TAG_COLOR[p.tag] + "26",
      color: TAG_COLOR[p.tag]
    }
  }, p.tag), p.status === "draft" && /*#__PURE__*/React.createElement("span", {
    className: "fb-badge draft"
  }, "draft"), /*#__PURE__*/React.createElement("button", {
    className: "tree-del",
    style: {
      marginLeft: "auto"
    },
    title: "Delete",
    onClick: e => {
      e.stopPropagation();
      const rest = data.posts.filter(x => x.id !== p.id);
      onUpdate({
        ...data,
        posts: rest
      });
      if (selId === p.id) setSelId(rest[0] ? rest[0].id : null);
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 13
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cl-item-title"
  }, p.title), /*#__PURE__*/React.createElement("div", {
    className: "cl-item-date"
  }, p.date, " \xB7 ", p.author)))), /*#__PURE__*/React.createElement("div", {
    className: "docs-main"
  }, post ? /*#__PURE__*/React.createElement("div", {
    className: "cl-editor"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cl-editor-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cl-tag",
    style: {
      background: TAG_COLOR[post.tag] + "26",
      color: TAG_COLOR[post.tag],
      cursor: "pointer"
    },
    onClick: cycleTag
  }, post.tag), /*#__PURE__*/React.createElement("span", {
    className: "cl-date"
  }, post.date), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    style: {
      marginLeft: "auto",
      height: 28
    },
    onClick: () => setPost({
      status: post.status === "published" ? "draft" : "published"
    })
  }, post.status === "published" ? "Unpublish" : "Publish")), /*#__PURE__*/React.createElement("input", {
    className: "doc-title-input",
    value: post.title,
    onChange: e => setPost({
      title: e.target.value
    }),
    placeholder: "Post title"
  }), /*#__PURE__*/React.createElement("input", {
    className: "cl-excerpt",
    value: post.excerpt,
    onChange: e => setPost({
      excerpt: e.target.value
    }),
    placeholder: "Short summary\u2026"
  }), /*#__PURE__*/React.createElement("textarea", {
    className: "cl-body",
    value: post.body,
    onChange: e => setPost({
      body: e.target.value
    }),
    placeholder: "Write your changelog entry\u2026"
  })) : /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No post selected"))));
}
Object.assign(window, {
  Changelog,
  CHANGELOG_SEED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Changelog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Chat.jsx
try { (() => {
// Chat.jsx — team chat. Channel/DM sidebar + message timeline + threads,
// modeled on Mattermost (mattermost/mattermost) channel + threading structure.
const CHAT_SEED = {
  channels: [{
    id: "ch1",
    kind: "channel",
    name: "general",
    topic: "Company-wide announcements"
  }, {
    id: "ch2",
    kind: "channel",
    name: "engineering",
    topic: "Eng discussion"
  }, {
    id: "ch3",
    kind: "channel",
    name: "design",
    topic: "Design crits & specs"
  }, {
    id: "ch4",
    kind: "channel",
    name: "random",
    topic: "Off-topic"
  }],
  dms: [{
    id: "dm1",
    kind: "dm",
    name: "Alex Park",
    from: "#4CB782",
    to: "#2D9CDB"
  }, {
    id: "dm2",
    kind: "dm",
    name: "Jordan Lee",
    from: "#BB6BD9",
    to: "#EB5757"
  }],
  messages: {
    ch1: [{
      id: "m1",
      author: "Alex Park",
      color: "#4CB782",
      time: "9:02 AM",
      text: "Morning team — onboarding v2 ships this cycle 🎉",
      reactions: [{
        e: "🎉",
        n: 3
      }],
      replies: [{
        id: "r1",
        author: "김혁규",
        color: "#2D9CDB",
        time: "9:05 AM",
        text: "Let's get the checklist polished today."
      }]
    }, {
      id: "m2",
      author: "Jordan Lee",
      color: "#BB6BD9",
      time: "9:14 AM",
      text: "Pushed the filter submenu fix — VEC-3 ready for review.",
      reactions: [{
        e: "👀",
        n: 1
      }],
      replies: []
    }],
    ch2: [{
      id: "m3",
      author: "김혁규",
      color: "#2D9CDB",
      time: "10:20 AM",
      text: "Migrating CI to the new runners this afternoon. Expect a brief slowdown.",
      reactions: [],
      replies: []
    }],
    ch3: [],
    ch4: [],
    dm1: [{
      id: "m5",
      author: "Alex Park",
      color: "#4CB782",
      time: "8:50 AM",
      text: "Can you review the onboarding copy?",
      reactions: [],
      replies: []
    }],
    dm2: []
  }
};
const REACTIONS = ["👍", "🎉", "👀", "❤️", "🚀", "✅"];
function Message({
  msg,
  onReact,
  onOpenThread
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "chat-msg",
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: msg.color,
    to: msg.color,
    text: msg.author[0],
    size: 36
  }), /*#__PURE__*/React.createElement("div", {
    className: "chat-msg-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chat-msg-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chat-author"
  }, msg.author), /*#__PURE__*/React.createElement("span", {
    className: "chat-time"
  }, msg.time)), /*#__PURE__*/React.createElement("div", {
    className: "chat-text"
  }, msg.text), msg.reactions.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "chat-reacts"
  }, msg.reactions.map((r, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "chat-react",
    onClick: () => onReact(msg.id, r.e)
  }, r.e, " ", r.n))), msg.replies.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "chat-thread-link",
    onClick: () => onOpenThread(msg.id)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "message-circle",
    size: 13,
    cls: "icon-sm",
    color: "var(--accent)"
  }), msg.replies.length, " ", msg.replies.length > 1 ? "replies" : "reply")), hover && /*#__PURE__*/React.createElement("div", {
    className: "chat-msg-actions"
  }, REACTIONS.slice(0, 3).map(e => /*#__PURE__*/React.createElement("button", {
    key: e,
    className: "chat-act",
    onClick: () => onReact(msg.id, e)
  }, e)), /*#__PURE__*/React.createElement("button", {
    className: "chat-act",
    onClick: () => onOpenThread(msg.id)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "message-circle",
    size: 14
  }))));
}
function Composer({
  placeholder,
  onSend
}) {
  const [val, setVal] = React.useState("");
  const send = () => {
    if (!val.trim()) return;
    onSend(val.trim());
    setVal("");
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "chat-composer"
  }, /*#__PURE__*/React.createElement("input", {
    value: val,
    placeholder: placeholder,
    onChange: e => setVal(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: send,
    disabled: !val.trim(),
    style: {
      opacity: val.trim() ? 1 : .4
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "send-horizontal",
    size: 16,
    color: "var(--accent)"
  })));
}
function Chat({
  data,
  onUpdate
}) {
  const all = [...data.channels, ...data.dms];
  const [activeId, setActiveId] = React.useState("ch1");
  const [threadId, setThreadId] = React.useState(null);
  const active = all.find(c => c.id === activeId);
  const msgs = data.messages[activeId] || [];
  const thread = threadId ? msgs.find(m => m.id === threadId) : null;
  const post = text => {
    const m = {
      id: "m" + Date.now(),
      author: "김혁규",
      color: "#2D9CDB",
      time: "now",
      text,
      reactions: [],
      replies: []
    };
    onUpdate({
      ...data,
      messages: {
        ...data.messages,
        [activeId]: [...msgs, m]
      }
    });
  };
  const reply = text => {
    const r = {
      id: "r" + Date.now(),
      author: "김혁규",
      color: "#2D9CDB",
      time: "now",
      text
    };
    onUpdate({
      ...data,
      messages: {
        ...data.messages,
        [activeId]: msgs.map(m => m.id === threadId ? {
          ...m,
          replies: [...m.replies, r]
        } : m)
      }
    });
  };
  const react = (mid, e) => {
    onUpdate({
      ...data,
      messages: {
        ...data.messages,
        [activeId]: msgs.map(m => {
          if (m.id !== mid) return m;
          const ex = m.reactions.find(r => r.e === e);
          return {
            ...m,
            reactions: ex ? m.reactions.map(r => r.e === e ? {
              ...r,
              n: r.n + 1
            } : r) : [...m.reactions, {
              e,
              n: 1
            }]
          };
        })
      }
    });
  };
  const navItem = c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    className: "chat-nav-item" + (activeId === c.id ? " active" : ""),
    onClick: () => {
      setActiveId(c.id);
      setThreadId(null);
    }
  }, c.kind === "channel" ? /*#__PURE__*/React.createElement("span", {
    className: "chat-hash"
  }, "#") : /*#__PURE__*/React.createElement(Avatar, {
    from: c.from,
    to: c.to,
    text: c.name[0],
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "chat-nav-name"
  }, c.name));
  return /*#__PURE__*/React.createElement("div", {
    className: "chat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chat-sidebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chat-sb-cap"
  }, "Channels"), data.channels.map(navItem), /*#__PURE__*/React.createElement("div", {
    className: "chat-sb-cap"
  }, "Direct messages"), data.dms.map(navItem)), /*#__PURE__*/React.createElement("div", {
    className: "chat-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chat-header"
  }, active.kind === "channel" ? /*#__PURE__*/React.createElement("span", {
    className: "chat-h-title"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chat-hash"
  }, "#"), active.name) : /*#__PURE__*/React.createElement("span", {
    className: "chat-h-title"
  }, active.name), active.topic && /*#__PURE__*/React.createElement("span", {
    className: "chat-h-topic"
  }, active.topic)), /*#__PURE__*/React.createElement("div", {
    className: "chat-timeline"
  }, msgs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "message-square",
    size: 36,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No messages yet")) : msgs.map(m => /*#__PURE__*/React.createElement(Message, {
    key: m.id,
    msg: m,
    onReact: react,
    onOpenThread: setThreadId
  }))), /*#__PURE__*/React.createElement(Composer, {
    placeholder: active.kind === "channel" ? `Message #${active.name}` : `Message ${active.name}`,
    onSend: post
  })), thread && /*#__PURE__*/React.createElement("div", {
    className: "chat-thread"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chat-thread-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chat-h-title"
  }, "Thread"), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setThreadId(null)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    className: "chat-timeline"
  }, /*#__PURE__*/React.createElement(Message, {
    msg: thread,
    onReact: react,
    onOpenThread: () => {}
  }), /*#__PURE__*/React.createElement("div", {
    className: "chat-thread-divider"
  }, thread.replies.length, " ", thread.replies.length === 1 ? "reply" : "replies"), thread.replies.map(r => /*#__PURE__*/React.createElement("div", {
    className: "chat-msg",
    key: r.id
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: r.color,
    to: r.color,
    text: r.author[0],
    size: 32
  }), /*#__PURE__*/React.createElement("div", {
    className: "chat-msg-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chat-msg-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chat-author"
  }, r.author), /*#__PURE__*/React.createElement("span", {
    className: "chat-time"
  }, r.time)), /*#__PURE__*/React.createElement("div", {
    className: "chat-text"
  }, r.text))))), /*#__PURE__*/React.createElement(Composer, {
    placeholder: "Reply\u2026",
    onSend: reply
  })));
}
Object.assign(window, {
  Chat,
  CHAT_SEED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Chat.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/CoachMarks.jsx
try { (() => {
// CoachMarks.jsx — Vector DS feedback (from Keystone), Part 3
// First-run guided tour: sequential popovers anchored to real elements, with
// Skip / Next, step dots, and a persisted "seen" flag. Self-contained; Vector
// tokens; load after React. Exports window.CoachMarks.
//
// USAGE
//   <CoachMarks
//     id="v1"                       // bumping the id re-shows the tour
//     steps={[
//       { sel: '[data-coach="inbox"]',   title: "Inbox",   body: "Notifications land here.", placement: "right" },
//       { sel: '[data-coach="create"]',  title: "Create",  body: "Press C anywhere to add an issue." },
//       { sel: '[data-coach="filter"]',  title: "Filter",  body: "Slice the list by any property." },
//     ]}
//   />
//
// step: { sel, title, body, placement?: "top"|"bottom"|"left"|"right" }
// Renders nothing once seen (localStorage "vector-coach-<id>"). Call
// CoachMarks.reset(id) to replay.

(function () {
  const seenKey = id => "vector-coach-" + (id || "v1");
  function CoachMarks({
    id = "v1",
    steps = [],
    onDone
  }) {
    const [i, setI] = React.useState(() => {
      try {
        return localStorage.getItem(seenKey(id)) ? -1 : 0;
      } catch (e) {
        return 0;
      }
    });
    const [, force] = React.useState(0);
    React.useEffect(() => {
      const on = () => force(x => x + 1);
      window.addEventListener("resize", on, true);
      window.addEventListener("scroll", on, true);
      return () => {
        window.removeEventListener("resize", on, true);
        window.removeEventListener("scroll", on, true);
      };
    }, []);
    if (i < 0 || i >= steps.length) return null;
    const step = steps[i];
    const el = typeof document !== "undefined" ? document.querySelector(step.sel) : null;
    const r = el ? el.getBoundingClientRect() : {
      top: 80,
      left: 80,
      right: 160,
      bottom: 120,
      width: 80,
      height: 40
    };
    const place = step.placement || "bottom";
    const finish = () => {
      try {
        localStorage.setItem(seenKey(id), "1");
      } catch (e) {}
      setI(-1);
      onDone && onDone();
    };
    const next = () => {
      if (i + 1 >= steps.length) finish();else setI(i + 1);
    };
    const gap = 10,
      W = 260;
    const box = {
      position: "fixed",
      zIndex: 301,
      width: W
    };
    if (place === "right") {
      box.left = r.right + gap;
      box.top = r.top;
    } else if (place === "left") {
      box.left = Math.max(8, r.left - W - gap);
      box.top = r.top;
    } else if (place === "top") {
      box.left = r.left;
      box.top = Math.max(8, r.top - gap);
      box.transform = "translateY(-100%)";
    } else {
      box.left = r.left;
      box.top = r.bottom + gap;
    }
    box.left = Math.min(box.left, (window.innerWidth || 1200) - W - 8);
    return React.createElement(React.Fragment, null,
    // dim scrim + a bright cutout ring around the target
    React.createElement("div", {
      onClick: finish,
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.5)"
      }
    }), el && React.createElement("div", {
      style: {
        position: "fixed",
        zIndex: 300,
        pointerEvents: "none",
        left: r.left - 4,
        top: r.top - 4,
        width: r.width + 8,
        height: r.height + 8,
        border: "1px solid var(--accent)",
        borderRadius: "var(--r-sm)",
        boxShadow: "0 0 0 4px var(--accent-soft)"
      }
    }), React.createElement("div", {
      style: Object.assign(box, {
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-popover)",
        padding: "13px 14px"
      })
    }, React.createElement("div", {
      style: {
        font: "var(--fw-semi) 13px var(--font-sans)",
        color: "var(--fg)",
        marginBottom: 4
      }
    }, step.title), React.createElement("div", {
      style: {
        font: "var(--fw-regular) 12.5px var(--font-sans)",
        color: "var(--fg-3)",
        lineHeight: 1.5
      }
    }, step.body), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 12
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        gap: 5
      }
    }, steps.map((_, k) => React.createElement("span", {
      key: k,
      style: {
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: k === i ? "var(--accent)" : "var(--border-strong)"
      }
    }))), React.createElement("div", {
      style: {
        display: "flex",
        gap: 6
      }
    }, React.createElement("button", {
      onClick: finish,
      style: {
        border: "none",
        background: "none",
        cursor: "pointer",
        font: "var(--fw-medium) 12px var(--font-sans)",
        color: "var(--fg-4)",
        padding: "5px 8px"
      }
    }, "Skip"), React.createElement("button", {
      onClick: next,
      style: {
        border: "none",
        cursor: "pointer",
        font: "var(--fw-semi) 12px var(--font-sans)",
        color: "var(--fg-on-accent, #fff)",
        background: "var(--accent)",
        borderRadius: "var(--r-sm)",
        padding: "5px 12px"
      }
    }, i + 1 >= steps.length ? "Done" : "Next")))));
  }
  CoachMarks.reset = id => {
    try {
      localStorage.removeItem(seenKey(id));
    } catch (e) {}
  };
  if (typeof window !== "undefined") window.CoachMarks = CoachMarks;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/CoachMarks.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/CreateIssueModal.jsx
try { (() => {
// CreateIssueModal.jsx
function CreateIssueModal({
  onClose,
  onCreate,
  initialStatus = "todo"
}) {
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [more, setMore] = React.useState(false);
  const chip = (icon, label, custom) => /*#__PURE__*/React.createElement("span", {
    className: "v-chip"
  }, custom || /*#__PURE__*/React.createElement(Lic, {
    name: icon,
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), label);
  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      status: initialStatus
    });
    onClose();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "scrim",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-crumb"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb-badge"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "user",
    size: 11,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    className: "crumb-team"
  }, "VEC"), /*#__PURE__*/React.createElement("span", {
    className: "crumb-sep"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 13,
    cls: "icon-sm"
  })), /*#__PURE__*/React.createElement("span", {
    className: "crumb-new"
  }, "New issue")), /*#__PURE__*/React.createElement("div", {
    className: "mh-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "maximize-2",
    size: 15
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 16
  })))), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, /*#__PURE__*/React.createElement("input", {
    className: "modal-title-input",
    autoFocus: true,
    placeholder: "Issue title",
    value: title,
    onChange: e => setTitle(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") submit();
    }
  }), /*#__PURE__*/React.createElement("textarea", {
    className: "modal-desc-input",
    placeholder: "Add description\u2026",
    value: desc,
    onChange: e => setDesc(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-props"
  }, chip(null, statusLabel(initialStatus), /*#__PURE__*/React.createElement(StatusIcon, {
    status: initialStatus,
    size: 14
  })), chip("signal-high", "Priority"), chip("user", "Assignee"), chip("box", "Project"), chip("tag", "Labels"), /*#__PURE__*/React.createElement("span", {
    className: "v-chip",
    onClick: () => setMore(!more),
    style: {
      width: 30,
      justifyContent: "center",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "more-horizontal",
    size: 16,
    cls: "icon-sm"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "paperclip",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    className: "ff"
  }, /*#__PURE__*/React.createElement("span", {
    className: "toggle-inline"
  }, /*#__PURE__*/React.createElement("span", {
    className: "switch"
  }), "Create more"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: submit
  }, "Create issue")))));
}
Object.assign(window, {
  CreateIssueModal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/CreateIssueModal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Cycles.jsx
try { (() => {
// Cycles.jsx — sprints view (active cycle + progress + issue breakdown)
// Stacked status progress bar (Plane-style) — colored segments, groupable by status/priority/assignee.
function CycleProgressBar({
  issues,
  scope,
  completed,
  groupBy = "status"
}) {
  const total = issues.length || scope || 1;
  let segs = [];
  if (groupBy === "priority") {
    const pc = {
      urgent: "#F2994A",
      high: "#C9CCD1",
      medium: "#9CA0A8",
      low: "#62666D",
      none: "#3A3D42"
    };
    segs = PRIORITIES.map(p => ({
      color: pc[p],
      n: issues.filter(i => i.priority === p).length
    }));
  } else if (groupBy === "assignee") {
    const map = {};
    issues.forEach(i => {
      const k = i.assignee || "—";
      map[k] = (map[k] || 0) + 1;
    });
    const pal = ["#4C8DFF", "#4CB782", "#BB6BD9", "#F2994A", "#EB5757", "#62666D"];
    segs = Object.keys(map).map((k, i) => ({
      color: k === "—" ? "#3A3D42" : pal[i % pal.length],
      n: map[k]
    }));
  } else {
    segs = [{
      color: STATUS.done.color,
      n: issues.filter(i => i.status === "done").length
    }, {
      color: STATUS.review.color,
      n: issues.filter(i => i.status === "review").length
    }, {
      color: STATUS.progress.color,
      n: issues.filter(i => i.status === "progress").length
    }, {
      color: STATUS.todo.color,
      n: issues.filter(i => i.status === "todo").length
    }, {
      color: STATUS.backlog.color,
      n: issues.filter(i => i.status === "backlog").length
    }];
  }
  const pct = Math.round(completed / (scope || total) * 100) || 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "cyc-prog"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cyc-prog-track cyc-prog-stack"
  }, segs.filter(s => s.n > 0).map((s, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: s.n / total * 100 + "%",
      background: s.color
    }
  }))), /*#__PURE__*/React.createElement("span", {
    className: "cyc-prog-label"
  }, completed, "/", scope, " \xB7 ", pct, "%"));
}

// Mini burndown sparkline beside the metric numbers.
function MiniBurndown({
  scope
}) {
  const W = 96,
    H = 36,
    n = 8;
  const cur = [scope, scope, scope - 1, scope - 1, scope - 2, scope - 3, scope - 4, scope - 5].map(v => Math.max(0, v));
  const x = i => W * i / (n - 1);
  const y = v => 4 + (H - 8) * (1 - v / (scope || 1));
  const line = cur.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1)} ${H} L0 ${H} Z`;
  return /*#__PURE__*/React.createElement("svg", {
    width: W,
    height: H,
    className: "cyc-spark"
  }, /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: "var(--accent-soft)"
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}

// Status-group progress breakdown — mirrors Plane's active-cycle progress.tsx
// (LinearProgressIndicator + per-group rows over completed/started/unstarted/backlog).
function CycleStatusBreakdown({
  issues
}) {
  const groups = [{
    key: "completed",
    label: "Completed",
    color: STATUS.done.color,
    match: s => s === "done"
  }, {
    key: "started",
    label: "Started",
    color: STATUS.progress.color,
    match: s => s === "progress" || s === "review"
  }, {
    key: "unstarted",
    label: "Unstarted",
    color: STATUS.todo.color,
    match: s => s === "todo"
  }, {
    key: "backlog",
    label: "Backlog",
    color: STATUS.backlog.color,
    match: s => s === "backlog"
  }].map(g => ({
    ...g,
    count: issues.filter(i => g.match(i.status)).length
  }));
  const total = issues.length || 1;
  return /*#__PURE__*/React.createElement("div", {
    className: "cyc-breakdown"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cyc-seg"
  }, groups.filter(g => g.count > 0).map(g => /*#__PURE__*/React.createElement("span", {
    key: g.key,
    style: {
      width: g.count / total * 100 + "%",
      background: g.color
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cyc-breakdown-rows"
  }, groups.map(g => /*#__PURE__*/React.createElement("div", {
    className: "cyc-bd-row",
    key: g.key
  }, /*#__PURE__*/React.createElement("span", {
    className: "cyc-bd-dot",
    style: {
      background: g.color
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "cyc-bd-lab"
  }, g.label), /*#__PURE__*/React.createElement("span", {
    className: "cyc-bd-num"
  }, g.count)))));
}
function CyclePill({
  c,
  active,
  onClick
}) {
  const dot = c.state === "active" ? "var(--accent)" : c.state === "completed" ? "var(--status-done)" : "var(--fg-4)";
  return /*#__PURE__*/React.createElement("div", {
    className: "cyc-pill" + (active ? " on" : ""),
    onClick: onClick
  }, /*#__PURE__*/React.createElement("span", {
    className: "cyc-dot",
    style: {
      background: dot
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "cyc-name"
  }, c.name), /*#__PURE__*/React.createElement("span", {
    className: "cyc-range"
  }, c.start, "\u2013", c.end), c.state === "active" && /*#__PURE__*/React.createElement("span", {
    className: "cyc-badge"
  }, "Active"));
}

// SingleProgressStats + tabbed Assignees/Labels/Priority — mirrors Plane's cycle-stats.tsx
function SingleProgressStat({
  title,
  completed,
  total
}) {
  const pct = total > 0 ? Math.round(completed / total * 100) : 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "cyc-sps"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cyc-sps-title"
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "cyc-sps-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cyc-sps-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cyc-sps-fill",
    style: {
      width: pct + "%"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "cyc-sps-num"
  }, completed, "/", total)));
}
function CycleStats({
  issues
}) {
  const [tab, setTab] = React.useState("Assignees");
  const done = arr => arr.filter(i => i.status === "done").length;
  let rows = [];
  if (tab === "Assignees") {
    const map = {};
    issues.forEach(i => {
      const k = i.assignee || "No assignee";
      (map[k] = map[k] || []).push(i);
    });
    rows = Object.entries(map).map(([k, arr]) => ({
      key: k,
      node: /*#__PURE__*/React.createElement("span", {
        className: "cyc-sps-name"
      }, k === "No assignee" ? /*#__PURE__*/React.createElement("span", {
        className: "avatar empty",
        style: {
          width: 18,
          height: 18
        }
      }) : /*#__PURE__*/React.createElement(Avatar, {
        from: "#2D9CDB",
        to: "#4C8DFF",
        text: k[0],
        size: 18
      }), k),
      completed: done(arr),
      total: arr.length
    }));
  } else if (tab === "Labels") {
    const map = {};
    issues.forEach(i => (i.labels.length ? i.labels : ["No label"]).forEach(l => {
      (map[l] = map[l] || []).push(i);
    }));
    rows = Object.entries(map).map(([k, arr]) => ({
      key: k,
      node: /*#__PURE__*/React.createElement("span", {
        className: "cyc-sps-name"
      }, /*#__PURE__*/React.createElement("span", {
        className: "label-dot",
        style: {
          background: LABELS[k] && LABELS[k].color || "var(--fg-4)"
        }
      }), k),
      completed: done(arr),
      total: arr.length
    }));
  } else {
    const map = {};
    issues.forEach(i => {
      (map[i.priority] = map[i.priority] || []).push(i);
    });
    rows = PRIORITIES.filter(p => map[p]).map(p => ({
      key: p,
      node: /*#__PURE__*/React.createElement("span", {
        className: "cyc-sps-name"
      }, /*#__PURE__*/React.createElement(PriorityIcon, {
        priority: p,
        size: 15
      }), priorityLabel(p)),
      completed: done(map[p]),
      total: map[p].length
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "cyc-stats-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cyc-stats-tabs"
  }, ["Priority", "Assignees", "Labels"].map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    className: "cyc-stats-tab" + (tab === t ? " active" : ""),
    onClick: () => setTab(t)
  }, t))), /*#__PURE__*/React.createElement("div", {
    className: "cyc-stats-list"
  }, rows.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "etext",
    style: {
      padding: 20,
      textAlign: "center"
    }
  }, "No data") : rows.map(r => /*#__PURE__*/React.createElement(SingleProgressStat, {
    key: r.key,
    title: r.node,
    completed: r.completed,
    total: r.total
  }))));
}
function Cycles({
  cycles,
  issues,
  onOpen,
  onCycle,
  onSetStatus,
  cycWidgets,
  onCycWidgets
}) {
  const active = cycles.find(c => c.state === "active") || cycles[0];
  const [selId, setSelId] = React.useState(active ? active.id : null);
  const sel = cycles.find(c => c.id === selId) || active;
  const cycleIssues = issues.filter(i => i.cycle === sel.id);
  // live-derived metrics (not seed): scope = issues in cycle, done = completed issues
  const liveScope = cycleIssues.length;
  const liveDone = cycleIssues.filter(i => i.status === "done").length;
  const groups = buildGroups(cycleIssues, "Status").filter(g => g.items.length);
  const daysLeft = sel.state === "active" ? 4 : sel.state === "upcoming" ? null : 0;
  const [mode, setMode] = React.useState("overview");
  const [custOpen, setCustOpen] = React.useState(false);
  const W = cycWidgets || {
    progress: true,
    breakdown: true,
    stats: true,
    sparkline: true,
    list: true
  };
  const toggleW = k => onCycWidgets && onCycWidgets({
    ...W,
    [k]: !W[k]
  });
  const issueList = groups.map(g => /*#__PURE__*/React.createElement(React.Fragment, {
    key: g.key
  }, /*#__PURE__*/React.createElement("div", {
    className: "group-header"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 14,
    cls: "icon-sm chev"
  }), g.icon, /*#__PURE__*/React.createElement("span", {
    className: "gh-title"
  }, g.label), /*#__PURE__*/React.createElement("span", {
    className: "gh-count"
  }, g.items.length)), g.items.map(i => /*#__PURE__*/React.createElement("div", {
    className: "issue-row",
    key: i.id,
    onClick: () => onOpen(i)
  }, /*#__PURE__*/React.createElement("span", {
    className: "issue-id"
  }, i.id), /*#__PURE__*/React.createElement("span", {
    className: "statusbtn",
    style: {
      width: 22,
      height: 22
    },
    onClick: e => {
      e.stopPropagation();
      onCycle(i.id);
    }
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: i.status,
    size: 14
  })), /*#__PURE__*/React.createElement("span", {
    className: "issue-priority"
  }, /*#__PURE__*/React.createElement(PriorityIcon, {
    priority: i.priority,
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    className: "issue-title"
  }, i.title), /*#__PURE__*/React.createElement("span", {
    className: "issue-meta"
  }, i.estimate != null && /*#__PURE__*/React.createElement("span", {
    className: "cyc-est"
  }, i.estimate), i.labels.map(l => /*#__PURE__*/React.createElement("span", {
    className: "label-chip",
    key: l
  }, /*#__PURE__*/React.createElement("span", {
    className: "label-dot",
    style: {
      background: LABELS[l].color
    }
  }), l)), i.assignee ? /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: i.assignee[0],
    size: 20
  }) : /*#__PURE__*/React.createElement("span", {
    className: "avatar empty"
  }))))));
  return /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cyc-rail"
  }, cycles.map(c => /*#__PURE__*/React.createElement(CyclePill, {
    key: c.id,
    c: c,
    active: c.id === sel.id,
    onClick: () => setSelId(c.id)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cyc-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cyc-head-main"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "cyc-title"
  }, sel.name), /*#__PURE__*/React.createElement("span", {
    className: "cyc-sub"
  }, sel.start, " \u2013 ", sel.end, daysLeft != null ? ` · ${daysLeft} days left` : " · upcoming")), /*#__PURE__*/React.createElement("div", {
    className: "cyc-stats"
  }, W.sparkline && /*#__PURE__*/React.createElement(MiniBurndown, {
    scope: Math.max(liveScope, 1)
  }), /*#__PURE__*/React.createElement("div", {
    className: "cyc-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cs-num"
  }, liveScope), /*#__PURE__*/React.createElement("span", {
    className: "cs-lab"
  }, "Scope")), /*#__PURE__*/React.createElement("div", {
    className: "cyc-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cs-num"
  }, liveDone), /*#__PURE__*/React.createElement("span", {
    className: "cs-lab"
  }, "Done")), /*#__PURE__*/React.createElement("div", {
    className: "cyc-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cs-num"
  }, liveScope - liveDone), /*#__PURE__*/React.createElement("span", {
    className: "cs-lab"
  }, "Remaining")))), /*#__PURE__*/React.createElement("div", {
    className: "cyc-modebar"
  }, [["overview", "layout-list", "Overview"], ["board", "layout-grid", "Board"], ["burndown", "trending-down", "Burndown"]].map(([m, ic, lab]) => /*#__PURE__*/React.createElement("div", {
    key: m,
    className: "seg" + (mode === m ? " active" : ""),
    onClick: () => setMode(m)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: ic,
    size: 14,
    cls: "icon-sm"
  }), lab)), mode === "overview" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    style: {
      height: 28
    },
    onClick: () => setCustOpen(!custOpen)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "sliders-horizontal",
    size: 14,
    cls: "icon-sm"
  }), "Customize"), custOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: () => setCustOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 34,
      right: 0,
      width: 220,
      zIndex: 45
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-caption"
  }, "Overview widgets"), [["sparkline", "Burndown sparkline"], ["progress", "Progress bar"], ["breakdown", "Status breakdown"], ["stats", "Tabbed stats"], ["list", "Issue list"]].map(([k, lab]) => /*#__PURE__*/React.createElement("div", {
    className: "panel-row",
    key: k,
    style: {
      paddingTop: 4,
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, lab), /*#__PURE__*/React.createElement("span", {
    className: "switch" + (W[k] ? " on" : ""),
    onClick: () => toggleW(k)
  }))), W.progress && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "panel-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Bar grouped by"), /*#__PURE__*/React.createElement("span", {
    className: "pr-select",
    onClick: () => onCycWidgets && onCycWidgets({
      ...W,
      barGroup: W.barGroup === "status" ? "priority" : W.barGroup === "priority" ? "assignee" : "status"
    })
  }, (W.barGroup || "status")[0].toUpperCase() + (W.barGroup || "status").slice(1), " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 13,
    cls: "icon-sm"
  })))))))), cycleIssues.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      height: 240
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "refresh-cw",
    size: 36,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No issues in this cycle")) : mode === "overview" ? /*#__PURE__*/React.createElement(React.Fragment, null, (W.progress || W.breakdown || W.stats) && /*#__PURE__*/React.createElement("div", {
    className: "cyc-progwrap"
  }, W.progress && /*#__PURE__*/React.createElement(CycleProgressBar, {
    issues: cycleIssues,
    scope: liveScope,
    completed: liveDone,
    groupBy: W.barGroup || "status"
  }), W.breakdown && /*#__PURE__*/React.createElement(CycleStatusBreakdown, {
    issues: cycleIssues
  }), W.stats && /*#__PURE__*/React.createElement(CycleStats, {
    issues: cycleIssues
  })), W.list && issueList) : mode === "board" ? /*#__PURE__*/React.createElement(BoardView, {
    issues: cycleIssues,
    opts: {
      ordering: "Priority",
      empty: false,
      props: []
    },
    onCycle: onCycle,
    onOpen: onOpen,
    onMove: (id, status) => onSetStatus && onSetStatus(id, status)
  }) : /*#__PURE__*/React.createElement("div", {
    className: "cyc-burndown-full"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ins-panel",
    style: {
      border: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ins-panel-head"
  }, /*#__PURE__*/React.createElement("span", null, "Burndown"), /*#__PURE__*/React.createElement("span", {
    className: "ins-cap"
  }, sel.name)), /*#__PURE__*/React.createElement(Burndown, {
    scope: Math.max(liveScope, 1)
  }), /*#__PURE__*/React.createElement("div", {
    className: "ins-legend-row"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "ins-leg-dot",
    style: {
      background: "var(--accent)"
    }
  }), "Actual remaining"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "ins-leg-dot",
    style: {
      background: "#A9BBD0"
    }
  }), "Ideal"))), /*#__PURE__*/React.createElement(CycleStatusBreakdown, {
    issues: cycleIssues
  })));
}
Object.assign(window, {
  Cycles
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Cycles.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Database.jsx
try { (() => {
// Database.jsx — Notion-style database: typed properties + Table / Board / Gallery
const DB_SEED = {
  id: "db1",
  team: "VEC",
  name: "Roadmap",
  props: [{
    id: "name",
    name: "Name",
    type: "title"
  }, {
    id: "status",
    name: "Status",
    type: "select",
    options: [{
      v: "Idea",
      color: "#8A8F98"
    }, {
      v: "Exploring",
      color: "#F2C94C"
    }, {
      v: "Building",
      color: "#2D9CDB"
    }, {
      v: "Shipped",
      color: "#4CB782"
    }]
  }, {
    id: "effort",
    name: "Effort",
    type: "select",
    options: [{
      v: "S",
      color: "#4CB782"
    }, {
      v: "M",
      color: "#F2C94C"
    }, {
      v: "L",
      color: "#F2994A"
    }, {
      v: "XL",
      color: "#EB5757"
    }]
  }, {
    id: "owner",
    name: "Owner",
    type: "text"
  }, {
    id: "target",
    name: "Target",
    type: "date"
  }, {
    id: "reach",
    name: "Reach",
    type: "number"
  }, {
    id: "shipped",
    name: "Done",
    type: "checkbox"
  }, {
    id: "summary",
    name: "Summary",
    type: "formula",
    formula: "concat(prop(\"Status\"), \" · \", prop(\"Effort\"), \" · reach \", prop(\"Reach\"))"
  }],
  rows: [{
    id: "r1",
    name: "Realtime presence",
    status: "Building",
    effort: "L",
    owner: "김혁규",
    target: "Aug 15",
    reach: 1200,
    shipped: false
  }, {
    id: "r2",
    name: "Slack 2-way sync",
    status: "Exploring",
    effort: "M",
    owner: "Alex Park",
    target: "Sep 1",
    reach: 800,
    shipped: false
  }, {
    id: "r3",
    name: "Saved filters",
    status: "Shipped",
    effort: "S",
    owner: "Jordan Lee",
    target: "May 20",
    reach: 2400,
    shipped: true
  }, {
    id: "r4",
    name: "Mobile offline mode",
    status: "Idea",
    effort: "XL",
    owner: "",
    target: "",
    reach: 0,
    shipped: false
  }, {
    id: "r5",
    name: "AI triage suggestions",
    status: "Exploring",
    effort: "L",
    owner: "김혁규",
    target: "Oct 10",
    reach: 1500,
    shipped: false
  }]
};
function SelectCell({
  prop,
  value,
  onChange
}) {
  const [open, setOpen] = React.useState(false);
  const opt = prop.options.find(o => o.v === value);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "db-pill",
    style: opt ? {
      background: opt.color + "26",
      color: opt.color
    } : {
      color: "var(--fg-4)"
    },
    onClick: e => {
      e.stopPropagation();
      setOpen(!open);
    }
  }, value || "—"), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: e => {
      e.stopPropagation();
      setOpen(false);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 24,
      left: 0,
      width: 150,
      zIndex: 45
    }
  }, prop.options.map(o => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: o.v,
    onClick: e => {
      e.stopPropagation();
      onChange(o.v);
      setOpen(false);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "db-pill",
    style: {
      background: o.color + "26",
      color: o.color
    }
  }, o.v), value === o.v && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    style: {
      marginLeft: "auto"
    },
    color: "var(--accent)"
  }))))));
}
function Cell({
  prop,
  row,
  onChange,
  db
}) {
  const v = row[prop.id];
  if (prop.type === "formula") {
    // build a name-keyed row so prop("Field name") resolves
    const named = {};
    (db ? db.props : []).forEach(p => {
      named[p.name] = row[p.id];
    });
    const out = window.runFormula ? window.runFormula(prop.formula || "", named) : "";
    const isErr = out === "#ERR";
    return /*#__PURE__*/React.createElement("span", {
      className: "db-cell-input",
      style: {
        color: isErr ? "var(--label-red)" : "var(--fg-3)",
        fontFamily: typeof out === "number" ? "var(--font-mono)" : "inherit"
      },
      title: prop.formula
    }, out === "" ? "—" : String(out));
  }
  if (prop.type === "title") return /*#__PURE__*/React.createElement("input", {
    className: "db-cell-input db-title",
    value: v || "",
    onChange: e => onChange(prop.id, e.target.value)
  });
  if (prop.type === "text") return /*#__PURE__*/React.createElement("input", {
    className: "db-cell-input",
    value: v || "",
    placeholder: "\u2014",
    onChange: e => onChange(prop.id, e.target.value)
  });
  if (prop.type === "number") return /*#__PURE__*/React.createElement("input", {
    className: "db-cell-input db-num",
    value: v ?? "",
    placeholder: "\u2014",
    onChange: e => onChange(prop.id, e.target.value.replace(/[^0-9.]/g, ""))
  });
  if (prop.type === "date") return /*#__PURE__*/React.createElement("input", {
    className: "db-cell-input",
    value: v || "",
    placeholder: "\u2014",
    onChange: e => onChange(prop.id, e.target.value)
  });
  if (prop.type === "checkbox") return /*#__PURE__*/React.createElement("span", {
    className: "blk-check" + (v ? " on" : ""),
    onClick: () => onChange(prop.id, !v)
  }, v && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 11,
    color: "var(--fg-on-accent)"
  }));
  if (prop.type === "select") return /*#__PURE__*/React.createElement(SelectCell, {
    prop: prop,
    value: v,
    onChange: nv => onChange(prop.id, nv)
  });
  return /*#__PURE__*/React.createElement("span", null, v);
}
const PROP_ICON = {
  title: "type",
  text: "align-left",
  number: "hash",
  date: "calendar",
  checkbox: "check-square",
  select: "chevron-down-circle",
  status: "circle-dot",
  rating: "star",
  url: "link",
  formula: "calculator"
};
const DB_FIELD_TYPES = [{
  type: "text",
  icon: "align-left",
  label: "Text"
}, {
  type: "number",
  icon: "hash",
  label: "Number"
}, {
  type: "select",
  icon: "chevron-down-circle",
  label: "Select"
}, {
  type: "status",
  icon: "circle-dot",
  label: "Status"
}, {
  type: "date",
  icon: "calendar",
  label: "Date"
}, {
  type: "checkbox",
  icon: "check-square",
  label: "Checkbox"
}, {
  type: "rating",
  icon: "star",
  label: "Rating"
}, {
  type: "url",
  icon: "link",
  label: "URL"
}, {
  type: "formula",
  icon: "calculator",
  label: "Formula"
}];
function DbTypePicker({
  value,
  onChange
}) {
  const [open, setOpen] = React.useState(false);
  const t = DB_FIELD_TYPES.find(x => x.type === value) || DB_FIELD_TYPES[0];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "set-select",
    onClick: e => {
      e.stopPropagation();
      setOpen(!open);
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: t.icon,
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), t.label, " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 12,
    cls: "icon-sm"
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: e => {
      e.stopPropagation();
      setOpen(false);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 32,
      right: 0,
      width: 180,
      zIndex: 45
    }
  }, DB_FIELD_TYPES.map(ft => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: ft.type,
    onClick: e => {
      e.stopPropagation();
      onChange(ft.type);
      setOpen(false);
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: ft.icon,
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), ft.label, ft.type === value && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    style: {
      marginLeft: "auto"
    },
    color: "var(--accent)"
  }))))));
}
function SchemaBuilderDB({
  db,
  onUpdate
}) {
  const setProp = (pid, patch) => onUpdate({
    ...db,
    props: db.props.map(p => p.id === pid ? {
      ...p,
      ...patch
    } : p)
  });
  const del = pid => onUpdate({
    ...db,
    props: db.props.filter(p => p.id !== pid)
  });
  const add = () => onUpdate({
    ...db,
    props: [...db.props, {
      id: "p" + Date.now(),
      name: "New field",
      type: "text"
    }]
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: "0 auto",
      padding: 28
    }
  }, db.props.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: p.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "schema-row"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "grip-vertical",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("input", {
    className: "schema-name",
    value: p.name,
    onChange: e => setProp(p.id, {
      name: e.target.value
    }),
    disabled: p.type === "title"
  }), p.type === "title" ? /*#__PURE__*/React.createElement("span", {
    className: "set-select",
    style: {
      opacity: .6
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "type",
    size: 13,
    cls: "icon-sm"
  }), "Title") : /*#__PURE__*/React.createElement(DbTypePicker, {
    value: p.type,
    onChange: t => setProp(p.id, {
      type: t
    })
  }), p.type !== "title" && /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => del(p.id)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 15
  }))), p.type === "formula" && /*#__PURE__*/React.createElement("div", {
    className: "schema-formula"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "calculator",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("input", {
    className: "schema-formula-input",
    value: p.formula || "",
    placeholder: 'concat(prop("Status"), " · ", prop("Effort"))',
    onChange: e => setProp(p.id, {
      formula: e.target.value
    })
  })))), /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: add,
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 14,
    cls: "icon-sm"
  }), "Add field"));
}
function TableView({
  db,
  onCell,
  onAddRow,
  onUpdate
}) {
  const [sel, setSel] = React.useState(new Set());
  const toggle = id => setSel(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allOn = db.rows.length > 0 && sel.size === db.rows.length;
  const toggleAll = () => setSel(allOn ? new Set() : new Set(db.rows.map(r => r.id)));
  const delSel = () => {
    onUpdate({
      ...db,
      rows: db.rows.filter(r => !sel.has(r.id))
    });
    setSel(new Set());
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "db-table-wrap",
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "db-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "db-selcol"
  }, /*#__PURE__*/React.createElement("span", {
    className: "row-check" + (allOn ? " on" : ""),
    style: {
      opacity: 1
    },
    onClick: toggleAll
  }, allOn && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 11,
    color: "var(--fg-on-accent)"
  }))), db.props.map(p => /*#__PURE__*/React.createElement("th", {
    key: p.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "db-th"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: PROP_ICON[p.type] || "type",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), p.name))))), /*#__PURE__*/React.createElement("tbody", null, db.rows.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id,
    className: sel.has(r.id) ? "db-row-sel" : ""
  }, /*#__PURE__*/React.createElement("td", {
    className: "db-td db-selcol"
  }, /*#__PURE__*/React.createElement("span", {
    className: "row-check" + (sel.has(r.id) ? " on" : ""),
    onClick: () => toggle(r.id)
  }, sel.has(r.id) && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 11,
    color: "var(--fg-on-accent)"
  }))), db.props.map(p => /*#__PURE__*/React.createElement("td", {
    key: p.id,
    className: "db-td db-td-" + p.type
  }, /*#__PURE__*/React.createElement(Cell, {
    prop: p,
    row: r,
    db: db,
    onChange: (pid, val) => onCell(r.id, pid, val)
  }))))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: db.props.length + 1,
    className: "db-addrow",
    onClick: onAddRow
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), "New row")))), sel.size > 0 && /*#__PURE__*/React.createElement("div", {
    className: "floating-toolbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ft-pill"
  }, sel.size, " selected", /*#__PURE__*/React.createElement("span", {
    className: "ft-x",
    onClick: () => setSel(new Set())
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 15,
    cls: "icon-sm"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "ft-actions",
    onClick: delSel
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 14,
    cls: "icon-sm"
  }), "Delete")));
}
function BoardViewDB({
  db,
  groupProp,
  onCell,
  onAddRow
}) {
  const gp = db.props.find(p => p.id === groupProp) || db.props.find(p => p.type === "select");
  const cols = gp.options.map(o => ({
    ...o,
    rows: db.rows.filter(r => r[gp.id] === o.v)
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "content",
    style: {
      overflowX: "auto",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "board"
  }, cols.map(col => /*#__PURE__*/React.createElement("div", {
    className: "board-col",
    key: col.v,
    style: {
      width: 280
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "board-col-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "db-pill",
    style: {
      background: col.color + "26",
      color: col.color
    }
  }, col.v), /*#__PURE__*/React.createElement("span", {
    className: "bc-count"
  }, col.rows.length)), /*#__PURE__*/React.createElement("div", {
    className: "board-cards"
  }, col.rows.map(r => /*#__PURE__*/React.createElement("div", {
    className: "board-card",
    key: r.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "bc-issue-title"
  }, r.name), /*#__PURE__*/React.createElement("div", {
    className: "bc-foot",
    style: {
      gap: 8,
      flexWrap: "wrap"
    }
  }, r.effort && /*#__PURE__*/React.createElement("span", {
    className: "db-pill",
    style: {
      background: (db.props.find(p => p.id === 'effort').options.find(o => o.v === r.effort) || {}).color + "26",
      color: (db.props.find(p => p.id === 'effort').options.find(o => o.v === r.effort) || {}).color
    }
  }, r.effort), r.owner && /*#__PURE__*/React.createElement("span", {
    className: "bc-when"
  }, r.owner), r.reach > 0 && /*#__PURE__*/React.createElement("span", {
    className: "bc-when"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "users",
    size: 11,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), r.reach)))))))));
}
function GalleryView({
  db
}) {
  const statusProp = db.props.find(p => p.id === "status");
  return /*#__PURE__*/React.createElement("div", {
    className: "db-gallery"
  }, db.rows.map(r => {
    const opt = statusProp.options.find(o => o.v === r.status);
    return /*#__PURE__*/React.createElement("div", {
      className: "db-card",
      key: r.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "db-card-cover",
      style: {
        background: (opt ? opt.color : "#8A8F98") + "22"
      }
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 22,
      color: opt ? opt.color : "var(--fg-3)"
    })), /*#__PURE__*/React.createElement("div", {
      className: "db-card-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "db-card-title"
    }, r.name), /*#__PURE__*/React.createElement("div", {
      className: "db-card-meta"
    }, /*#__PURE__*/React.createElement("span", {
      className: "db-pill",
      style: opt ? {
        background: opt.color + "26",
        color: opt.color
      } : null
    }, r.status), r.owner && /*#__PURE__*/React.createElement("span", {
      className: "bc-when"
    }, r.owner))));
  }));
}
function Database({
  db,
  onUpdate
}) {
  const [mode, setMode] = React.useState("table");
  const setCell = (rid, pid, val) => onUpdate({
    ...db,
    rows: db.rows.map(r => r.id === rid ? {
      ...r,
      [pid]: val
    } : r)
  });
  const addRow = () => onUpdate({
    ...db,
    rows: [...db.rows, {
      id: "r" + Date.now(),
      name: "Untitled",
      status: "Idea",
      effort: "M",
      owner: "",
      target: "",
      reach: 0,
      shipped: false
    }]
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "content",
    style: {
      display: "flex",
      flexDirection: "column",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "db-toolbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "db-views"
  }, /*#__PURE__*/React.createElement("div", {
    className: "db-vtab" + (mode === "table" ? " active" : ""),
    onClick: () => setMode("table")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "table-2",
    size: 14,
    cls: "icon-sm"
  }), "Table"), /*#__PURE__*/React.createElement("div", {
    className: "db-vtab" + (mode === "board" ? " active" : ""),
    onClick: () => setMode("board")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "layout-grid",
    size: 14,
    cls: "icon-sm"
  }), "Board"), /*#__PURE__*/React.createElement("div", {
    className: "db-vtab" + (mode === "gallery" ? " active" : ""),
    onClick: () => setMode("gallery")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "image",
    size: 14,
    cls: "icon-sm"
  }), "Gallery"), /*#__PURE__*/React.createElement("div", {
    className: "db-vtab" + (mode === "schema" ? " active" : ""),
    onClick: () => setMode("schema")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "settings-2",
    size: 14,
    cls: "icon-sm"
  }), "Schema")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    style: {
      height: 28
    },
    onClick: addRow
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 14,
    cls: "icon-sm"
  }), "New"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto"
    }
  }, mode === "table" && /*#__PURE__*/React.createElement(TableView, {
    db: db,
    onCell: setCell,
    onAddRow: addRow,
    onUpdate: onUpdate
  }), mode === "board" && /*#__PURE__*/React.createElement(BoardViewDB, {
    db: db,
    groupProp: "status",
    onCell: setCell,
    onAddRow: addRow
  }), mode === "gallery" && /*#__PURE__*/React.createElement(GalleryView, {
    db: db
  }), mode === "schema" && /*#__PURE__*/React.createElement(SchemaBuilderDB, {
    db: db,
    onUpdate: onUpdate
  })));
}
Object.assign(window, {
  Database,
  DB_SEED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Database.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Docs.jsx
try { (() => {
// Docs.jsx — Notion-style documents, block model mirrored from BlockNote
// (TypeCellOS/BlockNote defaultBlockSpecs). Block types & slash menu match the
// open-source schema: paragraph, heading(1-3), bulletListItem, numberedListItem,
// checkListItem, toggleListItem, quote, codeBlock, divider, image — plus an
// issue-embed extension. Default props mirror BlockNote (textAlignment).

const DOC_SEED = [{
  id: "d1",
  team: "VEC",
  title: "Product spec: Onboarding v2",
  icon: "file-text",
  blocks: [{
    type: "heading",
    props: {
      level: 1
    },
    text: "Onboarding v2"
  }, {
    type: "paragraph",
    text: "Goal: get a new user to their first created issue in under 60 seconds."
  }, {
    type: "heading",
    props: {
      level: 2
    },
    text: "Problems with v1"
  }, {
    type: "checkListItem",
    text: "Too many steps before value",
    checked: true
  }, {
    type: "checkListItem",
    text: "No sample data to explore",
    checked: true
  }, {
    type: "checkListItem",
    text: "Unclear where to start",
    checked: false
  }, {
    type: "callout",
    text: "Decision: ship a guided checklist with seeded demo issues."
  }, {
    type: "heading",
    props: {
      level: 2
    },
    text: "Linked issues"
  }, {
    type: "issue",
    ref: "VEC-1"
  }, {
    type: "issue",
    ref: "VEC-5"
  }]
}, {
  id: "d2",
  team: "VEC",
  title: "Engineering principles",
  icon: "book",
  blocks: [{
    type: "heading",
    props: {
      level: 1
    },
    text: "Engineering principles"
  }, {
    type: "paragraph",
    text: "How we build at Vector."
  }, {
    type: "bulletListItem",
    text: "Ship small, ship often"
  }, {
    type: "bulletListItem",
    text: "Write the changelog first"
  }, {
    type: "quote",
    text: "Make it work, make it right, make it fast."
  }]
}, {
  id: "d3",
  team: "VEC",
  title: "Q3 planning notes",
  icon: "file-text",
  blocks: [{
    type: "heading",
    props: {
      level: 1
    },
    text: "Q3 planning"
  }, {
    type: "toggleListItem",
    text: "Themes",
    open: true,
    body: "Reliability, onboarding, mobile."
  }, {
    type: "codeBlock",
    text: "npm run plan --quarter Q3"
  }]
}];

// Slash-menu items mirror BlockNote's getDefaultSlashMenuItems groups.
const SLASH_ITEMS = [{
  group: "Headings",
  type: "heading",
  props: {
    level: 1
  },
  title: "Heading 1",
  icon: "heading-1",
  alias: "h1"
}, {
  group: "Headings",
  type: "heading",
  props: {
    level: 2
  },
  title: "Heading 2",
  icon: "heading-2",
  alias: "h2"
}, {
  group: "Headings",
  type: "heading",
  props: {
    level: 3
  },
  title: "Heading 3",
  icon: "heading-3",
  alias: "h3"
}, {
  group: "Basic blocks",
  type: "paragraph",
  title: "Paragraph",
  icon: "pilcrow",
  alias: "p text"
}, {
  group: "Lists",
  type: "bulletListItem",
  title: "Bulleted list",
  icon: "list",
  alias: "ul"
}, {
  group: "Lists",
  type: "numberedListItem",
  title: "Numbered list",
  icon: "list-ordered",
  alias: "ol"
}, {
  group: "Lists",
  type: "checkListItem",
  title: "Check list",
  icon: "list-checks",
  alias: "todo checkbox"
}, {
  group: "Lists",
  type: "toggleListItem",
  title: "Toggle list",
  icon: "chevron-right",
  alias: "collapsible"
}, {
  group: "Basic blocks",
  type: "quote",
  title: "Quote",
  icon: "quote",
  alias: "blockquote"
}, {
  group: "Basic blocks",
  type: "codeBlock",
  title: "Code",
  icon: "code",
  alias: "codeblock"
}, {
  group: "Basic blocks",
  type: "callout",
  title: "Callout",
  icon: "info",
  alias: "note"
}, {
  group: "Basic blocks",
  type: "divider",
  title: "Divider",
  icon: "minus",
  alias: "hr separator"
}, {
  group: "Media",
  type: "issue",
  title: "Link issue",
  icon: "circle-dot",
  alias: "embed issue"
}];
function SlashMenu({
  q,
  onPick,
  onClose,
  active
}) {
  const filtered = SLASH_ITEMS.filter(it => (it.title + " " + it.alias).toLowerCase().includes(q.toLowerCase()));
  let lastGroup = null;
  if (filtered.length === 0) return /*#__PURE__*/React.createElement("div", {
    className: "slash-menu"
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-empty",
    style: {
      padding: 10
    }
  }, "No blocks"));
  return /*#__PURE__*/React.createElement("div", {
    className: "slash-menu"
  }, filtered.map((it, i) => {
    const head = it.group !== lastGroup ? /*#__PURE__*/React.createElement("div", {
      className: "cmd-cap",
      key: "g" + i
    }, it.group) : null;
    lastGroup = it.group;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, head, /*#__PURE__*/React.createElement("div", {
      className: "slash-item" + (i === active ? " active" : ""),
      onMouseDown: e => {
        e.preventDefault();
        onPick(it);
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "slash-ic"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: it.icon,
      size: 16,
      cls: "icon-sm"
    })), /*#__PURE__*/React.createElement("span", null, it.title)));
  }));
}
function BlockRow({
  block,
  idx,
  issues,
  onChange,
  onEnter,
  onBackspace,
  onSlash,
  onOpenIssue,
  registerRef,
  setAlign
}) {
  const ref = el => registerRef(idx, el);
  const align = block.props && block.props.textAlignment;
  const baseStyle = align ? {
    textAlign: align
  } : null;
  const handleKey = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnter(idx, block);
    } else if (e.key === "Backspace" && e.target.value === "") {
      e.preventDefault();
      onBackspace(idx);
    } else if (e.key === "/" && e.target.value === "") {
      onSlash(idx);
    }
  };
  const input = (cls, extra) => /*#__PURE__*/React.createElement("input", {
    ref: ref,
    className: "blk " + cls,
    style: baseStyle,
    value: block.text || "",
    placeholder: extra,
    onChange: e => onChange(idx, {
      text: e.target.value
    }),
    onKeyDown: handleKey
  });
  if (block.type === "heading") {
    const lvl = block.props && block.props.level || 1;
    return input("blk-h" + lvl, "Heading " + lvl);
  }
  if (block.type === "bulletListItem") return /*#__PURE__*/React.createElement("div", {
    className: "blk-li"
  }, /*#__PURE__*/React.createElement("span", {
    className: "blk-bullet"
  }, "\u2022"), input("", "List"));
  if (block.type === "numberedListItem") return /*#__PURE__*/React.createElement("div", {
    className: "blk-li"
  }, /*#__PURE__*/React.createElement("span", {
    className: "blk-num"
  }, block.props && block.props.index || 1, "."), input("", "List"));
  if (block.type === "checkListItem") return /*#__PURE__*/React.createElement("div", {
    className: "blk-todo"
  }, /*#__PURE__*/React.createElement("span", {
    className: "blk-check" + (block.checked ? " on" : ""),
    onClick: () => onChange(idx, {
      checked: !block.checked
    })
  }, block.checked && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 11,
    color: "var(--fg-on-accent)"
  })), /*#__PURE__*/React.createElement("input", {
    ref: ref,
    className: "blk" + (block.checked ? " blk-done" : ""),
    value: block.text || "",
    placeholder: "To-do",
    onChange: e => onChange(idx, {
      text: e.target.value
    }),
    onKeyDown: handleKey
  }));
  if (block.type === "toggleListItem") return /*#__PURE__*/React.createElement("div", {
    className: "blk-toggle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "blk-toggle-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "blk-toggle-chev",
    onClick: () => onChange(idx, {
      open: !block.open
    })
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 14,
    cls: "icon-sm" + (block.open ? " open" : ""),
    color: "var(--fg-3)"
  })), input("", "Toggle")), block.open && /*#__PURE__*/React.createElement("div", {
    className: "blk-toggle-body"
  }, block.body || "Empty toggle. Click to add content."));
  if (block.type === "quote") return /*#__PURE__*/React.createElement("div", {
    className: "blk-quote"
  }, input("", "Quote"));
  if (block.type === "codeBlock") return /*#__PURE__*/React.createElement("div", {
    className: "blk-code"
  }, /*#__PURE__*/React.createElement("textarea", {
    ref: ref,
    className: "blk blk-codearea",
    value: block.text || "",
    placeholder: "// code",
    rows: Math.max(1, (block.text || "").split("\n").length),
    onChange: e => onChange(idx, {
      text: e.target.value
    }),
    onKeyDown: e => {
      if (e.key === "Backspace" && e.target.value === "") {
        e.preventDefault();
        onBackspace(idx);
      }
    }
  }));
  if (block.type === "callout") return /*#__PURE__*/React.createElement("div", {
    className: "blk-callout"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "info",
    size: 16,
    cls: "icon-sm",
    color: "var(--accent)"
  }), input("", "Callout"));
  if (block.type === "divider") return /*#__PURE__*/React.createElement("div", {
    className: "blk-divider"
  });
  if (block.type === "issue") {
    const iss = issues.find(x => x.id === block.ref);
    return /*#__PURE__*/React.createElement("div", {
      className: "blk-issue",
      onClick: () => iss && onOpenIssue(iss)
    }, iss ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusIcon, {
      status: iss.status,
      size: 14
    }), /*#__PURE__*/React.createElement("span", {
      className: "id"
    }, iss.id), /*#__PURE__*/React.createElement("span", {
      className: "blk-issue-t"
    }, iss.title), /*#__PURE__*/React.createElement(PriorityIcon, {
      priority: iss.priority,
      size: 14
    })) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-4)"
      }
    }, "Link an issue\u2026"));
  }
  return /*#__PURE__*/React.createElement("textarea", {
    ref: ref,
    className: "blk blk-p",
    style: baseStyle,
    rows: 1,
    value: block.text || "",
    placeholder: "Write, or press '/' for commands",
    onChange: e => {
      onChange(idx, {
        text: e.target.value
      });
      e.target.style.height = "auto";
      e.target.style.height = e.target.scrollHeight + "px";
    },
    onKeyDown: handleKey
  });
}
function DocEditor({
  doc,
  issues,
  onUpdate,
  onOpenIssue
}) {
  const refs = React.useRef({});
  const focusIdx = React.useRef(null);
  const [slash, setSlash] = React.useState(null); // { idx, q, active }
  const registerRef = (i, el) => {
    refs.current[i] = el;
  };
  const blocks = doc.blocks;
  const setBlocks = nb => onUpdate(doc.id, {
    blocks: nb
  });
  const change = (i, patch) => setBlocks(blocks.map((b, j) => j === i ? {
    ...b,
    ...patch
  } : b));
  const enter = (i, block) => {
    const nb = blocks.slice();
    const carry = ["bulletListItem", "numberedListItem", "checkListItem"].includes(block.type) && (block.text || "").trim() !== "" ? block.type : "paragraph";
    nb.splice(i + 1, 0, {
      type: carry,
      text: "",
      props: {}
    });
    setBlocks(nb);
    focusIdx.current = i + 1;
  };
  const backspace = i => {
    if (blocks.length <= 1) return;
    const nb = blocks.slice();
    nb.splice(i, 1);
    setBlocks(nb);
    focusIdx.current = Math.max(0, i - 1);
  };
  const openSlash = i => setSlash({
    idx: i,
    q: "",
    active: 0
  });
  const pickSlash = it => {
    const i = slash.idx;
    setBlocks(blocks.map((b, j) => j === i ? {
      type: it.type,
      text: it.type === "issue" ? "" : b.text || "",
      ref: it.type === "issue" ? issues[0] && issues[0].id : undefined,
      props: it.props || {},
      open: it.type === "toggleListItem" ? true : undefined
    } : b));
    setSlash(null);
    focusIdx.current = i;
  };
  React.useEffect(() => {
    if (focusIdx.current != null && refs.current[focusIdx.current]) {
      refs.current[focusIdx.current].focus();
      focusIdx.current = null;
    }
  });
  // capture typing into slash query
  React.useEffect(() => {
    if (!slash) return;
    const onKey = e => {
      if (e.key === "Escape") {
        setSlash(null);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlash(s => ({
          ...s,
          active: s.active + 1
        }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlash(s => ({
          ...s,
          active: Math.max(0, s.active - 1)
        }));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const items = SLASH_ITEMS.filter(it => (it.title + " " + it.alias).toLowerCase().includes(slash.q.toLowerCase()));
        const it = items[slash.active % Math.max(1, items.length)];
        if (it) pickSlash(it);
        return;
      }
      if (e.key === "Backspace") {
        setSlash(s => s.q === "" ? null : {
          ...s,
          q: s.q.slice(0, -1),
          active: 0
        });
        return;
      }
      if (e.key.length === 1) {
        setSlash(s => ({
          ...s,
          q: s.q + e.key,
          active: 0
        }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slash]);
  return /*#__PURE__*/React.createElement("div", {
    className: "doc-editor"
  }, /*#__PURE__*/React.createElement("input", {
    className: "doc-title-input",
    value: doc.title,
    onChange: e => onUpdate(doc.id, {
      title: e.target.value
    }),
    placeholder: "Untitled"
  }), /*#__PURE__*/React.createElement("div", {
    className: "doc-meta"
  }, "Edited just now \xB7 ", blocks.length, " blocks"), /*#__PURE__*/React.createElement("div", {
    className: "doc-blocks"
  }, blocks.map((b, i) => /*#__PURE__*/React.createElement("div", {
    className: "blk-wrap",
    key: i
  }, /*#__PURE__*/React.createElement(BlockRow, {
    block: b,
    idx: i,
    issues: issues,
    onChange: change,
    onEnter: enter,
    onBackspace: backspace,
    onSlash: openSlash,
    onOpenIssue: onOpenIssue,
    registerRef: registerRef
  }), slash && slash.idx === i && /*#__PURE__*/React.createElement(SlashMenu, {
    q: slash.q,
    active: slash.active,
    onPick: pickSlash,
    onClose: () => setSlash(null)
  })))));
}
function Docs({
  docs,
  issues,
  onUpdate,
  onCreate,
  onOpenIssue,
  onDelete
}) {
  const [selId, setSelId] = React.useState(docs[0] ? docs[0].id : null);
  const doc = docs.find(d => d.id === selId);
  React.useEffect(() => {
    if (!doc && docs[0]) setSelId(docs[0].id);
  }, [docs.length]);
  return /*#__PURE__*/React.createElement("div", {
    className: "docs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "docs-tree"
  }, /*#__PURE__*/React.createElement("div", {
    className: "docs-tree-head"
  }, /*#__PURE__*/React.createElement("span", null, "Documents"), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => {
      const id = onCreate();
      if (id) setSelId(id);
    },
    title: "New document"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 15
  }))), docs.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.id,
    className: "docs-tree-item" + (selId === d.id ? " active" : ""),
    onClick: () => setSelId(d.id)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: d.icon || "file-text",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, d.title || "Untitled"), /*#__PURE__*/React.createElement("button", {
    className: "tree-del",
    title: "Delete",
    onClick: e => {
      e.stopPropagation();
      onDelete && onDelete(d.id);
      if (selId === d.id) {
        const rest = docs.filter(x => x.id !== d.id);
        setSelId(rest[0] ? rest[0].id : null);
      }
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 13
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "docs-main"
  }, doc ? /*#__PURE__*/React.createElement(DocEditor, {
    doc: doc,
    issues: issues,
    onUpdate: onUpdate,
    onOpenIssue: onOpenIssue
  }) : /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "file-text",
    size: 40,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No document selected"))));
}
Object.assign(window, {
  Docs,
  DOC_SEED,
  SLASH_ITEMS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Docs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Forms.jsx
try { (() => {
// Forms.jsx — survey builder + responses, Formbricks-style (formbricks/formbricks)
const FORM_SEED = {
  forms: [{
    id: "f1",
    name: "Onboarding feedback",
    status: "live",
    responses: 42,
    fields: [{
      id: "q1",
      type: "rating",
      label: "How easy was getting started?",
      scale: 5
    }, {
      id: "q2",
      type: "choice",
      label: "Which feature did you use first?",
      options: ["Issues", "Projects", "Docs", "Cycles"]
    }, {
      id: "q3",
      type: "text",
      label: "What was confusing, if anything?"
    }]
  }, {
    id: "f2",
    name: "Churn survey",
    status: "draft",
    responses: 0,
    fields: [{
      id: "q1",
      type: "choice",
      label: "Why are you leaving?",
      options: ["Too expensive", "Missing features", "Switched tools"]
    }, {
      id: "q2",
      type: "text",
      label: "Anything we could have done?"
    }]
  }]
};
const FIELD_TYPES = [{
  type: "text",
  icon: "align-left",
  label: "Text"
}, {
  type: "choice",
  icon: "circle-dot",
  label: "Multiple choice"
}, {
  type: "rating",
  icon: "star",
  label: "Rating"
}];
function FieldEditor({
  field,
  onChange,
  onDelete
}) {
  const t = FIELD_TYPES.find(x => x.type === field.type);
  return /*#__PURE__*/React.createElement("div", {
    className: "fb-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-field-head"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: t.icon,
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("input", {
    className: "fb-q-input",
    value: field.label,
    onChange: e => onChange({
      ...field,
      label: e.target.value
    }),
    placeholder: "Question"
  }), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onDelete
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 14
  }))), field.type === "rating" && /*#__PURE__*/React.createElement("div", {
    className: "fb-rating"
  }, Array.from({
    length: field.scale || 5
  }).map((_, i) => /*#__PURE__*/React.createElement(Lic, {
    key: i,
    name: "star",
    size: 18,
    color: "var(--fg-4)"
  }))), field.type === "choice" && /*#__PURE__*/React.createElement("div", {
    className: "fb-options"
  }, field.options.map((o, i) => /*#__PURE__*/React.createElement("div", {
    className: "fb-opt",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "fb-radio"
  }), o))), field.type === "text" && /*#__PURE__*/React.createElement("div", {
    className: "fb-text-preview"
  }, "Short answer\u2026"));
}
function Forms({
  data,
  onUpdate
}) {
  const [selId, setSelId] = React.useState(data.forms[0] ? data.forms[0].id : null);
  const [tab, setTab] = React.useState("build");
  const [addOpen, setAddOpen] = React.useState(false);
  const form = data.forms.find(f => f.id === selId);
  const setForm = patch => onUpdate({
    ...data,
    forms: data.forms.map(f => f.id === selId ? {
      ...f,
      ...patch
    } : f)
  });
  const addField = ft => {
    const f = {
      id: "q" + Date.now(),
      type: ft.type,
      label: "Untitled question",
      ...(ft.type === "rating" ? {
        scale: 5
      } : {}),
      ...(ft.type === "choice" ? {
        options: ["Option 1", "Option 2"]
      } : {})
    };
    setForm({
      fields: [...form.fields, f]
    });
    setAddOpen(false);
  };
  const newForm = () => {
    const id = "f" + Date.now();
    onUpdate({
      ...data,
      forms: [...data.forms, {
        id,
        name: "Untitled form",
        status: "draft",
        responses: 0,
        fields: []
      }]
    });
    setSelId(id);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "docs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "docs-tree"
  }, /*#__PURE__*/React.createElement("div", {
    className: "docs-tree-head"
  }, /*#__PURE__*/React.createElement("span", null, "Forms"), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: newForm
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 15
  }))), data.forms.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    className: "docs-tree-item" + (selId === f.id ? " active" : ""),
    onClick: () => setSelId(f.id)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "clipboard-list",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, f.name), /*#__PURE__*/React.createElement("span", {
    className: "fb-badge " + f.status
  }, f.status), /*#__PURE__*/React.createElement("button", {
    className: "tree-del",
    title: "Delete",
    onClick: e => {
      e.stopPropagation();
      const rest = data.forms.filter(x => x.id !== f.id);
      onUpdate({
        ...data,
        forms: rest
      });
      if (selId === f.id) setSelId(rest[0] ? rest[0].id : null);
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 13
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "docs-main"
  }, form ? /*#__PURE__*/React.createElement("div", {
    className: "fb-editor"
  }, /*#__PURE__*/React.createElement("input", {
    className: "doc-title-input",
    value: form.name,
    onChange: e => setForm({
      name: e.target.value
    }),
    placeholder: "Form name"
  }), /*#__PURE__*/React.createElement("div", {
    className: "fb-tabs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "seg" + (tab === "build" ? " active" : ""),
    onClick: () => setTab("build")
  }, "Build"), /*#__PURE__*/React.createElement("div", {
    className: "seg" + (tab === "responses" ? " active" : ""),
    onClick: () => setTab("responses")
  }, "Responses ", /*#__PURE__*/React.createElement("span", {
    className: "seg-count"
  }, form.responses))), tab === "build" ? /*#__PURE__*/React.createElement("div", {
    className: "fb-build"
  }, form.fields.map(f => /*#__PURE__*/React.createElement(FieldEditor, {
    key: f.id,
    field: f,
    onChange: nf => setForm({
      fields: form.fields.map(x => x.id === f.id ? nf : x)
    }),
    onDelete: () => setForm({
      fields: form.fields.filter(x => x.id !== f.id)
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => setAddOpen(!addOpen)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 14,
    cls: "icon-sm"
  }), "Add question"), addOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: () => setAddOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      position: "absolute",
      top: 36,
      left: 0,
      width: 200,
      zIndex: 45
    }
  }, FIELD_TYPES.map(ft => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: ft.type,
    onClick: () => addField(ft)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: ft.icon,
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), ft.label)))))) : /*#__PURE__*/React.createElement("div", {
    className: "fb-responses"
  }, form.responses === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      height: 200
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "inbox",
    size: 36,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No responses yet")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "fb-resp-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cs-num"
  }, form.responses), /*#__PURE__*/React.createElement("span", {
    className: "cs-lab"
  }, "responses"), /*#__PURE__*/React.createElement("span", {
    className: "fb-resp-rate"
  }, "68% completion")), form.fields.filter(f => f.type === "rating").map(f => /*#__PURE__*/React.createElement("div", {
    className: "fb-resp-card",
    key: f.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-resp-q"
  }, f.label), /*#__PURE__*/React.createElement("div", {
    className: "fb-resp-bigrating"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cs-num"
  }, "4.2"), /*#__PURE__*/React.createElement(Lic, {
    name: "star",
    size: 16,
    color: "#F2C94C"
  })))), form.fields.filter(f => f.type === "choice").map(f => /*#__PURE__*/React.createElement("div", {
    className: "fb-resp-card",
    key: f.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-resp-q"
  }, f.label), f.options.map((o, i) => {
    const pct = [48, 27, 15, 10][i] || 5;
    return /*#__PURE__*/React.createElement("div", {
      className: "fb-resp-bar-row",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "fb-resp-bar-lab"
    }, o), /*#__PURE__*/React.createElement("div", {
      className: "fb-resp-bar"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: pct + "%"
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "fb-resp-pct"
    }, pct, "%"));
  })))))) : /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No form selected"))));
}
Object.assign(window, {
  Forms,
  FORM_SEED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Forms.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Graph.jsx
try { (() => {
// Graph.jsx — knowledge graph (backlinks/relations), Obsidian/Foam-style (d3-force model)
function buildGraphModel(issues, projects, docs) {
  const nodes = [],
    edges = [];
  const add = (id, label, type) => {
    if (!nodes.find(n => n.id === id)) nodes.push({
      id,
      label,
      type
    });
  };
  projects.forEach(p => add("p:" + p.id, p.name, "project"));
  issues.forEach(i => add("i:" + i.id, i.id, "issue"));
  docs.forEach(d => add("d:" + d.id, d.title, "doc"));
  // issue -> project
  issues.forEach(i => {
    if (i.project) {
      const p = projects.find(x => x.name === i.project);
      if (p) edges.push({
        s: "i:" + i.id,
        t: "p:" + p.id,
        kind: "belongs_to"
      });
    }
  });
  // issue -> label (create label nodes)
  issues.forEach(i => (i.labels || []).forEach(l => {
    add("l:" + l, l, "label");
    edges.push({
      s: "i:" + i.id,
      t: "l:" + l,
      kind: "tagged_with"
    });
  }));
  // doc -> issue (issue-embed blocks)
  docs.forEach(d => (d.blocks || []).forEach(b => {
    if (b.type === "issue" && b.ref) {
      if (issues.find(x => x.id === b.ref)) edges.push({
        s: "d:" + d.id,
        t: "i:" + b.ref,
        kind: "references"
      });
    }
  }));
  return {
    nodes,
    edges
  };
}

// tiny deterministic force layout (repulsion + spring + centering)
function layoutGraph(nodes, edges, W, H, seed = 1) {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const pos = {};
  nodes.forEach((n, i) => {
    const a = i / nodes.length * Math.PI * 2;
    pos[n.id] = {
      x: W / 2 + Math.cos(a) * 160 + rnd() * 40,
      y: H / 2 + Math.sin(a) * 130 + rnd() * 40,
      vx: 0,
      vy: 0
    };
  });
  const adj = edges.map(e => [e.s, e.t]);
  for (let it = 0; it < 240; it++) {
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      const pa = pos[nodes[a].id],
        pb = pos[nodes[b].id];
      let dx = pa.x - pb.x,
        dy = pa.y - pb.y;
      let d2 = dx * dx + dy * dy + 0.01;
      const f = 2400 / d2;
      const d = Math.sqrt(d2);
      dx /= d;
      dy /= d;
      pa.vx += dx * f;
      pa.vy += dy * f;
      pb.vx -= dx * f;
      pb.vy -= dy * f;
    }
    adj.forEach(([sa, ta]) => {
      const pa = pos[sa],
        pb = pos[ta];
      if (!pa || !pb) return;
      let dx = pb.x - pa.x,
        dy = pb.y - pa.y;
      const d = Math.sqrt(dx * dx + dy * dy) + .01;
      const f = (d - 96) * 0.02;
      dx /= d;
      dy /= d;
      pa.vx += dx * f;
      pa.vy += dy * f;
      pb.vx -= dx * f;
      pb.vy -= dy * f;
    });
    nodes.forEach(n => {
      const p = pos[n.id];
      p.vx += (W / 2 - p.x) * 0.008;
      p.vy += (H / 2 - p.y) * 0.008;
      p.x += p.vx *= 0.82;
      p.y += p.vy *= 0.82;
    });
  }
  return pos;
}
const GRAPH_COLORS = {
  project: "#4CB782",
  issue: "#4C8DFF",
  doc: "#BB6BD9",
  label: "#F2994A"
};
function Graph({
  issues,
  projects,
  docs,
  onOpenIssue
}) {
  const W = 900,
    H = 560;
  const {
    nodes,
    edges
  } = React.useMemo(() => buildGraphModel(issues, projects, docs), [issues, projects, docs]);
  const [pos, setPos] = React.useState(() => layoutGraph(nodes, edges, W, H));
  const [hover, setHover] = React.useState(null);
  const [view, setView] = React.useState({
    x: 0,
    y: 0,
    z: 1
  });
  const [filters, setFilters] = React.useState({
    project: true,
    issue: true,
    doc: true,
    label: true
  });
  const svgRef = React.useRef(null);
  const drag = React.useRef(null);
  React.useEffect(() => {
    setPos(layoutGraph(nodes, edges, W, H));
  }, [nodes.length, edges.length]);
  const neighbors = React.useMemo(() => {
    if (!hover) return null;
    const set = new Set([hover]);
    edges.forEach(e => {
      if (e.s === hover) set.add(e.t);
      if (e.t === hover) set.add(e.s);
    });
    return set;
  }, [hover, edges]);
  const onWheel = e => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.1 : 0.9;
    setView(v => ({
      ...v,
      z: Math.max(0.4, Math.min(2.5, v.z * f))
    }));
  };
  const onDown = e => {
    if (e.target === svgRef.current || e.target.tagName === "rect") drag.current = {
      x: e.clientX,
      y: e.clientY,
      ox: view.x,
      oy: view.y
    };
  };
  const onMove = e => {
    if (drag.current) setView(v => ({
      ...v,
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y)
    }));
  };
  const onUp = () => {
    drag.current = null;
  };
  const visible = n => filters[n.type];
  return /*#__PURE__*/React.createElement("div", {
    className: "content gr-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gr-toolbar"
  }, Object.keys(GRAPH_COLORS).map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    className: "gr-legend" + (filters[t] ? "" : " off"),
    onClick: () => setFilters(f => ({
      ...f,
      [t]: !f[t]
    }))
  }, /*#__PURE__*/React.createElement("span", {
    className: "gr-dot",
    style: {
      background: GRAPH_COLORS[t]
    }
  }), t === "doc" ? "Documents" : t.charAt(0).toUpperCase() + t.slice(1) + "s")), /*#__PURE__*/React.createElement("span", {
    className: "gr-count"
  }, nodes.filter(visible).length, " nodes \xB7 ", edges.length, " links")), /*#__PURE__*/React.createElement("svg", {
    ref: svgRef,
    className: "gr-svg",
    viewBox: `0 0 ${W} ${H}`,
    onWheel: onWheel,
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerCancel: onUp,
    onPointerLeave: onUp
  }, /*#__PURE__*/React.createElement("rect", {
    width: W,
    height: H,
    fill: "transparent"
  }), /*#__PURE__*/React.createElement("g", {
    transform: `translate(${view.x} ${view.y}) scale(${view.z})`
  }, edges.map((e, i) => {
    const a = pos[e.s],
      b = pos[e.t];
    if (!a || !b) return null;
    const na = nodes.find(n => n.id === e.s),
      nb = nodes.find(n => n.id === e.t);
    if (!visible(na) || !visible(nb)) return null;
    const dim = neighbors && !(neighbors.has(e.s) && neighbors.has(e.t));
    return /*#__PURE__*/React.createElement("line", {
      key: i,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: "var(--border-strong)",
      strokeWidth: dim ? 0.6 : 1.2,
      opacity: dim ? 0.25 : 0.8
    });
  }), nodes.filter(visible).map(n => {
    const p = pos[n.id];
    if (!p) return null;
    const r = n.type === "project" ? 9 : n.type === "label" ? 5 : 7;
    const dim = neighbors && !neighbors.has(n.id);
    return /*#__PURE__*/React.createElement("g", {
      key: n.id,
      transform: `translate(${p.x} ${p.y})`,
      style: {
        cursor: "pointer",
        opacity: dim ? 0.3 : 1
      },
      onPointerEnter: () => setHover(n.id),
      onPointerLeave: () => setHover(null),
      onClick: () => {
        if (n.type === "issue") {
          const it = issues.find(x => x.id === n.id.slice(2));
          if (it) onOpenIssue(it);
        }
      }
    }, /*#__PURE__*/React.createElement("circle", {
      r: r,
      fill: GRAPH_COLORS[n.type],
      stroke: "var(--bg-app)",
      strokeWidth: "1.5"
    }), (view.z > 0.7 || hover === n.id) && /*#__PURE__*/React.createElement("text", {
      x: r + 4,
      y: 3.5,
      className: "gr-label",
      style: {
        fontWeight: hover === n.id ? 600 : 500
      }
    }, n.label));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "gr-zoom"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setView(v => ({
      ...v,
      z: Math.max(0.4, v.z * 0.9)
    }))
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "minus",
    size: 15
  })), /*#__PURE__*/React.createElement("span", {
    onClick: () => setView({
      x: 0,
      y: 0,
      z: 1
    })
  }, Math.round(view.z * 100), "%"), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setView(v => ({
      ...v,
      z: Math.min(2.5, v.z * 1.1)
    }))
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 15
  }))));
}
Object.assign(window, {
  Graph
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Graph.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ImportFlow.jsx
try { (() => {
// ImportFlow.jsx — file import pipeline (Detect→Parse→Preview→Map→Save)
// Parser basis: SheetJS (csv/xlsx), PDF.js (pdf), Mammoth (docx), Turndown/Readability (html), markdown-it (md)
const IMPORT_SAMPLES = [{
  name: "reading-list.csv",
  kind: "csv",
  icon: "file-spreadsheet",
  parser: "SheetJS",
  cols: ["title", "type", "year", "url"],
  rows: [["Clean Code", "Book", "2008", "—"], ["MapReduce", "Paper", "2004", "research.google"], ["Refactoring", "Book", "1999", "—"]]
}, {
  name: "spec.md",
  kind: "md",
  icon: "file-text",
  parser: "markdown-it"
}, {
  name: "q3-report.pdf",
  kind: "pdf",
  icon: "file",
  parser: "PDF.js"
}, {
  name: "contacts.xlsx",
  kind: "xlsx",
  icon: "file-spreadsheet",
  parser: "SheetJS",
  cols: ["name", "email", "company"],
  rows: [["Jane Doe", "jane@acme.com", "Acme"], ["Tom Lee", "tom@globex.com", "Globex"]]
}, {
  name: "article.html",
  kind: "html",
  icon: "file-code",
  parser: "Turndown + Readability"
}];
const IMPORT_DEST_FIELD_TYPES = [{
  type: "text",
  icon: "align-left"
}, {
  type: "number",
  icon: "hash"
}, {
  type: "select",
  icon: "chevron-down-circle"
}, {
  type: "url",
  icon: "link"
}, {
  type: "date",
  icon: "calendar"
}];
function ImpTypePill({
  value,
  onChange
}) {
  const [open, setOpen] = React.useState(false);
  const t = IMPORT_DEST_FIELD_TYPES.find(x => x.type === value) || IMPORT_DEST_FIELD_TYPES[0];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "set-select",
    onClick: () => setOpen(!open)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: t.icon,
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), value, " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 12,
    cls: "icon-sm"
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: () => setOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 32,
      right: 0,
      width: 150,
      zIndex: 45
    }
  }, IMPORT_DEST_FIELD_TYPES.map(ft => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: ft.type,
    onClick: () => {
      onChange(ft.type);
      setOpen(false);
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: ft.icon,
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), ft.type)))));
}
function ImportFlow({
  onImportToDb,
  onImportToDoc,
  history,
  onLog
}) {
  const [over, setOver] = React.useState(false);
  const [file, setFile] = React.useState(null);
  const [dest, setDest] = React.useState("database");
  const [maps, setMaps] = React.useState([]);
  const [done, setDone] = React.useState(false);
  const [pasteOpen, setPasteOpen] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");
  const STEPS = ["Detect", "Parse", "Preview", "Map", "Save"];
  const isTable = file && file.cols;
  const stepIdx = !file ? 0 : done ? 4 : 3;
  const pick = f => {
    setFile(f);
    setDone(false);
    setMaps((f.cols || []).map((c, i) => ["text", "select", "number", "url", "date"][i] || "text"));
  };
  const parsePasted = () => {
    const {
      format,
      rows
    } = window.parseAny(pasteText);
    if (!format || rows.length < 2) {
      pick(IMPORT_SAMPLES[0]);
      setPasteOpen(false);
      return;
    }
    const cols = rows[0];
    const body = rows.slice(1);
    const maps = cols.map((_, i) => window.inferType(body.map(r => r[i])));
    setFile({
      name: "pasted." + format,
      kind: format,
      icon: "clipboard",
      parser: format === "md" ? "markdown table" : format.toUpperCase() + " parser",
      cols,
      rows: body
    });
    setMaps(maps);
    setDone(false);
    setPasteOpen(false);
  };
  const save = () => {
    if (isTable && dest === "database") onImportToDb({
      ...file,
      maps
    });else onImportToDoc(file);
    onLog({
      id: "src" + Date.now(),
      name: file.name,
      kind: file.kind,
      size: "—",
      into: dest === "database" ? "Roadmap" : "Documents",
      imported: "now"
    });
    setDone(true);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "imp"
  }, /*#__PURE__*/React.createElement("div", {
    className: "imp-dropzone" + (over ? " over" : ""),
    onDragOver: e => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: e => {
      e.preventDefault();
      setOver(false);
      pick(IMPORT_SAMPLES[0]);
    },
    onClick: () => pick(IMPORT_SAMPLES[0])
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "upload-cloud",
    size: 32,
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "imp-dz-title"
  }, "Drop a file to import, or click to pick a sample"), /*#__PURE__*/React.createElement("div", {
    className: "imp-dz-sub"
  }, "Parsed in code \u2014 no AI. The original is always kept."), /*#__PURE__*/React.createElement("div", {
    className: "imp-formats"
  }, ["MD", "TXT", "CSV", "XLSX", "PDF", "DOCX", "HTML", "JSON"].map(f => /*#__PURE__*/React.createElement("span", {
    className: "imp-fmt",
    key: f
  }, f)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-chip",
    onClick: () => setPasteOpen(!pasteOpen)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "clipboard-paste",
    size: 13,
    cls: "icon-sm"
  }), "Paste CSV / TSV / Markdown"), IMPORT_SAMPLES.map(f => /*#__PURE__*/React.createElement("span", {
    key: f.name,
    className: "v-chip",
    onClick: () => pick(f)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: f.icon,
    size: 13,
    cls: "icon-sm"
  }), f.name))), pasteOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    className: "v-input",
    style: {
      width: "100%",
      height: 120,
      padding: 12,
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      resize: "vertical"
    },
    placeholder: "name,role,year\nJane,PM,2024\nTom,Eng,2023",
    value: pasteText,
    onChange: e => setPasteText(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    style: {
      marginTop: 8
    },
    onClick: parsePasted
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "wand-2",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-on-accent)"
  }), "Parse & detect types")), file && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "imp-steps"
  }, STEPS.map((s, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: s
  }, /*#__PURE__*/React.createElement("span", {
    className: "imp-step" + (i <= stepIdx ? " on" : "")
  }, i < stepIdx && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 12,
    cls: "icon-sm"
  }), s), i < STEPS.length - 1 && /*#__PURE__*/React.createElement("span", {
    className: "imp-step-sep"
  }, "\u203A")))), done ? /*#__PURE__*/React.createElement("div", {
    className: "imp-done"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "check-circle-2",
    size: 20,
    color: "var(--label-green)"
  }), /*#__PURE__*/React.createElement("span", null, "Imported ", /*#__PURE__*/React.createElement("b", null, file.name), " into ", dest === "database" ? "Roadmap" : "Documents", " \xB7 indexed for search."), /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => setFile(null)
  }, "Import another")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "imp-preview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "imp-preview-head"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: file.icon,
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "imp-fname"
  }, file.name), /*#__PURE__*/React.createElement("span", {
    className: "imp-fmt"
  }, file.parser), /*#__PURE__*/React.createElement("span", {
    className: "imp-meta"
  }, isTable ? `${file.rows.length} rows · ${file.cols.length} cols` : "text extracted")), isTable ? /*#__PURE__*/React.createElement("table", {
    className: "db-table",
    style: {
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, file.cols.map(c => /*#__PURE__*/React.createElement("th", {
    key: c
  }, /*#__PURE__*/React.createElement("span", {
    className: "db-th"
  }, c))))), /*#__PURE__*/React.createElement("tbody", null, file.rows.map((row, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, row.map((v, j) => /*#__PURE__*/React.createElement("td", {
    key: j,
    className: "db-td"
  }, v)))))) : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      color: "var(--fg-3)",
      font: "var(--fw-regular) 13px/1.7 var(--font-sans)"
    }
  }, "# ", file.name.split(".")[0], /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Headings and paragraphs are detected and converted to editable blocks. The original file is retained and downloadable.")), /*#__PURE__*/React.createElement("div", {
    className: "imp-map"
  }, /*#__PURE__*/React.createElement("div", {
    className: "imp-map-dest"
  }, /*#__PURE__*/React.createElement("span", {
    className: "imp-lab"
  }, "Save into"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4
    }
  }, [["database", "Roadmap"], ["document", "Document"]].map(([k, l]) => /*#__PURE__*/React.createElement("span", {
    key: k,
    className: "ks-vtab" + (dest === k ? " active" : ""),
    onClick: () => setDest(k),
    style: {
      height: 28,
      padding: "0 11px",
      display: "inline-flex",
      alignItems: "center",
      borderRadius: "var(--r-pill)",
      cursor: "pointer",
      font: "var(--fw-medium) 13px var(--font-sans)",
      color: dest === k ? "var(--fg)" : "var(--fg-3)",
      background: dest === k ? "var(--bg-active)" : "transparent"
    }
  }, l)))), isTable && dest === "database" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "imp-cap"
  }, "Field mapping"), file.cols.map((c, i) => /*#__PURE__*/React.createElement("div", {
    className: "imp-map-row",
    key: c
  }, /*#__PURE__*/React.createElement("span", {
    className: "imp-map-src"
  }, c), /*#__PURE__*/React.createElement(Lic, {
    name: "arrow-right",
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement(ImpTypePill, {
    value: maps[i] || "text",
    onChange: t => setMaps(m => m.map((x, j) => j === i ? t : x))
  })))), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    style: {
      marginTop: 14,
      alignSelf: "flex-start"
    },
    onClick: save
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-on-accent)"
  }), "Import & index")))), /*#__PURE__*/React.createElement("div", {
    className: "imp-history"
  }, /*#__PURE__*/React.createElement("div", {
    className: "imp-cap",
    style: {
      padding: "8px 0"
    }
  }, "Import history"), history.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--fg-4)",
      font: "var(--fw-medium) 12px var(--font-sans)"
    }
  }, "Nothing imported yet."), history.map(s => /*#__PURE__*/React.createElement("div", {
    className: "imp-src-row",
    key: s.id
  }, /*#__PURE__*/React.createElement(Lic, {
    name: s.kind === "pdf" ? "file" : s.kind === "csv" || s.kind === "xlsx" ? "file-spreadsheet" : "file-code",
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "imp-fname"
  }, s.name), /*#__PURE__*/React.createElement("span", {
    className: "imp-fmt"
  }, s.kind.toUpperCase()), /*#__PURE__*/React.createElement("span", {
    className: "imp-meta"
  }, "into ", s.into, " \xB7 ", s.imported)))));
}
Object.assign(window, {
  ImportFlow
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ImportFlow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Inbox.jsx
try { (() => {
// Inbox.jsx — Linear-style notifications inbox (master list + reading pane)
const INBOX_SEED = [{
  id: "n1",
  type: "Assignments",
  icon: "user-plus",
  actor: "Alex Park",
  text: "assigned an issue to you",
  issue: "VEC-3",
  title: "Connect your tools",
  time: "2h",
  read: false,
  snoozed: false,
  status: "progress"
}, {
  id: "n2",
  type: "Comments and replies",
  icon: "message-circle",
  actor: "Jordan Lee",
  text: "commented",
  issue: "VEC-8",
  title: "Polish onboarding copy",
  time: "5h",
  read: false,
  snoozed: false,
  status: "review"
}, {
  id: "n3",
  type: "Status changes",
  icon: "circle-check",
  actor: "김혁규",
  text: "marked as Done",
  issue: "VEC-5",
  title: "Invite your teammates",
  time: "1d",
  read: true,
  snoozed: false,
  status: "done"
}, {
  id: "n4",
  type: "Mentions",
  icon: "at-sign",
  actor: "Alex Park",
  text: "mentioned you",
  issue: "VEC-2",
  title: "Set up your teams",
  time: "2d",
  read: true,
  snoozed: true,
  status: "todo"
}, {
  id: "n5",
  type: "Reactions",
  icon: "smile",
  actor: "Jordan Lee",
  text: "reacted 👍 to your comment",
  issue: "VEC-1",
  title: "Get familiar with Vector",
  time: "3d",
  read: true,
  snoozed: false,
  status: "todo"
}];
function InboxItem({
  n,
  active,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ibx-item" + (active ? " active" : "") + (n.read ? " read" : ""),
    onClick: onClick
  }, !n.read && /*#__PURE__*/React.createElement("span", {
    className: "ibx-unread"
  }), /*#__PURE__*/React.createElement("span", {
    className: "ibx-ic"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: n.icon,
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "ibx-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ibx-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ibx-actor"
  }, n.actor), " ", /*#__PURE__*/React.createElement("span", {
    className: "ibx-text"
  }, n.text)), /*#__PURE__*/React.createElement("div", {
    className: "ibx-sub"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ibx-id"
  }, n.issue), " ", n.title)), /*#__PURE__*/React.createElement("span", {
    className: "ibx-time"
  }, n.time));
}
function Inbox({
  onOpenIssue
}) {
  const [items, setItems] = React.useState(INBOX_SEED);
  const [selId, setSelId] = React.useState(null);
  const [ordering, setOrdering] = React.useState("Newest");
  const [showSnoozed, setShowSnoozed] = React.useState(false);
  const [showRead, setShowRead] = React.useState(true);
  const [unreadFirst, setUnreadFirst] = React.useState(false);
  const [menu, setMenu] = React.useState(null); // 'filter' | 'display'
  const [subHover, setSubHover] = React.useState(null);
  const [filters, setFilters] = React.useState({});
  const toggleFilter = (key, opt) => setFilters(f => {
    const cur = f[key] || [];
    const next = cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt];
    const n = {
      ...f,
      [key]: next
    };
    if (!next.length) delete n[key];
    return n;
  });
  const matchFilters = n => Object.entries(filters).every(([k, vals]) => {
    if (!vals.length) return true;
    if (k === "Notification type") return vals.includes(n.type);
    if (k === "From") return vals.includes(n.actor);
    return true;
  });
  let list = items.filter(n => (showSnoozed || !n.snoozed) && (showRead || !n.read) && matchFilters(n));
  if (ordering === "Oldest") list = [...list].reverse();
  if (unreadFirst) list = [...list].sort((a, b) => a.read === b.read ? 0 : a.read ? 1 : -1);
  const sel = items.find(n => n.id === selId);
  const patch = (id, p) => setItems(prev => prev.map(x => x.id === id ? {
    ...x,
    ...p
  } : x));
  const open = n => {
    setSelId(n.id);
    patch(n.id, {
      read: true
    });
  };
  const markAllRead = () => setItems(prev => prev.map(x => ({
    ...x,
    read: true
  })));
  const unread = items.filter(n => !n.read && !n.snoozed).length;
  return /*#__PURE__*/React.createElement("div", {
    className: "inbox"
  }, /*#__PURE__*/React.createElement("div", {
    className: "inbox-master"
  }, /*#__PURE__*/React.createElement("div", {
    className: "inbox-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ibx-title"
  }, "Inbox"), unread > 0 && /*#__PURE__*/React.createElement("span", {
    className: "ibx-count"
  }, unread), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 2,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: markAllRead,
    title: "Mark all as read"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "check-check",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setMenu(menu === "filter" ? null : "filter")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "list-filter",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setMenu(menu === "display" ? null : "display")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "sliders-horizontal",
    size: 16
  })))), menu && /*#__PURE__*/React.createElement("div", {
    className: "overlay",
    onClick: () => {
      setMenu(null);
      setSubHover(null);
    }
  }), menu === "filter" && (() => {
    const SUBS = {
      "Notification type": ["Assignments", "Comments and replies", "Status changes", "Mentions", "Reactions"],
      "From": ["Alex Park", "Jordan Lee", "김혁규"],
      "Project": ["Design system", "Q3 Platform revamp", "Mobile app v2"],
      "Issue priority": ["Urgent", "High", "Medium", "Low"],
      "Issue status type": ["Backlog", "Todo", "In Progress", "Done"]
    };
    const ICONS = {
      "Notification type": "bell",
      "From": "user",
      "Project": "box",
      "Issue priority": "signal-high",
      "Issue status type": "circle-dashed"
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        position: "absolute",
        top: 86,
        left: 250,
        width: 230,
        zIndex: 41
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "menu-search"
    }, /*#__PURE__*/React.createElement("input", {
      autoFocus: true,
      placeholder: "Add filter\u2026"
    })), Object.keys(SUBS).map(key => /*#__PURE__*/React.createElement("div", {
      className: "v-menu-item",
      key: key,
      onMouseEnter: e => setSubHover({
        key,
        top: e.currentTarget.getBoundingClientRect().top
      })
    }, /*#__PURE__*/React.createElement(Lic, {
      name: ICONS[key],
      size: 16,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }), /*#__PURE__*/React.createElement("span", null, key), /*#__PURE__*/React.createElement(Lic, {
      name: "chevron-right",
      size: 14,
      cls: "icon-sm",
      style: {
        marginLeft: "auto"
      },
      color: "var(--fg-4)"
    })))), subHover && /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        position: "fixed",
        top: Math.min(subHover.top, window.innerHeight - 220),
        left: 484,
        width: 200,
        zIndex: 42
      },
      onMouseEnter: () => setSubHover(subHover)
    }, SUBS[subHover.key].map(opt => {
      const on = (filters[subHover.key] || []).includes(opt);
      return /*#__PURE__*/React.createElement("div", {
        className: "v-menu-item" + (on ? " " : ""),
        key: opt,
        onClick: () => toggleFilter(subHover.key, opt)
      }, /*#__PURE__*/React.createElement("span", {
        className: "check",
        style: {
          width: 14,
          height: 14,
          border: "1.5px solid var(--border-strong)",
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: on ? "var(--accent)" : "transparent",
          borderColor: on ? "var(--accent)" : "var(--border-strong)"
        }
      }, on && /*#__PURE__*/React.createElement(Lic, {
        name: "check",
        size: 10,
        color: "var(--fg-on-accent)"
      })), /*#__PURE__*/React.createElement("span", null, opt));
    })));
  })(), menu === "display" && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      position: "absolute",
      top: 86,
      left: 200,
      width: 280,
      zIndex: 41
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Ordering"), /*#__PURE__*/React.createElement(PrSelect, {
    value: ordering,
    options: ["Newest", "Oldest", "Priority"],
    onChange: setOrdering
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-row",
    style: {
      paddingTop: 4,
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Show snoozed"), /*#__PURE__*/React.createElement("span", {
    className: "switch" + (showSnoozed ? " on" : ""),
    onClick: () => setShowSnoozed(!showSnoozed)
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-row",
    style: {
      paddingTop: 4,
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Show read"), /*#__PURE__*/React.createElement("span", {
    className: "switch" + (showRead ? " on" : ""),
    onClick: () => setShowRead(!showRead)
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-row",
    style: {
      paddingTop: 4,
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Show unread first"), /*#__PURE__*/React.createElement("span", {
    className: "switch" + (unreadFirst ? " on" : ""),
    onClick: () => setUnreadFirst(!unreadFirst)
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-caption"
  }, "Display properties"), /*#__PURE__*/React.createElement("div", {
    className: "prop-chips"
  }, /*#__PURE__*/React.createElement("span", {
    className: "prop-chip"
  }, "ID"), /*#__PURE__*/React.createElement("span", {
    className: "prop-chip on"
  }, "Status and icon"))), /*#__PURE__*/React.createElement("div", {
    className: "inbox-items"
  }, list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      height: 240
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No notifications")) : list.map(n => /*#__PURE__*/React.createElement(InboxItem, {
    key: n.id,
    n: n,
    active: selId === n.id,
    onClick: () => open(n)
  })))), /*#__PURE__*/React.createElement("div", {
    className: "inbox-detail"
  }, sel ? /*#__PURE__*/React.createElement("div", {
    className: "ibx-reader"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ibx-reader-head"
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: sel.status,
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    className: "ibx-id"
  }, sel.issue), /*#__PURE__*/React.createElement("h2", null, sel.title)), /*#__PURE__*/React.createElement("div", {
    className: "activity-item",
    style: {
      padding: "14px 0 0"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#4CB782",
    to: "#2D9CDB",
    text: sel.actor[0],
    size: 22
  }), /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, /*#__PURE__*/React.createElement("b", null, sel.actor), " ", sel.text, /*#__PURE__*/React.createElement("span", {
    className: "aw"
  }, sel.time, " ago"))), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--fg-2)",
      font: "var(--fw-regular) 14px/1.6 var(--font-sans)",
      marginTop: 16,
      maxWidth: 620
    }
  }, "This is the notification context. Open the issue to see the full thread, comments, and activity history."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: () => onOpenIssue && onOpenIssue(sel.issue)
  }, "Open issue"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => {
      patch(sel.id, {
        snoozed: !sel.snoozed
      });
    }
  }, sel.snoozed ? "Unsnooze" : "Snooze"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => patch(sel.id, {
      read: !sel.read
    })
  }, sel.read ? "Mark unread" : "Mark read"))) : /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "80",
    height: "64",
    viewBox: "0 0 80 64",
    fill: "none",
    className: "glyph"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M14 26L24 10h32l10 16v22a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V26z",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 28h16l4 7h12l4-7h16",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinejoin: "round"
  })), /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "Select a notification to read"))));
}
Object.assign(window, {
  Inbox
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Inbox.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Insights.jsx
try { (() => {
// Insights.jsx — analytics: burndown, velocity, status & priority breakdown
function StatCard({
  label,
  value,
  sub,
  accent
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ins-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ins-stat-val",
    style: accent ? {
      color: "var(--accent)"
    } : null
  }, value), /*#__PURE__*/React.createElement("div", {
    className: "ins-stat-lab"
  }, label), sub && /*#__PURE__*/React.createElement("div", {
    className: "ins-stat-sub"
  }, sub));
}

// Burndown — mirrors Plane's ProgressChart (makeplane/plane):
// ideal[i] = total * (1 - i/(n-1)); current from the completion distribution.
function Burndown({
  scope
}) {
  const W = 520,
    H = 200,
    P = 28;
  const days = 14;
  const current = [scope, scope, scope - 1, scope - 1, scope - 2, scope - 2, scope - 2, scope - 3, scope - 3, scope - 4, scope - 4, scope - 4, scope - 5, scope - 6];
  const ideal = Array.from({
    length: days
  }, (_, i) => scope * (1 - i / (days - 1)));
  const x = i => P + (W - 2 * P) * i / (days - 1);
  const y = v => P + (H - 2 * P) * (1 - v / scope);
  const path = arr => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${path(current)} L${x(days - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    className: "ins-svg"
  }, [0, 0.25, 0.5, 0.75, 1].map((f, i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: P,
    x2: W - P,
    y1: P + (H - 2 * P) * f,
    y2: P + (H - 2 * P) * f,
    stroke: "var(--border)",
    strokeWidth: "1"
  })), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: "var(--accent-soft)"
  }), /*#__PURE__*/React.createElement("path", {
    d: path(ideal),
    fill: "none",
    stroke: "#A9BBD0",
    strokeWidth: "1",
    strokeDasharray: "6 3"
  }), /*#__PURE__*/React.createElement("path", {
    d: path(current),
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: "2",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), current.map((v, i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: x(i),
    cy: y(v),
    r: "2.5",
    fill: "var(--accent)"
  })));
}

// velocity bars: completed per cycle
function Velocity({
  data
}) {
  const W = 520,
    H = 200,
    P = 28;
  const max = Math.max(...data.map(d => Math.max(d.scope, d.done)), 1);
  const n = data.length;
  const groupW = (W - 2 * P) / n;
  const bw = Math.min(26, groupW * 0.3);
  const y = v => P + (H - 2 * P) * (1 - v / max);
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    className: "ins-svg"
  }, [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: P,
    x2: W - P,
    y1: P + (H - 2 * P) * f,
    y2: P + (H - 2 * P) * f,
    stroke: "var(--border)",
    strokeWidth: "1"
  })), data.map((d, i) => {
    const cx = P + groupW * (i + 0.5);
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("rect", {
      x: cx - bw - 2,
      y: y(d.scope),
      width: bw,
      height: H - P - y(d.scope),
      rx: "3",
      fill: "var(--bg-elevated-2)"
    }), /*#__PURE__*/React.createElement("rect", {
      x: cx + 2,
      y: y(d.done),
      width: bw,
      height: H - P - y(d.done),
      rx: "3",
      fill: "var(--accent)"
    }), /*#__PURE__*/React.createElement("text", {
      x: cx,
      y: H - 8,
      textAnchor: "middle",
      className: "ins-axis"
    }, d.name));
  }));
}

// horizontal stacked bar: distribution
function DistBar({
  rows,
  total
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ins-dist"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ins-dist-bar"
  }, rows.filter(r => r.count > 0).map((r, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: r.count / total * 100 + "%",
      background: r.color
    },
    title: `${r.label}: ${r.count}`
  }))), /*#__PURE__*/React.createElement("div", {
    className: "ins-dist-legend"
  }, rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    className: "ins-leg",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "ins-leg-dot",
    style: {
      background: r.color
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "ins-leg-lab"
  }, r.label), /*#__PURE__*/React.createElement("span", {
    className: "ins-leg-num"
  }, r.count)))));
}

// simple charts for the database-chart widget
function KsBar({
  data,
  color = "var(--accent)"
}) {
  const W = 460,
    H = 190,
    P = 28;
  const max = Math.max(...data.map(d => d.v), 1);
  const bw = (W - 2 * P) / Math.max(1, data.length);
  const y = v => P + (H - 2 * P) * (1 - v / max);
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    style: {
      width: "100%",
      height: "auto"
    }
  }, [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: P,
    x2: W - P,
    y1: P + (H - 2 * P) * f,
    y2: P + (H - 2 * P) * f,
    stroke: "var(--border)"
  })), data.map((d, i) => {
    const cx = P + bw * (i + 0.5);
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("rect", {
      x: cx - bw * 0.3,
      y: y(d.v),
      width: bw * 0.6,
      height: H - P - y(d.v),
      rx: "3",
      fill: color
    }), /*#__PURE__*/React.createElement("text", {
      x: cx,
      y: H - 7,
      textAnchor: "middle",
      className: "ins-axis"
    }, d.k), /*#__PURE__*/React.createElement("text", {
      x: cx,
      y: y(d.v) - 5,
      textAnchor: "middle",
      className: "ins-axis",
      style: {
        fill: "var(--fg-3)"
      }
    }, d.v));
  }));
}
function KsLine({
  data
}) {
  const W = 460,
    H = 190,
    P = 28;
  const max = Math.max(...data.map(d => d.v), 1);
  const x = i => P + (W - 2 * P) * i / Math.max(1, data.length - 1);
  const y = v => P + (H - 2 * P) * (1 - v / max);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.v).toFixed(1)}`).join(" ");
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    style: {
      width: "100%",
      height: "auto"
    }
  }, [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: P,
    x2: W - P,
    y1: P + (H - 2 * P) * f,
    y2: P + (H - 2 * P) * f,
    stroke: "var(--border)"
  })), data.length > 1 && /*#__PURE__*/React.createElement("path", {
    d: `${path} L${x(data.length - 1)} ${H - P} L${x(0)} ${H - P} Z`,
    fill: "var(--accent-soft)"
  }), /*#__PURE__*/React.createElement("path", {
    d: path,
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: "2",
    strokeLinejoin: "round"
  }), data.map((d, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("circle", {
    cx: x(i),
    cy: y(d.v),
    r: "2.5",
    fill: "var(--accent)"
  }), /*#__PURE__*/React.createElement("text", {
    x: x(i),
    y: H - 7,
    textAnchor: "middle",
    className: "ins-axis"
  }, d.k))));
}
function KsPie({
  data
}) {
  const cx = 95,
    cy = 95,
    r = 72;
  let acc = 0;
  const total = data.reduce((s, d) => s + d.v, 0) || 1;
  const pal = ["#4C8DFF", "#4CB782", "#F2C94C", "#F2994A", "#BB6BD9", "#EB5757"];
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 320 190",
    style: {
      width: "100%",
      height: "auto"
    }
  }, data.map((d, i) => {
    const a0 = acc / total * Math.PI * 2 - Math.PI / 2;
    acc += d.v;
    const a1 = acc / total * Math.PI * 2 - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0),
      y0 = cy + r * Math.sin(a0),
      x1 = cx + r * Math.cos(a1),
      y1 = cy + r * Math.sin(a1);
    return /*#__PURE__*/React.createElement("path", {
      key: i,
      d: `M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`,
      fill: pal[i % pal.length]
    });
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: "38",
    fill: "var(--bg-app)"
  }), data.map((d, i) => /*#__PURE__*/React.createElement("g", {
    key: i,
    transform: `translate(200 ${42 + i * 24})`
  }, /*#__PURE__*/React.createElement("rect", {
    width: "11",
    height: "11",
    rx: "3",
    fill: pal[i % pal.length]
  }), /*#__PURE__*/React.createElement("text", {
    x: "18",
    y: "10",
    className: "ins-axis",
    style: {
      fill: "var(--fg-2)",
      fontSize: 12
    }
  }, d.k, " \xB7 ", d.v))));
}
function DbChartWidget({
  db
}) {
  const [groupId, setGroupId] = React.useState(null);
  const [aggFn, setAggFn] = React.useState("count");
  const [valId, setValId] = React.useState(null);
  const [chart, setChart] = React.useState("bar");
  const [open, setOpen] = React.useState(null);
  if (!db || !db.props) return /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      height: 160
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No database"));
  const C = window.VChart;
  const groupables = db.props.filter(p => ["select", "status", "checkbox"].includes(p.type));
  const numerics = db.props.filter(p => ["number", "rating"].includes(p.type));
  const gp = db.props.find(p => p.id === groupId) || groupables[0];
  const vp = db.props.find(p => p.id === valId);
  const rows = db.records || db.rows || [];
  const data = window.aggregateBy(rows, gp ? gp.id : null, aggFn, vp ? vp.id : undefined).map(d => ({
    k: d.label,
    v: Math.round(d.value * 10) / 10
  }));
  const secondCat = groupables.find(p => gp && p.id !== gp.id);
  const numField = numerics[0];
  const pick = (key, items, cur, set) => /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ks-select",
    style: {
      height: 26
    },
    onClick: () => setOpen(open === key ? null : key)
  }, cur, " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 12,
    cls: "icon-sm"
  })), open === key && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: () => setOpen(null)
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 30,
      left: 0,
      width: 170,
      zIndex: 45,
      maxHeight: 280,
      overflowY: "auto"
    }
  }, items.map(it => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: it.v,
    onClick: () => {
      set(it.v);
      setOpen(null);
    }
  }, it.l)))));
  const renderChart = () => {
    switch (chart) {
      case "bar":
        return /*#__PURE__*/React.createElement(C.Bar, {
          data: data
        });
      case "hbar":
        return /*#__PURE__*/React.createElement(C.CategoryBar, {
          data: data
        });
      case "line":
        return /*#__PURE__*/React.createElement(C.Line, {
          data: data
        });
      case "area":
        return /*#__PURE__*/React.createElement(C.Area, {
          data: data
        });
      case "pie":
        return /*#__PURE__*/React.createElement(C.Pie, {
          data: data
        });
      case "donut":
        return /*#__PURE__*/React.createElement(C.Pie, {
          data: data,
          donut: true
        });
      case "stacked":
        return /*#__PURE__*/React.createElement(C.StackedBar, {
          cats: data.map(d => d.k),
          series: [{
            name: "count",
            color: "#4C8DFF",
            vals: data.map(d => d.v)
          }]
        });
      case "histogram":
        return /*#__PURE__*/React.createElement(C.Histogram, {
          values: numField ? rows.map(r => r[numField.id]) : []
        });
      case "scatter":
        return /*#__PURE__*/React.createElement(C.Scatter, {
          points: rows.map(r => ({
            x: Number(r[numerics[0] ? numerics[0].id : "x"]) || 0,
            y: Number(r[numerics[1] ? numerics[1].id : numerics[0] ? numerics[0].id : "y"]) || 0
          }))
        });
      case "funnel":
        return /*#__PURE__*/React.createElement(C.Funnel, {
          stages: data
        });
      case "heatmap":
        return /*#__PURE__*/React.createElement(C.Heatmap, {
          rows: rows,
          catField: gp ? gp.id : "",
          groupField: secondCat ? secondCat.id : gp ? gp.id : ""
        });
      case "pivot":
        return /*#__PURE__*/React.createElement(C.Pivot, {
          rows: rows,
          rowField: gp ? gp.id : "",
          colField: secondCat ? secondCat.id : gp ? gp.id : ""
        });
      case "bullet":
        return /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 6
          }
        }, data.slice(0, 5).map((d, i) => /*#__PURE__*/React.createElement(C.Bullet, {
          key: i,
          label: d.k,
          value: d.v,
          target: Math.max(...data.map(x => x.v))
        })));
      default:
        return /*#__PURE__*/React.createElement(C.Bar, {
          data: data
        });
    }
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 12,
      alignItems: "center"
    }
  }, pick("g", groupables.map(p => ({
    v: p.id,
    l: p.name
  })), gp ? gp.name : "—", setGroupId), pick("f", [["count", "Count"], ["sum", "Sum"], ["avg", "Average"], ["min", "Min"], ["max", "Max"]].map(([v, l]) => ({
    v,
    l
  })), AGG_LABELS[aggFn], setAggFn), aggFn !== "count" && pick("v", numerics.map(p => ({
    v: p.id,
    l: p.name
  })), vp ? vp.name : "value", setValId), pick("c", window.CHART_TYPES.map(t => ({
    v: t.id,
    l: t.label
  })), (window.CHART_TYPES.find(t => t.id === chart) || {}).label || "Bar", setChart)), renderChart());
}
const WIDGET_TYPES = [{
  type: "metric",
  title: "Metric card",
  icon: "hash"
}, {
  type: "burndown",
  title: "Burndown chart",
  icon: "trending-down"
}, {
  type: "velocity",
  title: "Velocity chart",
  icon: "bar-chart-3"
}, {
  type: "status",
  title: "Status distribution",
  icon: "pie-chart"
}, {
  type: "priority",
  title: "Priority distribution",
  icon: "signal-high"
}, {
  type: "dbchart",
  title: "Database chart",
  icon: "table-2"
}];
const METRIC_OPTIONS = [{
  key: "total",
  label: "Total issues"
}, {
  key: "done",
  label: "Completed"
}, {
  key: "inProgress",
  label: "In progress"
}, {
  key: "backlog",
  label: "Backlog"
}, {
  key: "avgVelocity",
  label: "Avg velocity"
}, {
  key: "completionRate",
  label: "Completion %"
}];
const DEFAULT_WIDGETS = [{
  id: "w1",
  type: "metric",
  metric: "total",
  w: "half"
}, {
  id: "w2",
  type: "metric",
  metric: "done",
  w: "half"
}, {
  id: "w3",
  type: "burndown",
  w: "half"
}, {
  id: "w4",
  type: "velocity",
  w: "half"
}, {
  id: "w5",
  type: "status",
  w: "half"
}, {
  id: "w6",
  type: "priority",
  w: "half"
}];
function Insights({
  issues,
  cycles,
  widgets,
  onWidgets,
  database
}) {
  const [adding, setAdding] = React.useState(false);
  const total = issues.length;
  const done = issues.filter(i => i.status === "done").length;
  const inProgress = issues.filter(i => i.status === "progress" || i.status === "review").length;
  const backlog = issues.filter(i => i.status === "backlog").length;
  const activeCycle = cycles.find(c => c.state === "active") || cycles[0] || {
    scope: 6,
    completed: 2
  };
  const completionRate = total ? Math.round(done / total * 100) : 0;
  const avgVelocity = Math.round(cycles.filter(c => c.state === "completed").reduce((s, c) => s + c.completed, 0) / Math.max(1, cycles.filter(c => c.state === "completed").length));
  const metricVals = {
    total,
    done,
    inProgress,
    backlog,
    avgVelocity: avgVelocity || 0,
    completionRate: completionRate + "%"
  };
  const statusRows = [{
    label: "Backlog",
    color: STATUS.backlog.color,
    count: issues.filter(i => i.status === "backlog").length
  }, {
    label: "Todo",
    color: STATUS.todo.color,
    count: issues.filter(i => i.status === "todo").length
  }, {
    label: "In Progress",
    color: STATUS.progress.color,
    count: issues.filter(i => i.status === "progress").length
  }, {
    label: "In Review",
    color: STATUS.review.color,
    count: issues.filter(i => i.status === "review").length
  }, {
    label: "Done",
    color: STATUS.done.color,
    count: done
  }, {
    label: "Canceled",
    color: STATUS.canceled.color,
    count: issues.filter(i => i.status === "canceled").length
  }];
  const prioColors = {
    urgent: "#F2994A",
    high: "#C9CCD1",
    medium: "#9CA0A8",
    low: "#62666D",
    none: "#3A3D42"
  };
  const prioRows = PRIORITIES.map(p => ({
    label: priorityLabel(p),
    color: prioColors[p],
    count: issues.filter(i => i.priority === p).length
  }));
  const velocityData = cycles.length ? cycles.map(c => ({
    name: c.name.replace("Cycle ", "C"),
    scope: c.scope,
    done: c.completed
  })) : [{
    name: "C1",
    scope: 8,
    done: 8
  }];
  const addWidget = t => {
    const id = "w" + Date.now();
    onWidgets([...widgets, {
      id,
      type: t.type,
      metric: t.type === "metric" ? "total" : undefined,
      w: t.type === "metric" ? "half" : "half"
    }]);
    setAdding(false);
  };
  const removeWidget = id => onWidgets(widgets.filter(w => w.id !== id));
  const toggleW = id => onWidgets(widgets.map(w => w.id === id ? {
    ...w,
    w: w.w === "half" ? "full" : "half"
  } : w));
  const setMetric = (id, m) => onWidgets(widgets.map(w => w.id === id ? {
    ...w,
    metric: m
  } : w));
  const renderWidget = wd => {
    const chrome = (body, head) => /*#__PURE__*/React.createElement("div", {
      className: "ins-widget " + (wd.w === "full" ? "ins-w-full" : "ins-w-half"),
      key: wd.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "ins-widget-bar"
    }, head, /*#__PURE__*/React.createElement("div", {
      className: "ins-widget-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "iconbtn",
      title: "Toggle width",
      onClick: () => toggleW(wd.id)
    }, /*#__PURE__*/React.createElement(Lic, {
      name: wd.w === "full" ? "minimize-2" : "maximize-2",
      size: 13
    })), /*#__PURE__*/React.createElement("button", {
      className: "iconbtn",
      title: "Remove",
      onClick: () => removeWidget(wd.id)
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "x",
      size: 14
    })))), body);
    if (wd.type === "metric") {
      const opt = METRIC_OPTIONS.find(o => o.key === wd.metric) || METRIC_OPTIONS[0];
      return chrome(/*#__PURE__*/React.createElement("div", {
        className: "ins-metric-body"
      }, /*#__PURE__*/React.createElement("div", {
        className: "ins-stat-val",
        style: opt.key === "done" ? {
          color: "var(--accent)"
        } : null
      }, metricVals[opt.key])), /*#__PURE__*/React.createElement(MetricPicker, {
        value: wd.metric,
        onChange: m => setMetric(wd.id, m)
      }));
    }
    if (wd.type === "burndown") return chrome(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Burndown, {
      scope: activeCycle.scope || 6
    }), /*#__PURE__*/React.createElement("div", {
      className: "ins-legend-row"
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      className: "ins-leg-dot",
      style: {
        background: "var(--accent)"
      }
    }), "Actual"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      className: "ins-leg-dot",
      style: {
        background: "#A9BBD0"
      }
    }), "Ideal"))), /*#__PURE__*/React.createElement("span", {
      className: "ins-wt"
    }, "Burndown"));
    if (wd.type === "velocity") return chrome(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Velocity, {
      data: velocityData
    }), /*#__PURE__*/React.createElement("div", {
      className: "ins-legend-row"
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      className: "ins-leg-dot",
      style: {
        background: "var(--bg-elevated-2)"
      }
    }), "Scope"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      className: "ins-leg-dot",
      style: {
        background: "var(--accent)"
      }
    }), "Completed"))), /*#__PURE__*/React.createElement("span", {
      className: "ins-wt"
    }, "Velocity"));
    if (wd.type === "status") return chrome(/*#__PURE__*/React.createElement(DistBar, {
      rows: statusRows,
      total: total || 1
    }), /*#__PURE__*/React.createElement("span", {
      className: "ins-wt"
    }, "Status distribution"));
    if (wd.type === "priority") return chrome(/*#__PURE__*/React.createElement(DistBar, {
      rows: prioRows,
      total: total || 1
    }), /*#__PURE__*/React.createElement("span", {
      className: "ins-wt"
    }, "Priority distribution"));
    if (wd.type === "dbchart") return chrome(/*#__PURE__*/React.createElement(DbChartWidget, {
      db: database
    }), /*#__PURE__*/React.createElement("span", {
      className: "ins-wt"
    }, database ? database.name : "Database", " chart"));
    return null;
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "content ins-scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ins-dash-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ins-dash-title"
  }, "Dashboard"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => setAdding(!adding)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 14,
    cls: "icon-sm"
  }), "Add widget"), adding && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: () => setAdding(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 38,
      right: 0,
      width: 220,
      zIndex: 45
    }
  }, WIDGET_TYPES.map(t => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: t.type,
    onClick: () => addWidget(t)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: t.icon,
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), t.title)))))), /*#__PURE__*/React.createElement("div", {
    className: "ins-dash"
  }, widgets.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      height: 200,
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "bar-chart-3",
    size: 36,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No widgets \u2014 add one to build your dashboard")) : widgets.map(renderWidget)));
}
function MetricPicker({
  value,
  onChange
}) {
  const [open, setOpen] = React.useState(false);
  const opt = METRIC_OPTIONS.find(o => o.key === value) || METRIC_OPTIONS[0];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ins-metric-pick",
    onClick: () => setOpen(!open)
  }, opt.label, " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 12,
    cls: "icon-sm"
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: () => setOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 22,
      left: 0,
      width: 180,
      zIndex: 45
    }
  }, METRIC_OPTIONS.map(o => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: o.key,
    onClick: () => {
      onChange(o.key);
      setOpen(false);
    }
  }, o.label, o.key === value && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    style: {
      marginLeft: "auto"
    },
    color: "var(--accent)"
  }))))));
}
Object.assign(window, {
  Insights,
  DEFAULT_WIDGETS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Insights.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/IssueDetail.jsx
try { (() => {
// IssueDetail.jsx — full issue view (main + properties sidebar), fully editable
function PropDropdown({
  trigger,
  options,
  onPick,
  width = 200,
  multi,
  selected
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      setOpen(!open);
    },
    style: {
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 7,
      flexWrap: "wrap"
    }
  }, trigger), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: e => {
      e.stopPropagation();
      setOpen(false);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 28,
      right: 0,
      width,
      zIndex: 45
    }
  }, options.map((o, i) => {
    const on = multi ? (selected || []).includes(o.value) : o.active;
    return /*#__PURE__*/React.createElement("div", {
      className: "v-menu-item",
      key: i,
      onClick: e => {
        e.stopPropagation();
        onPick(o.value);
        if (!multi) setOpen(false);
      }
    }, o.icon, /*#__PURE__*/React.createElement("span", null, o.label), on && /*#__PURE__*/React.createElement(Lic, {
      name: "check",
      size: 14,
      cls: "icon-sm",
      style: {
        marginLeft: "auto"
      },
      color: "var(--accent)"
    }));
  }))));
}
function PropLine({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "prop-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-label"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "pl-value"
  }, children));
}
const REL_TYPES = [{
  key: "blocks",
  label: "Blocks",
  icon: "circle-slash"
}, {
  key: "blocked",
  label: "Blocked by",
  icon: "ban"
}, {
  key: "related",
  label: "Related",
  icon: "git-compare"
}, {
  key: "duplicate",
  label: "Duplicate of",
  icon: "copy"
}];
function IssueDetail({
  issue,
  onBack,
  onCycle,
  onUpdate,
  index = 0,
  total = 1,
  onPrev,
  onNext,
  projectNames = []
}) {
  const [comment, setComment] = React.useState("");
  const [sideOpen, setSideOpen] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [subTitle, setSubTitle] = React.useState("");
  const [addingRel, setAddingRel] = React.useState(false);
  const subs = issue.subIssues || [];
  const doneCount = subs.filter(s => s.status === "done").length;
  const comments = issue.comments || [];
  const rels = issue.relations || [];
  const statusOpts = ["backlog", "todo", "progress", "review", "done", "canceled"].map(s => ({
    value: s,
    label: statusLabel(s),
    icon: /*#__PURE__*/React.createElement(StatusIcon, {
      status: s,
      size: 14
    }),
    active: issue.status === s
  }));
  const prioOpts = PRIORITIES.map(p => ({
    value: p,
    label: priorityLabel(p),
    icon: /*#__PURE__*/React.createElement(PriorityIcon, {
      priority: p,
      size: 15
    }),
    active: issue.priority === p
  }));
  const assigneeOpts = ASSIGNEES.map(a => ({
    value: a,
    label: a,
    icon: a === "Unassigned" ? /*#__PURE__*/React.createElement("span", {
      className: "avatar empty",
      style: {
        width: 18,
        height: 18
      }
    }) : /*#__PURE__*/React.createElement(Avatar, {
      from: "#2D9CDB",
      to: "#4C8DFF",
      text: a[0],
      size: 18
    }),
    active: (issue.assignee || "Unassigned") === a
  }));
  const labelOpts = Object.keys(LABELS).map(l => ({
    value: l,
    label: l,
    icon: /*#__PURE__*/React.createElement("span", {
      className: "label-dot",
      style: {
        background: LABELS[l].color
      }
    })
  }));
  const projectOpts = [{
    value: null,
    label: "No project",
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-4)"
    })
  }].concat(projectNames.map(p => ({
    value: p,
    label: p,
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    active: issue.project === p
  })));
  const assignee = issue.assignee || "Unassigned";
  const addSub = () => {
    if (!subTitle.trim()) return;
    const sub = {
      id: issue.id + "-" + (subs.length + 1),
      title: subTitle.trim(),
      status: "todo"
    };
    onUpdate(issue.id, {
      subIssues: [...subs, sub]
    });
    setSubTitle("");
    setAdding(false);
  };
  const cycleSub = sid => onUpdate(issue.id, {
    subIssues: subs.map(s => s.id === sid ? {
      ...s,
      status: STATUS_CYCLE[(STATUS_CYCLE.indexOf(s.status) + 1) % STATUS_CYCLE.length]
    } : s)
  });
  const toggleLabel = l => onUpdate(issue.id, {
    labels: issue.labels.includes(l) ? issue.labels.filter(x => x !== l) : [...issue.labels, l]
  });
  const postComment = () => {
    if (!comment.trim()) return;
    onUpdate(issue.id, {
      comments: [...comments, {
        id: Date.now(),
        author: "김혁규",
        text: comment.trim(),
        when: "just now"
      }]
    });
    setComment("");
  };
  const addRel = type => {
    onUpdate(issue.id, {
      relations: [...rels, {
        type,
        target: "VEC-" + (Math.floor(Math.random() * 90) + 10)
      }]
    });
    setAddingRel(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "detail"
  }, /*#__PURE__*/React.createElement("div", {
    className: "detail-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "detail-crumb",
    style: {
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-left",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)",
    onClick: onBack,
    style: {
      cursor: "pointer"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "ws-av",
    style: {
      width: 18,
      height: 18,
      fontSize: 9,
      borderRadius: 5
    }
  }, "VC"), /*#__PURE__*/React.createElement("span", {
    className: "c"
  }, "vector-team"), /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "c",
    style: {
      cursor: "pointer"
    },
    onClick: onBack
  }, "Issues"), /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "id"
  }, issue.id)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, total > 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "v-meta"
  }, index + 1, " / ", total), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onPrev,
    disabled: index === 0,
    style: {
      opacity: index === 0 ? .4 : 1
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-up",
    size: 15
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onNext,
    disabled: index === total - 1,
    style: {
      opacity: index === total - 1 ? .4 : 1
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 15
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 16,
      background: "var(--border)",
      margin: "0 4px"
    }
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setSideOpen(!sideOpen),
    title: sideOpen ? "Hide properties" : "Show properties",
    style: sideOpen ? {
      background: "var(--bg-active)",
      color: "var(--fg)"
    } : null
  }, /*#__PURE__*/React.createElement(PanelIcon, {
    side: "right",
    size: 15
  })))), /*#__PURE__*/React.createElement("h1", {
    className: "detail-title"
  }, issue.title), /*#__PURE__*/React.createElement("div", {
    className: "detail-desc"
  }, /*#__PURE__*/React.createElement("p", null, issue.body || "Add a description to give your team the context they need to pick this up.")), /*#__PURE__*/React.createElement("div", {
    className: "detail-section-h"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "git-branch-plus",
    size: 14,
    cls: "icon-sm"
  }), " Sub-issues", subs.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "sub-prog"
  }, doneCount, "/", subs.length), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    style: {
      marginLeft: "auto"
    },
    onClick: () => setAdding(true)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 15
  }))), subs.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "sub-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sub-bar-fill",
    style: {
      width: (subs.length ? doneCount / subs.length * 100 : 0) + "%"
    }
  })), subs.map(s => /*#__PURE__*/React.createElement("div", {
    className: "subissue",
    key: s.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "statusbtn",
    style: {
      width: 20,
      height: 20
    },
    onClick: () => cycleSub(s.id)
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: s.status,
    size: 14
  })), /*#__PURE__*/React.createElement("span", {
    className: "id"
  }, s.id), /*#__PURE__*/React.createElement("span", {
    className: "t",
    style: s.status === "done" ? {
      textDecoration: "line-through",
      color: "var(--fg-4)"
    } : null
  }, s.title))), adding && /*#__PURE__*/React.createElement("div", {
    className: "subissue"
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: "todo",
    size: 14
  }), /*#__PURE__*/React.createElement("input", {
    className: "sub-input",
    autoFocus: true,
    placeholder: "Sub-issue title\u2026",
    value: subTitle,
    onChange: e => setSubTitle(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") addSub();
      if (e.key === "Escape") setAdding(false);
    },
    onBlur: () => subTitle.trim() ? addSub() : setAdding(false)
  })), /*#__PURE__*/React.createElement("div", {
    className: "detail-section-h"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "activity",
    size: 14,
    cls: "icon-sm"
  }), " Activity"), /*#__PURE__*/React.createElement("div", {
    className: "activity-item"
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: "K",
    size: 20
  }), /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, /*#__PURE__*/React.createElement("b", null, "\uAE40\uD601\uADDC"), " created the issue", /*#__PURE__*/React.createElement("span", {
    className: "aw"
  }, issue.created))), comments.map(c => /*#__PURE__*/React.createElement("div", {
    className: "activity-item",
    key: c.id
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: c.author[0],
    size: 20
  }), /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, /*#__PURE__*/React.createElement("b", null, c.author), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-2)"
    }
  }, c.text), /*#__PURE__*/React.createElement("span", {
    className: "aw"
  }, c.when)))), /*#__PURE__*/React.createElement("div", {
    className: "comment-box"
  }, /*#__PURE__*/React.createElement("textarea", {
    placeholder: "Leave a comment\u2026",
    value: comment,
    onChange: e => setComment(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment();
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "comment-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-meta",
    style: {
      marginRight: "auto",
      color: "var(--fg-4)"
    }
  }, "\u2318\u21B5 to send"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    style: {
      opacity: comment.trim() ? 1 : .5
    },
    onClick: postComment
  }, "Comment")))), sideOpen && /*#__PURE__*/React.createElement("div", {
    className: "detail-side"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 0 12px",
      marginBottom: 4,
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-label"
  }, "Properties"), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setSideOpen(false),
    title: "Hide properties"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 15
  }))), /*#__PURE__*/React.createElement("div", {
    className: "side-group"
  }, /*#__PURE__*/React.createElement(PropLine, {
    label: "Status"
  }, /*#__PURE__*/React.createElement(PropDropdown, {
    trigger: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusIcon, {
      status: issue.status,
      size: 14
    }), statusLabel(issue.status)),
    options: statusOpts,
    onPick: v => onUpdate(issue.id, {
      status: v
    })
  })), /*#__PURE__*/React.createElement(PropLine, {
    label: "Priority"
  }, /*#__PURE__*/React.createElement(PropDropdown, {
    trigger: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PriorityIcon, {
      priority: issue.priority,
      size: 15
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        color: issue.priority === "none" ? "var(--fg-4)" : "var(--fg-2)"
      }
    }, priorityLabel(issue.priority))),
    options: prioOpts,
    onPick: v => onUpdate(issue.id, {
      priority: v
    })
  })), /*#__PURE__*/React.createElement(PropLine, {
    label: "Assignee"
  }, /*#__PURE__*/React.createElement(PropDropdown, {
    trigger: assignee === "Unassigned" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "avatar empty",
      style: {
        width: 18,
        height: 18
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-4)"
      }
    }, "Unassigned")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Avatar, {
      from: "#2D9CDB",
      to: "#4C8DFF",
      text: assignee[0],
      size: 18
    }), assignee),
    options: assigneeOpts,
    onPick: v => onUpdate(issue.id, {
      assignee: v === "Unassigned" ? null : v
    })
  }))), /*#__PURE__*/React.createElement("div", {
    className: "side-group"
  }, /*#__PURE__*/React.createElement(PropLine, {
    label: "Labels"
  }, /*#__PURE__*/React.createElement(PropDropdown, {
    multi: true,
    selected: issue.labels,
    width: 190,
    trigger: issue.labels.length ? issue.labels.map(l => /*#__PURE__*/React.createElement("span", {
      className: "label-chip",
      key: l
    }, /*#__PURE__*/React.createElement("span", {
      className: "label-dot",
      style: {
        background: LABELS[l].color
      }
    }), l)) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-4)"
      }
    }, "Add label"),
    options: labelOpts,
    onPick: toggleLabel
  })), /*#__PURE__*/React.createElement(PropLine, {
    label: "Project"
  }, /*#__PURE__*/React.createElement(PropDropdown, {
    trigger: issue.project ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-2)"
      }
    }, issue.project)) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-4)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-4)"
      }
    }, "No project")),
    options: projectOpts,
    onPick: v => onUpdate(issue.id, {
      project: v
    })
  })), /*#__PURE__*/React.createElement(PropLine, {
    label: "Milestone"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-4)",
      display: "flex",
      alignItems: "center",
      gap: 7
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "diamond",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), "No milestone"))), /*#__PURE__*/React.createElement("div", {
    className: "side-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "prop-line",
    style: {
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-label"
  }, "Relations"), /*#__PURE__*/React.createElement("span", {
    className: "pl-value",
    style: {
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 6
    }
  }, rels.map((r, i) => {
    const t = REL_TYPES.find(x => x.key === r.type);
    return /*#__PURE__*/React.createElement("span", {
      key: i,
      className: "rel-chip"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: t.icon,
      size: 12,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }), t.label, " ", /*#__PURE__*/React.createElement("span", {
      className: "id"
    }, r.target));
  }), /*#__PURE__*/React.createElement(PropDropdown, {
    trigger: /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-4)",
        display: "flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "plus",
      size: 13,
      cls: "icon-sm",
      color: "var(--fg-4)"
    }), "Add relation"),
    options: REL_TYPES.map(t => ({
      value: t.key,
      label: t.label,
      icon: /*#__PURE__*/React.createElement(Lic, {
        name: t.icon,
        size: 14,
        cls: "icon-sm",
        color: "var(--fg-3)"
      })
    })),
    onPick: addRel
  })))), /*#__PURE__*/React.createElement("div", {
    className: "side-group"
  }, /*#__PURE__*/React.createElement(PropLine, {
    label: "Created"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-3)"
    }
  }, issue.created)), /*#__PURE__*/React.createElement(PropLine, {
    label: "Updated"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-3)"
    }
  }, issue.updated)))));
}
Object.assign(window, {
  IssueDetail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/IssueDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Menus.jsx
try { (() => {
// Menus.jsx — Help menu, Workspace menu, Right facet sidebar, New Project modal

function HelpMenu({
  onClose,
  onNav
}) {
  const item = (icon, label, sub, run) => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    onClick: () => {
      run && run();
      onClose();
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: icon,
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", null, label), sub && /*#__PURE__*/React.createElement("span", {
    className: "shortcut"
  }, sub));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "overlay",
    style: {
      zIndex: 48
    },
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-menu",
    style: {
      position: "fixed",
      left: 10,
      bottom: 42,
      width: 240,
      zIndex: 49
    }
  }, item("search", "Search for help…"), item("book-open", "Docs"), item("message-circle", "Contact us"), item("keyboard", "Keyboard shortcuts", "Ctrl /"), item("circle-check", "Vector status"), item("monitor-down", "Download apps"), item("settings-2", "Settings", "G then S", () => onNav("settings")), item("slack", "Slack community"), /*#__PURE__*/React.createElement("div", {
    className: "cmd-cap whatsnew"
  }, "What's new"), /*#__PURE__*/React.createElement("div", {
    className: "whatsnew-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nd"
  }), "Vector Diffs"), /*#__PURE__*/React.createElement("div", {
    className: "whatsnew-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nd"
  }), "Project Slack channels"), /*#__PURE__*/React.createElement("div", {
    className: "whatsnew-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nd"
  }), "Full changelog")));
}
function WorkspaceMenu({
  onClose,
  onNav
}) {
  const item = (label, sub, run, icon) => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    onClick: () => {
      run && run();
      onClose();
    }
  }, icon && /*#__PURE__*/React.createElement(Lic, {
    name: icon,
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", null, label), sub && /*#__PURE__*/React.createElement("span", {
    className: "shortcut"
  }, sub));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "overlay",
    style: {
      zIndex: 48
    },
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-menu",
    style: {
      position: "fixed",
      left: 12,
      top: 44,
      width: 248,
      zIndex: 49
    }
  }, item("Settings", "G then S", () => onNav("settings"), "settings-2"), item("Invite and manage members", null, () => onNav("settings"), "user-plus"), /*#__PURE__*/React.createElement("div", {
    className: "panel-sep"
  }), item("Download desktop app", null, null, "monitor-down"), item("Switch workspace", "O then W", null, "repeat"), /*#__PURE__*/React.createElement("div", {
    className: "panel-sep"
  }), item("Log out", "Alt ⇧ Q", null, "log-out")));
}

// ---- Right facet sidebar ----
function facetData(issues, facet) {
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const m = new Map();
  if (facet === "Assignees") {
    issues.forEach(i => bump(m, i.assignee || "No assignee"));
  } else if (facet === "Labels") {
    issues.forEach(i => i.labels.length ? i.labels.forEach(l => bump(m, l)) : bump(m, "No label"));
  } else if (facet === "Priority") {
    issues.forEach(i => bump(m, priorityLabel(i.priority)));
  } else {
    issues.forEach(i => bump(m, i.project || "No project"));
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function facetIcon(facet, key) {
  if (facet === "Assignees") return key === "No assignee" ? /*#__PURE__*/React.createElement(Lic, {
    name: "user-x",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }) : /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: key[0],
    size: 18
  });
  if (facet === "Labels") return /*#__PURE__*/React.createElement("span", {
    className: "label-dot",
    style: {
      background: key === "No label" ? "var(--fg-4)" : LABELS[key]?.color || "var(--label-gray)"
    }
  });
  if (facet === "Priority") {
    const p = PRIORITIES.find(p => priorityLabel(p) === key) || "none";
    return /*#__PURE__*/React.createElement(PriorityIcon, {
      priority: p,
      size: 15
    });
  }
  return /*#__PURE__*/React.createElement(Lic, {
    name: "box",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-3)"
  });
}
const FACET_FILTER = {
  Assignees: "Assignee",
  Labels: "Labels",
  Priority: "Priority",
  Projects: "Project"
};
function FacetBody({
  issues,
  filters,
  onToggle
}) {
  const [facet, setFacet] = React.useState("Assignees");
  const rows = facetData(issues, facet);
  const ftype = FACET_FILTER[facet];
  const active = key => (filters.find(f => f.type === ftype)?.values || []).includes(key === "No label" ? key : key);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "right-tabs"
  }, ["Assignees", "Labels", "Priority", "Projects"].map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    className: "right-tab" + (facet === t ? " active" : ""),
    onClick: () => setFacet(t)
  }, t))), /*#__PURE__*/React.createElement("div", {
    className: "facet-list"
  }, rows.map(([key, count]) => /*#__PURE__*/React.createElement("div", {
    key: key,
    className: "facet-row" + (active(key) ? " on" : ""),
    onClick: () => onToggle(ftype, key)
  }, facetIcon(facet, key), /*#__PURE__*/React.createElement("span", null, key), /*#__PURE__*/React.createElement("span", {
    className: "fc"
  }, count)))));
}
function RightSidebar({
  issues,
  filters,
  onToggle,
  onClose,
  width = 300,
  onResize
}) {
  const startResize = e => {
    e.preventDefault();
    const sx = e.clientX,
      sw = width;
    const mv = ev => onResize && onResize(Math.max(240, Math.min(520, sw - (ev.clientX - sx))));
    const up = () => {
      document.removeEventListener("mousemove", mv);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", mv);
    document.addEventListener("mouseup", up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "right-side",
    style: {
      width
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "right-resize",
    onMouseDown: startResize
  }), /*#__PURE__*/React.createElement(FacetBody, {
    issues: issues,
    filters: filters,
    onToggle: onToggle
  }));
}

// ---- New Project modal ----
function NewProjectModal({
  onClose,
  onCreate
}) {
  const [name, setName] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim()
    });
    onClose();
  };
  const chip = (icon, label) => /*#__PURE__*/React.createElement("span", {
    className: "v-chip"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: icon,
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), label);
  return /*#__PURE__*/React.createElement("div", {
    className: "scrim",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-crumb"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb-badge"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "box",
    size: 11,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    className: "crumb-team"
  }, "VEC"), /*#__PURE__*/React.createElement("span", {
    className: "crumb-sep"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 13,
    cls: "icon-sm"
  })), /*#__PURE__*/React.createElement("span", {
    className: "crumb-new"
  }, "New project")), /*#__PURE__*/React.createElement("div", {
    className: "mh-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 16
  })))), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, /*#__PURE__*/React.createElement("input", {
    className: "modal-title-input",
    autoFocus: true,
    placeholder: "Project name",
    value: name,
    onChange: e => setName(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") submit();
    }
  }), /*#__PURE__*/React.createElement("textarea", {
    className: "modal-desc-input",
    placeholder: "Add a short summary\u2026",
    value: summary,
    onChange: e => setSummary(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-props"
  }, chip("circle-dashed", "Backlog"), chip("signal-high", "Priority"), chip("user", "Lead"), chip("users", "Members"), chip("calendar", "Target")), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ff"
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: submit
  }, "Create project")))));
}
Object.assign(window, {
  HelpMenu,
  WorkspaceMenu,
  RightSidebar,
  NewProjectModal
});

// ---- Projects right facet sidebar ----
function projFacetData(projects, facet) {
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const m = new Map();
  if (facet === "Lead") projects.forEach(p => bump(m, p.lead || "No lead"));else if (facet === "Priority") projects.forEach(p => bump(m, priorityLabel(p.priority)));else if (facet === "Health") projects.forEach(p => bump(m, HEALTH[p.health].label));else projects.forEach(p => bump(m, PROJECT_STATUS[p.status].label));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function projFacetIcon(facet, key) {
  if (facet === "Lead") return key === "No lead" ? /*#__PURE__*/React.createElement(Lic, {
    name: "user-x",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }) : /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: key[0],
    size: 18
  });
  if (facet === "Priority") {
    const p = PRIORITIES.find(p => priorityLabel(p) === key) || "none";
    return /*#__PURE__*/React.createElement(PriorityIcon, {
      priority: p,
      size: 15
    });
  }
  if (facet === "Health") {
    const h = Object.values(HEALTH).find(h => h.label === key);
    return /*#__PURE__*/React.createElement(Lic, {
      name: "activity",
      size: 14,
      cls: "icon-sm",
      color: h ? h.color : "var(--fg-3)"
    });
  }
  const sk = Object.keys(PROJECT_STATUS).find(k => PROJECT_STATUS[k].label === key);
  return /*#__PURE__*/React.createElement(StatusIcon, {
    status: PROJECT_STATUS[sk] ? PROJECT_STATUS[sk].key : "backlog",
    size: 14
  });
}
function ProjectFacetBody({
  projects,
  projFilter,
  onToggle
}) {
  const [facet, setFacet] = React.useState("Lead");
  const rows = projFacetData(projects, facet);
  const active = key => (projFilter[facet] || []).includes(key);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "right-tabs"
  }, ["Lead", "Priority", "Health", "Status"].map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    className: "right-tab" + (facet === t ? " active" : ""),
    onClick: () => setFacet(t)
  }, t))), /*#__PURE__*/React.createElement("div", {
    className: "facet-list"
  }, rows.map(([key, count]) => /*#__PURE__*/React.createElement("div", {
    key: key,
    className: "facet-row" + (active(key) ? " on" : ""),
    onClick: () => onToggle(facet, key)
  }, projFacetIcon(facet, key), /*#__PURE__*/React.createElement("span", null, key), /*#__PURE__*/React.createElement("span", {
    className: "fc"
  }, count)))));
}
function ProjectRightSidebar({
  projects,
  projFilter,
  onToggle,
  width = 300,
  onResize
}) {
  const startResize = e => {
    e.preventDefault();
    const sx = e.clientX,
      sw = width;
    const mv = ev => onResize && onResize(Math.max(240, Math.min(520, sw - (ev.clientX - sx))));
    const up = () => {
      document.removeEventListener("mousemove", mv);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", mv);
    document.addEventListener("mouseup", up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "right-side",
    style: {
      width
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "right-resize",
    onMouseDown: startResize
  }), /*#__PURE__*/React.createElement(ProjectFacetBody, {
    projects: projects,
    projFilter: projFilter,
    onToggle: onToggle
  }));
}
Object.assign(window, {
  ProjectRightSidebar,
  FacetBody,
  ProjectFacetBody
});

// ---- Unified timeline right panel: segmented Details | Filters ----
function TimelineRightPanel({
  tab,
  setTab,
  width = 300,
  onResize,
  detail,
  facet
}) {
  const startResize = e => {
    e.preventDefault();
    const sx = e.clientX,
      sw = width;
    const mv = ev => onResize && onResize(Math.max(240, Math.min(520, sw - (ev.clientX - sx))));
    const up = () => {
      document.removeEventListener("mousemove", mv);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", mv);
    document.addEventListener("mouseup", up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "right-side",
    style: {
      width
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "right-resize",
    onMouseDown: startResize
  }), /*#__PURE__*/React.createElement("div", {
    className: "trp-seg"
  }, /*#__PURE__*/React.createElement("div", {
    className: "trp-tab" + (tab === "details" ? " active" : ""),
    onClick: () => setTab("details")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "panel-right",
    size: 13,
    cls: "icon-sm"
  }), "Details"), /*#__PURE__*/React.createElement("div", {
    className: "trp-tab" + (tab === "filters" ? " active" : ""),
    onClick: () => setTab("filters")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "list-filter",
    size: 13,
    cls: "icon-sm"
  }), "Filters")), tab === "details" ? detail || /*#__PURE__*/React.createElement("div", {
    className: "trp-empty"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "mouse-pointer-click",
    size: 28,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("span", null, "Select a bar to see details")) : facet);
}
Object.assign(window, {
  TimelineRightPanel
});

// ---- More menu (sidebar) ----
function MoreMenu({
  anchor,
  onClose,
  onNav,
  onCustomize
}) {
  const top = anchor ? anchor.bottom + 4 : 300;
  const left = anchor ? anchor.left : 12;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "overlay",
    style: {
      zIndex: 48
    },
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-menu",
    style: {
      position: "fixed",
      top,
      left,
      width: 200,
      zIndex: 49
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    onClick: () => {
      onNav("settings");
      onClose();
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "users",
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), "Members"), /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    onClick: () => {
      onNav("settings");
      onClose();
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "layout-grid",
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), "Teams"), /*#__PURE__*/React.createElement("div", {
    className: "panel-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    onClick: () => {
      onCustomize();
      onClose();
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "square-pen",
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), "Customize sidebar")));
}

// ---- Customize sidebar modal (Linear-level) ----
function SidebarVisSelect({
  value,
  onChange
}) {
  const [open, setOpen] = React.useState(false);
  const opts = ["Always show", "Show when badged", "Don't show"];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "set-select",
    onClick: e => {
      e.stopPropagation();
      setOpen(!open);
    }
  }, value, " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 13,
    cls: "icon-sm"
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 64
    },
    onClick: e => {
      e.stopPropagation();
      setOpen(false);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 34,
      right: 0,
      width: 190,
      zIndex: 65
    }
  }, opts.map(o => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: o,
    onClick: e => {
      e.stopPropagation();
      onChange(o);
      setOpen(false);
    }
  }, o, o === value && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    style: {
      marginLeft: "auto"
    },
    color: "var(--accent)"
  }))))));
}
function CustomizeSidebarModal({
  cfg,
  setCfg,
  onClose
}) {
  const get = k => {
    const v = cfg[k];
    if (v === false) return "Don't show";
    if (typeof v === "string") return v;
    return "Always show";
  };
  const set = (k, v) => setCfg({
    ...cfg,
    [k]: v
  });
  const [badge, setBadge] = React.useState(cfg.badgeStyle || "Count");
  const [badgeOpen, setBadgeOpen] = React.useState(false);
  const groups = [["Personal", [["inbox", "Inbox", "inbox"], ["reviews", "Reviews", "git-pull-request"], ["my", "My issues", "crosshair"], ["triage", "Triage", "shield-alert"]]], ["Workspace", [["projects", "Projects", "box"], ["views", "Views", "layers"], ["cycles", "Cycles", "refresh-cw"], ["insights", "Insights", "bar-chart-3"]]], ["Docs & data", [["docs", "Documents", "file-text"], ["wiki", "Wiki", "book-open"], ["database", "Roadmap", "table-2"], ["canvas", "Whiteboard", "pen-tool"], ["graph", "Graph", "share-2"], ["import", "Import", "download"]]], ["Apps", [["chat", "Chat", "message-square"], ["crm", "CRM", "contact"], ["calendar", "Calendar", "calendar"], ["forms", "Forms", "clipboard-list"], ["support", "Support", "life-buoy"], ["changelog", "Changelog", "megaphone"]]]];
  const row = (key, label, icon) => /*#__PURE__*/React.createElement("div", {
    className: "cs-row",
    key: key
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "grip-vertical",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement(Lic, {
    name: icon,
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "si-label"
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement(SidebarVisSelect, {
    value: get(key),
    onChange: v => set(key, v)
  })));
  return /*#__PURE__*/React.createElement("div", {
    className: "scrim",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      width: 480
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb-new"
  }, "Customize sidebar"), /*#__PURE__*/React.createElement("div", {
    className: "mh-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 16
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "6px 16px 18px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cs-row",
    style: {
      borderBottom: "1px solid var(--border)",
      paddingBottom: 12,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "si-label",
    style: {
      marginLeft: 2
    }
  }, "Default badge style"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "set-select",
    onClick: () => setBadgeOpen(!badgeOpen)
  }, badge, " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 13,
    cls: "icon-sm"
  })), badgeOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 64
    },
    onClick: () => setBadgeOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 34,
      right: 0,
      width: 160,
      zIndex: 65
    }
  }, ["Count", "Dot", "None"].map(o => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: o,
    onClick: () => {
      setBadge(o);
      set("badgeStyle", o);
      setBadgeOpen(false);
    }
  }, o, o === badge && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    style: {
      marginLeft: "auto"
    },
    color: "var(--accent)"
  }))))))), groups.map(([cap, items]) => /*#__PURE__*/React.createElement("div", {
    key: cap
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-cap",
    style: {
      padding: "12px 0 4px"
    }
  }, cap), items.map(([k, l, ic]) => row(k, l, ic)))))));
}

// ---- Import issues modal ----
function ImportModal({
  onClose
}) {
  const sources = [["github", "GitHub"], ["trello", "Trello"], ["columns-3", "Jira"], ["check-square", "Asana"], ["file-spreadsheet", "CSV file"], ["box", "Shortcut"]];
  return /*#__PURE__*/React.createElement("div", {
    className: "scrim",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      width: 520
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb-new"
  }, "Import issues"), /*#__PURE__*/React.createElement("div", {
    className: "mh-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 16
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "4px 16px 8px",
      color: "var(--fg-3)",
      font: "var(--fw-regular) 13px var(--font-sans)"
    }
  }, "Choose a source to import issues from."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      padding: "8px 16px 16px"
    }
  }, sources.map(([icon, label]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    className: "import-src"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: icon,
    size: 18,
    cls: "icon-sm",
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement("span", null, label))))));
}

// ---- Invite people modal ----
function InviteModal({
  onClose
}) {
  const [email, setEmail] = React.useState("");
  const [invited, setInvited] = React.useState([]);
  const send = () => {
    if (!/.+@.+/.test(email)) return;
    setInvited(v => [...v, email.trim()]);
    setEmail("");
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "scrim",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      width: 520
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb-new"
  }, "Invite people"), /*#__PURE__*/React.createElement("div", {
    className: "mh-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 16
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 16px 4px",
      color: "var(--fg-3)",
      font: "var(--fw-regular) 13px var(--font-sans)"
    }
  }, "Invite teammates by email to join vector-team."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      padding: "8px 16px 12px"
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "v-input",
    placeholder: "name@company.com",
    value: email,
    onChange: e => setEmail(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") send();
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: send
  }, "Send invite")), invited.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 16px 16px"
    }
  }, invited.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "set-item",
    style: {
      padding: "8px 0",
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "mail",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "si-label"
  }, e)), /*#__PURE__*/React.createElement("span", {
    className: "v-meta",
    style: {
      color: "var(--label-green)"
    }
  }, "Invited"))))));
}
Object.assign(window, {
  MoreMenu,
  CustomizeSidebarModal,
  ImportModal,
  InviteModal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Menus.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Mobile.jsx
try { (() => {
// Mobile.jsx — mobile shell. NOT the desktop layout rescaled: a distinct
// composition (large-title home, section list, full-screen drilldown, floating
// pill tab bar + search FAB) matching how Linear's mobile app is structured.

function MTopBar({
  title,
  onBack,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "m-topbar"
  }, onBack && /*#__PURE__*/React.createElement("button", {
    className: "m-icon-btn",
    onClick: onBack,
    "aria-label": "Back"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-left",
    size: 22
  })), /*#__PURE__*/React.createElement("span", {
    className: "m-topbar-title" + (onBack ? " sm" : "")
  }, title), action);
}
function MSection({
  label,
  children,
  empty
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "m-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "m-section-label"
  }, label), empty ? /*#__PURE__*/React.createElement("div", {
    className: "m-section-empty"
  }, empty) : children);
}
function MRow({
  icon,
  title,
  sub,
  right,
  onClick,
  accent
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: "m-row",
    onClick: onClick
  }, icon && /*#__PURE__*/React.createElement("span", {
    className: "m-row-icon",
    style: accent ? {
      background: accent
    } : null
  }, icon), /*#__PURE__*/React.createElement("span", {
    className: "m-row-main"
  }, /*#__PURE__*/React.createElement("span", {
    className: "m-row-title"
  }, title), sub && /*#__PURE__*/React.createElement("span", {
    className: "m-row-sub"
  }, sub)), right);
}
function MIssueRow({
  issue,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: "m-issue",
    onClick: () => onOpen(issue)
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: issue.status,
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "m-issue-main"
  }, /*#__PURE__*/React.createElement("span", {
    className: "m-issue-title"
  }, issue.title), /*#__PURE__*/React.createElement("span", {
    className: "m-issue-meta"
  }, issue.id, issue.project ? " · " + issue.project : "")), /*#__PURE__*/React.createElement(PriorityIcon, {
    priority: issue.priority,
    size: 16
  }));
}
function MHome({
  teams,
  favorites,
  savedViews,
  onTeam,
  onView
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MTopBar, {
    title: teams[0] ? teams[0].name : "Workspace",
    action: /*#__PURE__*/React.createElement("button", {
      className: "m-fab-sm",
      "aria-label": "New issue"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "square-pen",
      size: 19
    }))
  }), /*#__PURE__*/React.createElement("div", {
    className: "m-scroll"
  }, /*#__PURE__*/React.createElement(MSection, {
    label: "Favorites",
    empty: favorites.length === 0 ? "Add items to your favorites for fast access" : null
  }, savedViews.filter(v => favorites.includes(v.id)).map(v => /*#__PURE__*/React.createElement(MRow, {
    key: v.id,
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: v.icon || "layers",
      size: 17
    }),
    title: v.name,
    onClick: () => onView(v)
  }))), /*#__PURE__*/React.createElement(MSection, {
    label: "Teams"
  }, teams.map(t => /*#__PURE__*/React.createElement(MRow, {
    key: t.id,
    accent: t.color,
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: t.icon || "users",
      size: 15,
      color: "#fff"
    }),
    title: t.name,
    onClick: () => onTeam(t)
  })))));
}
function MList({
  title,
  issues,
  onBack,
  onOpen,
  emptyText
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MTopBar, {
    title: title,
    onBack: onBack,
    action: /*#__PURE__*/React.createElement("button", {
      className: "m-icon-btn",
      "aria-label": "Filter"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "list-filter",
      size: 19
    }))
  }), /*#__PURE__*/React.createElement("div", {
    className: "m-scroll"
  }, issues.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "m-empty"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "inbox",
    size: 30,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("span", null, emptyText || "Nothing here yet")) : issues.map(i => /*#__PURE__*/React.createElement(MIssueRow, {
    key: i.id,
    issue: i,
    onOpen: onOpen
  }))));
}
function MDetail({
  issue,
  onBack,
  onCycle
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MTopBar, {
    title: issue.id,
    onBack: onBack,
    action: /*#__PURE__*/React.createElement("button", {
      className: "m-icon-btn",
      "aria-label": "More"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "more-horizontal",
      size: 19
    }))
  }), /*#__PURE__*/React.createElement("div", {
    className: "m-scroll"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "m-detail-title"
  }, issue.title), /*#__PURE__*/React.createElement("div", {
    className: "m-chips"
  }, /*#__PURE__*/React.createElement("button", {
    className: "m-chip",
    onClick: () => onCycle(issue.id)
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: issue.status,
    size: 15
  }), statusLabel ? statusLabel(issue.status) : issue.status), /*#__PURE__*/React.createElement("span", {
    className: "m-chip"
  }, /*#__PURE__*/React.createElement(PriorityIcon, {
    priority: issue.priority,
    size: 15
  }), issue.priority), issue.assignee && /*#__PURE__*/React.createElement("span", {
    className: "m-chip"
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: issue.assignee[0],
    size: 17
  }), issue.assignee)), /*#__PURE__*/React.createElement("p", {
    className: "m-detail-body"
  }, issue.body || "No description provided."), /*#__PURE__*/React.createElement("div", {
    className: "m-detail-sec"
  }, "Activity"), /*#__PURE__*/React.createElement("div", {
    className: "m-activity"
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: "K",
    size: 26
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "\uAE40\uD601\uADDC"), " created this issue", /*#__PURE__*/React.createElement("em", null, issue.created)))));
}
function MSearch({
  issues,
  onClose,
  onOpen
}) {
  const [q, setQ] = React.useState("");
  const hits = q ? issues.filter(i => (i.title + " " + i.id).toLowerCase().includes(q.toLowerCase())) : [];
  return /*#__PURE__*/React.createElement("div", {
    className: "m-search"
  }, /*#__PURE__*/React.createElement("div", {
    className: "m-search-bar"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "search",
    size: 18,
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search issues\u2026"
  }), /*#__PURE__*/React.createElement("button", {
    className: "m-icon-btn",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 20
  }))), /*#__PURE__*/React.createElement("div", {
    className: "m-scroll"
  }, q && hits.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "m-empty"
  }, /*#__PURE__*/React.createElement("span", null, "No results for \u201C", q, "\u201D")), hits.map(i => /*#__PURE__*/React.createElement(MIssueRow, {
    key: i.id,
    issue: i,
    onOpen: onOpen
  }))));
}
function MobileApp({
  issues,
  teams,
  savedViews,
  favorites,
  onCycle
}) {
  const [tab, setTab] = React.useState("home");
  const [stack, setStack] = React.useState(null); // {kind:'list'|'detail', ...}
  const [searching, setSearching] = React.useState(false);
  const me = "김혁규";
  const openIssue = i => setStack({
    kind: "detail",
    issue: i
  });
  const back = () => setStack(s => s && s.kind === "detail" && s.from ? s.from : null);
  const tabs = [["home", "home", "Home"], ["inbox", "inbox", "Inbox"], ["my", "crosshair", "My issues"], ["views", "layers", "Views"]];
  let screen;
  if (stack && stack.kind === "detail") screen = /*#__PURE__*/React.createElement(MDetail, {
    issue: stack.issue,
    onBack: back,
    onCycle: onCycle
  });else if (stack && stack.kind === "list") screen = /*#__PURE__*/React.createElement(MList, {
    title: stack.title,
    issues: stack.issues,
    onBack: () => setStack(null),
    onOpen: i => setStack({
      kind: "detail",
      issue: i,
      from: stack
    })
  });else if (tab === "home") screen = /*#__PURE__*/React.createElement(MHome, {
    teams: teams,
    favorites: favorites,
    savedViews: savedViews,
    onTeam: t => setStack({
      kind: "list",
      title: t.name,
      issues: issues.filter(i => i.team === t.id)
    }),
    onView: v => setStack({
      kind: "list",
      title: v.name,
      issues
    })
  });else if (tab === "inbox") screen = /*#__PURE__*/React.createElement(MList, {
    title: "Inbox",
    issues: issues.filter(i => (i.subscribers || []).includes(me)),
    onOpen: openIssue,
    emptyText: "No notifications"
  });else if (tab === "my") screen = /*#__PURE__*/React.createElement(MList, {
    title: "My issues",
    issues: issues.filter(i => i.assignee === me),
    onOpen: openIssue,
    emptyText: "No issues assigned to you"
  });else screen = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MTopBar, {
    title: "Views"
  }), /*#__PURE__*/React.createElement("div", {
    className: "m-scroll"
  }, /*#__PURE__*/React.createElement(MSection, {
    label: "Saved views"
  }, savedViews.map(v => /*#__PURE__*/React.createElement(MRow, {
    key: v.id,
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: v.icon || "layers",
      size: 17
    }),
    title: v.name,
    sub: v.desc,
    onClick: () => setStack({
      kind: "list",
      title: v.name,
      issues
    })
  })))));
  return /*#__PURE__*/React.createElement("div", {
    className: "m-app"
  }, screen, /*#__PURE__*/React.createElement("div", {
    className: "m-tabbar-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "m-tabbar"
  }, tabs.map(([k, ic]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "m-tab" + (tab === k && !stack ? " active" : ""),
    onClick: () => {
      setTab(k);
      setStack(null);
    },
    "aria-label": k
  }, /*#__PURE__*/React.createElement(Lic, {
    name: ic,
    size: 21
  })))), /*#__PURE__*/React.createElement("button", {
    className: "m-fab",
    onClick: () => setSearching(true),
    "aria-label": "Search"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "search",
    size: 21
  }))), searching && /*#__PURE__*/React.createElement(MSearch, {
    issues: issues,
    onClose: () => setSearching(false),
    onOpen: i => {
      setSearching(false);
      openIssue(i);
    }
  }));
}
Object.assign(window, {
  MobileApp
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Mobile.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/MyIssues.jsx
try { (() => {
// MyIssues.jsx — Assigned / Created / Subscribed / Activity tabs (real data)
const ME = "김혁규";
const CREATOR = {
  "VEC-1": ME,
  "VEC-3": ME,
  "VEC-2": "Alex Park",
  "VEC-4": ME,
  "VEC-5": "Jordan Lee",
  "VEC-8": ME,
  "VEC-6": ME,
  "VEC-7": "Alex Park"
};
function MyIssueRow({
  issue,
  onOpen,
  onCycle
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "issue-row",
    onClick: () => onOpen(issue)
  }, /*#__PURE__*/React.createElement("span", {
    className: "issue-id"
  }, issue.id), /*#__PURE__*/React.createElement("span", {
    className: "statusbtn",
    style: {
      width: 22,
      height: 22
    },
    onClick: e => {
      e.stopPropagation();
      onCycle(issue.id);
    }
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: issue.status,
    size: 14
  })), /*#__PURE__*/React.createElement("span", {
    className: "issue-priority"
  }, /*#__PURE__*/React.createElement(PriorityIcon, {
    priority: issue.priority,
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    className: "issue-title"
  }, issue.title), /*#__PURE__*/React.createElement("span", {
    className: "issue-meta"
  }, issue.project && /*#__PURE__*/React.createElement("span", {
    className: "label-chip"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "box",
    size: 11,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), issue.project), issue.labels.map(l => /*#__PURE__*/React.createElement("span", {
    className: "label-chip",
    key: l
  }, /*#__PURE__*/React.createElement("span", {
    className: "label-dot",
    style: {
      background: LABELS[l].color
    }
  }), l)), /*#__PURE__*/React.createElement("span", {
    className: "issue-date"
  }, issue.updated), issue.assignee ? /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: issue.assignee[0],
    size: 20
  }) : /*#__PURE__*/React.createElement("span", {
    className: "avatar empty"
  })));
}
function MyIssueGroups({
  list,
  onOpen,
  onCycle,
  emptyText
}) {
  if (list.length === 0) return /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      height: 280
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "check-circle-2",
    size: 36,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, emptyText));
  const groups = buildGroups(list, "Status");
  return /*#__PURE__*/React.createElement(React.Fragment, null, groups.filter(g => g.items.length).map(g => /*#__PURE__*/React.createElement(GroupBlock, {
    key: g.key,
    g: g,
    onOpen: onOpen,
    onCycle: onCycle
  })));
}
function GroupBlock({
  g,
  onOpen,
  onCycle
}) {
  const [open, setOpen] = React.useState(true);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "group-header",
    onClick: () => setOpen(!open)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 14,
    cls: "icon-sm chev" + (open ? "" : " collapsed")
  }), g.icon, /*#__PURE__*/React.createElement("span", {
    className: "gh-title"
  }, g.label), /*#__PURE__*/React.createElement("span", {
    className: "gh-count"
  }, g.items.length)), open && g.items.map(i => /*#__PURE__*/React.createElement(MyIssueRow, {
    key: i.id,
    issue: i,
    onOpen: onOpen,
    onCycle: onCycle
  })));
}
function ActivityFeed({
  issues
}) {
  // synthesize a reverse-chron activity feed from issue metadata
  const events = [];
  issues.forEach(i => {
    events.push({
      id: i.id + "-c",
      icon: "circle-dot",
      actor: CREATOR[i.id] || ME,
      verb: "created",
      issue: i,
      when: i.created,
      status: i.status
    });
    if (i.updated !== i.created) events.push({
      id: i.id + "-u",
      icon: "pencil",
      actor: ME,
      verb: i.status === "done" ? "completed" : "updated",
      issue: i,
      when: i.updated,
      status: i.status
    });
  });
  const order = ["May 6", "May 3", "Jun 1", "Apr 18", "Mar 9", "Mar 2", "Feb 27", "Feb 26", "Feb 20", "Feb 18"];
  events.sort((a, b) => order.indexOf(a.when) - order.indexOf(b.when));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 20px 40px",
      maxWidth: 760
    }
  }, events.map(e => /*#__PURE__*/React.createElement("div", {
    className: "activity-item",
    key: e.id,
    style: {
      padding: "10px 0"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: e.actor[0],
    size: 22
  }), /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, /*#__PURE__*/React.createElement("b", null, e.actor), " ", e.verb, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-3)"
    }
  }, e.issue.id), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-2)"
    }
  }, " ", e.issue.title), /*#__PURE__*/React.createElement("span", {
    className: "aw"
  }, e.when)), /*#__PURE__*/React.createElement(StatusIcon, {
    status: e.status,
    size: 14
  }))));
}
function MyIssues({
  issues,
  onOpen,
  onCycle,
  onCompose
}) {
  const [tab, setTab] = React.useState("Assigned");
  const tabs = ["Assigned", "Created", "Subscribed", "Activity"];
  const assigned = issues.filter(i => i.assignee === ME);
  const created = issues.filter(i => (CREATOR[i.id] || ME) === ME);
  const subscribed = issues.filter(i => (i.subscribers || []).includes(ME));
  return /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "my-tabs"
  }, tabs.map(t => {
    const n = t === "Assigned" ? assigned.length : t === "Created" ? created.length : t === "Subscribed" ? subscribed.length : null;
    return /*#__PURE__*/React.createElement("div", {
      key: t,
      className: "seg" + (tab === t ? " active" : ""),
      onClick: () => setTab(t)
    }, t, n != null && /*#__PURE__*/React.createElement("span", {
      className: "seg-count"
    }, n));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    style: {
      height: 28
    },
    onClick: () => onCompose("todo")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 14,
    cls: "icon-sm"
  }), "New issue"))), tab === "Assigned" && /*#__PURE__*/React.createElement(MyIssueGroups, {
    list: assigned,
    onOpen: onOpen,
    onCycle: onCycle,
    emptyText: "No issues assigned to you"
  }), tab === "Created" && /*#__PURE__*/React.createElement(MyIssueGroups, {
    list: created,
    onOpen: onOpen,
    onCycle: onCycle,
    emptyText: "You haven't created any issues"
  }), tab === "Subscribed" && /*#__PURE__*/React.createElement(MyIssueGroups, {
    list: subscribed,
    onOpen: onOpen,
    onCycle: onCycle,
    emptyText: "You aren't subscribed to any issues"
  }), tab === "Activity" && /*#__PURE__*/React.createElement(ActivityFeed, {
    issues: issues
  }));
}
Object.assign(window, {
  MyIssues,
  CREATOR,
  ME
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/MyIssues.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/NavHoverActions.jsx
try { (() => {
// SidebarHoverActions.jsx — Vector DS contribution
// Linear-style hover affordances for the sidebar. Three pieces:
//   <NavCaption>  — collapsible section caption with a hover "+" create button
//   <NavRow>      — nav row whose count fades out on hover, revealing a "…" menu
//   useNavMenu()  — single-open-menu state shared across rows
// Icons are inline SVG (no icon-set dependency). Styles: sidebar-hover-actions.css.

/* Plus / dots / chevron glyphs — geometry tuned to Lucide stroke weight */
function NavPlusGlyph() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 14 14",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 3.3V10.7M3.3 7H10.7",
    stroke: "currentColor",
    strokeWidth: "1.3",
    strokeLinecap: "round"
  }));
}
function NavDotsGlyph() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 16 16"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "3.6",
    cy: "8",
    r: "1.3",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "1.3",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12.4",
    cy: "8",
    r: "1.3",
    fill: "currentColor"
  }));
}
function NavChevGlyph({
  open
}) {
  return /*#__PURE__*/React.createElement("svg", {
    className: "nav-cap-chev" + (open ? " open" : ""),
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M9 18l6-6-6-6",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}

/* Section caption.
   props: label, open (bool), onToggle, onAdd (optional — shows hover "+"), addTitle */
function NavCaption({
  label,
  open,
  onToggle,
  onAdd,
  addTitle = "Add"
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "nav-caption nav-caption-btn",
    onClick: onToggle
  }, /*#__PURE__*/React.createElement("span", {
    className: "nav-cap-lab"
  }, label), /*#__PURE__*/React.createElement(NavChevGlyph, {
    open: open
  }), onAdd && /*#__PURE__*/React.createElement("button", {
    className: "nav-cap-add",
    title: addTitle,
    onClick: e => {
      e.stopPropagation();
      onAdd();
    }
  }, /*#__PURE__*/React.createElement(NavPlusGlyph, null)));
}

/* Single-open menu state for a whole sidebar. Returns [openId, toggle(id), close()]. */
function useNavMenu() {
  const [openId, setOpenId] = React.useState(null);
  const toggle = id => setOpenId(cur => cur === id ? null : id);
  const close = () => setOpenId(null);
  return [openId, toggle, close];
}

/* Hover "…" button + anchored context menu. Render as the LAST child of a .nav-item-row.
   props: id, menu/toggle/close (from useNavMenu), items: [{icon?, label, run, danger?} | {sep:true}]
   `icon` is an optional render prop: (item) => node — pass your own <Lic/> etc. */
function NavRowMenu({
  id,
  menu,
  toggle,
  close,
  items,
  moreTitle = "More"
}) {
  const open = menu === id;
  return /*#__PURE__*/React.createElement("div", {
    className: "nav-item-more-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: "nav-item-more",
    title: moreTitle,
    onClick: e => {
      e.stopPropagation();
      toggle(id);
    }
  }, /*#__PURE__*/React.createElement(NavDotsGlyph, null)), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "v-menu-scrim",
    onClick: e => {
      e.stopPropagation();
      close();
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "nav-ctx v-menu",
    onClick: e => e.stopPropagation()
  }, items.map((it, i) => it.sep ? /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "v-menu-sep"
  }) : /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "v-menu-item" + (it.danger ? " danger" : ""),
    onClick: () => {
      close();
      it.run();
    }
  }, it.icon, /*#__PURE__*/React.createElement("span", null, it.label))))));
}

/* Convenience row: leading node + label + count (fades on hover) + "…" menu.
   props: leading (node), label, count?, active?, onClick, menuId, menuState ([menu,toggle,close]), items */
function NavRow({
  leading,
  label,
  count,
  active,
  onClick,
  menuId,
  menuState,
  items
}) {
  const [menu, toggle, close] = menuState;
  return /*#__PURE__*/React.createElement("div", {
    className: "nav-item nav-sub nav-item-row" + (active ? " active" : ""),
    onClick: onClick
  }, leading, /*#__PURE__*/React.createElement("span", {
    className: "nav-item-lab"
  }, label), items && /*#__PURE__*/React.createElement(NavRowMenu, {
    id: menuId,
    menu: menu,
    toggle: toggle,
    close: close,
    items: items
  }), count != null && /*#__PURE__*/React.createElement("span", {
    className: "count nav-item-count"
  }, count));
}
Object.assign(window, {
  NavCaption,
  NavRow,
  NavRowMenu,
  useNavMenu,
  NavPlusGlyph,
  NavDotsGlyph,
  NavChevGlyph
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/NavHoverActions.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Overlays.jsx
try { (() => {
// Overlays.jsx — Search modal + Command menu (⌘K)
function SearchModal({
  issues,
  onClose,
  onOpenIssue
}) {
  const [q, setQ] = React.useState("");
  const results = q.trim() ? issues.filter(i => (i.title + " " + i.id).toLowerCase().includes(q.toLowerCase())) : issues;
  return /*#__PURE__*/React.createElement("div", {
    className: "cmd-scrim",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "cmd",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "cmd-input-row"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "search",
    size: 18,
    cls: "icon",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    placeholder: "Search issues, projects, docs\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  }), /*#__PURE__*/React.createElement("span", {
    className: "v-mono",
    style: {
      color: "var(--fg-4)"
    }
  }, "esc")), /*#__PURE__*/React.createElement("div", {
    className: "cmd-list"
  }, results.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "search-empty"
  }, "No results for \u201C", q, "\u201D"), results.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "cmd-cap"
  }, "Issues"), results.map(i => /*#__PURE__*/React.createElement("div", {
    className: "cmd-item",
    key: i.id,
    onClick: () => {
      onOpenIssue(i);
      onClose();
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ci-icon"
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: i.status,
    size: 15
  })), /*#__PURE__*/React.createElement("span", null, i.title), /*#__PURE__*/React.createElement("span", {
    className: "ci-id"
  }, i.id))))));
}
function CommandMenu({
  onClose,
  onCompose,
  onNav,
  onSearch,
  onToggleTheme,
  theme,
  onNewProject,
  ctxIssue,
  onIssueAction
}) {
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [page, setPage] = React.useState(null); // null | 'status' | 'priority' | 'assignee'

  const baseCmds = () => {
    const list = [];
    if (ctxIssue) {
      list.push({
        group: ctxIssue.id,
        icon: "circle-dashed",
        label: "Change status…",
        sub: "S",
        run: () => setPage("status"),
        keep: true
      });
      list.push({
        group: ctxIssue.id,
        icon: "signal-high",
        label: "Change priority…",
        sub: "1–4",
        run: () => setPage("priority"),
        keep: true
      });
      list.push({
        group: ctxIssue.id,
        icon: "user",
        label: "Assign to…",
        sub: "A",
        run: () => setPage("assignee"),
        keep: true
      });
      list.push({
        group: ctxIssue.id,
        icon: "circle-check",
        label: "Mark as Done",
        run: () => onIssueAction(ctxIssue.id, {
          status: "done"
        })
      });
      list.push({
        group: ctxIssue.id,
        icon: "trash-2",
        label: "Delete issue",
        run: () => onIssueAction(ctxIssue.id, {
          __delete: true
        })
      });
    }
    list.push({
      group: "Create",
      icon: "square-pen",
      label: "New issue",
      sub: "C",
      run: onCompose
    }, {
      group: "Create",
      icon: "box",
      label: "New project",
      run: onNewProject || (() => onNav("projects"))
    }, {
      group: "Navigation",
      icon: "search",
      label: "Search…",
      sub: "/",
      run: onSearch
    }, {
      group: "Navigation",
      icon: "inbox",
      label: "Go to Inbox",
      sub: "G I",
      run: () => onNav("inbox")
    }, {
      group: "Navigation",
      icon: "crosshair",
      label: "Go to My issues",
      sub: "G M",
      run: () => onNav("my")
    }, {
      group: "Navigation",
      icon: "copy",
      label: "Go to Issues",
      sub: "G E",
      run: () => onNav("issues")
    }, {
      group: "Navigation",
      icon: "box",
      label: "Go to Projects",
      sub: "G P",
      run: () => onNav("projects")
    }, {
      group: "Navigation",
      icon: "refresh-cw",
      label: "Go to Cycles",
      run: () => onNav("cycles")
    }, {
      group: "Navigation",
      icon: "shield-alert",
      label: "Go to Triage",
      run: () => onNav("triage")
    }, {
      group: "Navigation",
      icon: "git-pull-request",
      label: "Go to Reviews",
      run: () => onNav("reviews")
    }, {
      group: "Preferences",
      icon: theme === "dark" ? "sun" : "moon",
      label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      run: onToggleTheme
    }, {
      group: "Preferences",
      icon: "settings-2",
      label: "Open settings",
      sub: "G S",
      run: () => onNav("settings")
    });
    return list;
  };
  const subCmds = () => {
    if (page === "status") return ["backlog", "todo", "progress", "review", "done", "canceled"].map(s => ({
      group: "Set status",
      icon: null,
      statusIcon: s,
      label: statusLabel(s),
      run: () => onIssueAction(ctxIssue.id, {
        status: s
      })
    }));
    if (page === "priority") return PRIORITIES.map(p => ({
      group: "Set priority",
      icon: null,
      prioIcon: p,
      label: priorityLabel(p),
      run: () => onIssueAction(ctxIssue.id, {
        priority: p
      })
    }));
    if (page === "assignee") return ASSIGNEES.map(a => ({
      group: "Assign to",
      icon: a === "Unassigned" ? "user-x" : "user",
      label: a,
      run: () => onIssueAction(ctxIssue.id, {
        assignee: a === "Unassigned" ? null : a
      })
    }));
    return [];
  };
  const cmds = page ? subCmds() : baseCmds();
  const filtered = cmds.filter(c => c.label.toLowerCase().includes(q.toLowerCase()));
  React.useEffect(() => {
    setActive(0);
  }, [q, page]);
  const runCmd = c => {
    c.run();
    if (!c.keep) onClose();else {
      setQ("");
    }
  };
  const onKey = e => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(a => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = filtered[active];
      if (c) runCmd(c);
    } else if (e.key === "Backspace" && q === "" && page) {
      e.preventDefault();
      setPage(null);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (page) setPage(null);else onClose();
    }
  };
  let lastGroup = null;
  return /*#__PURE__*/React.createElement("div", {
    className: "cmd-scrim",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "cmd",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "cmd-input-row"
  }, page ? /*#__PURE__*/React.createElement("span", {
    className: "cmd-back",
    onClick: () => setPage(null)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-left",
    size: 16,
    cls: "icon"
  })) : /*#__PURE__*/React.createElement(Lic, {
    name: "navigation",
    size: 17,
    cls: "icon",
    color: "var(--accent)"
  }), ctxIssue && /*#__PURE__*/React.createElement("span", {
    className: "cmd-ctx"
  }, ctxIssue.id), /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    placeholder: page ? "Filter…" : ctxIssue ? "Issue commands…" : "Type a command or search…",
    value: q,
    onChange: e => setQ(e.target.value),
    onKeyDown: onKey
  }), /*#__PURE__*/React.createElement("span", {
    className: "v-mono",
    style: {
      color: "var(--fg-4)"
    }
  }, "\u2318K")), /*#__PURE__*/React.createElement("div", {
    className: "cmd-list"
  }, filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "search-empty"
  }, "No commands"), filtered.map((c, i) => {
    const head = c.group !== lastGroup ? /*#__PURE__*/React.createElement("div", {
      className: "cmd-cap",
      key: "g" + i
    }, c.group) : null;
    lastGroup = c.group;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: c.label + i
    }, head, /*#__PURE__*/React.createElement("div", {
      className: "cmd-item" + (i === active ? " active" : ""),
      onMouseEnter: () => setActive(i),
      onClick: () => runCmd(c)
    }, /*#__PURE__*/React.createElement("span", {
      className: "ci-icon"
    }, c.statusIcon ? /*#__PURE__*/React.createElement(StatusIcon, {
      status: c.statusIcon,
      size: 15
    }) : c.prioIcon ? /*#__PURE__*/React.createElement(PriorityIcon, {
      priority: c.prioIcon,
      size: 15
    }) : /*#__PURE__*/React.createElement(Lic, {
      name: c.icon,
      size: 16,
      cls: "icon-sm"
    })), /*#__PURE__*/React.createElement("span", null, c.label), c.keep && /*#__PURE__*/React.createElement(Lic, {
      name: "chevron-right",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-4)",
      style: {
        marginLeft: "auto"
      }
    }), c.sub && !c.keep && /*#__PURE__*/React.createElement("span", {
      className: "ci-sub"
    }, c.sub)));
  }))));
}
Object.assign(window, {
  SearchModal,
  CommandMenu
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Overlays.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Panels.jsx
try { (() => {
// Panels.jsx — Filter "Add filter" menu (with cascading submenus) + Display options panel

// ---- submenu option sets ----
function statusOpt(key, label, count) {
  return {
    icon: /*#__PURE__*/React.createElement(StatusIcon, {
      status: key,
      size: 14
    }),
    label,
    count
  };
}
function prioOpt(key, label, count) {
  return {
    icon: /*#__PURE__*/React.createElement(PriorityIcon, {
      priority: key,
      size: 15
    }),
    label,
    count
  };
}
function dotOpt(color, label) {
  return {
    icon: /*#__PURE__*/React.createElement("span", {
      className: "label-dot",
      style: {
        background: color
      }
    }),
    label
  };
}
const SUBMENUS = {
  "Status": [statusOpt("backlog", "Backlog"), statusOpt("todo", "Todo", "5 issues"), statusOpt("progress", "In Progress"), statusOpt("review", "In Review"), statusOpt("done", "Done"), statusOpt("canceled", "Canceled"), statusOpt("canceled", "Duplicate")],
  "Status type": [statusOpt("progress", "Triage"), statusOpt("backlog", "Backlog"), statusOpt("todo", "Unstarted", "5 issues"), statusOpt("progress", "Started"), statusOpt("done", "Completed"), statusOpt("canceled", "Canceled")],
  "Priority": [prioOpt("none", "No priority", "5 issues"), prioOpt("urgent", "Urgent"), prioOpt("high", "High"), prioOpt("medium", "Medium"), prioOpt("low", "Low")],
  "Labels": [dotOpt("#EB5757", "Bug"), dotOpt("#BB6BD9", "Feature"), dotOpt("#2D9CDB", "Improvement")],
  "Suggested label": [dotOpt("#EB5757", "Bug"), dotOpt("#BB6BD9", "Feature"), dotOpt("#2D9CDB", "Improvement")],
  "Assignee": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "user-x",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "No assignee",
    count: "5 issues"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "user",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Current user"
  }, {
    icon: /*#__PURE__*/React.createElement(Avatar, {
      from: "#2D9CDB",
      to: "#4C8DFF",
      text: "",
      size: 14
    }),
    label: "김혁규"
  }],
  "Creator": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "user",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Current user",
    count: "1 issue"
  }, {
    icon: /*#__PURE__*/React.createElement(Avatar, {
      from: "#2D9CDB",
      to: "#4C8DFF",
      text: "",
      size: 14
    }),
    label: "김혁규",
    count: "1 issue"
  }],
  "Project": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "No project",
    count: "8 issues"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Q3 Platform revamp"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Design system"
  }],
  "Agent": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "bot-off",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "No agent",
    count: "8 issues"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "bot",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Any agent"
  }],
  "Relations": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "git-merge",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Parent issues"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "git-branch",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Sub-issues"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "ban",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Blocked issues"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "octagon-alert",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Blocking issues"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "copy",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Duplicates"
  }],
  "Dates": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "calendar",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Has due date"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "calendar-x",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "No due date"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "calendar-clock",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Overdue"
  }],
  "Project properties": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "circle-dashed",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Project status"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "signal-high",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Project priority"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "user",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Project lead"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "diamond",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Project milestone"
  }],
  "Subscribers": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "bell-off",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "No subscribers",
    count: "5 issues"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "user",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Current user"
  }, {
    icon: /*#__PURE__*/React.createElement(Avatar, {
      from: "#2D9CDB",
      to: "#4C8DFF",
      text: "",
      size: 14
    }),
    label: "김혁규"
  }],
  "External source": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "github",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "GitHub"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "circle-slash",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "No source",
    count: "8 issues"
  }],
  "Links": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "github",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "GitHub"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "link-2-off",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "No links"
  }],
  "Template": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "file-x",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "No template",
    count: "8 issues"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "file",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Bug report"
  }],
  "Content": [{
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "paperclip",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Has attachments"
  }, {
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "type",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    label: "Has description"
  }]
};
function FilterMenu({
  onClose,
  filters,
  onToggle
}) {
  const [hover, setHover] = React.useState(null); // {key, top}
  const rows = [["sparkles", "AI filter"], ["list-filter", "Advanced filter"], null, ["circle-dashed", "Status"], ["circle-gauge", "Status type"], ["user", "Assignee"], ["bot", "Agent"], ["git-commit-horizontal", "Creator"], ["signal-high", "Priority"], ["tag", "Labels"], ["flag", "Relations"], ["tag", "Suggested label"], ["calendar", "Dates"], null, ["box", "Project"], ["boxes", "Project properties"], null, ["bell", "Subscribers"], ["share-2", "External source"], ["circle-x", "Auto-closed"], ["type", "Content"], ["link", "Links"], ["file", "Template"]];
  const noSub = new Set(["AI filter", "Advanced filter", "Auto-closed"]);
  const sub = hover && SUBMENUS[hover.key];
  const selected = type => filters.find(f => f.type === type)?.values || [];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 96,
      right: 16,
      width: 240,
      maxHeight: "74vh",
      overflowY: "auto"
    },
    onMouseLeave: () => setHover(null)
  }, /*#__PURE__*/React.createElement("div", {
    className: "menu-search"
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    placeholder: "Add filter\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-pad",
    style: {
      paddingTop: 0
    }
  }, rows.map((r, i) => r === null ? /*#__PURE__*/React.createElement("div", {
    className: "panel-sep",
    key: i
  }) : /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: i,
    onClick: r[1] === "Auto-closed" ? () => onToggle("Auto-closed", "Auto-closed") : undefined,
    onMouseEnter: e => setHover(noSub.has(r[1]) ? null : {
      key: r[1],
      top: e.currentTarget.getBoundingClientRect().top
    })
  }, /*#__PURE__*/React.createElement(Lic, {
    name: r[0],
    size: 16,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", null, r[1]), !noSub.has(r[1]) && /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-4)",
    style: {
      marginLeft: "auto"
    }
  }))))), sub && (() => {
    const subH = Math.min(sub.length * 34 + 46, window.innerHeight * 0.7);
    const top = Math.max(8, Math.min(hover.top, window.innerHeight - subH - 12));
    return /*#__PURE__*/React.createElement("div", {
      className: "submenu",
      style: {
        top,
        right: 264
      },
      onMouseEnter: () => setHover(hover)
    }, /*#__PURE__*/React.createElement("div", {
      className: "menu-search"
    }, /*#__PURE__*/React.createElement("input", {
      autoFocus: true,
      placeholder: "Filter\u2026"
    })), sub.map((o, i) => {
      const on = selected(hover.key).includes(o.label);
      return /*#__PURE__*/React.createElement("div", {
        className: "sub-item" + (on ? " on" : ""),
        key: i,
        onClick: () => onToggle(hover.key, o.label)
      }, /*#__PURE__*/React.createElement("span", {
        className: "check"
      }, on && /*#__PURE__*/React.createElement(Lic, {
        name: "check",
        size: 11,
        color: "var(--fg-on-accent)"
      })), o.icon, /*#__PURE__*/React.createElement("span", null, o.label), o.count && /*#__PURE__*/React.createElement("span", {
        className: "scount"
      }, o.count));
    }));
  })());
}

// Renders the active filter pills in the toolbar's filter bar.
function FilterPills({
  filters,
  onToggle,
  onRemove
}) {
  const iconFor = (type, value) => {
    if (type === "Status" || type === "Status type") {
      const key = Object.keys(STATUS).find(k => STATUS[k].label === value);
      return /*#__PURE__*/React.createElement(StatusIcon, {
        status: key || "todo",
        size: 13
      });
    }
    if (type === "Priority") {
      const p = PRIORITIES.find(p => priorityLabel(p) === value) || "none";
      return /*#__PURE__*/React.createElement(PriorityIcon, {
        priority: p,
        size: 14
      });
    }
    if (type === "Labels" || type === "Suggested label") {
      const c = LABELS[value]?.color || "var(--label-gray)";
      return /*#__PURE__*/React.createElement("span", {
        className: "label-dot",
        style: {
          background: c
        }
      });
    }
    return /*#__PURE__*/React.createElement(Lic, {
      name: "circle-dashed",
      size: 13,
      cls: "icon-sm",
      color: "var(--fg-3)"
    });
  };
  return filters.map(f => {
    const vals = f.values;
    const single = vals.length === 1;
    return /*#__PURE__*/React.createElement("span", {
      className: "filter-pill",
      key: f.type
    }, /*#__PURE__*/React.createElement("span", {
      className: "seg-part"
    }, iconFor(f.type, vals[0]), f.type), /*#__PURE__*/React.createElement("span", {
      className: "seg-part op"
    }, single ? "is" : "is any of"), /*#__PURE__*/React.createElement("span", {
      className: "seg-part"
    }, single ? /*#__PURE__*/React.createElement(React.Fragment, null, iconFor(f.type, vals[0]), vals[0]) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        gap: 2
      }
    }, vals.slice(0, 3).map((v, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        display: "flex"
      }
    }, iconFor(f.type, v)))), vals.length, " ", f.type.toLowerCase(), "s")), /*#__PURE__*/React.createElement("span", {
      className: "x",
      onClick: () => onRemove(f.type)
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "x",
      size: 13,
      cls: "icon-sm"
    })));
  });
}
function PrSelect({
  value,
  options,
  onChange
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-select",
    onClick: e => {
      e.stopPropagation();
      setOpen(!open);
    }
  }, value, " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 13,
    cls: "icon-sm"
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: e => {
      e.stopPropagation();
      setOpen(false);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 26,
      right: 0,
      width: 180,
      zIndex: 45
    }
  }, options.map(o => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: o,
    onClick: e => {
      e.stopPropagation();
      onChange(o);
      setOpen(false);
    }
  }, /*#__PURE__*/React.createElement("span", null, o), o === value && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    style: {
      marginLeft: "auto"
    },
    color: "var(--accent)"
  }))))));
}
function DisplayPanel({
  context,
  mode,
  setMode,
  opts,
  setOpts
}) {
  const set = (k, v) => setOpts({
    ...opts,
    [k]: v
  });
  const toggle = k => set(k, !opts[k]);
  if (context === "projects") {
    const tl = mode === "timeline";
    return /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        top: 96,
        right: 16,
        width: 300
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "seg-toggle"
    }, /*#__PURE__*/React.createElement("div", {
      className: "st" + (mode === "list" ? " active" : ""),
      onClick: () => setMode("list")
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "list",
      size: 15,
      cls: "icon-sm"
    }), "List"), /*#__PURE__*/React.createElement("div", {
      className: "st" + (mode === "board" ? " active" : ""),
      onClick: () => setMode("board")
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "layout-grid",
      size: 15,
      cls: "icon-sm"
    }), "Board"), /*#__PURE__*/React.createElement("div", {
      className: "st" + (mode === "timeline" ? " active" : ""),
      onClick: () => setMode("timeline")
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "gantt-chart",
      size: 15,
      cls: "icon-sm"
    }), "Timeline")), !tl && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "panel-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pr-label"
    }, mode === "board" ? "Columns" : "Grouping"), /*#__PURE__*/React.createElement(PrSelect, {
      value: opts.grouping,
      options: ["No grouping", "Status", "Lead", "Priority", "Health"],
      onChange: v => set("grouping", v)
    })), /*#__PURE__*/React.createElement("div", {
      className: "panel-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pr-label"
    }, "Ordering"), /*#__PURE__*/React.createElement(PrSelect, {
      value: opts.ordering,
      options: ["Manual", "Name", "Priority", "Status", "Target date"],
      onChange: v => set("ordering", v)
    }))), /*#__PURE__*/React.createElement("div", {
      className: "panel-sep"
    }), /*#__PURE__*/React.createElement("div", {
      className: "panel-caption"
    }, tl ? "Timeline options" : mode === "board" ? "Board options" : "List options"), tl ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "panel-row",
      style: {
        paddingTop: 4,
        paddingBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "pr-label"
    }, "Show project list"), /*#__PURE__*/React.createElement("span", {
      className: "switch" + (opts.showList !== false ? " on" : ""),
      onClick: () => toggle("showList")
    })), /*#__PURE__*/React.createElement("div", {
      className: "panel-row",
      style: {
        paddingTop: 4,
        paddingBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "pr-label"
    }, "Show week numbers"), /*#__PURE__*/React.createElement("span", {
      className: "switch" + (opts.weeks ? " on" : ""),
      onClick: () => toggle("weeks")
    }))) : mode === "board" && /*#__PURE__*/React.createElement("div", {
      className: "panel-row",
      style: {
        paddingTop: 4,
        paddingBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "pr-label"
    }, "Show empty columns"), /*#__PURE__*/React.createElement("span", {
      className: "switch" + (opts.empty ? " on" : ""),
      onClick: () => toggle("empty")
    })), /*#__PURE__*/React.createElement("div", {
      className: "panel-caption"
    }, "Display properties"), /*#__PURE__*/React.createElement("div", {
      className: "prop-chips"
    }, PROJECT_PROPS_ALL.map(p => {
      const on = opts.props.includes(p);
      return /*#__PURE__*/React.createElement("span", {
        key: p,
        className: "prop-chip" + (on ? " on" : ""),
        onClick: () => set("props", on ? opts.props.filter(x => x !== p) : [...opts.props, p])
      }, p);
    })), /*#__PURE__*/React.createElement("div", {
      className: "panel-foot"
    }, /*#__PURE__*/React.createElement("span", {
      className: "reset",
      onClick: () => setOpts({
        ...opts,
        props: [...PROJECT_PROPS_DEFAULT],
        grouping: "Status",
        ordering: "Manual"
      })
    }, "Reset"), /*#__PURE__*/React.createElement("span", {
      className: "setdef"
    }, "Set default for everyone")));
  }

  // ---- issues ----
  const board = mode === "board";
  const tl = mode === "timeline";
  const props = ["ID", "Status", "Assignee", "Priority", "Project", "Due date", "Milestone", "Labels", "Links", "Time in status", "Created", "Updated", "Pull requests"];
  return /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 96,
      right: 16,
      width: 300
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "seg-toggle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "st" + (mode === "list" ? " active" : ""),
    onClick: () => setMode("list")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "list",
    size: 15,
    cls: "icon-sm"
  }), "List"), /*#__PURE__*/React.createElement("div", {
    className: "st" + (board ? " active" : ""),
    onClick: () => setMode("board")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "layout-grid",
    size: 15,
    cls: "icon-sm"
  }), "Board"), /*#__PURE__*/React.createElement("div", {
    className: "st" + (tl ? " active" : ""),
    onClick: () => setMode("timeline")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "gantt-chart",
    size: 15,
    cls: "icon-sm"
  }), "Timeline")), tl ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "panel-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel-caption"
  }, "Timeline options"), /*#__PURE__*/React.createElement("div", {
    className: "panel-row",
    style: {
      paddingTop: 4,
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Show issue list"), /*#__PURE__*/React.createElement("span", {
    className: "switch" + (opts.showList !== false ? " on" : ""),
    onClick: () => set("showList", !(opts.showList !== false))
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-row",
    style: {
      paddingTop: 4,
      paddingBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Show week numbers"), /*#__PURE__*/React.createElement("span", {
    className: "switch" + (opts.weeks ? " on" : ""),
    onClick: () => toggle("weeks")
  }))) : /*#__PURE__*/React.createElement(React.Fragment, null, !board ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "panel-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Grouping"), /*#__PURE__*/React.createElement(PrSelect, {
    value: opts.grouping,
    options: ["No grouping", "Status", "Assignee", "Project", "Priority"],
    onChange: v => set("grouping", v)
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Sub-grouping"), /*#__PURE__*/React.createElement(PrSelect, {
    value: opts.subgrouping,
    options: ["No grouping", "Project"],
    onChange: v => set("subgrouping", v)
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Ordering"), /*#__PURE__*/React.createElement(PrSelect, {
    value: opts.ordering,
    options: ["Manual", "Priority", "Title", "Status", "Updated", "Created"],
    onChange: v => set("ordering", v)
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-row",
    style: {
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Order completed by recency"), /*#__PURE__*/React.createElement("span", {
    className: "switch" + (opts.recency ? " on" : ""),
    onClick: () => toggle("recency")
  }))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "panel-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Columns"), /*#__PURE__*/React.createElement(PrSelect, {
    value: "Status",
    options: ["Status"],
    onChange: () => {}
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Ordering"), /*#__PURE__*/React.createElement(PrSelect, {
    value: opts.ordering,
    options: ["Manual", "Priority", "Title", "Status", "Updated", "Created"],
    onChange: v => set("ordering", v)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "panel-row",
    style: {
      paddingTop: 4,
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, "Show sub-issues"), /*#__PURE__*/React.createElement("span", {
    className: "switch" + (opts.subissues ? " on" : ""),
    onClick: () => toggle("subissues")
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel-caption"
  }, board ? "Board options" : "List options"), /*#__PURE__*/React.createElement("div", {
    className: "panel-row",
    style: {
      paddingTop: 4,
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, board ? "Show empty columns" : "Show empty groups"), /*#__PURE__*/React.createElement("span", {
    className: "switch" + (opts.empty ? " on" : ""),
    onClick: () => toggle("empty")
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-caption"
  }, "Display properties"), /*#__PURE__*/React.createElement("div", {
    className: "prop-chips"
  }, props.map(p => {
    const on = opts.props.includes(p);
    return /*#__PURE__*/React.createElement("span", {
      key: p,
      className: "prop-chip" + (on ? " on" : ""),
      onClick: () => set("props", on ? opts.props.filter(x => x !== p) : [...opts.props, p])
    }, p);
  }))), /*#__PURE__*/React.createElement("div", {
    className: "panel-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "reset",
    onClick: () => setOpts({
      ...opts,
      props: ["ID", "Status", "Assignee", "Priority", "Created", "Updated", "Labels"],
      grouping: "Status",
      subgrouping: "Project",
      ordering: "Priority"
    })
  }, "Reset"), /*#__PURE__*/React.createElement("span", {
    className: "setdef"
  }, "Set default for everyone")));
}
Object.assign(window, {
  FilterMenu,
  FilterPills,
  DisplayPanel
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Panels.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ProjectsView.jsx
try { (() => {
// ProjectsView.jsx — Projects in List / Board / Timeline, driven by display options
function HealthDot({
  health
}) {
  const h = HEALTH[health] || HEALTH.onTrack;
  return /*#__PURE__*/React.createElement("span", {
    className: "bc-when",
    style: {
      color: h.color
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "activity",
    size: 12,
    cls: "icon-sm",
    color: h.color
  }), h.label);
}
function LeadCell({
  lead,
  size = 18
}) {
  return lead ? /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: lead[0],
    size: size
  }) : /*#__PURE__*/React.createElement("span", {
    className: "avatar empty",
    style: {
      width: size,
      height: size
    }
  });
}
function projectGroups(projects, grouping) {
  if (grouping === "Lead") {
    const leads = [...new Set(projects.map(p => p.lead || "No lead"))];
    return leads.map(l => ({
      key: l,
      label: l,
      icon: l === "No lead" ? /*#__PURE__*/React.createElement(Lic, {
        name: "user-x",
        size: 14,
        cls: "icon-sm",
        color: "var(--fg-3)"
      }) : /*#__PURE__*/React.createElement(Avatar, {
        from: "#2D9CDB",
        to: "#4C8DFF",
        text: l[0],
        size: 16
      }),
      items: projects.filter(p => (p.lead || "No lead") === l)
    }));
  }
  if (grouping === "Priority") return PRIORITIES.map(pr => ({
    key: pr,
    label: priorityLabel(pr),
    icon: /*#__PURE__*/React.createElement(PriorityIcon, {
      priority: pr,
      size: 15
    }),
    items: projects.filter(p => p.priority === pr)
  }));
  if (grouping === "Health") return Object.keys(HEALTH).map(h => ({
    key: h,
    label: HEALTH[h].label,
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "activity",
      size: 14,
      cls: "icon-sm",
      color: HEALTH[h].color
    }),
    items: projects.filter(p => p.health === h)
  }));
  if (grouping === "No grouping") return [{
    key: "all",
    label: null,
    items: projects
  }];
  // Status (default)
  return PROJECT_STATUS_ORDER.map(s => ({
    key: s,
    label: PROJECT_STATUS[s].label,
    icon: /*#__PURE__*/React.createElement(StatusIcon, {
      status: PROJECT_STATUS[s].key,
      size: 14
    }),
    items: projects.filter(p => p.status === s)
  }));
}
function ProjectCard({
  p,
  props,
  onOpen
}) {
  const has = k => props.includes(k);
  return /*#__PURE__*/React.createElement("div", {
    className: "board-card",
    onClick: () => onOpen && onOpen(p)
  }, /*#__PURE__*/React.createElement("div", {
    className: "bc-title-row"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "box",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "bc-issue-title"
  }, p.name)), /*#__PURE__*/React.createElement("div", {
    className: "bc-foot",
    style: {
      flexWrap: "wrap",
      gap: 10
    }
  }, has("Health") && /*#__PURE__*/React.createElement(HealthDot, {
    health: p.health
  }), has("Priority") && /*#__PURE__*/React.createElement(PriorityIcon, {
    priority: p.priority,
    size: 15
  }), has("Lead") && /*#__PURE__*/React.createElement(LeadCell, {
    lead: p.lead,
    size: 18
  }), has("Progress") && /*#__PURE__*/React.createElement("span", {
    className: "bc-when"
  }, p.progress, "%")), (has("Issues") || has("Target date")) && /*#__PURE__*/React.createElement("div", {
    className: "bc-created",
    style: {
      display: "flex",
      gap: 12
    }
  }, has("Issues") && /*#__PURE__*/React.createElement("span", null, p.issues, " issues"), has("Target date") && /*#__PURE__*/React.createElement("span", null, "Target ", p.target)));
}
function ProjectsBoard({
  projects,
  opts,
  onAdd,
  onOpen
}) {
  let groups = projectGroups(projects, opts.grouping);
  if (!opts.empty && opts.grouping === "Status") groups = groups.filter(g => g.items.length > 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "content",
    style: {
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "board"
  }, groups.map(col => /*#__PURE__*/React.createElement("div", {
    className: "board-col",
    key: col.key,
    style: {
      width: 300
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "board-col-head"
  }, col.icon, /*#__PURE__*/React.createElement("span", {
    className: "bc-title"
  }, col.label), /*#__PURE__*/React.createElement("span", {
    className: "bc-count"
  }, col.items.length), /*#__PURE__*/React.createElement("span", {
    className: "bc-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => onAdd(col.key)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 14
  })))), /*#__PURE__*/React.createElement("div", {
    className: "board-cards"
  }, col.items.map(p => /*#__PURE__*/React.createElement(ProjectCard, {
    key: p.id,
    p: p,
    props: opts.props,
    onOpen: onOpen
  })))))));
}
const PROJ_COL = {
  Priority: {
    w: "90px",
    head: "Priority"
  },
  Status: {
    w: "92px",
    head: "Status"
  },
  Health: {
    w: "128px",
    head: "Health"
  },
  Lead: {
    w: "128px",
    head: "Lead"
  },
  Members: {
    w: "84px",
    head: "Members"
  },
  Dependencies: {
    w: "100px",
    head: "Dependencies"
  },
  "Start date": {
    w: "92px",
    head: "Start date"
  },
  "Target date": {
    w: "96px",
    head: "Target date"
  },
  Issues: {
    w: "64px",
    head: "Issues"
  },
  Created: {
    w: "80px",
    head: "Created"
  },
  Updated: {
    w: "80px",
    head: "Updated"
  },
  Completed: {
    w: "84px",
    head: "Completed"
  },
  Labels: {
    w: "110px",
    head: "Labels"
  }
};
function projCell(prop, p) {
  switch (prop) {
    case "Priority":
      return /*#__PURE__*/React.createElement(PriorityIcon, {
        priority: p.priority,
        size: 15
      });
    case "Status":
      return /*#__PURE__*/React.createElement(StatusIcon, {
        status: PROJECT_STATUS[p.status].key,
        size: 14
      });
    case "Health":
      return /*#__PURE__*/React.createElement(HealthDot, {
        health: p.health
      });
    case "Lead":
      return /*#__PURE__*/React.createElement(LeadCell, {
        lead: p.lead
      });
    case "Members":
      return p.members ? /*#__PURE__*/React.createElement("span", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: "var(--fg-3)"
        }
      }, /*#__PURE__*/React.createElement(Lic, {
        name: "users",
        size: 13,
        cls: "icon-sm",
        color: "var(--fg-3)"
      }), p.members) : /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--fg-4)"
        }
      }, "\u2014");
    case "Dependencies":
      return p.deps ? /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--fg-3)"
        }
      }, p.deps) : /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--fg-4)"
        }
      }, "\u2014");
    case "Start date":
      return /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--fg-3)"
        }
      }, p.start);
    case "Target date":
      return /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--fg-3)"
        }
      }, p.target);
    case "Created":
      return /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--fg-3)"
        }
      }, p.created);
    case "Updated":
      return /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--fg-3)"
        }
      }, p.updated);
    case "Completed":
      return p.completed ? /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--fg-3)"
        }
      }, p.completed) : /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--fg-4)"
        }
      }, "\u2014");
    case "Issues":
      return /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--fg-3)"
        }
      }, p.issues);
    case "Labels":
      return p.labels.length ? p.labels.map(l => /*#__PURE__*/React.createElement("span", {
        className: "label-dot",
        key: l,
        style: {
          background: LABELS[l].color
        }
      })) : /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--fg-4)"
        }
      }, "\u2014");
    default:
      return null;
  }
}
function ProjectsList({
  projects,
  opts,
  onAdd,
  sel,
  onToggleSel,
  onOpen
}) {
  const cols = opts.props.filter(p => PROJ_COL[p]);
  const grid = "minmax(220px,1fr) " + cols.map(c => PROJ_COL[c].w).join(" ");
  const groups = projectGroups(projects, opts.grouping);
  return /*#__PURE__*/React.createElement("div", {
    className: "content",
    style: {
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: "fit-content"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "proj-row proj-head",
    style: {
      gridTemplateColumns: grid
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pc-name"
  }, "Name"), cols.map(c => /*#__PURE__*/React.createElement("span", {
    key: c,
    className: "pc"
  }, PROJ_COL[c].head))), groups.map(g => /*#__PURE__*/React.createElement(React.Fragment, {
    key: g.key
  }, g.label !== null && /*#__PURE__*/React.createElement("div", {
    className: "group-header"
  }, g.icon, /*#__PURE__*/React.createElement("span", {
    className: "gh-title"
  }, g.label), /*#__PURE__*/React.createElement("span", {
    className: "gh-count"
  }, g.items.length), /*#__PURE__*/React.createElement("span", {
    className: "gh-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => onAdd(g.key)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 15
  })))), g.items.map(p => /*#__PURE__*/React.createElement("div", {
    className: "proj-row" + (sel && sel.has(p.id) ? " selected" : ""),
    key: p.id,
    style: {
      gridTemplateColumns: grid
    },
    onClick: () => onOpen && onOpen(p)
  }, /*#__PURE__*/React.createElement("span", {
    className: "pc-name"
  }, /*#__PURE__*/React.createElement("span", {
    className: "row-check" + (sel && sel.has(p.id) ? " on" : ""),
    onClick: e => {
      e.stopPropagation();
      onToggleSel && onToggleSel(p.id);
    }
  }, sel && sel.has(p.id) && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 11,
    color: "var(--fg-on-accent)"
  })), /*#__PURE__*/React.createElement(Lic, {
    name: "box",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pname"
  }, p.name)), cols.map(c => /*#__PURE__*/React.createElement("span", {
    key: c,
    className: "pc"
  }, projCell(c, p)))))))));
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthIdx(dateStr) {
  const m = (dateStr || "").split(" ")[0];
  const i = MONTHS.indexOf(m);
  return i < 0 ? 6 : i;
}
const TL_ZOOM = {
  Year: {
    n: 30,
    w: 72,
    sub: "Y",
    back: 11
  },
  Quarter: {
    n: 16,
    w: 120,
    sub: "Q",
    back: 5
  },
  Month: {
    n: 9,
    w: 210,
    sub: "M",
    back: 2
  },
  Week: {
    n: 6,
    w: 320,
    sub: "W",
    back: 1
  }
};
function ProjectsTimeline({
  projects,
  opts,
  onOpen,
  onUpdateDates,
  onSelectBar,
  selectedId
}) {
  const [zoom, setZoom] = React.useState("Year");
  const [zoomOpen, setZoomOpen] = React.useState(false);
  const cfg = TL_ZOOM[zoom];
  const curM = 5,
    curY = 2026; // app "today" = Jun 2026
  const startAbs = curY * 12 + curM - cfg.back;
  const seq = Array.from({
    length: cfg.n
  }, (_, k) => {
    const a = startAbs + k;
    const y = Math.floor(a / 12);
    const m = (a % 12 + 12) % 12;
    return {
      m,
      y,
      label: MONTHS[m]
    };
  });
  const todayCol = cfg.back;
  const listW = opts.showList !== false ? 240 : 0;
  const trackW = cfg.n * cfg.w;
  const ROW_H = 44,
    AXIS_H = 40;

  // dates <-> month-float-from-start helpers
  const parse = str => {
    const [mon, dd] = (str || "").split(" ");
    let m = MONTHS.indexOf(mon);
    if (m < 0) m = curM;
    const day = parseInt(dd) || 1;
    const curAbs = curY * 12 + curM;
    const c26 = 2026 * 12 + m,
      c27 = 2027 * 12 + m;
    const abs = (Math.abs(c26 - curAbs) <= Math.abs(c27 - curAbs) ? c26 : c27) + (day - 1) / 30;
    return abs - startAbs;
  };
  const mfToDate = mf => {
    const abs = startAbs + mf;
    const month = Math.floor(abs);
    const frac = abs - month;
    const y = Math.floor(month / 12);
    const mi = (month % 12 + 12) % 12;
    const day = Math.max(1, Math.round(frac * 30) + 1);
    return new Date(y, mi, day);
  };
  const fmtFull = d => d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  const fmtShort = d => d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
  const [bars, setBars] = React.useState({});
  const [deps, setDeps] = React.useState([]);
  const [link, setLink] = React.useState(null);
  const [tip, setTip] = React.useState(null);
  const [detailId, setDetailId] = React.useState(null);
  const ref = React.useRef(null);
  const barOf = p => {
    if (bars[p.id] === "none") return null;
    if (bars[p.id]) return bars[p.id];
    let s = parse(p.start);
    if (s == null) s = todayCol;
    let e = parse(p.target);
    if (e == null) e = s + 2;
    return {
      s,
      e: Math.max(e, s + 0.5)
    };
  };
  const clearBar = (e, p) => {
    e.preventDefault();
    e.stopPropagation();
    setBars(prev => ({
      ...prev,
      [p.id]: "none"
    }));
    if (onUpdateDates) onUpdateDates(p.id, "—", "—");
  };
  const createBarAt = (e, p, i) => {
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left + ref.current.scrollLeft - listW;
    const s = Math.max(0, x / cfg.w);
    const nb = {
      s,
      e: s + 2
    };
    setBars(prev => ({
      ...prev,
      [p.id]: nb
    }));
    if (onUpdateDates) onUpdateDates(p.id, fmtShort(mfToDate(nb.s)), fmtShort(mfToDate(nb.e)));
  };
  const byId = id => projects.find(p => p.id === id);
  const idx = id => projects.findIndex(p => p.id === id);
  const startDrag = (e, p, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const b = barOf(p);
    const startX = e.clientX;
    const i = idx(p.id);
    let moved = false;
    const onMove = ev => {
      const dxM = (ev.clientX - startX) / cfg.w;
      if (Math.abs(ev.clientX - startX) > 3) moved = true;
      const ns = {
        ...b
      };
      if (mode === "move") {
        ns.s = b.s + dxM;
        ns.e = b.e + dxM;
      } else if (mode === "resizeR") ns.e = Math.max(b.s + 0.25, b.e + dxM);else if (mode === "resizeL") ns.s = Math.min(b.e - 0.25, b.s + dxM);
      setBars(prev => ({
        ...prev,
        [p.id]: ns
      }));
      const edge = mode === "resizeL" ? ns.s : mode === "move" ? ns.s : ns.e;
      setTip({
        x: listW + edge * cfg.w,
        y: AXIS_H + i * ROW_H,
        text: fmtFull(mfToDate(edge))
      });
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      setTip(null);
      setBars(prev => {
        const nb = prev[p.id] || b;
        if (onUpdateDates) onUpdateDates(p.id, fmtShort(mfToDate(nb.s)), fmtShort(mfToDate(nb.e)));
        return prev;
      });
      if (!moved && mode === "move") {
        if (onSelectBar) onSelectBar(p);else setDetailId(p.id);
      }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };
  const startLink = (e, p) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = ref.current.getBoundingClientRect();
    const pt = ev => ({
      x: ev.clientX - rect.left + ref.current.scrollLeft,
      y: ev.clientY - rect.top + ref.current.scrollTop
    });
    const onMove = ev => setLink({
      from: p.id,
      ...pt(ev)
    });
    const onUp = ev => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      const m = pt(ev);
      const target = projects.find((q, qi) => {
        if (q.id === p.id) return false;
        const b = barOf(q);
        const x1 = listW + b.s * cfg.w,
          x2 = listW + b.e * cfg.w,
          y = AXIS_H + qi * ROW_H;
        return m.x >= x1 - 12 && m.x <= x2 + 12 && m.y >= y && m.y <= y + ROW_H;
      });
      if (target) setDeps(prev => prev.some(d => d.from === p.id && d.to === target.id) ? prev : [...prev, {
        from: p.id,
        to: target.id
      }]);
      setLink(null);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };
  const innerH = AXIS_H + projects.length * ROW_H + 20;
  return /*#__PURE__*/React.createElement("div", {
    className: "content",
    style: {
      overflowX: "auto",
      position: "relative"
    },
    ref: ref
  }, /*#__PURE__*/React.createElement("div", {
    className: "tl-ctrl"
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => setZoom("Year")
  }, "Today"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => setZoomOpen(!zoomOpen)
  }, zoom, " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 13,
    cls: "icon-sm"
  })), zoomOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: () => setZoomOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 34,
      right: 0,
      width: 150,
      zIndex: 45
    }
  }, Object.keys(TL_ZOOM).map(z => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: z,
    onClick: () => {
      setZoom(z);
      setZoomOpen(false);
    }
  }, /*#__PURE__*/React.createElement("span", null, z), z === zoom ? /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    style: {
      marginLeft: "auto"
    },
    color: "var(--accent)"
  }) : /*#__PURE__*/React.createElement("span", {
    className: "shortcut"
  }, TL_ZOOM[z].sub))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: listW + trackW,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "tl-axis",
    style: {
      paddingLeft: listW
    }
  }, seq.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "tl-month",
    key: i,
    style: {
      width: cfg.w
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tl-mlabel"
  }, s.m === 0 ? s.label + " " + s.y : s.label), i === todayCol && /*#__PURE__*/React.createElement("span", {
    className: "tl-today-pill"
  }, MONTHS[curM].toUpperCase(), " 1")))), /*#__PURE__*/React.createElement("div", {
    className: "tl-grid",
    style: {
      left: listW,
      top: 0,
      bottom: 0,
      width: cfg.n * cfg.w,
      backgroundSize: cfg.w + "px 100%"
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "tl-today-line",
    style: {
      left: listW + todayCol * cfg.w
    }
  }), /*#__PURE__*/React.createElement("svg", {
    className: "tl-deps",
    width: listW + trackW,
    height: innerH
  }, deps.map((d, i) => {
    const fb = barOf(byId(d.from)),
      tb = barOf(byId(d.to));
    const x1 = listW + fb.e * cfg.w,
      y1 = AXIS_H + idx(d.from) * ROW_H + ROW_H / 2;
    const x2 = listW + tb.s * cfg.w,
      y2 = AXIS_H + idx(d.to) * ROW_H + ROW_H / 2;
    const dx = Math.max(30, Math.abs(x2 - x1) / 2);
    return /*#__PURE__*/React.createElement("path", {
      key: i,
      d: `M${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
      className: "tl-dep-path",
      onClick: () => setDeps(prev => prev.filter(x => !(x.from === d.from && x.to === d.to)))
    });
  }), link && (() => {
    const fb = barOf(byId(link.from));
    const x1 = listW + fb.e * cfg.w,
      y1 = AXIS_H + idx(link.from) * ROW_H + ROW_H / 2;
    const dx = Math.max(30, Math.abs(link.x - x1) / 2);
    return /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
      d: `M${x1} ${y1} C ${x1 + dx} ${y1}, ${link.x - dx} ${link.y}, ${link.x} ${link.y}`,
      className: "tl-dep-path live"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: link.x,
      cy: link.y,
      r: "4",
      fill: "var(--accent)"
    }));
  })()), projects.map((p, i) => {
    const b = barOf(p);
    const c = (HEALTH[p.health] || HEALTH.onTrack).color;
    const w = b ? Math.max(cfg.w * 0.4, (b.e - b.s) * cfg.w) : 0;
    const wide = w > 130;
    return /*#__PURE__*/React.createElement("div", {
      className: "tl-row",
      key: p.id
    }, opts.showList !== false && /*#__PURE__*/React.createElement("div", {
      className: "tl-name",
      style: {
        width: listW
      }
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }), /*#__PURE__*/React.createElement("span", null, p.name)), b ? /*#__PURE__*/React.createElement("div", {
      className: "tl-bar tl-pbar" + (detailId === p.id || selectedId === p.id ? " sel" : ""),
      style: {
        left: listW + b.s * cfg.w,
        width: w,
        background: c + "22",
        border: "1px solid " + c
      },
      onPointerDown: e => startDrag(e, p, "move"),
      onContextMenu: e => clearBar(e, p),
      title: p.name + " · " + p.start + " → " + p.target + " · " + p.progress + "%"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tl-fill",
      style: {
        width: p.progress + "%",
        background: c + "44"
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "tl-bar-ic",
      style: {
        background: c
      }
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 9,
      color: "#0A0A0B"
    })), wide && /*#__PURE__*/React.createElement("span", {
      className: "tl-bar-name"
    }, p.name), /*#__PURE__*/React.createElement("span", {
      className: "tl-bar-pct"
    }, p.progress, "%"), p.lead && wide && /*#__PURE__*/React.createElement(Avatar, {
      from: "#2D9CDB",
      to: "#4C8DFF",
      text: p.lead[0],
      size: 15
    }), /*#__PURE__*/React.createElement("span", {
      className: "tl-ms",
      style: {
        left: "62%"
      },
      title: "Milestone: Design complete"
    }), /*#__PURE__*/React.createElement("span", {
      className: "tl-ms tl-ms-done",
      style: {
        left: "28%"
      },
      title: "Milestone: Kickoff"
    }), /*#__PURE__*/React.createElement("span", {
      className: "tl-handle l",
      onPointerDown: e => startDrag(e, p, "resizeL")
    }), /*#__PURE__*/React.createElement("span", {
      className: "tl-handle r",
      onPointerDown: e => startDrag(e, p, "resizeR")
    }), /*#__PURE__*/React.createElement("span", {
      className: "tl-dep-dot",
      title: "Drag to create dependency",
      onPointerDown: e => startLink(e, p)
    })) : /*#__PURE__*/React.createElement("div", {
      className: "tl-emptyrow",
      style: {
        left: listW,
        right: 0
      },
      onPointerDown: e => createBarAt(e, p, i),
      title: "Click to schedule"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tl-schedule"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "plus",
      size: 12,
      cls: "icon-sm",
      color: "var(--fg-4)"
    }), "Schedule")));
  }), tip && /*#__PURE__*/React.createElement("div", {
    className: "tl-tip",
    style: {
      left: tip.x,
      top: tip.y
    }
  }, tip.text)), !onSelectBar && detailId && (() => {
    const p = byId(detailId);
    if (!p) return null;
    const row = (label, val) => /*#__PURE__*/React.createElement("div", {
      className: "prop-line"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pl-label"
    }, label), /*#__PURE__*/React.createElement("span", {
      className: "pl-value"
    }, val));
    return /*#__PURE__*/React.createElement("div", {
      className: "tl-detail"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tl-detail-head"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 15,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }), /*#__PURE__*/React.createElement("span", {
      className: "tl-detail-title"
    }, p.name), /*#__PURE__*/React.createElement("button", {
      className: "iconbtn",
      style: {
        marginLeft: "auto"
      },
      onClick: () => {
        setDetailId(null);
        onOpen && onOpen(p);
      },
      title: "Open full page"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "maximize-2",
      size: 14
    })), /*#__PURE__*/React.createElement("button", {
      className: "iconbtn",
      onClick: () => setDetailId(null)
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "x",
      size: 15
    }))), /*#__PURE__*/React.createElement("div", {
      className: "side-group"
    }, row("Status", /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusIcon, {
      status: PROJECT_STATUS[p.status].key,
      size: 14
    }), PROJECT_STATUS[p.status].label)), row("Priority", /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PriorityIcon, {
      priority: p.priority,
      size: 15
    }), priorityLabel(p.priority))), row("Health", /*#__PURE__*/React.createElement(HealthDot, {
      health: p.health
    })), row("Lead", /*#__PURE__*/React.createElement(LeadCell, {
      lead: p.lead
    })), row("Members", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-3)"
      }
    }, p.members, " members")), row("Issues", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-3)"
      }
    }, p.issues))), /*#__PURE__*/React.createElement("div", {
      className: "side-group"
    }, row("Start date", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-3)"
      }
    }, p.start)), row("Target date", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-3)"
      }
    }, p.target)), row("Progress", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-3)"
      }
    }, p.progress, "%"))));
  })());
}
function ProjectsView({
  projects,
  mode,
  opts,
  onAdd,
  sel,
  onToggleSel,
  onOpen,
  onUpdateDates
}) {
  if (projects.length === 0) return /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, /*#__PURE__*/React.createElement(EmptyState, {
    text: "No projects yet",
    glyph: /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 40,
      color: "var(--fg-4)"
    })
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: () => onAdd("backlog")
  }, "Create project")));
  if (mode === "list") return /*#__PURE__*/React.createElement(ProjectsList, {
    projects: projects,
    opts: opts,
    onAdd: onAdd,
    sel: sel,
    onToggleSel: onToggleSel,
    onOpen: onOpen
  });
  if (mode === "timeline") return /*#__PURE__*/React.createElement(ProjectsTimeline, {
    projects: projects,
    opts: opts,
    onOpen: onOpen,
    onUpdateDates: onUpdateDates
  });
  return /*#__PURE__*/React.createElement(ProjectsBoard, {
    projects: projects,
    opts: opts,
    onAdd: onAdd,
    onOpen: onOpen
  });
}
function IssuesTimeline({
  issues,
  opts,
  onCycle,
  onUpdate,
  onSelectBar,
  selectedId
}) {
  const [zoom, setZoom] = React.useState("Year");
  const [zoomOpen, setZoomOpen] = React.useState(false);
  const cfg = TL_ZOOM[zoom];
  const curM = 5,
    curY = 2026;
  const startAbs = curY * 12 + curM - cfg.back;
  const seq = Array.from({
    length: cfg.n
  }, (_, k) => {
    const a = startAbs + k;
    const y = Math.floor(a / 12);
    const m = (a % 12 + 12) % 12;
    return {
      m,
      y,
      label: MONTHS[m]
    };
  });
  const todayCol = cfg.back;
  const listW = opts.showList === false ? 0 : 260;
  const trackW = cfg.n * cfg.w;
  const ROW_H = 44,
    AXIS_H = 40;
  const parse = str => {
    const [mon, dd] = (str || "").split(" ");
    let m = MONTHS.indexOf(mon);
    if (m < 0) return null;
    const day = parseInt(dd) || 1;
    const curAbs = curY * 12 + curM;
    const c26 = 2026 * 12 + m,
      c27 = 2027 * 12 + m;
    const abs = (Math.abs(c26 - curAbs) <= Math.abs(c27 - curAbs) ? c26 : c27) + (day - 1) / 30;
    return abs - startAbs;
  };
  const mfToDate = mf => {
    const abs = startAbs + mf;
    const month = Math.floor(abs);
    const frac = abs - month;
    const y = Math.floor(month / 12);
    const mi = (month % 12 + 12) % 12;
    const day = Math.max(1, Math.round(frac * 30) + 1);
    return new Date(y, mi, day);
  };
  const fmtFull = d => d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  const fmtShort = d => d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
  const [bars, setBars] = React.useState({});
  const [tip, setTip] = React.useState(null);
  const [detailId, setDetailId] = React.useState(null);
  const [scrollX, setScrollX] = React.useState(0);
  const [vw, setVw] = React.useState(1000);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) setVw(ref.current.clientWidth);
  }, [zoom]);
  const barOf = i => {
    if (bars[i.id] === "none") return null;
    if (bars[i.id]) return bars[i.id];
    let s = parse(i.created);
    if (s == null) s = todayCol - 1;
    let e = parse(i.dueDate);
    if (e == null) e = s + 1.4;
    return {
      s,
      e: Math.max(e, s + 0.4)
    };
  };
  const clearBar = (e, it) => {
    e.preventDefault();
    e.stopPropagation();
    setBars(prev => ({
      ...prev,
      [it.id]: "none"
    }));
    if (onUpdate) onUpdate(it.id, {
      dueDate: null
    });
  };
  const createBarAt = (e, it) => {
    const x = e.clientX - ref.current.getBoundingClientRect().left + ref.current.scrollLeft - listW;
    const s = Math.max(0, x / cfg.w);
    const nb = {
      s,
      e: s + 1.4
    };
    setBars(prev => ({
      ...prev,
      [it.id]: nb
    }));
    if (onUpdate) onUpdate(it.id, {
      dueDate: fmtShort(mfToDate(nb.e))
    });
  };
  const scrollToBar = b => {
    if (ref.current) ref.current.scrollTo({
      left: Math.max(0, listW + b.s * cfg.w - listW - 80),
      behavior: "smooth"
    });
  };
  const startDrag = (e, it, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const b = barOf(it);
    const startX = e.clientX;
    const i = issues.indexOf(it);
    let moved = false;
    const onMove = ev => {
      const dxM = (ev.clientX - startX) / cfg.w;
      if (Math.abs(ev.clientX - startX) > 3) moved = true;
      const ns = {
        ...b
      };
      if (mode === "move") {
        ns.s = b.s + dxM;
        ns.e = b.e + dxM;
      } else if (mode === "resizeR") ns.e = Math.max(b.s + 0.4, b.e + dxM);else if (mode === "resizeL") ns.s = Math.min(b.e - 0.4, b.s + dxM);
      setBars(prev => ({
        ...prev,
        [it.id]: ns
      }));
      const edge = mode === "resizeL" ? ns.s : ns.e;
      setTip({
        x: listW + edge * cfg.w,
        y: AXIS_H + i * ROW_H,
        text: fmtFull(mfToDate(edge))
      });
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      setTip(null);
      if (!moved && mode === "move") {
        if (onSelectBar) onSelectBar(it);else setDetailId(it.id);
      } else setBars(prev => {
        const nb = prev[it.id] || b;
        if (onUpdate) onUpdate(it.id, {
          dueDate: fmtShort(mfToDate(nb.e))
        });
        return prev;
      });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "content",
    style: {
      overflowX: "auto",
      position: "relative"
    },
    ref: ref,
    onScroll: e => setScrollX(e.target.scrollLeft)
  }, /*#__PURE__*/React.createElement("div", {
    className: "tl-ctrl"
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => {
      setZoom("Year");
      if (ref.current) ref.current.scrollTo({
        left: todayCol * cfg.w - 120,
        behavior: "smooth"
      });
    }
  }, "Today"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => setZoomOpen(!zoomOpen)
  }, zoom, " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 13,
    cls: "icon-sm"
  })), zoomOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: () => setZoomOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 34,
      right: 0,
      width: 150,
      zIndex: 45
    }
  }, Object.keys(TL_ZOOM).map(z => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: z,
    onClick: () => {
      setZoom(z);
      setZoomOpen(false);
    }
  }, /*#__PURE__*/React.createElement("span", null, z), z === zoom ? /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    style: {
      marginLeft: "auto"
    },
    color: "var(--accent)"
  }) : /*#__PURE__*/React.createElement("span", {
    className: "shortcut"
  }, TL_ZOOM[z].sub))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: listW + trackW,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "tl-axis",
    style: {
      paddingLeft: listW
    }
  }, seq.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "tl-month",
    key: i,
    style: {
      width: cfg.w
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tl-mlabel"
  }, s.m === 0 ? s.label + " " + s.y : s.label), i === todayCol && /*#__PURE__*/React.createElement("span", {
    className: "tl-today-pill"
  }, MONTHS[curM].toUpperCase(), " 1")))), /*#__PURE__*/React.createElement("div", {
    className: "tl-grid",
    style: {
      left: listW,
      top: 0,
      bottom: 0,
      width: cfg.n * cfg.w,
      backgroundSize: cfg.w + "px 100%"
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "tl-today-line",
    style: {
      left: listW + todayCol * cfg.w
    }
  }), issues.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      height: 200
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No issues to show")), issues.map(it => {
    const b = barOf(it);
    const c = (STATUS[it.status] || STATUS.todo).color;
    const left = b ? listW + b.s * cfg.w : 0,
      width = b ? Math.max(cfg.w * 0.4, (b.e - b.s) * cfg.w) : 0;
    const offLeft = b && left + width < scrollX + listW + 4;
    const offRight = b && left > scrollX + vw - 4;
    const wide = width > 120;
    return /*#__PURE__*/React.createElement("div", {
      className: "tl-row",
      key: it.id
    }, opts.showList !== false && /*#__PURE__*/React.createElement("div", {
      className: "tl-name",
      style: {
        width: listW
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "statusbtn",
      style: {
        width: 20,
        height: 20
      },
      onClick: e => {
        e.stopPropagation();
        onCycle && onCycle(it.id);
      }
    }, /*#__PURE__*/React.createElement(StatusIcon, {
      status: it.status,
      size: 13
    })), /*#__PURE__*/React.createElement("span", {
      className: "issue-id",
      style: {
        width: 52
      }
    }, it.id), /*#__PURE__*/React.createElement("span", null, it.title)), b ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "tl-bar" + (detailId === it.id || selectedId === it.id ? " sel" : ""),
      style: {
        left,
        width,
        background: c + "2e",
        border: "1px solid " + c
      },
      onPointerDown: e => startDrag(e, it, "move"),
      onContextMenu: e => clearBar(e, it),
      title: "Click to open \xB7 drag to move \xB7 right-click to remove"
    }, /*#__PURE__*/React.createElement(StatusIcon, {
      status: it.status,
      size: 12
    }), /*#__PURE__*/React.createElement(PriorityIcon, {
      priority: it.priority,
      size: 12
    }), wide && /*#__PURE__*/React.createElement("span", {
      style: {
        font: "var(--fw-medium) 11px var(--font-sans)",
        color: "var(--fg)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        flex: 1
      }
    }, it.title), wide && it.assignee && /*#__PURE__*/React.createElement(Avatar, {
      from: "#2D9CDB",
      to: "#4C8DFF",
      text: it.assignee[0],
      size: 15
    }), !wide && /*#__PURE__*/React.createElement("span", {
      style: {
        font: "var(--fw-medium) 11px var(--font-sans)",
        color: "var(--fg-2)",
        whiteSpace: "nowrap",
        overflow: "hidden"
      }
    }, it.id), /*#__PURE__*/React.createElement("span", {
      className: "tl-handle l",
      onPointerDown: e => startDrag(e, it, "resizeL")
    }), /*#__PURE__*/React.createElement("span", {
      className: "tl-handle r",
      onPointerDown: e => startDrag(e, it, "resizeR")
    })), offLeft && /*#__PURE__*/React.createElement("button", {
      className: "tl-jump",
      style: {
        left: scrollX + listW + 6
      },
      onClick: () => scrollToBar(b),
      title: "Jump to bar"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "chevron-left",
      size: 14
    })), offRight && /*#__PURE__*/React.createElement("button", {
      className: "tl-jump",
      style: {
        left: scrollX + vw - 30
      },
      onClick: () => scrollToBar(b),
      title: "Jump to bar"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "chevron-right",
      size: 14
    }))) : /*#__PURE__*/React.createElement("div", {
      className: "tl-emptyrow",
      style: {
        left: listW,
        right: 0
      },
      onPointerDown: e => createBarAt(e, it),
      title: "Click to schedule"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tl-schedule",
      style: {
        left: scrollX + listW + 8,
        position: "absolute"
      }
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "plus",
      size: 12,
      cls: "icon-sm",
      color: "var(--fg-4)"
    }), "Set dates")));
  }), tip && /*#__PURE__*/React.createElement("div", {
    className: "tl-tip",
    style: {
      left: tip.x,
      top: tip.y
    }
  }, tip.text)), !onSelectBar && detailId && (() => {
    const it = issues.find(x => x.id === detailId);
    if (!it) return null;
    const row = (label, val) => /*#__PURE__*/React.createElement("div", {
      className: "prop-line"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pl-label"
    }, label), /*#__PURE__*/React.createElement("span", {
      className: "pl-value"
    }, val));
    return /*#__PURE__*/React.createElement("div", {
      className: "tl-detail"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tl-detail-head"
    }, /*#__PURE__*/React.createElement(StatusIcon, {
      status: it.status,
      size: 15
    }), /*#__PURE__*/React.createElement("span", {
      className: "tl-detail-title"
    }, it.id, " ", it.title), /*#__PURE__*/React.createElement("button", {
      className: "iconbtn",
      style: {
        marginLeft: "auto"
      },
      onClick: () => setDetailId(null)
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "x",
      size: 15
    }))), /*#__PURE__*/React.createElement("div", {
      className: "side-group"
    }, row("Status", /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusIcon, {
      status: it.status,
      size: 14
    }), statusLabel(it.status))), row("Priority", /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PriorityIcon, {
      priority: it.priority,
      size: 15
    }), priorityLabel(it.priority))), row("Assignee", it.assignee ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Avatar, {
      from: "#2D9CDB",
      to: "#4C8DFF",
      text: it.assignee[0],
      size: 18
    }), it.assignee) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-4)"
      }
    }, "Unassigned"))), /*#__PURE__*/React.createElement("div", {
      className: "side-group"
    }, row("Project", it.project ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-2)"
      }
    }, it.project) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-4)"
      }
    }, "No project")), row("Labels", it.labels.length ? it.labels.map(l => /*#__PURE__*/React.createElement("span", {
      className: "label-chip",
      key: l
    }, /*#__PURE__*/React.createElement("span", {
      className: "label-dot",
      style: {
        background: LABELS[l].color
      }
    }), l)) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-4)"
      }
    }, "None"))), /*#__PURE__*/React.createElement("div", {
      className: "side-group"
    }, row("Created", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg-3)"
      }
    }, it.created)), row("Due date", /*#__PURE__*/React.createElement("span", {
      style: {
        color: it.dueDate ? "var(--fg-3)" : "var(--fg-4)"
      }
    }, it.dueDate || "No due date"))));
  })());
}
function ProjectDetail({
  project,
  onBack
}) {
  const p = project;
  const pSide = (label, children) => /*#__PURE__*/React.createElement("div", {
    className: "prop-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-label"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "pl-value"
  }, children));
  return /*#__PURE__*/React.createElement("div", {
    className: "detail"
  }, /*#__PURE__*/React.createElement("div", {
    className: "detail-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "detail-crumb"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-left",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)",
    onClick: onBack,
    style: {
      cursor: "pointer"
    }
  }), /*#__PURE__*/React.createElement(Lic, {
    name: "box",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "c"
  }, "Projects"), /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "c",
    style: {
      color: "var(--fg-2)"
    }
  }, p.name)), /*#__PURE__*/React.createElement("h1", {
    className: "detail-title"
  }, p.name), /*#__PURE__*/React.createElement("div", {
    className: "detail-desc"
  }, /*#__PURE__*/React.createElement("p", null, "A cross-functional initiative tracked in Vector. Add a project brief, link issues, and set milestones to organize the work.")), /*#__PURE__*/React.createElement("div", {
    className: "detail-section-h"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "diamond",
    size: 14,
    cls: "icon-sm"
  }), " Milestones"), /*#__PURE__*/React.createElement("div", {
    className: "subissue"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "diamond",
    size: 13,
    cls: "icon-sm",
    color: "var(--label-blue)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, "Design complete"), /*#__PURE__*/React.createElement("span", {
    className: "id",
    style: {
      marginLeft: "auto"
    }
  }, p.target)), /*#__PURE__*/React.createElement("div", {
    className: "subissue"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "diamond",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, "Beta launch")), /*#__PURE__*/React.createElement("div", {
    className: "detail-section-h"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "activity",
    size: 14,
    cls: "icon-sm"
  }), " Activity"), /*#__PURE__*/React.createElement("div", {
    className: "activity-item"
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: "K",
    size: 20
  }), /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, /*#__PURE__*/React.createElement("b", null, "\uAE40\uD601\uADDC"), " set start date to ", p.start, /*#__PURE__*/React.createElement("span", {
    className: "aw"
  }, "just now"))), /*#__PURE__*/React.createElement("div", {
    className: "activity-item"
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: "K",
    size: 20
  }), /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, /*#__PURE__*/React.createElement("b", null, "\uAE40\uD601\uADDC"), " created the project", /*#__PURE__*/React.createElement("span", {
    className: "aw"
  }, p.created)))), /*#__PURE__*/React.createElement("div", {
    className: "detail-side"
  }, /*#__PURE__*/React.createElement("div", {
    className: "side-group"
  }, pSide("Status", /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusIcon, {
    status: PROJECT_STATUS[p.status].key,
    size: 14
  }), PROJECT_STATUS[p.status].label)), pSide("Priority", /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PriorityIcon, {
    priority: p.priority,
    size: 15
  }), priorityLabel(p.priority))), pSide("Health", /*#__PURE__*/React.createElement(HealthDot, {
    health: p.health
  }))), /*#__PURE__*/React.createElement("div", {
    className: "side-group"
  }, pSide("Lead", /*#__PURE__*/React.createElement(LeadCell, {
    lead: p.lead
  })), pSide("Members", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-3)"
    }
  }, p.members, " members")), pSide("Issues", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-3)"
    }
  }, p.issues))), /*#__PURE__*/React.createElement("div", {
    className: "side-group"
  }, pSide("Dates", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-3)"
    }
  }, p.start, " \u2192 ", p.target)), pSide("Progress", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-3)"
    }
  }, p.progress, "%")))));
}
Object.assign(window, {
  ProjectsView,
  ProjectsBoard,
  IssuesTimeline,
  ProjectDetail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ProjectsView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/RichTooltip.jsx
try { (() => {
// RichTooltip.jsx — Vector DS feedback (from Keystone), Part 2A
// A reusable box tooltip: header + value rows + optional divider, edge-flip.
// Self-contained: inline styles on Vector tokens only, no extra CSS file.
// Load after React; exports window.RichTooltip.
//
// USAGE
//   <RichTooltip
//     placement="top"            // top | bottom  (× start | center | end via `align`)
//     align="center"
//     header={<>VEC-42 · In progress</>}
//     rows={[
//       { name: "Assignee", val: "Dana", dot: "#4C8DFF" },
//       { name: "Cycle burn", val: "+12%", tone: "pos" },
//       { name: "Overdue", val: "3d", tone: "neg" },
//     ]}
//     footer="Updated 2h ago"
//   >
//     <span className="v-mono">VEC-42</span>   {/* the anchor */}
//   </RichTooltip>
//
// Rows accept: { name, val, tone?: "pos"|"neg", dot?: cssColor, flag?: ReactNode }.
// The tooltip is CSS-:hover driven (no JS state) so it's cheap in long lists;
// `align="end"`/`"start"` is how you flip it away from a viewport edge.

(function () {
  const TOKENS = {
    box: {
      position: "absolute",
      zIndex: 40,
      width: 200,
      display: "flex",
      flexDirection: "column",
      gap: 3,
      padding: "9px 11px",
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--r-md)",
      boxShadow: "var(--shadow-popover)",
      textAlign: "left",
      pointerEvents: "none",
      opacity: 0,
      transition: "opacity .12s ease"
    }
  };
  function toneColor(tone) {
    return tone === "pos" ? "var(--pos, #4CB782)" : tone === "neg" ? "var(--neg, #EB5757)" : "var(--fg-2)";
  }
  function RichTooltip({
    children,
    header,
    rows = [],
    footer,
    placement = "top",
    align = "center",
    width,
    style
  }) {
    const pos = {};
    if (placement === "bottom") pos.top = "calc(100% + 8px)";else pos.bottom = "calc(100% + 8px)";
    if (align === "start") {
      pos.left = 0;
    } else if (align === "end") {
      pos.right = 0;
    } else {
      pos.left = "50%";
      pos.transform = "translateX(-50%)";
    }
    const box = Object.assign({}, TOKENS.box, width ? {
      width
    } : null, pos, style);
    return React.createElement("span", {
      className: "v-richtip-anchor",
      style: {
        position: "relative",
        display: "inline-flex"
      }
    }, children, React.createElement("span", {
      className: "v-richtip",
      style: box
    }, header != null && React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        font: "var(--fw-semi) 11px var(--font-sans)",
        color: "var(--fg)",
        paddingBottom: rows.length ? 6 : 0,
        marginBottom: rows.length ? 4 : 0,
        borderBottom: rows.length ? "1px solid var(--border)" : "none"
      }
    }, header), rows.map((r, i) => React.createElement("span", {
      key: i,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14
      }
    }, React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        font: "var(--fw-medium) 12px var(--font-sans)",
        color: "var(--fg-3)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, r.flag != null ? r.flag : null, r.dot != null ? React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: r.dot,
        flexShrink: 0
      }
    }) : null, r.name), React.createElement("span", {
      style: {
        flexShrink: 0,
        font: "var(--fw-semi) 12px var(--font-mono)",
        fontVariantNumeric: "tabular-nums",
        color: toneColor(r.tone)
      }
    }, r.val))), footer != null && React.createElement("span", {
      style: {
        font: "var(--fw-medium) 10px var(--font-mono)",
        color: "var(--fg-4)",
        marginTop: rows.length ? 4 : 0,
        paddingTop: rows.length ? 5 : 0,
        borderTop: rows.length ? "1px solid var(--border)" : "none"
      }
    }, footer)));
  }

  // one small CSS rule the inline styles can't express (:hover on the anchor)
  if (typeof document !== "undefined" && !document.getElementById("v-richtip-css")) {
    const s = document.createElement("style");
    s.id = "v-richtip-css";
    s.textContent = ".v-richtip-anchor:hover > .v-richtip { opacity: 1 !important; }";
    document.head.appendChild(s);
  }
  if (typeof window !== "undefined") window.RichTooltip = RichTooltip;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/RichTooltip.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Settings.jsx
try { (() => {
// Settings.jsx — full settings shell with working controls (dropdowns, toggles, create)
function Toggle({
  on,
  onClick
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "switch" + (on ? " on" : ""),
    onClick: onClick
  });
}
function SetSelect({
  value,
  options,
  onChange
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "set-select",
    onClick: e => {
      e.stopPropagation();
      setOpen(!open);
    }
  }, value, " ", /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 13,
    cls: "icon-sm"
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: e => {
      e.stopPropagation();
      setOpen(false);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      top: 34,
      right: 0,
      width: 200,
      zIndex: 45
    }
  }, options.map(o => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: o,
    onClick: e => {
      e.stopPropagation();
      onChange(o);
      setOpen(false);
    }
  }, /*#__PURE__*/React.createElement("span", null, o), o === value && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    style: {
      marginLeft: "auto"
    },
    color: "var(--accent)"
  }))))));
}
function SetItem({
  label,
  desc,
  control
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "set-item"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "si-label"
  }, label), desc && /*#__PURE__*/React.createElement("div", {
    className: "si-desc"
  }, desc)), control);
}
function PreferencesSection({
  theme,
  onToggleTheme
}) {
  const [s, setS] = React.useState({
    home: "Active issues",
    names: "Full name",
    week: "Sunday",
    font: "Default",
    emoji: true,
    pointer: false
  });
  const set = (k, v) => setS({
    ...s,
    [k]: v
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Preferences"), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "General"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Default home view",
    desc: "Select which view to display when launching the app",
    control: /*#__PURE__*/React.createElement(SetSelect, {
      value: s.home,
      options: ["Active issues", "My issues", "Inbox", "All issues"],
      onChange: v => set("home", v)
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Display names",
    desc: "Select how names are displayed in the interface",
    control: /*#__PURE__*/React.createElement(SetSelect, {
      value: s.names,
      options: ["Full name", "Short name", "Username"],
      onChange: v => set("names", v)
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "First day of the week",
    desc: "Used for date pickers",
    control: /*#__PURE__*/React.createElement(SetSelect, {
      value: s.week,
      options: ["Sunday", "Monday", "Saturday"],
      onChange: v => set("week", v)
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Interface and theme"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Interface theme",
    desc: "Select or customize your interface color scheme",
    control: /*#__PURE__*/React.createElement(SetSelect, {
      value: (theme || "dark") === "dark" ? "Dark" : "Light",
      options: ["Dark", "Light"],
      onChange: v => {
        if (v === "Light" === (theme === "dark")) onToggleTheme();
      }
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Font size",
    desc: "Adjust the size of text across the app",
    control: /*#__PURE__*/React.createElement(SetSelect, {
      value: s.font,
      options: ["Small", "Default", "Large"],
      onChange: v => set("font", v)
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Convert text emoticons into emojis",
    desc: "Strings like :) will be converted to \uD83D\uDE42",
    control: /*#__PURE__*/React.createElement(Toggle, {
      on: s.emoji,
      onClick: () => set("emoji", !s.emoji)
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Use pointer cursors",
    desc: "Change the cursor to a pointer over interactive elements",
    control: /*#__PURE__*/React.createElement(Toggle, {
      on: s.pointer,
      onClick: () => set("pointer", !s.pointer)
    })
  })));
}
function ProfileSection() {
  const [name, setName] = React.useState("김혁규");
  const [username, setUsername] = React.useState("kkh");
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Profile"), /*#__PURE__*/React.createElement("div", {
    className: "set-card",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: 16
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: name[0],
    size: 56
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "si-label",
    style: {
      fontSize: 15
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    className: "si-desc"
  }, "kim@vector-team.example")), /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    style: {
      marginLeft: "auto"
    }
  }, "Change photo")), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Account"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Full name",
    control: /*#__PURE__*/React.createElement("input", {
      className: "v-input",
      style: {
        width: 200
      },
      value: name,
      onChange: e => setName(e.target.value)
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Username",
    control: /*#__PURE__*/React.createElement("input", {
      className: "v-input",
      style: {
        width: 200
      },
      value: username,
      onChange: e => setUsername(e.target.value)
    })
  })));
}
function NotificationsSection() {
  const [s, setS] = React.useState({
    inbox: true,
    email: false,
    mobile: true,
    assigned: true,
    status: "All"
  });
  const t = k => setS({
    ...s,
    [k]: !s[k]
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Notifications"), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Channels"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Inbox",
    desc: "Show notifications in the in-app inbox",
    control: /*#__PURE__*/React.createElement(Toggle, {
      on: s.inbox,
      onClick: () => t("inbox")
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Email",
    desc: "Send a summary to your email",
    control: /*#__PURE__*/React.createElement(Toggle, {
      on: s.email,
      onClick: () => t("email")
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Mobile push",
    desc: "Push notifications to your devices",
    control: /*#__PURE__*/React.createElement(Toggle, {
      on: s.mobile,
      onClick: () => t("mobile")
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Subscriptions"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Issues assigned to me",
    control: /*#__PURE__*/React.createElement(Toggle, {
      on: s.assigned,
      onClick: () => t("assigned")
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Issue status changes",
    control: /*#__PURE__*/React.createElement(SetSelect, {
      value: s.status,
      options: ["All", "Mentions only", "None"],
      onChange: v => setS({
        ...s,
        status: v
      })
    })
  })));
}
function MembersSection() {
  const [members, setMembers] = React.useState([{
    name: "김혁규",
    email: "kim@vector-team.example",
    role: "Admin"
  }, {
    name: "Alex Park",
    email: "alex@vector-team.example",
    role: "Member"
  }, {
    name: "Jordan Lee",
    email: "jordan@vector-team.example",
    role: "Member"
  }]);
  const invite = () => setMembers(prev => {
    const n = prev.length + 1;
    return [...prev, {
      name: "Teammate " + n,
      email: "user" + n + "@vector-team.example",
      role: "Member"
    }];
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "set-head-row"
  }, /*#__PURE__*/React.createElement("h1", null, "Members"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: invite
  }, "Invite member")), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, members.map(m => /*#__PURE__*/React.createElement("div", {
    className: "set-item",
    key: m.email
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: m.name[0],
    size: 28
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "si-label"
  }, m.name), /*#__PURE__*/React.createElement("div", {
    className: "si-desc"
  }, m.email))), /*#__PURE__*/React.createElement(SetSelect, {
    value: m.role,
    options: ["Admin", "Member", "Guest"],
    onChange: v => setMembers(ms => ms.map(x => x.email === m.email ? {
      ...x,
      role: v
    } : x))
  })))));
}
const LABEL_PALETTE = ["#EB5757", "#F2994A", "#F2C94C", "#4CB782", "#2D9CDB", "#BB6BD9", "#E879B9", "#8A8F98"];
function LabelsSection() {
  const [labels, setLabels] = React.useState(Object.keys(LABELS).map(l => ({
    name: l,
    color: LABELS[l].color
  })));
  const addLabel = () => setLabels(prev => [...prev, {
    name: "New label " + (prev.length + 1),
    color: LABEL_PALETTE[(prev.length + 1) % LABEL_PALETTE.length]
  }]);
  const recolor = name => setLabels(ls => ls.map(l => l.name === name ? {
    ...l,
    color: LABEL_PALETTE[(LABEL_PALETTE.indexOf(l.color) + 1) % LABEL_PALETTE.length]
  } : l));
  const remove = name => setLabels(ls => ls.filter(l => l.name !== name));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "set-head-row"
  }, /*#__PURE__*/React.createElement("h1", null, "Labels"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: addLabel
  }, "New label")), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, labels.map(l => /*#__PURE__*/React.createElement("div", {
    className: "set-item",
    key: l.name
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "label-dot",
    style: {
      background: l.color,
      cursor: "pointer",
      width: 11,
      height: 11
    },
    onClick: () => recolor(l.name),
    title: "Change color"
  }), /*#__PURE__*/React.createElement("span", {
    className: "si-label"
  }, l.name)), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => remove(l.name),
    title: "Delete"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 15
  })))), labels.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "set-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-desc"
  }, "No labels yet \u2014 create one."))));
}
function TemplatesSection() {
  const [tpls, setTpls] = React.useState([{
    name: "Bug report",
    icon: "bug"
  }, {
    name: "Feature request",
    icon: "sparkles"
  }]);
  const add = () => setTpls(prev => [...prev, {
    name: "New template " + (prev.length + 1),
    icon: "file"
  }]);
  const remove = name => setTpls(ts => ts.filter(t => t.name !== name));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "set-head-row"
  }, /*#__PURE__*/React.createElement("h1", null, "Templates"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: add
  }, "New template")), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, tpls.map(t => /*#__PURE__*/React.createElement("div", {
    className: "set-item",
    key: t.name
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: t.icon,
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "si-label"
  }, t.name)), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => remove(t.name),
    title: "Delete"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 15
  })))), tpls.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "set-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-desc"
  }, "No templates yet \u2014 create one."))));
}
function GeneralSection() {
  const [name, setName] = React.useState("vector-team");
  const [url, setUrl] = React.useState("vector-team");
  const [region, setRegion] = React.useState("United States");
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "General"), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Workspace"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Workspace name",
    control: /*#__PURE__*/React.createElement("input", {
      className: "v-input",
      style: {
        width: 220
      },
      value: name,
      onChange: e => setName(e.target.value)
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Workspace URL",
    desc: "vector.app/",
    control: /*#__PURE__*/React.createElement("input", {
      className: "v-input",
      style: {
        width: 220
      },
      value: url,
      onChange: e => setUrl(e.target.value)
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Region",
    desc: "Where your workspace data is stored",
    control: /*#__PURE__*/React.createElement(SetSelect, {
      value: region,
      options: ["United States", "European Union", "Asia Pacific"],
      onChange: setRegion
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title",
    style: {
      color: "var(--label-red)"
    }
  }, "Danger zone"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Delete workspace",
    desc: "Permanently delete this workspace and all its data",
    control: /*#__PURE__*/React.createElement("button", {
      className: "v-btn",
      style: {
        color: "var(--label-red)",
        borderColor: "var(--label-red)"
      }
    }, "Delete\u2026")
  })));
}
function SecuritySection() {
  const [twofa, setTwofa] = React.useState(false);
  const [sessions, setSessions] = React.useState([{
    id: 1,
    dev: "MacBook Pro · Chrome",
    loc: "Seoul, KR",
    cur: true
  }, {
    id: 2,
    dev: "iPhone 15 · Vector iOS",
    loc: "Seoul, KR",
    cur: false
  }]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Security & access"), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Password"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Current password",
    control: /*#__PURE__*/React.createElement("input", {
      className: "v-input",
      type: "password",
      style: {
        width: 220
      },
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "New password",
    control: /*#__PURE__*/React.createElement("input", {
      className: "v-input",
      type: "password",
      style: {
        width: 220
      },
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "set-item",
    style: {
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary"
  }, "Update password"))), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Two-factor authentication"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Authenticator app",
    desc: "Require a code from an authenticator app to sign in",
    control: /*#__PURE__*/React.createElement(Toggle, {
      on: twofa,
      onClick: () => setTwofa(!twofa)
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Passkeys",
    desc: "Sign in with Touch ID, Face ID, or a security key",
    control: /*#__PURE__*/React.createElement("button", {
      className: "v-btn"
    }, "Add passkey")
  })), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Active sessions"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, sessions.map(s => /*#__PURE__*/React.createElement("div", {
    className: "set-item",
    key: s.id
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "si-label"
  }, s.dev, " ", s.cur && /*#__PURE__*/React.createElement("span", {
    className: "v-meta",
    style: {
      color: "var(--label-green)"
    }
  }, "\xB7 This device")), /*#__PURE__*/React.createElement("div", {
    className: "si-desc"
  }, s.loc)), !s.cur && /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => setSessions(p => p.filter(x => x.id !== s.id))
  }, "Revoke")))));
}
function ConnRow({
  icon,
  name,
  desc,
  connected,
  onToggle
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "set-item"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: icon,
    size: 20,
    cls: "icon",
    color: "var(--fg-2)"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "si-label"
  }, name), /*#__PURE__*/React.createElement("div", {
    className: "si-desc"
  }, desc))), /*#__PURE__*/React.createElement("button", {
    className: "v-btn" + (connected ? "" : " v-btn--primary"),
    onClick: onToggle
  }, connected ? "Disconnect" : "Connect"));
}
function useConn(init) {
  const [s, setS] = React.useState(init);
  return [s, k => setS(p => ({
    ...p,
    [k]: !p[k]
  }))];
}
function ConnectedSection() {
  const [c, t] = useConn({
    github: true,
    google: true,
    slack: false
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Connected accounts"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(ConnRow, {
    icon: "github",
    name: "GitHub",
    desc: "Link issues to commits and pull requests",
    connected: c.github,
    onToggle: () => t("github")
  }), /*#__PURE__*/React.createElement(ConnRow, {
    icon: "mail",
    name: "Google",
    desc: "Sign in with your Google account",
    connected: c.google,
    onToggle: () => t("google")
  }), /*#__PURE__*/React.createElement(ConnRow, {
    icon: "slack",
    name: "Slack",
    desc: "Get notified and create issues from Slack",
    connected: c.slack,
    onToggle: () => t("slack")
  })));
}
function IntegrationsSection() {
  const [c, t] = useConn({
    github: true,
    slack: false,
    figma: true,
    sentry: false,
    zendesk: false,
    discord: false
  });
  const ints = [["github", "GitHub", "Automate your pull request and issue workflow"], ["slack", "Slack", "Create issues and get notifications in Slack"], ["figma", "Figma", "Embed file previews in issues and documents"], ["activity", "Sentry", "Link exceptions to issues automatically"], ["message-circle", "Zendesk", "Turn support tickets into issues"], ["disc", "Discord", "Notifications and issue creation from Discord"]];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Integrations"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, ints.map(([icon, name, desc]) => {
    const key = name.toLowerCase();
    return /*#__PURE__*/React.createElement(ConnRow, {
      key: key,
      icon: icon,
      name: name,
      desc: desc,
      connected: !!c[key],
      onToggle: () => t(key)
    });
  })));
}
function ApiSection() {
  const [keys, setKeys] = React.useState([{
    id: 1,
    name: "Personal key",
    token: "lin_api_7f3c…a91",
    created: "May 2"
  }]);
  const [hooks, setHooks] = React.useState([]);
  const addKey = () => setKeys(p => [...p, {
    id: Date.now(),
    name: "New key " + (p.length + 1),
    token: "lin_api_" + Math.random().toString(36).slice(2, 6) + "…" + Math.random().toString(36).slice(2, 5),
    created: "Jun 1"
  }]);
  const addHook = () => setHooks(p => [...p, {
    id: Date.now(),
    url: "https://example.com/webhook/" + (p.length + 1)
  }]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "set-head-row"
  }, /*#__PURE__*/React.createElement("h1", null, "API"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: addKey
  }, "Create key")), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Personal API keys"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, keys.map(k => /*#__PURE__*/React.createElement("div", {
    className: "set-item",
    key: k.id
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "si-label"
  }, k.name), /*#__PURE__*/React.createElement("div", {
    className: "si-desc",
    style: {
      fontFamily: "var(--font-mono)"
    }
  }, k.token, " \xB7 created ", k.created)), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setKeys(p => p.filter(x => x.id !== k.id))
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 15
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "set-head-row",
    style: {
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-section-title",
    style: {
      margin: 0
    }
  }, "Webhooks"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: addHook
  }, "New webhook")), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, hooks.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "set-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-desc"
  }, "No webhooks configured.")) : hooks.map(h => /*#__PURE__*/React.createElement("div", {
    className: "set-item",
    key: h.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-label",
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12
    }
  }, h.url), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setHooks(p => p.filter(x => x.id !== h.id))
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 15
  }))))));
}
function BillingSection() {
  const [plan, setPlan] = React.useState("Free");
  const plans = [["Free", "$0", "Up to 250 issues"], ["Basic", "$8", "Per user / month"], ["Business", "$14", "Per user / month"]];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Billing"), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Plan"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 10
    }
  }, plans.map(([n, price, desc]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    className: "set-card",
    style: {
      padding: 16,
      border: plan === n ? "1px solid var(--accent)" : null
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-label",
    style: {
      fontSize: 15
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fw-semi) 22px var(--font-sans)",
      color: "var(--fg)",
      margin: "6px 0 2px"
    }
  }, price), /*#__PURE__*/React.createElement("div", {
    className: "si-desc"
  }, desc), /*#__PURE__*/React.createElement("button", {
    className: "v-btn" + (plan === n ? "" : " v-btn--primary"),
    style: {
      marginTop: 12,
      width: "100%",
      justifyContent: "center"
    },
    onClick: () => setPlan(n)
  }, plan === n ? "Current plan" : "Upgrade")))), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Payment method"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Card",
    desc: "No card on file",
    control: /*#__PURE__*/React.createElement("button", {
      className: "v-btn"
    }, "Add card")
  })));
}
function ImportExportSection() {
  const srcs = [["github", "GitHub"], ["columns-3", "Jira"], ["trello", "Trello"], ["check-square", "Asana"], ["file-spreadsheet", "CSV"], ["box", "Shortcut"]];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Import / Export"), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Import issues from"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8
    }
  }, srcs.map(([icon, n]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    className: "import-src"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: icon,
    size: 18,
    cls: "icon-sm",
    color: "var(--fg-2)"
  }), n))), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Export"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Export all issues",
    desc: "Download a CSV of every issue in the workspace",
    control: /*#__PURE__*/React.createElement("button", {
      className: "v-btn"
    }, "Export CSV")
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Export as JSON",
    desc: "Full workspace data for backup",
    control: /*#__PURE__*/React.createElement("button", {
      className: "v-btn"
    }, "Export JSON")
  })));
}
function EmojisSection() {
  const [emojis, setEmojis] = React.useState([{
    id: 1,
    name: "shipit",
    char: "🚀"
  }, {
    id: 2,
    name: "party",
    char: "🎉"
  }]);
  const add = () => setEmojis(p => [...p, {
    id: Date.now(),
    name: "custom" + (p.length + 1),
    char: "✨"
  }]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "set-head-row"
  }, /*#__PURE__*/React.createElement("h1", null, "Emojis"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: add
  }, "Add emoji")), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, emojis.map(e => /*#__PURE__*/React.createElement("div", {
    className: "set-item",
    key: e.id
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, e.char), /*#__PURE__*/React.createElement("span", {
    className: "si-label"
  }, ":", e.name, ":")), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setEmojis(p => p.filter(x => x.id !== e.id))
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 15
  }))))));
}
function SamlSection() {
  const [on, setOn] = React.useState(false);
  const [enforce, setEnforce] = React.useState(false);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "SAML & SSO"), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Single sign-on"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Enable SAML SSO",
    desc: "Let members sign in through your identity provider",
    control: /*#__PURE__*/React.createElement(Toggle, {
      on: on,
      onClick: () => setOn(!on)
    })
  }), on && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SetItem, {
    label: "Identity provider",
    control: /*#__PURE__*/React.createElement(SetSelect, {
      value: "Okta",
      options: ["Okta", "Azure AD", "OneLogin", "Google Workspace", "Custom SAML"],
      onChange: () => {}
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "SSO URL",
    control: /*#__PURE__*/React.createElement("input", {
      className: "v-input",
      style: {
        width: 260
      },
      placeholder: "https://idp.example.com/sso/saml"
    })
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "x509 certificate",
    control: /*#__PURE__*/React.createElement("button", {
      className: "v-btn"
    }, "Upload\u2026")
  }))), /*#__PURE__*/React.createElement("div", {
    className: "set-section-title"
  }, "Enforcement"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Require SSO for all members",
    desc: "Members must authenticate through SAML to access the workspace",
    control: /*#__PURE__*/React.createElement(Toggle, {
      on: enforce,
      onClick: () => setEnforce(!enforce)
    })
  })));
}
function ScimSection() {
  const [on, setOn] = React.useState(false);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Directory sync (SCIM)"), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, /*#__PURE__*/React.createElement(SetItem, {
    label: "Enable SCIM provisioning",
    desc: "Automatically provision and deprovision members from your IdP",
    control: /*#__PURE__*/React.createElement(Toggle, {
      on: on,
      onClick: () => setOn(!on)
    })
  }), on && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SetItem, {
    label: "SCIM base URL",
    desc: "Paste this into your identity provider",
    control: /*#__PURE__*/React.createElement("code", {
      className: "v-mono",
      style: {
        fontSize: 12
      }
    }, "https://api.vector.app/scim/v2")
  }), /*#__PURE__*/React.createElement(SetItem, {
    label: "Bearer token",
    control: /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("code", {
      className: "v-mono",
      style: {
        fontSize: 12,
        color: "var(--fg-3)"
      }
    }, "scim_\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"), /*#__PURE__*/React.createElement("button", {
      className: "v-btn"
    }, "Regenerate"))
  }))));
}
function AuditSection() {
  const log = [{
    actor: "김혁규",
    action: "updated workspace SAML settings",
    ip: "203.0.113.4",
    when: "10 min ago"
  }, {
    actor: "Alex Park",
    action: "invited jordan@vector-team.example",
    ip: "198.51.100.9",
    when: "2 hours ago"
  }, {
    actor: "김혁규",
    action: "created API key “Personal key”",
    ip: "203.0.113.4",
    when: "1 day ago"
  }, {
    actor: "Jordan Lee",
    action: "exported all issues (CSV)",
    ip: "192.0.2.51",
    when: "3 days ago"
  }, {
    actor: "김혁규",
    action: "changed member role: Alex Park → Admin",
    ip: "203.0.113.4",
    when: "5 days ago"
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "set-head-row"
  }, /*#__PURE__*/React.createElement("h1", null, "Audit log"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn"
  }, "Export log")), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, log.map((e, i) => /*#__PURE__*/React.createElement("div", {
    className: "set-item",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: e.actor[0],
    size: 26
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-label"
  }, /*#__PURE__*/React.createElement("b", null, e.actor), " ", e.action), /*#__PURE__*/React.createElement("div", {
    className: "si-desc",
    style: {
      fontFamily: "var(--font-mono)"
    }
  }, "IP ", e.ip))), /*#__PURE__*/React.createElement("span", {
    className: "v-meta",
    style: {
      flex: "none"
    }
  }, e.when)))));
}
function SlaSection() {
  const [rules, setRules] = React.useState([{
    id: 1,
    name: "Urgent response",
    cond: "Priority is Urgent",
    target: "4 hours",
    on: true
  }, {
    id: 2,
    name: "First response",
    cond: "Status is Todo",
    target: "1 business day",
    on: true
  }]);
  const add = () => setRules(p => [...p, {
    id: Date.now(),
    name: "New SLA " + (p.length + 1),
    cond: "Priority is High",
    target: "2 days",
    on: true
  }]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "set-head-row"
  }, /*#__PURE__*/React.createElement("h1", null, "SLAs"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: add
  }, "New SLA")), /*#__PURE__*/React.createElement("div", {
    className: "si-desc",
    style: {
      marginBottom: 14
    }
  }, "Define time-bound targets that automatically apply to matching issues."), /*#__PURE__*/React.createElement("div", {
    className: "set-card"
  }, rules.map(r => /*#__PURE__*/React.createElement("div", {
    className: "set-item",
    key: r.id
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "si-label"
  }, r.name), /*#__PURE__*/React.createElement("div", {
    className: "si-desc"
  }, r.cond, " \xB7 target within ", /*#__PURE__*/React.createElement("b", null, r.target))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: r.on,
    onClick: () => setRules(p => p.map(x => x.id === r.id ? {
      ...x,
      on: !x.on
    } : x))
  }), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => setRules(p => p.filter(x => x.id !== r.id))
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 15
  })))))));
}
function Settings({
  onBack,
  theme,
  onToggleTheme
}) {
  const [section, setSection] = React.useState("Preferences");
  const groups = [{
    cap: "Account",
    items: [["sliders-horizontal", "Preferences"], ["user", "Profile"], ["bell", "Notifications"], ["shield", "Security & access"], ["link", "Connected accounts"]]
  }, {
    cap: "Workspace",
    items: [["settings-2", "General"], ["users", "Members"], ["credit-card", "Billing"], ["repeat", "Import / Export"], ["zap", "Integrations"], ["code", "API"]]
  }, {
    cap: "Features",
    items: [["tag", "Labels"], ["file", "Templates"], ["smile", "Emojis"]]
  }, {
    cap: "Administration",
    items: [["key-round", "SAML & SSO"], ["refresh-cw", "Directory sync"], ["scroll-text", "Audit log"], ["timer", "SLAs"]]
  }];
  const content = () => {
    switch (section) {
      case "Profile":
        return /*#__PURE__*/React.createElement(ProfileSection, null);
      case "Notifications":
        return /*#__PURE__*/React.createElement(NotificationsSection, null);
      case "Security & access":
        return /*#__PURE__*/React.createElement(SecuritySection, null);
      case "Security":
        return /*#__PURE__*/React.createElement(SecuritySection, null);
      case "Connected accounts":
        return /*#__PURE__*/React.createElement(ConnectedSection, null);
      case "General":
        return /*#__PURE__*/React.createElement(GeneralSection, null);
      case "Members":
        return /*#__PURE__*/React.createElement(MembersSection, null);
      case "Labels":
        return /*#__PURE__*/React.createElement(LabelsSection, null);
      case "Templates":
        return /*#__PURE__*/React.createElement(TemplatesSection, null);
      case "Emojis":
        return /*#__PURE__*/React.createElement(EmojisSection, null);
      case "Integrations":
        return /*#__PURE__*/React.createElement(IntegrationsSection, null);
      case "API":
        return /*#__PURE__*/React.createElement(ApiSection, null);
      case "Billing":
        return /*#__PURE__*/React.createElement(BillingSection, null);
      case "Import / Export":
        return /*#__PURE__*/React.createElement(ImportExportSection, null);
      case "SAML & SSO":
        return /*#__PURE__*/React.createElement(SamlSection, null);
      case "Directory sync":
        return /*#__PURE__*/React.createElement(ScimSection, null);
      case "Audit log":
        return /*#__PURE__*/React.createElement(AuditSection, null);
      case "SLAs":
        return /*#__PURE__*/React.createElement(SlaSection, null);
      case "Preferences":
        return /*#__PURE__*/React.createElement(PreferencesSection, {
          theme: theme,
          onToggleTheme: onToggleTheme
        });
      default:
        return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, section), /*#__PURE__*/React.createElement("div", {
          className: "set-card"
        }, /*#__PURE__*/React.createElement("div", {
          className: "set-item"
        }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
          className: "si-label"
        }, section), /*#__PURE__*/React.createElement("div", {
          className: "si-desc"
        }, "This section is part of the kit shell. Wire it to your backend in production.")))));
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "settings"
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-nav"
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-back",
    onClick: onBack
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-left",
    size: 16,
    cls: "icon-sm"
  }), "Back to app"), groups.map((g, gi) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: gi
  }, g.cap && /*#__PURE__*/React.createElement("div", {
    className: "set-cap"
  }, g.cap), g.items.map(([icon, label]) => /*#__PURE__*/React.createElement("div", {
    className: "nav-item" + (section === label ? " active" : ""),
    key: label,
    style: {
      margin: "1px 0"
    },
    onClick: () => setSection(label)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: icon,
    size: 16,
    cls: "icon"
  }), /*#__PURE__*/React.createElement("span", null, label)))))), /*#__PURE__*/React.createElement("div", {
    className: "set-content"
  }, content()));
}
Object.assign(window, {
  Settings
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Settings.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Sidebar.jsx
try { (() => {
// Sidebar.jsx — left navigation rail (resizable, collapsible, hover-peek)
function Sidebar({
  view,
  setView,
  onCompose,
  onSearch,
  onWsMenu,
  onImport,
  onInvite,
  onMore,
  cfg = {},
  width = 232,
  onResize,
  collapsed,
  peek,
  setPeek,
  onCollapse,
  onExpand,
  onRecents,
  teams = [],
  activeTeam,
  onSwitchTeam,
  onAddTeam,
  teamMenu,
  setTeamMenu,
  favoriteViews = [],
  onOpenView,
  onUnfavorite,
  onOpenTab,
  onHide
}) {
  const show = k => {
    const v = cfg[k];
    return v !== false && v !== "Don't show";
  };
  const cur = teams.find(t => t.id === activeTeam) || teams[0] || {
    id: "VEC",
    name: "vector-team",
    color: "#C026D3",
    icon: "user"
  };
  const [closed, setClosed] = React.useState({});
  const toggleSec = k => setClosed(c => ({
    ...c,
    [k]: !c[k]
  }));
  const navMenu = useNavMenu();
  const Caption = ({
    id,
    label,
    onAdd,
    addTitle
  }) => /*#__PURE__*/React.createElement(NavCaption, {
    label: label,
    open: !closed[id],
    onToggle: () => toggleSec(id),
    onAdd: onAdd,
    addTitle: addTitle
  });
  const item = (key, icon, label, count) => {
    if (!show(key)) return null;
    const [m, t, c] = navMenu;
    return /*#__PURE__*/React.createElement("div", {
      className: "nav-item nav-item-row" + (view === key ? " active" : ""),
      onClick: () => setView(key),
      draggable: ["inbox", "my", "projects", "views", "reviews", "issues"].includes(key),
      onDragStart: e => {
        e.dataTransfer.setData("text/vector-view", key);
        e.dataTransfer.effectAllowed = "copy";
      },
      title: "Drag to the tab bar to open in a new tab"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: icon,
      size: 16,
      cls: "icon"
    }), /*#__PURE__*/React.createElement("span", {
      className: "nav-item-lab"
    }, label), /*#__PURE__*/React.createElement(NavRowMenu, {
      id: "nav:" + key,
      menu: m,
      toggle: t,
      close: c,
      items: [{
        icon: /*#__PURE__*/React.createElement(Lic, {
          name: "external-link",
          size: 14,
          cls: "icon-sm"
        }),
        label: "Open in new tab",
        run: () => onOpenTab && onOpenTab(key)
      }, {
        sep: true
      }, {
        icon: /*#__PURE__*/React.createElement(Lic, {
          name: "eye-off",
          size: 14,
          cls: "icon-sm"
        }),
        label: "Hide from sidebar",
        run: () => onHide && onHide(key)
      }]
    }), count != null && /*#__PURE__*/React.createElement("span", {
      className: "count nav-item-count"
    }, count));
  };
  const startResize = e => {
    e.preventDefault();
    const sx = e.clientX,
      sw = width;
    const mv = ev => {
      const w = sw + (ev.clientX - sx);
      if (w < 160) {
        document.removeEventListener("mousemove", mv);
        document.removeEventListener("mouseup", up);
        onResize && onResize(232);
        onCollapse && onCollapse();
        return;
      }
      onResize && onResize(Math.min(420, w));
    };
    const up = () => {
      document.removeEventListener("mousemove", mv);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", mv);
    document.addEventListener("mouseup", up);
  };
  const overlay = collapsed && peek;
  return /*#__PURE__*/React.createElement(React.Fragment, null, (!collapsed || peek) && /*#__PURE__*/React.createElement("div", {
    className: "sidebar" + (overlay ? " sidebar--peek" : ""),
    style: {
      width
    },
    onMouseLeave: overlay ? () => setPeek(false) : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-switch",
    onClick: onWsMenu
  }, /*#__PURE__*/React.createElement("span", {
    className: "ws-av"
  }, "VC"), /*#__PURE__*/React.createElement("span", {
    className: "ws-name"
  }, "vector-team"), /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-4)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "ws-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onSearch,
    title: "Search (/)"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "search",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onCompose,
    title: "Create new issue"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "square-pen",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => collapsed ? onExpand && onExpand() : onCollapse && onCollapse(),
    title: collapsed ? "Open sidebar" : "Collapse sidebar ([)"
  }, /*#__PURE__*/React.createElement(PanelIcon, {
    side: "left",
    size: 16
  })))), /*#__PURE__*/React.createElement("div", {
    className: "nav"
  }, favoriteViews.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Caption, {
    id: "favorites",
    label: "Favorites"
  }), !closed.favorites && favoriteViews.map(v => /*#__PURE__*/React.createElement(NavRow, {
    key: v.id,
    leading: /*#__PURE__*/React.createElement(Lic, {
      name: v.icon || "layers",
      size: 16,
      cls: "icon",
      color: "#F2C94C"
    }),
    label: v.name,
    onClick: () => onOpenView && onOpenView(v),
    menuId: "fav:" + v.id,
    menuState: navMenu,
    items: [{
      icon: /*#__PURE__*/React.createElement(Lic, {
        name: "external-link",
        size: 14,
        cls: "icon-sm"
      }),
      label: "Open view",
      run: () => onOpenView && onOpenView(v)
    }, {
      sep: true
    }, {
      icon: /*#__PURE__*/React.createElement(Lic, {
        name: "star-off",
        size: 14,
        cls: "icon-sm"
      }),
      label: "Remove from favorites",
      danger: true,
      run: () => onUnfavorite && onUnfavorite(v.id)
    }]
  }))), /*#__PURE__*/React.createElement(Caption, {
    id: "personal",
    label: "Personal"
  }), !closed.personal && /*#__PURE__*/React.createElement(React.Fragment, null, show("inbox") && item("inbox", "inbox", "Inbox"), show("reviews") && item("reviews", "git-pull-request", "Reviews"), show("my") && item("my", "crosshair", "My issues"), item("triage", "shield-alert", "Triage")), /*#__PURE__*/React.createElement(Caption, {
    id: "workspace",
    label: "Workspace",
    onAdd: onCompose,
    addTitle: "New issue"
  }), !closed.workspace && /*#__PURE__*/React.createElement(React.Fragment, null, show("projects") && item("projects", "box", "Projects"), show("views") && item("views", "layers", "Views"), item("cycles", "refresh-cw", "Cycles"), item("insights", "bar-chart-3", "Insights"), /*#__PURE__*/React.createElement("div", {
    className: "nav-item",
    onClick: e => onMore && onMore(e.currentTarget.getBoundingClientRect())
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "more-horizontal",
    size: 16,
    cls: "icon"
  }), /*#__PURE__*/React.createElement("span", null, "More"))), /*#__PURE__*/React.createElement(Caption, {
    id: "docs",
    label: "Docs & data"
  }), !closed.docs && /*#__PURE__*/React.createElement(React.Fragment, null, item("docs", "file-text", "Documents"), item("wiki", "book-open", "Wiki"), item("database", "table-2", "Roadmap"), item("canvas", "pen-tool", "Whiteboard"), item("graph", "share-2", "Graph"), item("import", "download", "Import")), /*#__PURE__*/React.createElement(Caption, {
    id: "apps",
    label: "Apps"
  }), !closed.apps && /*#__PURE__*/React.createElement(React.Fragment, null, item("chat", "message-square", "Chat"), item("crm", "contact", "CRM"), item("calendar", "calendar", "Calendar"), item("forms", "clipboard-list", "Forms"), item("support", "life-buoy", "Support"), item("changelog", "megaphone", "Changelog")), /*#__PURE__*/React.createElement(Caption, {
    id: "teams",
    label: "Your teams",
    onAdd: onAddTeam,
    addTitle: "Create team"
  }), !closed.teams && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "team-row",
    onClick: e => setTeamMenu && setTeamMenu(teamMenu ? null : e.currentTarget.getBoundingClientRect())
  }, /*#__PURE__*/React.createElement("span", {
    className: "team-badge",
    style: {
      background: cur.color
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: cur.icon,
    size: 11,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    className: "team-name"
  }, cur.name), /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 12,
    cls: "icon-sm",
    color: "var(--fg-4)"
  })), teamMenu && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "overlay",
    style: {
      zIndex: 48
    },
    onClick: () => setTeamMenu(null)
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-menu",
    style: {
      position: "fixed",
      top: teamMenu.bottom + 4,
      left: teamMenu.left,
      width: 210,
      zIndex: 49
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cmd-cap",
    style: {
      padding: "6px 10px 4px"
    }
  }, "Switch team"), teams.map(t => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: t.id,
    onClick: () => {
      onSwitchTeam(t.id);
      setTeamMenu(null);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "team-badge",
    style: {
      background: t.color,
      width: 18,
      height: 18
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: t.icon,
    size: 11,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("span", null, t.name), t.id === activeTeam && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 14,
    cls: "icon-sm",
    color: "var(--accent)",
    style: {
      marginLeft: "auto"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "panel-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    onClick: onAddTeam
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), "Create team"))), /*#__PURE__*/React.createElement("div", {
    className: "nav-sub"
  }, item("issues", "copy", "Issues"), item("projects", "box", "Projects"), item("views", "layers", "Views"))), /*#__PURE__*/React.createElement(Caption, {
    id: "try",
    label: "Try"
  }), !closed.try && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "nav-item",
    onClick: onImport
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "download",
    size: 16,
    cls: "icon"
  }), /*#__PURE__*/React.createElement("span", null, "Import issues")), /*#__PURE__*/React.createElement("div", {
    className: "nav-item",
    onClick: onInvite
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 16,
    cls: "icon"
  }), /*#__PURE__*/React.createElement("span", null, "Invite people")))), /*#__PURE__*/React.createElement("div", {
    className: "sb-resize",
    onMouseDown: startResize
  })), collapsed && !peek && /*#__PURE__*/React.createElement("div", {
    className: "sb-peekzone",
    onMouseEnter: () => setPeek(true)
  }));
}
Object.assign(window, {
  Sidebar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/SidebarCustomize.jsx
try { (() => {
// SidebarCustomize.jsx — Vector DS feedback (from Keystone), Part 1B
// Sidebar customization: show/hide + reorder + PROMOTE (pin-to-top), persisted.
// Vector's Sidebar already has per-item "Hide"; this adds reorder + promotion +
// a single persisted model. Self-contained; Vector tokens; load after React.
//
// MODEL   { cfg: {key:bool}, order: [key…], pinned: [key…] }
//   visible(key)  = cfg[key] !== false
//   promoted(key) = visible(key) && pinned.includes(key)   → render beside core nav
//
// EXPORTS  window.SidebarCustomize = { load, save, promotedKeys, toolKeys, Modal }
//   const model = SidebarCustomize.load(defaults);           // {cfg,order,pinned}
//   SidebarCustomize.promotedKeys(model)  → ordered keys pinned to the top
//   SidebarCustomize.toolKeys(model)      → ordered visible keys NOT promoted (the "Tools" section)
//   <SidebarCustomize.Modal dests={DESTS} model={model} onChange={setModel} onClose={…} />
//     DESTS = [{ key, icon, label }]   (icon = Lucide name string, optional)

(function () {
  const KEY = "vector-sidebar-v1";
  function load(defaults) {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
    } catch (e) {}
    return {
      cfg: Object.assign({}, defaults && defaults.cfg, saved.cfg),
      order: saved.order && saved.order.length ? saved.order : defaults && defaults.order || [],
      pinned: saved.pinned || defaults && defaults.pinned || []
    };
  }
  function save(model) {
    try {
      localStorage.setItem(KEY, JSON.stringify(model));
    } catch (e) {}
  }
  const visible = (m, k) => m.cfg[k] !== false;
  const promotedKeys = m => m.order.filter(k => visible(m, k) && m.pinned.includes(k));
  const toolKeys = m => m.order.filter(k => visible(m, k) && !m.pinned.includes(k));

  // tiny inline icon helpers (fall back if Lucide's Lic isn't present)
  function Ic(name, size) {
    if (typeof window !== "undefined" && window.Lic) return React.createElement(window.Lic, {
      name,
      size: size || 15,
      cls: "icon-sm"
    });
    return React.createElement("span", {
      style: {
        width: size || 15,
        height: size || 15,
        display: "inline-block"
      }
    });
  }
  function Modal({
    dests,
    model,
    onChange,
    onClose
  }) {
    const [drag, setDrag] = React.useState(null);
    const [over, setOver] = React.useState(null);
    const byKey = Object.fromEntries((dests || []).map(d => [d.key, d]));
    const rows = model.order.filter(k => byKey[k]);
    const set = next => {
      save(next);
      onChange && onChange(next);
    };
    const toggleShow = k => set(Object.assign({}, model, {
      cfg: Object.assign({}, model.cfg, {
        [k]: model.cfg[k] === false
      })
    }));
    const togglePin = k => set(Object.assign({}, model, {
      pinned: model.pinned.includes(k) ? model.pinned.filter(x => x !== k) : [...model.pinned, k]
    }));
    const reorder = (from, to) => {
      if (from == null || to == null || from === to) return;
      const ord = [...model.order];
      const [m] = ord.splice(from, 1);
      ord.splice(to, 0, m);
      set(Object.assign({}, model, {
        order: ord
      }));
    };
    return React.createElement("div", {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "var(--scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      },
      onClick: onClose
    }, React.createElement("div", {
      onClick: e => e.stopPropagation(),
      style: {
        width: 380,
        maxHeight: "80vh",
        overflowY: "auto",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-modal)",
        padding: 18
      }
    }, React.createElement("div", {
      style: {
        font: "var(--fw-semi) 15px var(--font-sans)",
        color: "var(--fg)",
        marginBottom: 3
      }
    }, "Customize sidebar"), React.createElement("div", {
      style: {
        font: "var(--fw-medium) 12px var(--font-sans)",
        color: "var(--fg-4)",
        marginBottom: 14
      }
    }, "Drag to reorder · ★ pins to the top · eye toggles visibility"), rows.map(k => {
      const d = byKey[k];
      const idx = model.order.indexOf(k);
      const shown = model.cfg[k] !== false;
      const pin = model.pinned.includes(k);
      return React.createElement("div", {
        key: k,
        draggable: true,
        onDragStart: () => setDrag(idx),
        onDragEnter: () => setOver(idx),
        onDragEnd: () => {
          reorder(drag, over);
          setDrag(null);
          setOver(null);
        },
        onDragOver: e => e.preventDefault(),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "7px 8px",
          borderRadius: "var(--r-sm)",
          background: over === idx && drag !== idx ? "var(--bg-hover)" : "transparent",
          opacity: drag === idx ? 0.4 : shown ? 1 : 0.5,
          cursor: "grab"
        }
      }, React.createElement("span", {
        style: {
          color: "var(--fg-4)",
          display: "inline-flex"
        }
      }, Ic("grip-vertical", 14)), React.createElement("span", {
        style: {
          display: "inline-flex",
          color: "var(--fg-3)"
        }
      }, Ic(d.icon || "circle", 15)), React.createElement("span", {
        style: {
          flex: 1,
          font: "var(--fw-medium) 13px var(--font-sans)",
          color: "var(--fg-2)"
        }
      }, d.label), React.createElement("button", {
        onClick: () => togglePin(k),
        title: pin ? "Unpin from top" : "Pin to top",
        style: {
          border: "none",
          background: "none",
          cursor: "pointer",
          padding: 4,
          display: "inline-flex",
          color: pin ? "var(--accent)" : "var(--fg-4)"
        }
      }, Ic(pin ? "star" : "star", 15)), React.createElement("button", {
        onClick: () => toggleShow(k),
        title: shown ? "Hide from sidebar" : "Show in sidebar",
        style: {
          border: "none",
          background: "none",
          cursor: "pointer",
          padding: 4,
          display: "inline-flex",
          color: "var(--fg-4)"
        }
      }, Ic(shown ? "eye" : "eye-off", 15)));
    })));
  }
  if (typeof window !== "undefined") window.SidebarCustomize = {
    load,
    save,
    promotedKeys,
    toolKeys,
    Modal
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/SidebarCustomize.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/StatStrip.jsx
try { (() => {
// StatStrip.jsx — Vector DS feedback (from Keystone), Part 2B
// A headline summary row for the top of a list/view: a set of label+value
// stats, each with an optional drill-down hover (the records behind the number).
// Self-contained: inline styles on Vector tokens only. Load after React.
// If RichTooltip.jsx is also loaded it is reused for the drill-down; otherwise
// a minimal inline fallback tooltip is used.
//
// USAGE
//   <StatStrip stats={[
//     { label: "In progress", value: "8" },
//     { label: "Blocked", value: "2", tone: "neg",
//       tip: [ { name: "VEC-31 Payments", val: "4d", tone: "neg" },
//               { name: "VEC-52 Search",   val: "1d", tone: "neg" } ] },
//     { label: "Completion", value: "72%", tone: "pos" },
//     { label: "Avg cycle", value: "3.4d" },
//   ]} />
//
// stat: { label, value, tone?: "pos"|"neg", tip?: [ {name,val,tone?,dot?,flag?} ] }

(function () {
  function toneColor(tone) {
    return tone === "pos" ? "var(--pos, #4CB782)" : tone === "neg" ? "var(--neg, #EB5757)" : "var(--fg)";
  }
  function Stat({
    label,
    value,
    tone,
    tip
  }) {
    const inner = React.createElement("span", {
      style: {
        display: "inline-flex",
        flexDirection: "column",
        gap: 3,
        cursor: tip ? "default" : "inherit"
      }
    }, React.createElement("span", {
      style: {
        font: "var(--fw-medium) 11px var(--font-sans)",
        color: "var(--fg-4)",
        whiteSpace: "nowrap"
      }
    }, label), React.createElement("span", {
      style: {
        font: "var(--fw-semi) 18px var(--font-mono)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
        color: toneColor(tone)
      }
    }, value));
    if (!tip || !tip.length) return inner;

    // Prefer the shared RichTooltip primitive (Part 2A) if present.
    if (typeof window !== "undefined" && window.RichTooltip) {
      return React.createElement(window.RichTooltip, {
        placement: "bottom",
        align: "start",
        header: label,
        rows: tip
      }, inner);
    }

    // Minimal inline fallback (keeps this file standalone).
    return React.createElement("span", {
      className: "v-statstrip-anchor",
      style: {
        position: "relative",
        display: "inline-flex"
      }
    }, inner, React.createElement("span", {
      className: "v-statstrip-tip",
      style: {
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        zIndex: 40,
        width: 200,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: "9px 11px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-popover)",
        opacity: 0,
        pointerEvents: "none",
        transition: "opacity .12s ease"
      }
    }, tip.map((r, i) => React.createElement("span", {
      key: i,
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 14
      }
    }, React.createElement("span", {
      style: {
        font: "var(--fw-medium) 12px var(--font-sans)",
        color: "var(--fg-3)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, r.name), React.createElement("span", {
      style: {
        flexShrink: 0,
        font: "var(--fw-semi) 12px var(--font-mono)",
        fontVariantNumeric: "tabular-nums",
        color: toneColor(r.tone)
      }
    }, r.val)))));
  }
  function StatStrip({
    stats = [],
    style
  }) {
    return React.createElement("div", {
      className: "v-statstrip",
      style: Object.assign({
        display: "flex",
        gap: 28,
        alignItems: "flex-start",
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)"
      }, style)
    }, stats.map((s, i) => React.createElement(Stat, Object.assign({
      key: i
    }, s))));
  }
  if (typeof document !== "undefined" && !document.getElementById("v-statstrip-css")) {
    const s = document.createElement("style");
    s.id = "v-statstrip-css";
    s.textContent = ".v-statstrip-anchor:hover > .v-statstrip-tip { opacity: 1 !important; }";
    document.head.appendChild(s);
  }
  if (typeof window !== "undefined") window.StatStrip = StatStrip;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/StatStrip.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Support.jsx
try { (() => {
// Support.jsx — customer conversations inbox, Chatwoot-style (chatwoot/chatwoot)
const SUPPORT_SEED = {
  convos: [{
    id: "c1",
    name: "Maria Gomez",
    company: "Acme",
    channel: "email",
    status: "open",
    assignee: "김혁규",
    preview: "The export keeps timing out…",
    unread: 2,
    msgs: [{
      from: "them",
      text: "Hi — the CSV export keeps timing out on large workspaces.",
      time: "9:01 AM"
    }, {
      from: "me",
      text: "Thanks for flagging! How many issues are in the workspace?",
      time: "9:08 AM"
    }, {
      from: "them",
      text: "Around 12,000.",
      time: "9:10 AM"
    }]
  }, {
    id: "c2",
    name: "Tom Becker",
    company: "Globex",
    channel: "chat",
    status: "open",
    assignee: null,
    preview: "How do I invite my whole team?",
    unread: 1,
    msgs: [{
      from: "them",
      text: "How do I invite my whole team at once?",
      time: "8:40 AM"
    }]
  }, {
    id: "c3",
    name: "Priya N.",
    company: "Initech",
    channel: "email",
    status: "pending",
    assignee: "Alex Park",
    preview: "Thanks, that worked!",
    unread: 0,
    msgs: [{
      from: "them",
      text: "Thanks, that worked!",
      time: "Yesterday"
    }]
  }, {
    id: "c4",
    name: "Wei Liu",
    company: "Umbrella",
    channel: "chat",
    status: "resolved",
    assignee: "김혁규",
    preview: "Resolved — billing updated.",
    unread: 0,
    msgs: [{
      from: "them",
      text: "My invoice shows the wrong plan.",
      time: "Mon"
    }, {
      from: "me",
      text: "Fixed it on our end — updated to Business. 🎉",
      time: "Mon"
    }]
  }]
};
const SUP_STATUS = {
  open: {
    label: "Open",
    color: "#4CB782"
  },
  pending: {
    label: "Pending",
    color: "#F2C94C"
  },
  resolved: {
    label: "Resolved",
    color: "#8A8F98"
  }
};
function Support({
  data,
  onUpdate
}) {
  const [filter, setFilter] = React.useState("open");
  const [selId, setSelId] = React.useState("c1");
  const [reply, setReply] = React.useState("");
  const list = data.convos.filter(c => filter === "all" || c.status === filter);
  const convo = data.convos.find(c => c.id === selId);
  const patch = (id, p) => onUpdate({
    ...data,
    convos: data.convos.map(c => c.id === id ? {
      ...c,
      ...p
    } : c)
  });
  const send = () => {
    if (!reply.trim() || !convo) return;
    patch(convo.id, {
      msgs: [...convo.msgs, {
        from: "me",
        text: reply.trim(),
        time: "now"
      }],
      preview: reply.trim()
    });
    setReply("");
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "chat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sup-list"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sup-filters"
  }, ["open", "pending", "resolved", "all"].map(f => /*#__PURE__*/React.createElement("div", {
    key: f,
    className: "sup-filter" + (filter === f ? " active" : ""),
    onClick: () => setFilter(f)
  }, f === "all" ? "All" : SUP_STATUS[f].label))), /*#__PURE__*/React.createElement("div", {
    className: "inbox-items"
  }, list.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    className: "sup-convo" + (selId === c.id ? " active" : ""),
    onClick: () => {
      setSelId(c.id);
      patch(c.id, {
        unread: 0
      });
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#4CB782",
    to: "#2D9CDB",
    text: c.name[0],
    size: 34
  }), /*#__PURE__*/React.createElement("div", {
    className: "sup-convo-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sup-convo-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sup-name"
  }, c.name), /*#__PURE__*/React.createElement(Lic, {
    name: c.channel === "email" ? "mail" : "message-circle",
    size: 12,
    cls: "icon-sm",
    color: "var(--fg-4)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "sup-preview"
  }, c.preview), /*#__PURE__*/React.createElement("div", {
    className: "sup-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "db-pill",
    style: {
      background: SUP_STATUS[c.status].color + "26",
      color: SUP_STATUS[c.status].color,
      height: 18
    }
  }, SUP_STATUS[c.status].label), /*#__PURE__*/React.createElement("span", {
    className: "sup-company"
  }, c.company))), c.unread > 0 && /*#__PURE__*/React.createElement("span", {
    className: "sup-unread"
  }, c.unread), /*#__PURE__*/React.createElement("button", {
    className: "tree-del",
    title: "Delete",
    onClick: e => {
      e.stopPropagation();
      const rest = data.convos.filter(x => x.id !== c.id);
      onUpdate({
        ...data,
        convos: rest
      });
      if (selId === c.id) setSelId(rest[0] ? rest[0].id : null);
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 13
  })))))), /*#__PURE__*/React.createElement("div", {
    className: "chat-main"
  }, convo ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "chat-header"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chat-h-title"
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#4CB782",
    to: "#2D9CDB",
    text: convo.name[0],
    size: 22
  }), /*#__PURE__*/React.createElement("input", {
    className: "crm-edit crm-edit-title",
    style: {
      maxWidth: 220,
      fontSize: 15,
      fontWeight: 600
    },
    value: convo.name,
    onChange: e => patch(convo.id, {
      name: e.target.value
    })
  })), /*#__PURE__*/React.createElement("span", {
    className: "chat-h-topic"
  }, convo.company, " \xB7 ", convo.channel), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-select",
    onClick: () => patch(convo.id, {
      assignee: convo.assignee ? null : "김혁규"
    })
  }, convo.assignee ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: convo.assignee[0],
    size: 16
  }), convo.assignee) : "Assign"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    style: {
      height: 28
    },
    onClick: () => patch(convo.id, {
      status: convo.status === "resolved" ? "open" : "resolved"
    })
  }, convo.status === "resolved" ? "Reopen" : "Resolve"))), /*#__PURE__*/React.createElement("div", {
    className: "chat-timeline sup-timeline"
  }, convo.msgs.map((m, i) => /*#__PURE__*/React.createElement("div", {
    className: "sup-msg " + m.from,
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "sup-bubble"
  }, m.text, /*#__PURE__*/React.createElement("span", {
    className: "sup-time"
  }, m.time))))), /*#__PURE__*/React.createElement("div", {
    className: "chat-composer"
  }, /*#__PURE__*/React.createElement("input", {
    value: reply,
    placeholder: "Reply to customer\u2026",
    onChange: e => setReply(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: send,
    style: {
      opacity: reply.trim() ? 1 : .4
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "send-horizontal",
    size: 16,
    color: "var(--accent)"
  })))) : /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "Select a conversation"))));
}
Object.assign(window, {
  Support,
  SUPPORT_SEED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Support.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Triage.jsx
try { (() => {
// Triage.jsx — incoming unclassified issues (accept / decline / merge)
function Triage({
  queue,
  onAccept,
  onDecline,
  onOpen,
  onCycle,
  onSetPriority
}) {
  const [selId, setSelId] = React.useState(queue[0] ? queue[0].id : null);
  const sel = queue.find(q => q.id === selId);
  React.useEffect(() => {
    if (!sel && queue[0]) setSelId(queue[0].id);
  }, [queue.length]);
  if (queue.length === 0) return /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "inbox",
    size: 40,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-h3",
    style: {
      color: "var(--fg-2)"
    }
  }, "Triage zero"), /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No issues waiting for triage")));
  return /*#__PURE__*/React.createElement("div", {
    className: "inbox"
  }, /*#__PURE__*/React.createElement("div", {
    className: "inbox-master"
  }, /*#__PURE__*/React.createElement("div", {
    className: "inbox-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ibx-title"
  }, "Triage"), /*#__PURE__*/React.createElement("span", {
    className: "ibx-count"
  }, queue.length)), /*#__PURE__*/React.createElement("div", {
    className: "inbox-items"
  }, queue.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.id,
    className: "ibx-item" + (selId === n.id ? " active" : ""),
    onClick: () => setSelId(n.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "ibx-ic"
  }, /*#__PURE__*/React.createElement(PriorityIcon, {
    priority: n.priority,
    size: 15
  })), /*#__PURE__*/React.createElement("div", {
    className: "ibx-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ibx-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ibx-actor"
  }, n.title)), /*#__PURE__*/React.createElement("div", {
    className: "ibx-sub"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ibx-id"
  }, n.id), " \xB7 ", n.source)), /*#__PURE__*/React.createElement("span", {
    className: "ibx-time"
  }, n.created))))), /*#__PURE__*/React.createElement("div", {
    className: "inbox-detail"
  }, sel ? /*#__PURE__*/React.createElement("div", {
    className: "ibx-reader"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ibx-reader-head"
  }, /*#__PURE__*/React.createElement(PriorityIcon, {
    priority: sel.priority,
    size: 16
  }), /*#__PURE__*/React.createElement("span", {
    className: "ibx-id"
  }, sel.id), /*#__PURE__*/React.createElement("h2", null, sel.title)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      margin: "12px 0",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "label-chip"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "inbox",
    size: 11,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), sel.source), sel.labels.map(l => /*#__PURE__*/React.createElement("span", {
    className: "label-chip",
    key: l
  }, /*#__PURE__*/React.createElement("span", {
    className: "label-dot",
    style: {
      background: LABELS[l].color
    }
  }), l))), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--fg-2)",
      font: "var(--fw-regular) 14px/1.6 var(--font-sans)",
      maxWidth: 620
    }
  }, sel.desc), /*#__PURE__*/React.createElement("div", {
    className: "triage-props"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tp-label"
  }, "Set priority"), /*#__PURE__*/React.createElement("div", {
    className: "tp-opts"
  }, PRIORITIES.map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    className: "tp-opt" + (sel.priority === p ? " on" : ""),
    onClick: () => onSetPriority(sel.id, p),
    title: priorityLabel(p)
  }, /*#__PURE__*/React.createElement(PriorityIcon, {
    priority: p,
    size: 15
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: () => onAccept(sel.id)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-on-accent)"
  }), "Accept"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => onDecline(sel.id)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 15,
    cls: "icon-sm"
  }), "Decline"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "git-merge",
    size: 15,
    cls: "icon-sm"
  }), "Merge\u2026"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => onOpen(sel),
    style: {
      marginLeft: "auto"
    }
  }, "Open issue")), /*#__PURE__*/React.createElement("div", {
    className: "triage-hint"
  }, "Accept moves it into the team's backlog \xB7 Decline marks it canceled")) : /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "Select an issue to triage"))));
}
Object.assign(window, {
  Triage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Triage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Views.jsx
try { (() => {
// Views.jsx — IssueList (grouped) + BoardView + empty states
function IssueRow({
  issue,
  opts,
  onCycle,
  onOpen,
  selected,
  onToggleSel,
  draggable,
  focused,
  rowGrip,
  dragging
}) {
  const show = p => opts.props.includes(p);
  const rowRef = React.useRef(null);
  const lp = React.useRef(null);
  React.useEffect(() => {
    if (focused && rowRef.current) {
      const el = rowRef.current,
        c = el.closest(".content");
      if (c) {
        const er = el.getBoundingClientRect(),
          cr = c.getBoundingClientRect();
        if (er.top < cr.top + 44) c.scrollTop -= cr.top + 44 - er.top;else if (er.bottom > cr.bottom) c.scrollTop += er.bottom - cr.bottom;
      }
    }
  }, [focused]);
  // Long-press = the touch-surface path to multi-select (desktop uses the row checkbox).
  const startLP = e => {
    if (!onToggleSel) return;
    const t = e.touches ? e.touches[0] : e;
    lp.current = {
      x: t.clientX,
      y: t.clientY,
      fired: false
    };
    lp.current.timer = setTimeout(() => {
      if (!lp.current) return;
      lp.current.fired = true;
      if (navigator.vibrate) navigator.vibrate(12);
      onToggleSel(issue.id);
    }, 450);
  };
  const moveLP = e => {
    if (!lp.current) return;
    const t = e.touches ? e.touches[0] : e;
    if (Math.abs(t.clientX - lp.current.x) > 10 || Math.abs(t.clientY - lp.current.y) > 10) {
      clearTimeout(lp.current.timer);
      lp.current = null;
    }
  };
  const endLP = () => {
    if (lp.current) {
      clearTimeout(lp.current.timer);
      if (lp.current.fired) {
        lp.current = null;
        return true;
      }
      lp.current = null;
    }
    return false;
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: rowRef,
    className: "issue-row" + (selected ? " selected" : "") + (focused ? " focused" : ""),
    onTouchStart: startLP,
    onTouchMove: moveLP,
    onTouchEnd: endLP,
    onContextMenu: e => {
      if (window.matchMedia("(pointer:coarse)").matches) e.preventDefault();
    },
    onClick: e => {
      if (endLP()) {
        e.preventDefault();
        return;
      }
      onOpen && onOpen(issue);
    },
    onMouseEnter: () => {
      if (window.__vSetHover) window.__vSetHover(issue.id);
    },
    onMouseLeave: () => {
      if (window.__vSetHover) window.__vSetHover(null);
    }
  }, draggable && rowGrip && /*#__PURE__*/React.createElement(DragGrip, rowGrip(issue.id)), /*#__PURE__*/React.createElement("span", {
    className: "row-check" + (selected ? " on" : ""),
    onClick: e => {
      e.stopPropagation();
      onToggleSel && onToggleSel(issue.id);
    }
  }, selected && /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 11,
    color: "var(--fg-on-accent)"
  })), show("ID") && /*#__PURE__*/React.createElement("span", {
    className: "issue-id"
  }, issue.id), /*#__PURE__*/React.createElement("span", {
    className: "statusbtn",
    style: {
      width: 22,
      height: 22
    },
    onClick: e => {
      e.stopPropagation();
      onCycle(issue.id);
    }
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: issue.status,
    size: 14
  })), show("Priority") && /*#__PURE__*/React.createElement("span", {
    className: "issue-priority"
  }, /*#__PURE__*/React.createElement(PriorityIcon, {
    priority: issue.priority,
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    className: "issue-when"
  }, "2mo"), /*#__PURE__*/React.createElement("span", {
    className: "issue-title"
  }, issue.title), /*#__PURE__*/React.createElement("span", {
    className: "issue-meta"
  }, show("Labels") && issue.labels.map(l => /*#__PURE__*/React.createElement("span", {
    className: "label-chip",
    key: l
  }, /*#__PURE__*/React.createElement("span", {
    className: "label-dot",
    style: {
      background: LABELS[l].color
    }
  }), l)), show("Created") && /*#__PURE__*/React.createElement("span", {
    className: "issue-date"
  }, issue.created), show("Updated") && /*#__PURE__*/React.createElement("span", {
    className: "issue-date"
  }, issue.updated), /*#__PURE__*/React.createElement("span", {
    className: "avatar empty"
  })));
}
const PRIO_ORDER = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4
};
function sortIssues(list, ordering) {
  const a = [...list];
  if (ordering === "Priority") a.sort((x, y) => PRIO_ORDER[x.priority] - PRIO_ORDER[y.priority]);else if (ordering === "Title") a.sort((x, y) => x.title.localeCompare(y.title));else if (ordering === "Status") a.sort((x, y) => STATUS_CYCLE.indexOf(x.status) - STATUS_CYCLE.indexOf(y.status));
  return a;
}

// Build groups for the list based on opts.grouping.
function buildGroups(issues, grouping) {
  if (grouping === "Status") {
    return ["backlog", "todo", "progress", "review", "done", "canceled"].map(s => ({
      key: s,
      label: statusLabel(s),
      icon: /*#__PURE__*/React.createElement(StatusIcon, {
        status: s,
        size: 14
      }),
      items: issues.filter(i => i.status === s)
    }));
  }
  if (grouping === "Priority") {
    return PRIORITIES.map(p => ({
      key: p,
      label: priorityLabel(p),
      icon: /*#__PURE__*/React.createElement(PriorityIcon, {
        priority: p,
        size: 15
      }),
      items: issues.filter(i => i.priority === p)
    }));
  }
  if (grouping === "Assignee") return [{
    key: "noone",
    label: "No assignee",
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "user-x",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    items: issues
  }];
  if (grouping === "Project") return [{
    key: "noproj",
    label: "No project",
    icon: /*#__PURE__*/React.createElement(Lic, {
      name: "box",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }),
    items: issues
  }];
  return [{
    key: "all",
    label: null,
    icon: null,
    items: issues
  }]; // No grouping
}
function ListGroup({
  group,
  opts,
  onCycle,
  onOpen,
  onAdd,
  sel,
  onToggleSel,
  onMove,
  grouping,
  focusId,
  rowGrip,
  dragId,
  overKey
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const over = overKey === group.key;
  const items = sortIssues(group.items, opts.ordering);
  const canDrop = grouping === "Status" || grouping === "Priority" || grouping === "Assignee";
  return /*#__PURE__*/React.createElement("div", {
    "data-drop": canDrop ? group.key : undefined
  }, group.label !== null && /*#__PURE__*/React.createElement("div", {
    className: "group-header" + (over ? " group-header--over" : ""),
    onClick: () => setCollapsed(!collapsed)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 14,
    cls: "icon-sm chev" + (collapsed ? " collapsed" : "")
  }), group.icon, /*#__PURE__*/React.createElement("span", {
    className: "gh-title"
  }, group.label), /*#__PURE__*/React.createElement("span", {
    className: "gh-count"
  }, items.length), /*#__PURE__*/React.createElement("span", {
    className: "gh-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "more-horizontal",
    size: 15
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: e => {
      e.stopPropagation();
      onAdd && onAdd(group.key);
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 15
  })))), !collapsed && /*#__PURE__*/React.createElement(React.Fragment, null, opts.subgrouping === "Project" && /*#__PURE__*/React.createElement("div", {
    className: "subgroup-header"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-down",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement(Lic, {
    name: "box",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "sg-title"
  }, "No project"), /*#__PURE__*/React.createElement("span", {
    className: "sg-count"
  }, items.length)), items.map(i => /*#__PURE__*/React.createElement(IssueRow, {
    key: i.id,
    issue: i,
    opts: opts,
    onCycle: onCycle,
    onOpen: onOpen,
    selected: sel && sel.has(i.id),
    onToggleSel: onToggleSel,
    draggable: canDrop,
    focused: focusId === i.id,
    rowGrip: rowGrip,
    dragging: dragId === i.id
  }))));
}
function IssueList({
  issues,
  opts,
  onCycle,
  onOpen,
  onAdd,
  sel,
  onToggleSel,
  onMove,
  focusId
}) {
  const {
    dragId,
    overKey,
    grip: rowGrip
  } = useCardDrag({
    onDrop: (id, groupKey) => {
      if (onMove) onMove(id, groupKey);
    }
  });
  let groups = buildGroups(issues, opts.grouping);
  if (!opts.empty) groups = groups.filter(g => g.items.length > 0 || g.label === null);
  if (issues.length === 0) return /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, /*#__PURE__*/React.createElement(EmptyState, {
    text: "No issues match these filters",
    glyph: /*#__PURE__*/React.createElement(Lic, {
      name: "search-x",
      size: 40,
      color: "var(--fg-4)"
    })
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, groups.map(g => /*#__PURE__*/React.createElement(ListGroup, {
    key: g.key,
    group: g,
    opts: opts,
    onCycle: onCycle,
    onOpen: onOpen,
    onAdd: onAdd,
    sel: sel,
    onToggleSel: onToggleSel,
    onMove: onMove,
    grouping: opts.grouping,
    focusId: focusId,
    rowGrip: rowGrip,
    dragId: dragId,
    overKey: overKey
  })));
}
function BoardView({
  issues,
  opts,
  onCycle,
  onOpen,
  onAdd,
  onMove
}) {
  const {
    dragId,
    overKey: overCol,
    grip
  } = useCardDrag({
    onDrop: (id, colKey) => {
      if (onMove) onMove(id, colKey);
    }
  });
  let cols = [{
    key: "backlog",
    label: "Backlog"
  }, {
    key: "todo",
    label: "Todo"
  }, {
    key: "progress",
    label: "In Progress"
  }, {
    key: "review",
    label: "In Review"
  }, {
    key: "done",
    label: "Done"
  }, {
    key: "canceled",
    label: "Canceled"
  }].map(c => ({
    ...c,
    items: sortIssues(issues.filter(i => i.status === c.key), opts.ordering)
  }));
  if (!opts.empty) cols = cols.filter(c => c.items.length > 0 || c.key === overCol);
  if (cols.length === 0) cols = [{
    key: "todo",
    label: "Todo",
    items: []
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "content",
    style: {
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "board"
  }, cols.map(col => /*#__PURE__*/React.createElement("div", {
    className: "board-col" + (overCol === col.key ? " board-col--over" : ""),
    key: col.key,
    "data-drop": col.key
  }, /*#__PURE__*/React.createElement("div", {
    className: "board-col-head"
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: col.key,
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    className: "bc-title"
  }, col.label), /*#__PURE__*/React.createElement("span", {
    className: "bc-count"
  }, col.items.length), /*#__PURE__*/React.createElement("span", {
    className: "bc-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "more-horizontal",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => onAdd && onAdd(col.key)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 14
  })))), /*#__PURE__*/React.createElement("div", {
    className: "board-cards"
  }, col.items.map(i => /*#__PURE__*/React.createElement("div", {
    className: "board-card" + (dragId === i.id ? " board-card--drag" : ""),
    key: i.id,
    onClick: () => onOpen && onOpen(i)
  }, /*#__PURE__*/React.createElement("div", {
    className: "bc-top"
  }, /*#__PURE__*/React.createElement(DragGrip, grip(i.id)), /*#__PURE__*/React.createElement("span", {
    className: "bc-id"
  }, i.id), /*#__PURE__*/React.createElement("span", {
    className: "avatar empty"
  })), /*#__PURE__*/React.createElement("div", {
    className: "bc-title-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "statusbtn",
    onClick: e => {
      e.stopPropagation();
      onCycle(i.id);
    }
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: i.status,
    size: 14
  })), /*#__PURE__*/React.createElement("span", {
    className: "bc-issue-title"
  }, i.title)), /*#__PURE__*/React.createElement("div", {
    className: "bc-foot"
  }, /*#__PURE__*/React.createElement(PriorityIcon, {
    priority: i.priority,
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    className: "bc-when"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "clock",
    size: 12,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), "2mo")), /*#__PURE__*/React.createElement("div", {
    className: "bc-created"
  }, "Created ", i.created))), overCol === col.key && dragId && /*#__PURE__*/React.createElement("div", {
    className: "board-drop-hint"
  }, "Drop to move to ", col.label))))));
}
function EmptyState({
  glyph,
  text,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, glyph, /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, text), children);
}
function InboxEmpty() {
  return /*#__PURE__*/React.createElement(EmptyState, {
    text: "No notifications",
    glyph: /*#__PURE__*/React.createElement("svg", {
      width: "80",
      height: "64",
      viewBox: "0 0 80 64",
      fill: "none",
      className: "glyph"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M14 26L24 10h32l10 16v22a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V26z",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M14 28h16l4 7h12l4-7h16",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinejoin: "round"
    }))
  });
}
function MyIssuesEmpty({
  onCompose
}) {
  return /*#__PURE__*/React.createElement(EmptyState, {
    text: "No issues assigned to you",
    glyph: /*#__PURE__*/React.createElement("svg", {
      width: "76",
      height: "76",
      viewBox: "0 0 76 76",
      fill: "none",
      className: "glyph"
    }, /*#__PURE__*/React.createElement("ellipse", {
      cx: "38",
      cy: "38",
      rx: "18",
      ry: "9",
      stroke: "currentColor",
      strokeWidth: "2"
    }), /*#__PURE__*/React.createElement("ellipse", {
      cx: "38",
      cy: "30",
      rx: "18",
      ry: "9",
      stroke: "currentColor",
      strokeWidth: "2",
      opacity: ".5"
    }), /*#__PURE__*/React.createElement("ellipse", {
      cx: "38",
      cy: "46",
      rx: "18",
      ry: "9",
      stroke: "currentColor",
      strokeWidth: "2",
      opacity: ".3"
    }))
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: onCompose
  }, "Create new issue"));
}

// ---- Views screen (saved views) ----
function ViewRowMenu({
  v,
  onClose,
  anchor,
  onRename,
  onDuplicate,
  onCopyLink,
  onDelete
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "overlay",
    style: {
      zIndex: 48
    },
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-menu",
    style: {
      position: "fixed",
      top: anchor.bottom + 4,
      left: Math.min(anchor.left, window.innerWidth - 200),
      width: 190,
      zIndex: 49
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    onClick: () => {
      onRename(v);
      onClose();
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "pencil",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), "Edit view\u2026"), /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    onClick: () => {
      onDuplicate(v);
      onClose();
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "copy",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), "Duplicate view"), /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    onClick: () => {
      onCopyLink(v);
      onClose();
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "link",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), "Copy view link"), /*#__PURE__*/React.createElement("div", {
    className: "panel-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    style: {
      color: "var(--label-red)"
    },
    onClick: () => {
      onDelete(v.id);
      onClose();
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 15,
    cls: "icon-sm",
    color: "var(--label-red)"
  }), "Delete view")));
}
function ViewsScreen({
  savedViews,
  favorites,
  onOpenView,
  onDeleteView,
  onCreateView,
  onToggleFav,
  onRename,
  onDuplicate,
  onCopyLink,
  onToggleSubscribe
}) {
  const [tab, setTab] = React.useState("Issues");
  const [menu, setMenu] = React.useState(null); // {v, anchor}
  const scope = s => savedViews.filter(v => v.kind === tab.toLowerCase() && (v.scope || "personal") === s);
  const renderRow = v => {
    const fav = favorites.includes(v.id);
    return /*#__PURE__*/React.createElement("div", {
      className: "view-row",
      key: v.id,
      onClick: () => onOpenView(v)
    }, /*#__PURE__*/React.createElement(Lic, {
      name: v.icon || "layers",
      size: 16,
      cls: "icon",
      color: "var(--fg-3)"
    }), /*#__PURE__*/React.createElement("div", {
      className: "vr-main"
    }, /*#__PURE__*/React.createElement("span", {
      className: "vr-title"
    }, v.name), /*#__PURE__*/React.createElement("span", {
      className: "vr-desc"
    }, v.desc)), /*#__PURE__*/React.createElement("span", {
      className: "vr-owner"
    }, /*#__PURE__*/React.createElement(Avatar, {
      from: "#2D9CDB",
      to: "#4C8DFF",
      text: "K",
      size: 18
    }), "\uAE40\uD601\uADDC"), /*#__PURE__*/React.createElement("button", {
      className: "iconbtn",
      title: v.subscribed ? "Unsubscribe" : "Subscribe",
      onClick: e => {
        e.stopPropagation();
        onToggleSubscribe(v.id);
      }
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "bell",
      size: 15,
      color: v.subscribed ? "var(--accent)" : "var(--fg-4)"
    })), /*#__PURE__*/React.createElement("button", {
      className: "iconbtn",
      title: "Favorite",
      onClick: e => {
        e.stopPropagation();
        onToggleFav(v.id);
      }
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "star",
      size: 15,
      color: fav ? "#F2C94C" : "var(--fg-4)"
    })), /*#__PURE__*/React.createElement("button", {
      className: "iconbtn",
      onClick: e => {
        e.stopPropagation();
        setMenu({
          v,
          anchor: e.currentTarget.getBoundingClientRect()
        });
      }
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "more-horizontal",
      size: 15
    })));
  };
  const personal = scope("personal"),
    workspace = scope("workspace");
  return /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "views-tabs"
  }, ["Issues", "Projects"].map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    className: "seg" + (tab === t ? " active" : ""),
    onClick: () => setTab(t)
  }, t)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    style: {
      height: 28
    },
    onClick: () => onCreateView(tab.toLowerCase())
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 14,
    cls: "icon-sm"
  }), "New view"))), /*#__PURE__*/React.createElement("div", {
    className: "views-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vh-name"
  }, "Name"), /*#__PURE__*/React.createElement("span", {
    className: "vh-owner"
  }, "Owner")), /*#__PURE__*/React.createElement("div", {
    className: "views-group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vg-dot",
    style: {
      background: "var(--label-blue)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "vg-title"
  }, "Workspace views"), /*#__PURE__*/React.createElement("span", {
    className: "vg-sub"
  }, "\xB7 Shared with everyone")), workspace.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "views-empty"
  }, "No workspace ", tab.toLowerCase(), " views") : workspace.map(renderRow), /*#__PURE__*/React.createElement("div", {
    className: "views-group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vg-dot",
    style: {
      background: "var(--label-purple)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "vg-title"
  }, "Personal views"), /*#__PURE__*/React.createElement("span", {
    className: "vg-sub"
  }, "\xB7 Only visible to you")), personal.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "views-empty"
  }, "No personal ", tab.toLowerCase(), " views yet") : personal.map(renderRow), menu && /*#__PURE__*/React.createElement(ViewRowMenu, {
    v: menu.v,
    anchor: menu.anchor,
    onClose: () => setMenu(null),
    onRename: onRename,
    onDuplicate: onDuplicate,
    onCopyLink: onCopyLink,
    onDelete: onDeleteView
  }));
}

// ---- bottom floating selection toolbar ----
function FloatingToolbar({
  count,
  onClear,
  onAction
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "floating-toolbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ft-pill"
  }, count, " selected", /*#__PURE__*/React.createElement("span", {
    className: "ft-x",
    onClick: onClear
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 15,
    cls: "icon-sm"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ft-actions",
    onClick: () => setOpen(!open)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "command",
    size: 14,
    cls: "icon-sm"
  }), "Actions"), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44
    },
    onClick: () => setOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-menu",
    style: {
      position: "absolute",
      bottom: 44,
      right: 0,
      width: 220,
      zIndex: 45
    }
  }, onAction.items.map(a => /*#__PURE__*/React.createElement("div", {
    className: "v-menu-item",
    key: a.label,
    onClick: () => {
      a.run();
      setOpen(false);
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: a.icon,
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", null, a.label), a.sub && /*#__PURE__*/React.createElement("span", {
    className: "shortcut"
  }, a.sub)))))));
}

// ---- full search page (sidebar magnifier / "/" ) ----
function SearchView({
  issues,
  projects,
  onOpenIssue,
  onOpenProject
}) {
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState("All");
  const ql = q.toLowerCase();
  const mi = q ? issues.filter(i => (i.title + " " + i.id).toLowerCase().includes(ql)) : [];
  const mp = q ? projects.filter(p => p.name.toLowerCase().includes(ql)) : [];
  const showIssues = (tab === "All" || tab === "Issues") && mi.length > 0;
  const showProjects = (tab === "All" || tab === "Projects") && mp.length > 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-bar"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "search",
    size: 18,
    cls: "icon",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    placeholder: "Search issues, projects, and documents\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      padding: "8px 16px",
      borderBottom: "1px solid var(--border)"
    }
  }, ["All", "Issues", "Projects", "Documents"].map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    className: "seg" + (tab === t ? " active" : ""),
    onClick: () => setTab(t)
  }, t))), !q && /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "search",
    size: 40,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "v-h3",
    style: {
      color: "var(--fg-2)"
    }
  }, "Search"), /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "Find issues, projects, and documents")), q && !showIssues && !showProjects && tab !== "Documents" && /*#__PURE__*/React.createElement("div", {
    className: "search-empty"
  }, "No results for \u201C", q, "\u201D"), tab === "Documents" && q && /*#__PURE__*/React.createElement("div", {
    className: "search-empty"
  }, "No documents found"), showIssues && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "cmd-cap",
    style: {
      padding: "10px 16px 4px"
    }
  }, "Issues"), mi.map(i => /*#__PURE__*/React.createElement("div", {
    className: "view-row",
    key: i.id,
    onClick: () => onOpenIssue(i),
    style: {
      height: 44
    }
  }, /*#__PURE__*/React.createElement(StatusIcon, {
    status: i.status,
    size: 14
  }), /*#__PURE__*/React.createElement("div", {
    className: "vr-main"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vr-title",
    style: {
      fontSize: 13
    }
  }, i.title)), /*#__PURE__*/React.createElement("span", {
    className: "ibx-id",
    style: {
      marginLeft: "auto",
      font: "var(--fw-medium) 12px var(--font-mono)",
      color: "var(--fg-4)"
    }
  }, i.id)))), showProjects && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "cmd-cap",
    style: {
      padding: "10px 16px 4px"
    }
  }, "Projects"), mp.map(p => /*#__PURE__*/React.createElement("div", {
    className: "view-row",
    key: p.id,
    onClick: () => onOpenProject(p),
    style: {
      height: 44
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "box",
    size: 14,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "vr-main"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vr-title",
    style: {
      fontSize: 13
    }
  }, p.name))))));
}

// ---- Reviews (code review inbox) ----
const REVIEW_PRS = [{
  id: 1,
  num: 142,
  title: "feat: timeline drag interactions — Phase 2",
  repo: "vector/app",
  author: "김혁규",
  state: "ready",
  when: "5d",
  group: "Ready to merge",
  additions: 412,
  deletions: 86,
  files: 7,
  checks: "passing",
  branch: "feat/timeline-drag",
  desc: "Implements bar drag-to-move, edge resize handles with date tooltips, and dependency curves between project bars."
}, {
  id: 2,
  num: 138,
  title: "fix: filter submenu positioning",
  repo: "vector/app",
  author: "Alex Park",
  state: "ready",
  when: "1d",
  group: "Ready to merge",
  additions: 24,
  deletions: 12,
  files: 2,
  checks: "passing",
  branch: "fix/submenu-pos",
  desc: "Aligns cascading filter submenus to the hovered row; clamps to viewport only when overflowing."
}, {
  id: 3,
  num: 121,
  title: "chore: bump deps",
  repo: "vector/app",
  author: "Jordan Lee",
  state: "done",
  when: "2w",
  group: "Completed",
  additions: 8,
  deletions: 8,
  files: 1,
  checks: "passing",
  branch: "chore/deps",
  desc: "Routine dependency bump."
}];
function ReviewDetail({
  pr,
  onBack
}) {
  const [comment, setComment] = React.useState("");
  const [decision, setDecision] = React.useState(pr.state === "done" ? "merged" : null);
  return /*#__PURE__*/React.createElement("div", {
    className: "detail"
  }, /*#__PURE__*/React.createElement("div", {
    className: "detail-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "detail-crumb"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-left",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)",
    onClick: onBack,
    style: {
      cursor: "pointer"
    }
  }), /*#__PURE__*/React.createElement(Lic, {
    name: "git-pull-request",
    size: 14,
    cls: "icon-sm",
    color: "var(--label-green)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "c"
  }, pr.repo), /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-right",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "id"
  }, "#", pr.num)), /*#__PURE__*/React.createElement("h1", {
    className: "detail-title"
  }, pr.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      margin: "10px 0 6px",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-badge",
    style: {
      background: decision === "merged" ? "var(--accent)" : "var(--label-green)",
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: decision === "merged" ? "git-merge" : "git-pull-request",
    size: 13,
    cls: "icon-sm",
    color: "#fff"
  }), decision === "merged" ? "Merged" : "Open"), /*#__PURE__*/React.createElement("span", {
    className: "v-mono",
    style: {
      color: "var(--label-green)"
    }
  }, "+", pr.additions), /*#__PURE__*/React.createElement("span", {
    className: "v-mono",
    style: {
      color: "var(--label-red)"
    }
  }, "\u2212", pr.deletions), /*#__PURE__*/React.createElement("span", {
    className: "v-meta"
  }, pr.files, " files"), /*#__PURE__*/React.createElement("span", {
    className: "v-meta",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "git-branch",
    size: 13,
    cls: "icon-sm",
    color: "var(--fg-4)"
  }), pr.branch)), /*#__PURE__*/React.createElement("div", {
    className: "detail-desc"
  }, /*#__PURE__*/React.createElement("p", null, pr.desc)), /*#__PURE__*/React.createElement("div", {
    className: "detail-section-h"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "check-circle-2",
    size: 14,
    cls: "icon-sm"
  }), " Checks"), /*#__PURE__*/React.createElement("div", {
    className: "subissue"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 13,
    cls: "icon-sm",
    color: "var(--label-green)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, "build \xB7 passing")), /*#__PURE__*/React.createElement("div", {
    className: "subissue"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 13,
    cls: "icon-sm",
    color: "var(--label-green)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, "test \xB7 248 passed")), /*#__PURE__*/React.createElement("div", {
    className: "subissue"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "check",
    size: 13,
    cls: "icon-sm",
    color: "var(--label-green)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, "lint \xB7 no problems")), /*#__PURE__*/React.createElement("div", {
    className: "detail-section-h"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "activity",
    size: 14,
    cls: "icon-sm"
  }), " Review"), decision && decision !== "merged" && /*#__PURE__*/React.createElement("div", {
    className: "activity-item",
    style: {
      padding: "8px 0"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: "K",
    size: 22
  }), /*#__PURE__*/React.createElement("div", {
    className: "at"
  }, /*#__PURE__*/React.createElement("b", null, "\uAE40\uD601\uADDC"), " ", decision === "approve" ? "approved these changes" : "requested changes", /*#__PURE__*/React.createElement("span", {
    className: "aw"
  }, "just now"))), /*#__PURE__*/React.createElement("div", {
    className: "comment-box"
  }, /*#__PURE__*/React.createElement("textarea", {
    placeholder: "Leave a review comment\u2026",
    value: comment,
    onChange: e => setComment(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "comment-foot",
    style: {
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => {
      setDecision("changes");
      setComment("");
    }
  }, "Request changes"), /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    onClick: () => {
      setDecision("approve");
      setComment("");
    }
  }, "Approve")))), /*#__PURE__*/React.createElement("div", {
    className: "detail-side"
  }, /*#__PURE__*/React.createElement("div", {
    className: "side-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "prop-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-label"
  }, "Author"), /*#__PURE__*/React.createElement("span", {
    className: "pl-value"
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#4CB782",
    to: "#2D9CDB",
    text: pr.author[0],
    size: 18
  }), pr.author)), /*#__PURE__*/React.createElement("div", {
    className: "prop-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-label"
  }, "Reviewers"), /*#__PURE__*/React.createElement("span", {
    className: "pl-value"
  }, /*#__PURE__*/React.createElement(Avatar, {
    from: "#2D9CDB",
    to: "#4C8DFF",
    text: "K",
    size: 18
  }), "\uAE40\uD601\uADDC")), /*#__PURE__*/React.createElement("div", {
    className: "prop-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-label"
  }, "Status"), /*#__PURE__*/React.createElement("span", {
    className: "pl-value",
    style: {
      color: decision ? "var(--fg)" : "var(--fg-3)"
    }
  }, decision === "approve" ? "Approved" : decision === "changes" ? "Changes requested" : decision === "merged" ? "Merged" : "Review required"))), /*#__PURE__*/React.createElement("div", {
    className: "side-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "prop-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-label"
  }, "Repository"), /*#__PURE__*/React.createElement("span", {
    className: "pl-value"
  }, pr.repo)), /*#__PURE__*/React.createElement("div", {
    className: "prop-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-label"
  }, "Linked issue"), /*#__PURE__*/React.createElement("span", {
    className: "pl-value"
  }, /*#__PURE__*/React.createElement("span", {
    className: "id"
  }, "VEC-3")))), decision !== "merged" && /*#__PURE__*/React.createElement("button", {
    className: "v-btn v-btn--primary",
    style: {
      width: "100%",
      justifyContent: "center"
    },
    onClick: () => setDecision("merged")
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "git-merge",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-on-accent)"
  }), "Merge pull request")));
}
function ReviewsScreen() {
  const [tab, setTab] = React.useState("For me");
  const [sel, setSel] = React.useState(null);
  const groups = ["Ready to merge", "Completed"];
  const list = tab === "Created" ? [] : REVIEW_PRS;
  if (sel) return /*#__PURE__*/React.createElement(ReviewDetail, {
    pr: sel,
    onBack: () => setSel(null)
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rv-banner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rv-b-ic"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "git-pull-request",
    size: 18,
    cls: "icon-sm",
    color: "var(--fg-2)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "rv-b-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rv-b-title"
  }, "Get started with Vector code reviews"), /*#__PURE__*/React.createElement("div", {
    className: "rv-b-desc"
  }, "Connect GitHub with code access to review pull requests in Vector")), /*#__PURE__*/React.createElement("button", {
    className: "v-btn rv-connect"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "github",
    size: 15,
    cls: "icon-sm"
  }), "Connect GitHub")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      padding: "10px 16px"
    }
  }, ["For me", "Created"].map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    className: "seg" + (tab === t ? " active" : ""),
    onClick: () => setTab(t)
  }, t))), list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "git-pull-request",
    size: 40,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No reviews")) : groups.map(g => {
    const items = list.filter(p => p.group === g);
    if (!items.length) return null;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: g
    }, /*#__PURE__*/React.createElement("div", {
      className: "group-header"
    }, /*#__PURE__*/React.createElement(Lic, {
      name: g === "Completed" ? "check-circle-2" : "git-merge",
      size: 14,
      cls: "icon-sm",
      color: g === "Completed" ? "var(--accent)" : "var(--label-green)"
    }), /*#__PURE__*/React.createElement("span", {
      className: "gh-title"
    }, g), /*#__PURE__*/React.createElement("span", {
      className: "gh-count"
    }, items.length)), items.map(p => /*#__PURE__*/React.createElement("div", {
      className: "issue-row",
      key: p.id,
      onClick: () => setSel(p)
    }, /*#__PURE__*/React.createElement(Lic, {
      name: "git-pull-request",
      size: 15,
      cls: "icon-sm",
      color: p.state === "done" ? "var(--accent)" : "var(--label-green)"
    }), /*#__PURE__*/React.createElement("span", {
      className: "issue-id",
      style: {
        width: 42
      }
    }, "#", p.num), /*#__PURE__*/React.createElement("span", {
      className: "issue-title"
    }, p.title), /*#__PURE__*/React.createElement("span", {
      className: "issue-meta"
    }, /*#__PURE__*/React.createElement("span", {
      className: "v-mono",
      style: {
        color: "var(--label-green)"
      }
    }, "+", p.additions), /*#__PURE__*/React.createElement("span", {
      className: "v-mono",
      style: {
        color: "var(--label-red)"
      }
    }, "\u2212", p.deletions), /*#__PURE__*/React.createElement("span", {
      className: "v-meta"
    }, p.repo), /*#__PURE__*/React.createElement(Avatar, {
      from: "#4CB782",
      to: "#2D9CDB",
      text: p.author[0],
      size: 18
    }), /*#__PURE__*/React.createElement("span", {
      className: "issue-date"
    }, p.when)))));
  }));
}

// ---- Skeleton loading shells (Linear-style: brief shimmer on view load) ----
function Skeleton({
  w,
  h = 12,
  r = 4,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "vk-skel",
    style: {
      width: w,
      height: h,
      borderRadius: r,
      ...style
    }
  });
}
function ListSkeleton({
  rows = 8
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "group-header"
  }, /*#__PURE__*/React.createElement(Skeleton, {
    w: 14,
    h: 14,
    r: 7
  }), /*#__PURE__*/React.createElement(Skeleton, {
    w: 70
  }), /*#__PURE__*/React.createElement(Skeleton, {
    w: 18
  })), Array.from({
    length: rows
  }).map((_, i) => /*#__PURE__*/React.createElement("div", {
    className: "issue-row",
    key: i,
    style: {
      cursor: "default"
    }
  }, /*#__PURE__*/React.createElement(Skeleton, {
    w: 42
  }), /*#__PURE__*/React.createElement(Skeleton, {
    w: 16,
    h: 16,
    r: 8
  }), /*#__PURE__*/React.createElement(Skeleton, {
    w: 16,
    h: 16,
    r: 4
  }), /*#__PURE__*/React.createElement(Skeleton, {
    w: `${38 + i * 13 % 42}%`
  }), /*#__PURE__*/React.createElement("span", {
    className: "issue-meta"
  }, /*#__PURE__*/React.createElement(Skeleton, {
    w: 54,
    h: 20,
    r: 10
  }), /*#__PURE__*/React.createElement(Skeleton, {
    w: 20,
    h: 20,
    r: 6
  })))));
}
function BoardSkeleton() {
  return /*#__PURE__*/React.createElement("div", {
    className: "content",
    style: {
      overflowX: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "board"
  }, Array.from({
    length: 4
  }).map((_, c) => /*#__PURE__*/React.createElement("div", {
    className: "board-col",
    key: c,
    style: {
      width: 300
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "board-col-head"
  }, /*#__PURE__*/React.createElement(Skeleton, {
    w: 14,
    h: 14,
    r: 7
  }), /*#__PURE__*/React.createElement(Skeleton, {
    w: 70
  })), /*#__PURE__*/React.createElement("div", {
    className: "board-cards"
  }, Array.from({
    length: 3 - c % 2
  }).map((_, i) => /*#__PURE__*/React.createElement("div", {
    className: "board-card",
    key: i,
    style: {
      cursor: "default"
    }
  }, /*#__PURE__*/React.createElement(Skeleton, {
    w: 48
  }), /*#__PURE__*/React.createElement(Skeleton, {
    w: "86%",
    style: {
      marginTop: 8
    }
  }), /*#__PURE__*/React.createElement(Skeleton, {
    w: "40%",
    style: {
      marginTop: 8
    }
  }))))))));
}
Object.assign(window, {
  IssueRow,
  IssueList,
  ListGroup,
  buildGroups,
  BoardView,
  EmptyState,
  InboxEmpty,
  MyIssuesEmpty,
  ViewsScreen,
  FloatingToolbar,
  SearchView,
  ReviewsScreen,
  Skeleton,
  ListSkeleton,
  BoardSkeleton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Views.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Wiki.jsx
try { (() => {
// Wiki.jsx — structured knowledge pages (Wiki.js / Outline-style): TOC + infobox + sections
const WIKI_SEED = [{
  id: "wk1",
  team: "VEC",
  title: "Engineering handbook",
  icon: "book",
  updated: "May 28",
  summary: "How the team plans, builds, reviews, and ships. The single source of truth for engineering process.",
  infobox: {
    Owner: "김혁규",
    Status: "Maintained",
    Updated: "May 28, 2026",
    Audience: "All engineers"
  },
  sections: [{
    h: "Planning",
    t: "Work is organized into 2-week cycles. Each cycle has a scope set during planning and tracked on the cycle burndown. Issues are triaged before they enter a cycle."
  }, {
    h: "Branching",
    t: "Trunk-based development with short-lived feature branches. Branch names follow type/short-description. Open a draft PR early."
  }, {
    h: "Code review",
    t: "Every change needs one approval. Reviews happen in the Reviews inbox. Aim to respond within one business day."
  }, {
    h: "Releases",
    t: "We ship continuously. Every merged PR can deploy. User-facing changes get a Changelog entry."
  }],
  related: ["wk2"]
}, {
  id: "wk2",
  team: "VEC",
  title: "Design principles",
  icon: "palette",
  updated: "May 12",
  summary: "The values behind every Vector surface: calm, dense, fast, keyboard-first.",
  infobox: {
    Owner: "Design",
    Status: "Living",
    Updated: "May 12, 2026"
  },
  sections: [{
    h: "Calm",
    t: "Color is reserved for meaning. Motion is barely visible. Nothing competes for attention."
  }, {
    h: "Dense",
    t: "Information-rich without clutter. Small type, tight spacing, hairline borders."
  }, {
    h: "Keyboard-first",
    t: "Every action is reachable from the command palette and has a shortcut."
  }],
  related: ["wk1"]
}];
function Wiki({
  pages,
  onUpdate
}) {
  const [selId, setSelId] = React.useState(pages[0] ? pages[0].id : null);
  const page = pages.find(p => p.id === selId);
  const setPage = patch => onUpdate(pages.map(p => p.id === selId ? {
    ...p,
    ...patch
  } : p));
  const newPage = () => {
    const id = "wk" + Date.now();
    onUpdate([...pages, {
      id,
      team: page ? page.team : "VEC",
      title: "Untitled page",
      icon: "file-text",
      updated: "now",
      summary: "",
      infobox: {},
      sections: [{
        h: "Section",
        t: ""
      }],
      related: []
    }]);
    setSelId(id);
  };
  if (!page) return /*#__PURE__*/React.createElement("div", {
    className: "content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "book-open",
    size: 36,
    color: "var(--fg-4)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "etext"
  }, "No wiki pages")));
  return /*#__PURE__*/React.createElement("div", {
    className: "wiki"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wiki-tree"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wiki-tree-head"
  }, /*#__PURE__*/React.createElement("span", null, "Pages"), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: newPage
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 15
  }))), pages.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    className: "wiki-tree-item" + (selId === p.id ? " active" : ""),
    onClick: () => setSelId(p.id)
  }, /*#__PURE__*/React.createElement(Lic, {
    name: p.icon || "file-text",
    size: 15,
    cls: "icon-sm",
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "nm"
  }, p.title), /*#__PURE__*/React.createElement("button", {
    className: "tree-del",
    title: "Delete",
    onClick: e => {
      e.stopPropagation();
      const rest = pages.filter(x => x.id !== p.id);
      onUpdate(rest);
      if (selId === p.id) setSelId(rest[0] ? rest[0].id : null);
    }
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "trash-2",
    size: 13
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "wiki-main"
  }, /*#__PURE__*/React.createElement("article", {
    className: "wiki-article"
  }, /*#__PURE__*/React.createElement("input", {
    className: "wiki-title",
    value: page.title,
    onChange: e => setPage({
      title: e.target.value
    }),
    placeholder: "Page title"
  }), /*#__PURE__*/React.createElement("textarea", {
    className: "wiki-summary",
    value: page.summary,
    onChange: e => setPage({
      summary: e.target.value
    }),
    placeholder: "Summary\u2026",
    rows: 2
  }), page.sections.map((s, i) => /*#__PURE__*/React.createElement("section", {
    key: i,
    id: "wk-sec-" + i,
    className: "wiki-section"
  }, /*#__PURE__*/React.createElement("input", {
    className: "wiki-h2",
    value: s.h,
    onChange: e => {
      const ns = page.sections.slice();
      ns[i] = {
        ...s,
        h: e.target.value
      };
      setPage({
        sections: ns
      });
    },
    placeholder: "Section heading"
  }), /*#__PURE__*/React.createElement("textarea", {
    className: "wiki-body",
    value: s.t,
    onChange: e => {
      const ns = page.sections.slice();
      ns[i] = {
        ...s,
        t: e.target.value
      };
      setPage({
        sections: ns
      });
    },
    placeholder: "Write\u2026",
    rows: Math.max(2, Math.ceil((s.t.length || 1) / 80))
  }))), /*#__PURE__*/React.createElement("button", {
    className: "v-btn",
    onClick: () => setPage({
      sections: [...page.sections, {
        h: "New section",
        t: ""
      }]
    })
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "plus",
    size: 14,
    cls: "icon-sm"
  }), "Add section")), /*#__PURE__*/React.createElement("aside", {
    className: "wiki-aside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wiki-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wiki-card-head"
  }, "Infobox"), Object.entries(page.infobox).map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    className: "wiki-info-row",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "wiki-info-k"
  }, k), /*#__PURE__*/React.createElement("span", {
    className: "wiki-info-v"
  }, v)))), /*#__PURE__*/React.createElement("div", {
    className: "wiki-toc-head"
  }, "On this page"), page.sections.map((s, i) => /*#__PURE__*/React.createElement("a", {
    key: i,
    className: "wiki-toc-item",
    onClick: () => {
      const el = document.getElementById("wk-sec-" + i);
      const c = el && el.closest(".wiki-main");
      if (el && c) c.scrollTo({
        top: el.offsetTop - 16,
        behavior: "smooth"
      });
    }
  }, s.h)), page.related && page.related.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "wiki-toc-head",
    style: {
      marginTop: 18
    }
  }, "Related"), page.related.map(rid => {
    const r = pages.find(p => p.id === rid);
    return r ? /*#__PURE__*/React.createElement("div", {
      key: rid,
      className: "wiki-related",
      onClick: () => setSelId(rid)
    }, /*#__PURE__*/React.createElement(Lic, {
      name: r.icon || "file-text",
      size: 14,
      cls: "icon-sm",
      color: "var(--fg-3)"
    }), r.title) : null;
  })))));
}
Object.assign(window, {
  Wiki,
  WIKI_SEED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Wiki.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/adaptive.jsx
try { (() => {
// adaptive.jsx — responsive shell primitives (Vector)
// Research basis: Ionic split-pane (MIT — side pane min 270px / max 28%, flex row,
// side hidden when collapsed), Material 3 window size classes (compact/medium/expanded),
// vaul-style bottom sheet. Modules stay unchanged; only the wrapper adapts.

const BP = {
  sm: 640,
  md: 1024
};

// window size class: "compact" (<640) | "medium" (640-1023) | "expanded" (>=1024)
function useSizeClass() {
  const get = () => {
    if (typeof window !== "undefined" && window.__VECTOR_FORCE_SIZE__) return window.__VECTOR_FORCE_SIZE__;
    const w = window.innerWidth;
    return w < BP.sm ? "compact" : w < BP.md ? "medium" : "expanded";
  };
  const [cls, setCls] = React.useState(get);
  React.useEffect(() => {
    const on = () => setCls(get());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  React.useEffect(() => {
    document.documentElement.dataset.size = cls;
  }, [cls]);
  return cls;
}

// ---- NavRail: 72px icon rail for tablet (medium) ----
function NavRail({
  items,
  active,
  onSelect,
  onMore,
  brand
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "v-rail"
  }, brand, /*#__PURE__*/React.createElement("div", {
    className: "v-rail-items"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.key,
    className: "v-rail-item" + (active === it.key ? " active" : ""),
    onClick: () => onSelect(it.key),
    title: it.label
  }, it.icon, /*#__PURE__*/React.createElement("span", {
    className: "v-rail-label"
  }, it.label)))), onMore && /*#__PURE__*/React.createElement("button", {
    className: "v-rail-item v-rail-more",
    onClick: onMore,
    title: "More"
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "more-horizontal",
    size: 20,
    cls: "icon"
  }), /*#__PURE__*/React.createElement("span", {
    className: "v-rail-label"
  }, "More")));
}

// ---- SplitPane: Ionic-spec 2-pane (side 270px min / 28% max) ----
function SplitPane({
  side,
  children,
  open = true,
  sideWidth
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "v-split"
  }, open && /*#__PURE__*/React.createElement("div", {
    className: "v-split-side",
    style: sideWidth ? {
      width: sideWidth
    } : null
  }, side), /*#__PURE__*/React.createElement("div", {
    className: "v-split-main"
  }, children));
}

// ---- NavStack: full-screen push navigation for mobile ----
function NavStack({
  stack,
  onPop,
  children
}) {
  const depth = stack.length;
  return /*#__PURE__*/React.createElement("div", {
    className: "v-navstack"
  }, depth > 0 && /*#__PURE__*/React.createElement("div", {
    className: "v-navstack-bar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "v-navstack-back",
    onClick: onPop
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "chevron-left",
    size: 18,
    cls: "icon"
  }), stack[depth - 1].backLabel || "Back"), /*#__PURE__*/React.createElement("span", {
    className: "v-navstack-title"
  }, stack[depth - 1].title)), /*#__PURE__*/React.createElement("div", {
    className: "v-navstack-body"
  }, children));
}

// ---- BottomSheet: vaul-style drag-dismiss sheet ----
function BottomSheet({
  open,
  onClose,
  title,
  children,
  height = "70vh"
}) {
  const [dragY, setDragY] = React.useState(0);
  const start = React.useRef(null);
  React.useEffect(() => {
    if (open) setDragY(0);
  }, [open]);
  if (!open) return null;
  const onDown = e => {
    start.current = (e.touches ? e.touches[0] : e).clientY;
  };
  const onMove = e => {
    if (start.current == null) return;
    const y = (e.touches ? e.touches[0] : e).clientY;
    setDragY(Math.max(0, y - start.current));
  };
  const onUp = () => {
    if (dragY > 90) onClose();else setDragY(0);
    start.current = null;
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "v-sheet-scrim",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-sheet",
    style: {
      height,
      transform: `translateY(${dragY}px)`,
      transition: start.current == null ? "transform .18s ease" : "none"
    },
    onClick: e => e.stopPropagation(),
    onMouseDown: onDown,
    onMouseMove: onMove,
    onMouseUp: onUp,
    onMouseLeave: onUp,
    onTouchStart: onDown,
    onTouchMove: onMove,
    onTouchEnd: onUp
  }, /*#__PURE__*/React.createElement("div", {
    className: "v-sheet-grip"
  }), title && /*#__PURE__*/React.createElement("div", {
    className: "v-sheet-head"
  }, title, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Lic, {
    name: "x",
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    className: "v-sheet-body"
  }, children)));
}

// ---- TabBar: mobile bottom navigation ----
function TabBar({
  items,
  active,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "v-tabbar"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.key,
    className: "v-tab" + (active === it.key ? " active" : ""),
    onClick: () => onSelect(it.key)
  }, it.icon, /*#__PURE__*/React.createElement("span", null, it.label))));
}
Object.assign(window, {
  BP,
  useSizeClass,
  NavRail,
  SplitPane,
  NavStack,
  BottomSheet,
  TabBar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/adaptive.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/aggregate.jsx
try { (() => {
// aggregate.jsx — dashboard aggregation + chart recommend, ported from
// FlowBase lib/chart-aggregate.ts + dashboard-recommend.ts. Pure, zero deps.
// aggregateBy(rows, groupCol, aggFn, valueCol) -> [{label,value,count}]
(function () {
  function toNum(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const t = v.trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof v === "boolean") return v ? 1 : 0;
    return null;
  }
  function median(nums) {
    if (!nums.length) return 0;
    const s = [...nums].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function applyFn(fn, nums, count) {
    if (fn === "count") return count;
    if (!nums.length) return 0;
    if (fn === "sum") return nums.reduce((a, b) => a + b, 0);
    if (fn === "avg") return nums.reduce((a, b) => a + b, 0) / nums.length;
    if (fn === "min") return Math.min(...nums);
    if (fn === "max") return Math.max(...nums);
    if (fn === "median") return median(nums);
    return count;
  }
  // rows: array of objects keyed by field id; groupCol/valueCol = field id.
  function aggregateBy(rows, groupCol, aggFn, valueCol) {
    aggFn = aggFn || "count";
    if (!groupCol) {
      const nums = aggFn === "count" || !valueCol ? [] : rows.map(r => toNum(r[valueCol])).filter(n => n !== null);
      return [{
        label: "total",
        value: applyFn(aggFn, nums, rows.length),
        count: rows.length
      }];
    }
    const groups = new Map();
    for (const r of rows) {
      const raw = r[groupCol];
      if (raw == null || raw === "") continue;
      const keys = Array.isArray(raw) ? raw.map(x => x == null ? "" : String(x).trim()).filter(s => s) : [String(raw)];
      if (!keys.length) continue;
      const valNum = aggFn === "count" || !valueCol ? null : toNum(r[valueCol]);
      for (const k of keys) {
        let g = groups.get(k);
        if (!g) {
          g = {
            nums: [],
            count: 0
          };
          groups.set(k, g);
        }
        g.count += 1;
        if (valNum !== null) g.nums.push(valNum);
      }
    }
    return [...groups.entries()].map(([label, g]) => ({
      label,
      value: applyFn(aggFn, g.nums, g.count),
      count: g.count
    })).sort((a, b) => b.value - a.value);
  }
  const AGG_LABELS = {
    count: "Count",
    sum: "Sum",
    avg: "Average",
    min: "Min",
    max: "Max",
    median: "Median"
  };

  // chart recommend — pick a sensible chart given a group field's type & cardinality.
  function recommendChart(field, distinctCount) {
    if (!field) return "kpi";
    if (field.type === "checkbox") return "donut";
    if (field.type === "select" || field.type === "status") return distinctCount <= 6 ? "donut" : "bar";
    if (field.type === "date") return "line";
    if (field.type === "number") return "bar";
    return "bar";
  }
  if (typeof window !== "undefined") Object.assign(window, {
    aggregateBy,
    AGG_LABELS,
    recommendChart
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/aggregate.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/build/codemod.mjs
try { (() => {
// codemod.mjs — converts the in-browser prototype (window-global JSX loaded via
// <script type="text/babel" src>) into ES modules Vite can bundle.
//
// What it does, mechanically, per .jsx file in ui_kits/app/:
//   1. Prepends shared imports: React, ReactDOM (App only), and the icon shim.
//   2. Rewrites `Object.assign(window, { A, B })`  →  `export { A, B };`
//   3. Rewrites references to globals (Lic, StatusIcon, useStore, …) by adding
//      a top `import { ... } from "./<module>.js"` based on a known export map.
//
// It is intentionally conservative: review the diff before committing.
// Run locally:  node build/codemod.mjs
// (Node-only script. Imports are dynamic so design-system tooling that scans
//  the project for browser code can parse this file without resolving them.)

// where each shared symbol comes from (extend as needed)
const EXPORT_MAP = {
  "store.jsx": ["VECTOR_STORE", "useStore"],
  "icons.jsx": ["STATUS", "STATUS_CYCLE", "StatusIcon", "PriorityIcon", "Lic", "Avatar", "PanelIcon", "LABELS", "PRIORITIES", "priorityLabel", "statusLabel", "STATUS_TYPE", "ASSIGNEES", "TEAMS", "CYCLES", "TRIAGE_SEED", "SEED_ISSUES", "PROJECTS"]
  // …populated from each file's Object.assign(window, {...})
};
function symbolToModule() {
  const map = {};
  for (const [file, syms] of Object.entries(EXPORT_MAP)) for (const s of syms) map[s] = "./" + file.replace(/\.jsx$/, ".js");
  return map;
}
async function run() {
  const {
    readdir,
    readFile,
    writeFile,
    mkdir
  } = await import("node:fs/promises");
  const path = (await import("node:path")).default;
  const SRC = path.resolve("."); // ui_kits/app
  const OUT = path.resolve("src"); // ES-module output

  await mkdir(OUT, {
    recursive: true
  });
  const files = (await readdir(SRC)).filter(f => f.endsWith(".jsx"));
  const sym2mod = symbolToModule();
  for (const f of files) {
    let code = await readFile(path.join(SRC, f), "utf8");
    // 1. window exports -> ES exports
    code = code.replace(/(?:if \([^)]*\) )?Object\.assign\(window,\s*\{([^}]*)\}\);?/g, (_, names) => `export { ${names.trim()} };`);
    // 2. add React import if JSX present
    if (/<[A-Za-z]/.test(code) && !/^import React/m.test(code)) code = `import React from "react";\n` + code;
    // 3. naive import injection for referenced shared symbols
    const needed = {};
    for (const [sym, mod] of Object.entries(sym2mod)) {
      if (f.replace(/\.jsx$/, ".js") === mod.slice(2)) continue; // don't import self
      if (new RegExp("\\b" + sym + "\\b").test(code)) (needed[mod] = needed[mod] || []).push(sym);
    }
    const imports = Object.entries(needed).map(([m, s]) => `import { ${[...new Set(s)].join(", ")} } from "${m}";`).join("\n");
    code = (imports ? imports + "\n" : "") + code;
    await writeFile(path.join(OUT, f.replace(/\.jsx$/, ".jsx")), code);
  }
  console.log(`✓ codemod wrote ${files.length} ES modules → src/. Review the diff, wire main.jsx, then: npm run build`);
}
if (typeof process !== "undefined" && process.versions && process.versions.node) run();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/build/codemod.mjs", error: String((e && e.message) || e) }); }

// ui_kits/app/build/vite.config.js
try { (() => {
// Vector app — production build config.
// Run from ui_kits/app/ after the codemod (see BUILD.md):
//   npm install && npm run build
// Vite supports async-function configs; imports are dynamic so design-system
// tooling that scans the project for browser code can parse this file.
async function config() {
  const {
    defineConfig
  } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;
  return defineConfig({
    root: ".",
    plugins: [react()],
    build: {
      outDir: "dist",
      sourcemap: true,
      target: "es2020"
    },
    server: {
      port: 5173,
      open: true
    }
  });
}
Object.assign(__ds_scope, { config, __ds_default_ui_kits_app_build_vite_config_1fj0lz: config });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/build/vite.config.js", error: String((e && e.message) || e) }); }

// ui_kits/app/charts.jsx
try { (() => {
// charts.jsx — full chart set, ported from FlowBase components/charts/*.
// 13 types, all hand-drawn SVG in Vector tokens. Each takes simple data props.
// data: [{k,v}] for category charts; rows+fields for cross-tab (heatmap/scatter/pivot).
(function () {
  const PAL = ["#4C8DFF", "#4CB782", "#F2C94C", "#F2994A", "#BB6BD9", "#EB5757", "#2D9CDB", "#E879B9"];
  const A = props => React.createElement(React.Fragment, null, props.children);
  function Bar({
    data,
    horizontal
  }) {
    const W = 460,
      H = 200,
      P = 30,
      max = Math.max(...data.map(d => d.v), 1);
    if (horizontal) {
      const bh = (H - 2 * P) / Math.max(1, data.length);
      return /*#__PURE__*/React.createElement("svg", {
        viewBox: `0 0 ${W} ${H}`,
        style: {
          width: "100%",
          height: "auto"
        }
      }, data.map((d, i) => {
        const y = P + bh * i;
        const w = (W - 2 * P - 80) * d.v / max;
        return /*#__PURE__*/React.createElement("g", {
          key: i
        }, /*#__PURE__*/React.createElement("text", {
          x: P,
          y: y + bh / 2 + 3,
          className: "ins-axis",
          style: {
            fill: "var(--fg-2)"
          }
        }, d.k), /*#__PURE__*/React.createElement("rect", {
          x: P + 78,
          y: y + bh * 0.2,
          width: Math.max(1, w),
          height: bh * 0.6,
          rx: "3",
          fill: PAL[0]
        }), /*#__PURE__*/React.createElement("text", {
          x: P + 82 + w,
          y: y + bh / 2 + 3,
          className: "ins-axis",
          style: {
            fill: "var(--fg-3)"
          }
        }, d.v));
      }));
    }
    const bw = (W - 2 * P) / Math.max(1, data.length),
      y = v => P + (H - 2 * P) * (1 - v / max);
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${W} ${H}`,
      style: {
        width: "100%",
        height: "auto"
      }
    }, [0, .5, 1].map((f, i) => /*#__PURE__*/React.createElement("line", {
      key: i,
      x1: P,
      x2: W - P,
      y1: P + (H - 2 * P) * f,
      y2: P + (H - 2 * P) * f,
      stroke: "var(--border)"
    })), data.map((d, i) => {
      const cx = P + bw * (i + .5);
      return /*#__PURE__*/React.createElement("g", {
        key: i
      }, /*#__PURE__*/React.createElement("rect", {
        x: cx - bw * .3,
        y: y(d.v),
        width: bw * .6,
        height: H - P - y(d.v),
        rx: "3",
        fill: PAL[i % PAL.length]
      }), /*#__PURE__*/React.createElement("text", {
        x: cx,
        y: H - 8,
        textAnchor: "middle",
        className: "ins-axis"
      }, d.k), /*#__PURE__*/React.createElement("text", {
        x: cx,
        y: y(d.v) - 5,
        textAnchor: "middle",
        className: "ins-axis",
        style: {
          fill: "var(--fg-3)"
        }
      }, d.v));
    }));
  }
  function Line({
    data,
    area
  }) {
    const W = 460,
      H = 200,
      P = 30,
      max = Math.max(...data.map(d => d.v), 1);
    const x = i => P + (W - 2 * P) * i / Math.max(1, data.length - 1),
      y = v => P + (H - 2 * P) * (1 - v / max);
    const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.v).toFixed(1)}`).join(" ");
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${W} ${H}`,
      style: {
        width: "100%",
        height: "auto"
      }
    }, [0, .5, 1].map((f, i) => /*#__PURE__*/React.createElement("line", {
      key: i,
      x1: P,
      x2: W - P,
      y1: P + (H - 2 * P) * f,
      y2: P + (H - 2 * P) * f,
      stroke: "var(--border)"
    })), area && data.length > 1 && /*#__PURE__*/React.createElement("path", {
      d: `${path} L${x(data.length - 1)} ${H - P} L${x(0)} ${H - P} Z`,
      fill: "var(--accent-soft)"
    }), /*#__PURE__*/React.createElement("path", {
      d: path,
      fill: "none",
      stroke: PAL[0],
      strokeWidth: "2",
      strokeLinejoin: "round"
    }), data.map((d, i) => /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("circle", {
      cx: x(i),
      cy: y(d.v),
      r: "2.5",
      fill: PAL[0]
    }), /*#__PURE__*/React.createElement("text", {
      x: x(i),
      y: H - 8,
      textAnchor: "middle",
      className: "ins-axis"
    }, d.k))));
  }
  function Pie({
    data,
    donut
  }) {
    const cx = 95,
      cy = 100,
      r = 78;
    let acc = 0;
    const total = data.reduce((s, d) => s + d.v, 0) || 1;
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 320 200",
      style: {
        width: "100%",
        height: "auto"
      }
    }, data.map((d, i) => {
      const a0 = acc / total * Math.PI * 2 - Math.PI / 2;
      acc += d.v;
      const a1 = acc / total * Math.PI * 2 - Math.PI / 2;
      const lg = a1 - a0 > Math.PI ? 1 : 0;
      const x0 = cx + r * Math.cos(a0),
        y0 = cy + r * Math.sin(a0),
        x1 = cx + r * Math.cos(a1),
        y1 = cy + r * Math.sin(a1);
      return /*#__PURE__*/React.createElement("path", {
        key: i,
        d: `M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${lg} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`,
        fill: PAL[i % PAL.length]
      });
    }), donut && /*#__PURE__*/React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: "44",
      fill: "var(--bg-app)"
    }), data.map((d, i) => /*#__PURE__*/React.createElement("g", {
      key: i,
      transform: `translate(200 ${44 + i * 22})`
    }, /*#__PURE__*/React.createElement("rect", {
      width: "11",
      height: "11",
      rx: "3",
      fill: PAL[i % PAL.length]
    }), /*#__PURE__*/React.createElement("text", {
      x: "18",
      y: "10",
      className: "ins-axis",
      style: {
        fill: "var(--fg-2)",
        fontSize: 12
      }
    }, d.k, " \xB7 ", d.v))));
  }
  function Area({
    data
  }) {
    return /*#__PURE__*/React.createElement(Line, {
      data: data,
      area: true
    });
  }
  function StackedBar({
    series,
    cats
  }) {
    // series: [{name,color,vals:[]}], cats: [labels]
    const W = 460,
      H = 200,
      P = 30;
    const totals = cats.map((_, i) => series.reduce((s, sr) => s + (sr.vals[i] || 0), 0));
    const max = Math.max(...totals, 1),
      bw = (W - 2 * P) / Math.max(1, cats.length);
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${W} ${H}`,
      style: {
        width: "100%",
        height: "auto"
      }
    }, cats.map((c, i) => {
      const cx = P + bw * (i + .5);
      let yAcc = H - P;
      return /*#__PURE__*/React.createElement("g", {
        key: i
      }, series.map((sr, j) => {
        const h = (sr.vals[i] || 0) / max * (H - 2 * P);
        yAcc -= h;
        return /*#__PURE__*/React.createElement("rect", {
          key: j,
          x: cx - bw * .3,
          y: yAcc,
          width: bw * .6,
          height: Math.max(0, h),
          fill: sr.color || PAL[j % PAL.length]
        });
      }), /*#__PURE__*/React.createElement("text", {
        x: cx,
        y: H - 8,
        textAnchor: "middle",
        className: "ins-axis"
      }, c));
    }));
  }
  function CategoryBar({
    data
  }) {
    return /*#__PURE__*/React.createElement(Bar, {
      data: data,
      horizontal: true
    });
  }
  function Histogram({
    values,
    bins
  }) {
    bins = bins || 8;
    const nums = values.map(Number).filter(n => Number.isFinite(n));
    if (!nums.length) return /*#__PURE__*/React.createElement(Empty, null);
    const min = Math.min(...nums),
      max = Math.max(...nums),
      span = max - min || 1,
      step = span / bins;
    const buckets = Array.from({
      length: bins
    }, (_, i) => ({
      k: (min + step * i).toFixed(0),
      v: 0
    }));
    nums.forEach(n => {
      let b = Math.floor((n - min) / step);
      if (b >= bins) b = bins - 1;
      buckets[b].v++;
    });
    return /*#__PURE__*/React.createElement(Bar, {
      data: buckets
    });
  }
  function Scatter({
    points
  }) {
    const W = 460,
      H = 200,
      P = 30;
    const xs = points.map(p => p.x),
      ys = points.map(p => p.y);
    const xmin = Math.min(...xs, 0),
      xmax = Math.max(...xs, 1),
      ymin = Math.min(...ys, 0),
      ymax = Math.max(...ys, 1);
    const sx = v => P + (W - 2 * P) * (v - xmin) / (xmax - xmin || 1),
      sy = v => P + (H - 2 * P) * (1 - (v - ymin) / (ymax - ymin || 1));
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${W} ${H}`,
      style: {
        width: "100%",
        height: "auto"
      }
    }, [0, .5, 1].map((f, i) => /*#__PURE__*/React.createElement("line", {
      key: i,
      x1: P,
      x2: W - P,
      y1: P + (H - 2 * P) * f,
      y2: P + (H - 2 * P) * f,
      stroke: "var(--border)"
    })), points.map((p, i) => /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: sx(p.x),
      cy: sy(p.y),
      r: "4",
      fill: PAL[0],
      fillOpacity: "0.6"
    })));
  }
  function Funnel({
    stages
  }) {
    const data = stages.filter(s => s.v > 0);
    if (!data.length) return /*#__PURE__*/React.createElement(Empty, null);
    const max = Math.max(...data.map(s => s.v), 1),
      W = 320,
      sh = 34,
      gap = 5,
      padX = 8,
      innerW = W - padX * 2;
    const totalH = data.length * sh + (data.length - 1) * gap;
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${W} ${totalH}`,
      style: {
        width: "100%",
        maxWidth: 360,
        height: "auto",
        display: "block",
        margin: "0 auto"
      }
    }, data.map((s, i) => {
      const y = i * (sh + gap);
      const tw = (i === 0 ? 1 : data[i - 1].v / max) * innerW,
        bw2 = s.v / max * innerW;
      const tx = padX + (innerW - tw) / 2,
        bx = padX + (innerW - bw2) / 2;
      const pts = [[tx, y], [tx + tw, y], [bx + bw2, y + sh], [bx, y + sh]].map(p => p.join(",")).join(" ");
      const c = PAL[i % PAL.length];
      return /*#__PURE__*/React.createElement("g", {
        key: i
      }, /*#__PURE__*/React.createElement("polygon", {
        points: pts,
        fill: c,
        fillOpacity: "0.7",
        stroke: c
      }), /*#__PURE__*/React.createElement("text", {
        x: W / 2,
        y: y + sh / 2 + 4,
        textAnchor: "middle",
        fontSize: "11",
        fontWeight: "600",
        fill: "var(--fg)"
      }, s.k, " \xB7 ", s.v));
    }));
  }
  function Heatmap({
    rows,
    catField,
    groupField
  }) {
    const cells = {},
      catT = {},
      grpT = {};
    rows.forEach(r => {
      const c = String(r[catField] ?? ""),
        g = String(r[groupField] ?? "");
      if (!c || !g) return;
      const k = c + "|" + g;
      cells[k] = (cells[k] || 0) + 1;
      catT[c] = (catT[c] || 0) + 1;
      grpT[g] = (grpT[g] || 0) + 1;
    });
    const cats = Object.keys(catT).sort((a, b) => catT[b] - catT[a]),
      grps = Object.keys(grpT).sort((a, b) => grpT[b] - grpT[a]);
    const max = Math.max(1, ...Object.values(cells));
    if (!cats.length || !grps.length) return /*#__PURE__*/React.createElement(Empty, null);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        overflowX: "auto"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 2,
        gridTemplateColumns: `minmax(70px,1fr) repeat(${grps.length}, minmax(28px,1fr))`,
        fontSize: 11
      }
    }, /*#__PURE__*/React.createElement("div", null), grps.map(g => /*#__PURE__*/React.createElement("div", {
      key: g,
      style: {
        textAlign: "center",
        color: "var(--fg-3)",
        padding: "2px 4px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      },
      title: g
    }, g)), cats.map(c => /*#__PURE__*/React.createElement(React.Fragment, {
      key: c
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: "var(--fg-2)",
        padding: "4px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      },
      title: c
    }, c), grps.map(g => {
      const v = cells[c + "|" + g] || 0;
      const op = v ? Math.max(0.18, Math.min(1, v / max)) : 0;
      return /*#__PURE__*/React.createElement("div", {
        key: g,
        title: `${c} × ${g}: ${v}`,
        style: {
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
          fontFamily: "var(--font-mono)",
          background: v ? "var(--accent)" : "var(--bg-elevated-2)",
          opacity: v ? op : 0.5,
          color: v > 0 ? "var(--fg-on-accent)" : "var(--fg-4)"
        }
      }, v || "");
    })))));
  }
  function Pivot({
    rows,
    rowField,
    colField
  }) {
    const grid = {},
      rowsK = {},
      colsK = {};
    rows.forEach(r => {
      const rk = String(r[rowField] ?? "—"),
        ck = String(r[colField] ?? "—");
      const k = rk + "|" + ck;
      grid[k] = (grid[k] || 0) + 1;
      rowsK[rk] = 1;
      colsK[ck] = 1;
    });
    const rk = Object.keys(rowsK),
      ck = Object.keys(colsK);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        overflowX: "auto"
      }
    }, /*#__PURE__*/React.createElement("table", {
      className: "db-table",
      style: {
        fontSize: 12
      }
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, /*#__PURE__*/React.createElement("span", {
      className: "db-th"
    }, " ")), ck.map(c => /*#__PURE__*/React.createElement("th", {
      key: c
    }, /*#__PURE__*/React.createElement("span", {
      className: "db-th"
    }, c))), /*#__PURE__*/React.createElement("th", null, /*#__PURE__*/React.createElement("span", {
      className: "db-th"
    }, "\u03A3")))), /*#__PURE__*/React.createElement("tbody", null, rk.map(r => {
      let rowTotal = 0;
      const cellsR = ck.map(c => {
        const v = grid[r + "|" + c] || 0;
        rowTotal += v;
        return v;
      });
      return /*#__PURE__*/React.createElement("tr", {
        key: r
      }, /*#__PURE__*/React.createElement("td", {
        className: "db-td",
        style: {
          fontWeight: 600
        }
      }, r), cellsR.map((v, i) => /*#__PURE__*/React.createElement("td", {
        key: i,
        className: "db-td",
        style: {
          textAlign: "center",
          color: v ? "var(--fg)" : "var(--fg-4)"
        }
      }, v || "")), /*#__PURE__*/React.createElement("td", {
        className: "db-td",
        style: {
          textAlign: "center",
          fontWeight: 600
        }
      }, rowTotal));
    }))));
  }
  function Bullet({
    label,
    value,
    target,
    max
  }) {
    const W = 460,
      H = 46,
      m = max || Math.max(value, target) * 1.2;
    const sx = v => 90 + (W - 110) * v / m;
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${W} ${H}`,
      style: {
        width: "100%",
        height: "auto"
      }
    }, /*#__PURE__*/React.createElement("text", {
      x: "0",
      y: H / 2 + 4,
      className: "ins-axis",
      style: {
        fill: "var(--fg-2)"
      }
    }, label), /*#__PURE__*/React.createElement("rect", {
      x: "90",
      y: H / 2 - 7,
      width: W - 110,
      height: "14",
      rx: "3",
      fill: "var(--bg-elevated-2)"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "90",
      y: H / 2 - 5,
      width: sx(value) - 90,
      height: "10",
      rx: "2",
      fill: PAL[0]
    }), /*#__PURE__*/React.createElement("line", {
      x1: sx(target),
      y1: H / 2 - 10,
      x2: sx(target),
      y2: H / 2 + 10,
      stroke: "var(--fg)",
      strokeWidth: "2"
    }));
  }
  function Kpi({
    label,
    value,
    sub
  }) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "ins-kpi",
      style: {
        font: "var(--fw-semi) 30px var(--font-sans)",
        color: "var(--fg)"
      }
    }, value), /*#__PURE__*/React.createElement("div", {
      className: "ins-stat-lab"
    }, label), sub && /*#__PURE__*/React.createElement("div", {
      className: "ins-stat-sub"
    }, sub));
  }
  function Empty() {
    return /*#__PURE__*/React.createElement("div", {
      className: "empty",
      style: {
        height: 140
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "etext"
    }, "No data"));
  }
  const CHART_TYPES = [{
    id: "bar",
    label: "Bar",
    icon: "bar-chart-3"
  }, {
    id: "hbar",
    label: "Horizontal bar",
    icon: "bar-chart-horizontal"
  }, {
    id: "line",
    label: "Line",
    icon: "line-chart"
  }, {
    id: "area",
    label: "Area",
    icon: "area-chart"
  }, {
    id: "pie",
    label: "Pie",
    icon: "pie-chart"
  }, {
    id: "donut",
    label: "Donut",
    icon: "circle-dot"
  }, {
    id: "stacked",
    label: "Stacked bar",
    icon: "chart-no-axes-column"
  }, {
    id: "histogram",
    label: "Histogram",
    icon: "bar-chart-4"
  }, {
    id: "scatter",
    label: "Scatter",
    icon: "scatter-chart"
  }, {
    id: "funnel",
    label: "Funnel",
    icon: "filter"
  }, {
    id: "heatmap",
    label: "Heatmap",
    icon: "grid-3x3"
  }, {
    id: "pivot",
    label: "Pivot table",
    icon: "table-2"
  }, {
    id: "bullet",
    label: "Bullet",
    icon: "target"
  }];
  if (typeof window !== "undefined") Object.assign(window, {
    VChart: {
      Bar,
      Line,
      Pie,
      Area,
      StackedBar,
      CategoryBar,
      Histogram,
      Scatter,
      Funnel,
      Heatmap,
      Pivot,
      Bullet,
      Kpi
    },
    CHART_TYPES
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/charts.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/dnd.jsx
try { (() => {
// dnd.jsx — pointer-based drag and drop (mouse, touch, pen).
//
// Replaces HTML5 drag-and-drop, which fires no events on touch surfaces. Every
// draggable thing in the kit gets a small grip: the grip carries touch-action:none
// so dragging it never fights the column's own scrolling, while tapping the card
// body still opens it. Drop targets opt in with data-drop="<key>".
//
// useCardDrag({ onDrop }) -> { dragId, overKey, grip(id) }

function useCardDrag({
  onDrop
}) {
  const [dragId, setDragId] = React.useState(null);
  const [overKey, setOverKey] = React.useState(null);
  const ref = React.useRef(null);
  const zoneAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const z = el && el.closest ? el.closest("[data-drop]") : null;
    return z ? z.getAttribute("data-drop") : null;
  };
  const begin = (id, e) => {
    if (e.button != null && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const s = {
      id,
      x0: e.clientX,
      y0: e.clientY,
      moved: false
    };
    ref.current = s;
    setDragId(id);
    const onMove = ev => {
      const cur = ref.current;
      if (!cur) return;
      if (!cur.moved && Math.abs(ev.clientX - cur.x0) + Math.abs(ev.clientY - cur.y0) > 3) cur.moved = true;
      if (cur.moved) {
        ev.preventDefault();
        setOverKey(zoneAt(ev.clientX, ev.clientY));
      }
    };
    const onUp = ev => {
      const cur = ref.current;
      if (cur && cur.moved) {
        const k = zoneAt(ev.clientX, ev.clientY);
        if (k) onDrop(cur.id, k);
      }
      cleanup();
    };
    const cleanup = () => {
      ref.current = null;
      setDragId(null);
      setOverKey(null);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", cleanup);
    };
    document.addEventListener("pointermove", onMove, {
      passive: false
    });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", cleanup);
    if (e.pointerType === "touch" && navigator.vibrate) navigator.vibrate(8);
  };
  const grip = id => ({
    className: "drag-grip",
    title: "Drag to move",
    onPointerDown: e => begin(id, e),
    onClick: e => e.stopPropagation()
  });
  return {
    dragId,
    overKey,
    grip
  };
}
function DragGrip(props) {
  return /*#__PURE__*/React.createElement("span", props, /*#__PURE__*/React.createElement(Lic, {
    name: "grip-vertical",
    size: 13,
    cls: "icon-sm"
  }));
}
Object.assign(window, {
  useCardDrag,
  DragGrip
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/dnd.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/formula.jsx
try { (() => {
// formula.jsx — formula-column engine, ported from FlowBase (lib/formula/*)
// Pure functions, zero deps. tokenize → parse → evaluate(row).
// Reference a column with prop("Field name"). Functions: concat, lower, upper,
// length, round, if, today, format, prop, joinProp, contains, replace, trim,
// abs, mod, floor, ceil, dateAdd, weekOfYear, startsWith, endsWith, add/sub/mul/div.

(function () {
  // ---- tokenizer ----
  const MULTI_OPS = ["==", "!=", "<=", ">=", "&&", "||"];
  const SINGLE_OPS = ["+", "-", "*", "/", "<", ">", "!"];
  const isDigit = c => c >= "0" && c <= "9";
  const isIdStart = c => c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "_";
  const isIdBody = c => isIdStart(c) || isDigit(c);
  function tokenize(src) {
    const out = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
      const ch = src[i];
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        i++;
        continue;
      }
      if (ch === '"') {
        const start = i;
        i++;
        let v = "";
        while (i < n && src[i] !== '"') {
          if (src[i] === "\\" && i + 1 < n) {
            const x = src[i + 1];
            v += x === "n" ? "\n" : x === "t" ? "\t" : x;
            i += 2;
          } else {
            v += src[i];
            i++;
          }
        }
        if (i >= n) throw new FormulaError("Unterminated string");
        i++;
        out.push({
          k: "STR",
          v
        });
        continue;
      }
      if (isDigit(ch)) {
        const s = i;
        while (i < n && isDigit(src[i])) i++;
        if (src[i] === "." && isDigit(src[i + 1] || "")) {
          i++;
          while (i < n && isDigit(src[i])) i++;
        }
        out.push({
          k: "NUM",
          v: src.slice(s, i)
        });
        continue;
      }
      if (isIdStart(ch)) {
        const s = i;
        while (i < n && isIdBody(src[i])) i++;
        out.push({
          k: "IDENT",
          v: src.slice(s, i)
        });
        continue;
      }
      if (ch === "(") {
        out.push({
          k: "LP"
        });
        i++;
        continue;
      }
      if (ch === ")") {
        out.push({
          k: "RP"
        });
        i++;
        continue;
      }
      if (ch === ",") {
        out.push({
          k: "COMMA"
        });
        i++;
        continue;
      }
      const two = src.slice(i, i + 2);
      if (MULTI_OPS.includes(two)) {
        out.push({
          k: "OP",
          v: two
        });
        i += 2;
        continue;
      }
      if (SINGLE_OPS.includes(ch)) {
        out.push({
          k: "OP",
          v: ch
        });
        i++;
        continue;
      }
      throw new FormulaError(`Unexpected "${ch}"`);
    }
    out.push({
      k: "EOF"
    });
    return out;
  }

  // ---- parser (recursive descent) ----
  function parse(tokens) {
    let i = 0;
    const peek = (o = 0) => tokens[i + o];
    const adv = () => tokens[i++];
    const matchOp = (...ops) => {
      const t = peek();
      return t.k === "OP" && ops.includes(t.v);
    };
    const expect = k => {
      const t = peek();
      if (t.k !== k) throw new FormulaError(`Expected ${k}, got ${t.k}`);
      return adv();
    };
    function expr() {
      return or();
    }
    function or() {
      let l = and();
      while (matchOp("||")) {
        adv();
        l = {
          t: "Bin",
          op: "||",
          l,
          r: and()
        };
      }
      return l;
    }
    function and() {
      let l = eq();
      while (matchOp("&&")) {
        adv();
        l = {
          t: "Bin",
          op: "&&",
          l,
          r: eq()
        };
      }
      return l;
    }
    function eq() {
      let l = cmp();
      while (matchOp("==", "!=")) {
        const op = adv().v;
        l = {
          t: "Bin",
          op,
          l,
          r: cmp()
        };
      }
      return l;
    }
    function cmp() {
      let l = add();
      while (matchOp("<", ">", "<=", ">=")) {
        const op = adv().v;
        l = {
          t: "Bin",
          op,
          l,
          r: add()
        };
      }
      return l;
    }
    function add() {
      let l = mul();
      while (matchOp("+", "-")) {
        const op = adv().v;
        l = {
          t: "Bin",
          op,
          l,
          r: mul()
        };
      }
      return l;
    }
    function mul() {
      let l = un();
      while (matchOp("*", "/")) {
        const op = adv().v;
        l = {
          t: "Bin",
          op,
          l,
          r: un()
        };
      }
      return l;
    }
    function un() {
      if (matchOp("!", "-")) {
        const op = adv().v;
        return {
          t: "Un",
          op,
          x: un()
        };
      }
      return prim();
    }
    function prim() {
      const t = peek();
      if (t.k === "NUM") {
        adv();
        return {
          t: "Lit",
          v: Number(t.v)
        };
      }
      if (t.k === "STR") {
        adv();
        return {
          t: "Lit",
          v: t.v
        };
      }
      if (t.k === "LP") {
        adv();
        const e = expr();
        expect("RP");
        return e;
      }
      if (t.k === "IDENT") {
        adv();
        const name = t.v;
        if (peek().k === "LP") {
          adv();
          const args = [];
          if (peek().k !== "RP") {
            args.push(expr());
            while (peek().k === "COMMA") {
              adv();
              args.push(expr());
            }
          }
          expect("RP");
          return {
            t: "Call",
            name,
            args
          };
        }
        if (name === "true") return {
          t: "Lit",
          v: true
        };
        if (name === "false") return {
          t: "Lit",
          v: false
        };
        if (name === "null") return {
          t: "Lit",
          v: null
        };
        return {
          t: "Id",
          name
        };
      }
      throw new FormulaError("Unexpected token");
    }
    if (peek().k === "EOF") throw new FormulaError("Empty expression");
    const e = expr();
    if (peek().k !== "EOF") throw new FormulaError("Unexpected trailing token");
    return e;
  }

  // ---- coercion + functions ----
  function FormulaError(m) {
    this.message = m;
    this.name = "FormulaError";
  }
  FormulaError.prototype = Object.create(Error.prototype);
  const toStr = v => v === null || v === undefined ? "" : typeof v === "boolean" ? v ? "true" : "false" : typeof v === "number" ? Number.isNaN(v) ? "" : String(v) : String(v);
  const toNum = (v, c) => {
    if (typeof v === "number") {
      if (Number.isNaN(v)) throw new FormulaError(c + ": NaN");
      return v;
    }
    if (typeof v === "string") {
      if (v.trim() === "") throw new FormulaError(c + ": empty");
      const n = Number(v);
      if (Number.isNaN(n)) throw new FormulaError(`${c}: "${v}" not a number`);
      return n;
    }
    if (typeof v === "boolean") return v ? 1 : 0;
    throw new FormulaError(c + ": not a number");
  };
  const toBool = v => v === null ? false : typeof v === "boolean" ? v : typeof v === "string" ? v.length > 0 : typeof v === "number" ? v !== 0 && !Number.isNaN(v) : Boolean(v);
  const rowVal = v => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
    if (Array.isArray(v)) return v.filter(x => x != null && String(x).trim() !== "").map(String).join(", ");
    return String(v);
  };
  const FN = {
    concat: {
      min: 1,
      max: Infinity,
      fn: a => a.map(toStr).join("")
    },
    lower: {
      min: 1,
      max: 1,
      fn: a => toStr(a[0]).toLowerCase()
    },
    upper: {
      min: 1,
      max: 1,
      fn: a => toStr(a[0]).toUpperCase()
    },
    length: {
      min: 1,
      max: 1,
      fn: a => toStr(a[0]).length
    },
    add: {
      min: 2,
      max: 2,
      fn: a => toNum(a[0], "add") + toNum(a[1], "add")
    },
    sub: {
      min: 2,
      max: 2,
      fn: a => toNum(a[0], "sub") - toNum(a[1], "sub")
    },
    mul: {
      min: 2,
      max: 2,
      fn: a => toNum(a[0], "mul") * toNum(a[1], "mul")
    },
    div: {
      min: 2,
      max: 2,
      fn: a => {
        const d = toNum(a[1], "div");
        if (d === 0) throw new FormulaError("#DIV/0");
        return toNum(a[0], "div") / d;
      }
    },
    round: {
      min: 1,
      max: 2,
      fn: a => {
        const n = toNum(a[0], "round");
        const d = a[1] !== undefined ? toNum(a[1], "round") : 0;
        const f = Math.pow(10, d);
        return Math.round(n * f) / f;
      }
    },
    if: {
      min: 3,
      max: 3,
      fn: a => toBool(a[0]) ? a[1] : a[2]
    },
    today: {
      min: 0,
      max: 0,
      fn: (_a, ctx) => ctx.today
    },
    format: {
      min: 2,
      max: 2,
      fn: a => {
        const v = a[0],
          d = toNum(a[1], "format");
        if (typeof v === "number") return v.toFixed(d);
        if (typeof v === "string") {
          const n = Number(v);
          if (!Number.isNaN(n)) return n.toFixed(d);
        }
        return toStr(v);
      }
    },
    prop: {
      min: 1,
      max: 1,
      fn: (a, ctx) => rowVal(ctx.row[toStr(a[0])])
    },
    joinProp: {
      min: 2,
      max: 2,
      fn: (a, ctx) => {
        const raw = ctx.row[toStr(a[0])],
          sep = toStr(a[1]);
        if (Array.isArray(raw)) return raw.filter(x => x != null && String(x).trim() !== "").map(String).join(sep);
        return raw == null ? "" : String(raw);
      }
    },
    contains: {
      min: 2,
      max: 2,
      fn: a => toStr(a[0]).includes(toStr(a[1]))
    },
    replace: {
      min: 3,
      max: 3,
      fn: a => {
        const s = toStr(a[0]),
          f = toStr(a[1]);
        return f === "" ? s : s.split(f).join(toStr(a[2]));
      }
    },
    startsWith: {
      min: 2,
      max: 2,
      fn: a => toStr(a[0]).startsWith(toStr(a[1]))
    },
    endsWith: {
      min: 2,
      max: 2,
      fn: a => toStr(a[0]).endsWith(toStr(a[1]))
    },
    trim: {
      min: 1,
      max: 1,
      fn: a => toStr(a[0]).trim()
    },
    abs: {
      min: 1,
      max: 1,
      fn: a => Math.abs(toNum(a[0], "abs"))
    },
    mod: {
      min: 2,
      max: 2,
      fn: a => {
        const d = toNum(a[1], "mod");
        if (d === 0) throw new FormulaError("#MOD/0");
        return toNum(a[0], "mod") % d;
      }
    },
    floor: {
      min: 1,
      max: 1,
      fn: a => Math.floor(toNum(a[0], "floor"))
    },
    ceil: {
      min: 1,
      max: 1,
      fn: a => Math.ceil(toNum(a[0], "ceil"))
    },
    dateAdd: {
      min: 2,
      max: 2,
      fn: a => {
        const ds = toStr(a[0]);
        const d = new Date(ds + "T00:00:00Z");
        if (!Number.isFinite(d.getTime())) throw new FormulaError("dateAdd: invalid date");
        d.setUTCDate(d.getUTCDate() + Math.trunc(toNum(a[1], "dateAdd")));
        return d.toISOString().slice(0, 10);
      }
    }
  };

  // ---- evaluator ----
  function strictEq(a, b) {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    return a === b;
  }
  function compare(a, b) {
    if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
    const sa = toStr(a),
      sb = toStr(b);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  }
  function evaluate(node, ctx) {
    switch (node.t) {
      case "Lit":
        return node.v;
      case "Id":
        throw new FormulaError(`Unknown identifier "${node.name}". Use prop("${node.name}").`);
      case "Un":
        {
          const v = evaluate(node.x, ctx);
          return node.op === "!" ? !toBool(v) : -toNum(v, "unary -");
        }
      case "Bin":
        return evalBin(node, ctx);
      case "Call":
        return evalCall(node, ctx);
    }
  }
  function evalBin(node, ctx) {
    const {
      op
    } = node;
    if (op === "&&") {
      return toBool(evaluate(node.l, ctx)) ? toBool(evaluate(node.r, ctx)) : false;
    }
    if (op === "||") {
      return toBool(evaluate(node.l, ctx)) ? true : toBool(evaluate(node.r, ctx));
    }
    const l = evaluate(node.l, ctx),
      r = evaluate(node.r, ctx);
    switch (op) {
      case "+":
        return toNum(l, "+") + toNum(r, "+");
      case "-":
        return toNum(l, "-") - toNum(r, "-");
      case "*":
        return toNum(l, "*") * toNum(r, "*");
      case "/":
        {
          const d = toNum(r, "/");
          if (d === 0) throw new FormulaError("#DIV/0");
          return toNum(l, "/") / d;
        }
      case "==":
        return strictEq(l, r);
      case "!=":
        return !strictEq(l, r);
      case "<":
        return compare(l, r) < 0;
      case ">":
        return compare(l, r) > 0;
      case "<=":
        return compare(l, r) <= 0;
      case ">=":
        return compare(l, r) >= 0;
    }
  }
  function evalCall(node, ctx) {
    const def = FN[node.name];
    if (!def) throw new FormulaError(`Unknown function "${node.name}"`);
    if (node.args.length < def.min || node.args.length > def.max) throw new FormulaError(`${node.name}: wrong arg count`);
    return def.fn(node.args.map(a => evaluate(a, ctx)), ctx);
  }

  // ---- public API ----
  const cache = {};
  function compileFormula(src) {
    if (!(src in cache)) {
      try {
        cache[src] = {
          ast: parse(tokenize(src))
        };
      } catch (e) {
        cache[src] = {
          err: e.message
        };
      }
    }
    return cache[src];
  }
  // runFormula(src, rowObject) -> value or "#ERR". rowObject keys = field NAMES.
  function runFormula(src, row, today) {
    if (!src) return "";
    const c = compileFormula(src);
    if (c.err) return "#ERR";
    try {
      return evaluate(c.ast, {
        row,
        today: today || new Date().toISOString().slice(0, 10)
      });
    } catch (e) {
      return "#ERR";
    }
  }
  function extractDeps(src) {
    try {
      const ast = parse(tokenize(src));
      const deps = new Set();
      (function w(n) {
        if (!n) return;
        if (n.t === "Call" && n.name === "prop" && n.args[0] && n.args[0].t === "Lit" && typeof n.args[0].v === "string") deps.add(n.args[0].v);
        if (n.t === "Un") w(n.x);
        if (n.t === "Bin") {
          w(n.l);
          w(n.r);
        }
        if (n.t === "Call") n.args.forEach(w);
      })(ast);
      return [...deps];
    } catch (e) {
      return [];
    }
  }
  const FORMULA_FUNCS = Object.keys(FN);
  if (typeof window !== "undefined") Object.assign(window, {
    runFormula,
    extractDeps,
    FORMULA_FUNCS
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/formula.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/icons.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// icons.jsx — Vector workflow iconography + fake data
// Status & priority icons are custom inline SVG (geometry carries meaning).
// Everything else uses Lucide (loaded via CDN in index.html).

const STATUS = {
  backlog: {
    color: "#8A8F98",
    label: "Backlog"
  },
  todo: {
    color: "#9CA0A8",
    label: "Todo"
  },
  progress: {
    color: "#F2C94C",
    label: "In Progress"
  },
  review: {
    color: "#4CB782",
    label: "In Review"
  },
  done: {
    color: "#4C8DFF",
    label: "Done"
  },
  canceled: {
    color: "#62666D",
    label: "Canceled"
  }
};
const STATUS_CYCLE = ["todo", "progress", "review", "done", "backlog"];
function StatusIcon({
  status = "todo",
  size = 14
}) {
  const c = (STATUS[status] || STATUS.todo).color;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 14 14"
  };
  if (status === "backlog") return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5.5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.5",
    strokeDasharray: "1.6 1.8"
  }));
  if (status === "todo") return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5.5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.5"
  }));
  if (status === "progress") return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5.5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "3",
    fill: "none",
    stroke: c,
    strokeWidth: "6",
    strokeDasharray: "7.5 100",
    transform: "rotate(-90 7 7)"
  }));
  if (status === "review") return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5.5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "3",
    fill: "none",
    stroke: c,
    strokeWidth: "6",
    strokeDasharray: "14 100",
    transform: "rotate(-90 7 7)"
  }));
  if (status === "done") return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "6",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4.3 7.1l1.8 1.8 3.4-3.6",
    stroke: "#0A0A0B",
    strokeWidth: "1.4",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
  return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "6",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 5l4 4M9 5l-4 4",
    stroke: "#0A0A0B",
    strokeWidth: "1.3",
    strokeLinecap: "round"
  }));
}
function PriorityIcon({
  priority = "none",
  size = 16
}) {
  const on = "var(--priority-bar-on)",
    off = "var(--priority-bar-off)";
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 16 16"
  };
  if (priority === "urgent") return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("rect", {
    x: "1.5",
    y: "1.5",
    width: "13",
    height: "13",
    rx: "3",
    fill: "#F2994A"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7",
    y: "4",
    width: "2",
    height: "5",
    rx: "1",
    fill: "#0A0A0B"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7",
    y: "10.5",
    width: "2",
    height: "2",
    rx: "1",
    fill: "#0A0A0B"
  }));
  if (priority === "high" || priority === "medium" || priority === "low") {
    const n = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
    return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("rect", {
      x: "2",
      y: "9",
      width: "3",
      height: "5",
      rx: "1",
      fill: n >= 1 ? on : off
    }), /*#__PURE__*/React.createElement("rect", {
      x: "6.5",
      y: "6",
      width: "3",
      height: "8",
      rx: "1",
      fill: n >= 2 ? on : off
    }), /*#__PURE__*/React.createElement("rect", {
      x: "11",
      y: "3",
      width: "3",
      height: "11",
      rx: "1",
      fill: n >= 3 ? on : off
    }));
  }
  return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "7",
    width: "3",
    height: "2",
    rx: "1",
    fill: "var(--priority-none)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "6.5",
    y: "7",
    width: "3",
    height: "2",
    rx: "1",
    fill: "var(--priority-none)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "11",
    y: "7",
    width: "3",
    height: "2",
    rx: "1",
    fill: "var(--priority-none)"
  }));
}

// ---------------------------------------------------------------
// RESERVED ICONS — Vector originals that Lucide must never replace.
// Any Lucide name on the left is intercepted and rendered as the
// Vector SVG instead, so a stray <Lic name="panel-left"/> anywhere
// in any consuming app still draws the real Vector mark.
// Add to this map whenever a new signature icon is created.
// ---------------------------------------------------------------
const VECTOR_RESERVED = {
  "panel-left": p => /*#__PURE__*/React.createElement(PanelIcon, _extends({
    side: "left"
  }, p)),
  "panel-left-open": p => /*#__PURE__*/React.createElement(PanelIcon, _extends({
    side: "left"
  }, p)),
  "panel-left-close": p => /*#__PURE__*/React.createElement(PanelIcon, _extends({
    side: "left"
  }, p)),
  "panel-right": p => /*#__PURE__*/React.createElement(PanelIcon, _extends({
    side: "right"
  }, p)),
  "panel-right-open": p => /*#__PURE__*/React.createElement(PanelIcon, _extends({
    side: "right"
  }, p)),
  "panel-right-close": p => /*#__PURE__*/React.createElement(PanelIcon, _extends({
    side: "right"
  }, p)),
  "sidebar": p => /*#__PURE__*/React.createElement(PanelIcon, _extends({
    side: "left"
  }, p)),
  "sidebar-open": p => /*#__PURE__*/React.createElement(PanelIcon, _extends({
    side: "left"
  }, p)),
  "sidebar-close": p => /*#__PURE__*/React.createElement(PanelIcon, _extends({
    side: "left"
  }, p)),
  // workflow marks — geometry carries meaning, never a generic circle
  "circle-dashed": p => /*#__PURE__*/React.createElement(StatusIcon, _extends({
    status: "backlog"
  }, p)),
  "circle-dot": p => /*#__PURE__*/React.createElement(StatusIcon, _extends({
    status: "progress"
  }, p)),
  "circle-check": p => /*#__PURE__*/React.createElement(StatusIcon, _extends({
    status: "done"
  }, p)),
  "circle-check-big": p => /*#__PURE__*/React.createElement(StatusIcon, _extends({
    status: "done"
  }, p)),
  "check-circle-2": p => /*#__PURE__*/React.createElement(StatusIcon, _extends({
    status: "done"
  }, p)),
  "circle-x": p => /*#__PURE__*/React.createElement(StatusIcon, _extends({
    status: "canceled"
  }, p)),
  "signal-high": p => /*#__PURE__*/React.createElement(PriorityIcon, _extends({
    priority: "high"
  }, p)),
  "signal-medium": p => /*#__PURE__*/React.createElement(PriorityIcon, _extends({
    priority: "medium"
  }, p)),
  "signal-low": p => /*#__PURE__*/React.createElement(PriorityIcon, _extends({
    priority: "low"
  }, p))
};

// Lucide icon wrapper -> renders an <i data-lucide> then asks lucide to swap it.
// Reserved names are hard-redirected to the Vector original.
function Lic({
  name,
  size = 16,
  cls = "icon",
  color
}) {
  const ref = React.useRef(null);
  const reserved = VECTOR_RESERVED[name];
  React.useEffect(() => {
    if (reserved) return; // Vector SVG rendered below
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const i = document.createElement("i");
      i.setAttribute("data-lucide", name);
      ref.current.appendChild(i);
      window.lucide.createIcons({
        attrs: {
          width: size,
          height: size
        },
        nodes: [i]
      });
    }
  }, [name, size, reserved]);
  if (reserved) {
    if (typeof console !== "undefined" && !Lic._warned?.[name]) {
      (Lic._warned = Lic._warned || {})[name] = 1;
      console.warn(`[Vector] "${name}" is a Vector signature icon — rendered the Vector SVG instead of Lucide. Import it directly (PanelIcon / StatusIcon / PriorityIcon).`);
    }
    return /*#__PURE__*/React.createElement("span", {
      className: cls,
      style: {
        display: "inline-flex",
        color,
        width: size,
        height: size
      }
    }, reserved({
      size,
      color: color || "currentColor"
    }));
  }
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    className: cls,
    style: {
      display: "inline-flex",
      color,
      width: size,
      height: size
    }
  });
}
function Avatar({
  from = "#4CB782",
  to = "#2D9CDB",
  text,
  size = 20
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "avatar",
    style: {
      width: size,
      height: size,
      background: `linear-gradient(135deg, ${from}, ${to})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      font: "600 10px Inter",
      color: "#0A0A0B"
    }
  }, text);
}

// Rounded "panel" toggle icons — softer corners than Lucide's, closer to Linear's.
function PanelIcon({
  side = "left",
  size = 16,
  color = "currentColor"
}) {
  const railLeft = side === "left";
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 18 18",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "3",
    width: "14",
    height: "12",
    rx: "4",
    stroke: color,
    strokeWidth: "1.6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: railLeft ? "7" : "11",
    y1: "3.6",
    x2: railLeft ? "7" : "11",
    y2: "14.4",
    stroke: color,
    strokeWidth: "1.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: railLeft ? "2.8" : "11.2",
    y: "3.8",
    width: "4",
    height: "10.4",
    rx: "2.4",
    fill: color,
    opacity: "0.18"
  }));
}
const LABELS = {
  Bug: {
    color: "#EB5757"
  },
  Feature: {
    color: "#BB6BD9"
  },
  Improvement: {
    color: "#2D9CDB"
  }
};

// ---- fake data ----
const SEED_ISSUES = [{
  id: "VEC-1",
  title: "Get familiar with Vector",
  team: "VEC",
  status: "todo",
  priority: "none",
  created: "Feb 26",
  updated: "Feb 26",
  project: null,
  labels: [],
  assignee: null,
  source: null,
  subscribers: ["김혁규"],
  hasDescription: true,
  hasLinks: false,
  dueDate: null,
  overdue: false
}, {
  id: "VEC-3",
  title: "Connect your tools",
  team: "VEC",
  status: "progress",
  priority: "high",
  created: "Feb 26",
  updated: "May 3",
  project: "Design system",
  labels: ["Improvement"],
  assignee: "김혁규",
  source: "github",
  subscribers: ["김혁규"],
  hasDescription: true,
  hasLinks: true,
  dueDate: "Jun 15",
  overdue: false,
  cycle: "c2",
  estimate: 3
}, {
  id: "VEC-2",
  title: "Set up your teams",
  team: "VEC",
  status: "todo",
  priority: "medium",
  created: "Feb 26",
  updated: "Feb 26",
  project: null,
  labels: [],
  assignee: "김혁규",
  source: null,
  subscribers: [],
  hasDescription: false,
  hasLinks: false,
  dueDate: null,
  overdue: false
}, {
  id: "VEC-4",
  title: "Import your data",
  team: "VEC",
  status: "todo",
  priority: "low",
  created: "Feb 26",
  updated: "Feb 26",
  project: null,
  labels: ["Feature"],
  assignee: null,
  source: "github",
  subscribers: ["김혁규"],
  hasDescription: true,
  hasLinks: true,
  dueDate: "May 20",
  overdue: true
}, {
  id: "VEC-5",
  title: "Invite your teammates",
  team: "VEC",
  status: "todo",
  priority: "urgent",
  created: "Feb 27",
  updated: "Feb 27",
  project: null,
  labels: ["Bug"],
  assignee: null,
  source: null,
  subscribers: [],
  hasDescription: true,
  hasLinks: false,
  dueDate: "Jun 30",
  overdue: false,
  cycle: "c2",
  estimate: 1
}, {
  id: "VEC-8",
  title: "Polish onboarding copy",
  team: "VEC",
  status: "review",
  priority: "high",
  created: "Mar 2",
  updated: "May 6",
  project: "Q3 Platform revamp",
  labels: ["Feature"],
  assignee: "김혁규",
  source: "github",
  subscribers: ["김혁규"],
  hasDescription: true,
  hasLinks: true,
  dueDate: null,
  overdue: false,
  cycle: "c2",
  estimate: 2
}, {
  id: "VEC-6",
  title: "Refactor auth module",
  team: "VEC",
  status: "backlog",
  priority: "medium",
  created: "Feb 20",
  updated: "Apr 18",
  project: null,
  labels: ["Improvement"],
  assignee: "김혁규",
  source: null,
  subscribers: ["김혁규"],
  hasDescription: false,
  hasLinks: false,
  dueDate: null,
  overdue: false
}, {
  id: "VEC-7",
  title: "Clean up legacy endpoints",
  team: "VEC",
  status: "backlog",
  priority: "low",
  created: "Feb 18",
  updated: "Mar 9",
  project: null,
  labels: [],
  assignee: null,
  source: null,
  subscribers: [],
  hasDescription: false,
  hasLinks: false,
  dueDate: null,
  overdue: false
}, {
  id: "ENG-1",
  title: "Migrate CI to new runners",
  team: "ENG",
  status: "progress",
  priority: "high",
  created: "Apr 1",
  updated: "May 4",
  project: "Mobile app v2",
  labels: ["Improvement"],
  assignee: "김혁규",
  source: "github",
  subscribers: ["김혁규"],
  hasDescription: true,
  hasLinks: true,
  dueDate: "Jun 20",
  overdue: false,
  cycle: "ec2",
  estimate: 3
}, {
  id: "ENG-2",
  title: "Add rate limiting to API",
  team: "ENG",
  status: "todo",
  priority: "urgent",
  created: "Apr 3",
  updated: "Apr 3",
  project: null,
  labels: ["Bug"],
  assignee: null,
  source: null,
  subscribers: [],
  hasDescription: true,
  hasLinks: false,
  dueDate: null,
  overdue: false,
  cycle: "ec2",
  estimate: 1
}, {
  id: "ENG-3",
  title: "Upgrade to Node 22",
  team: "ENG",
  status: "backlog",
  priority: "medium",
  created: "Mar 28",
  updated: "Mar 28",
  project: null,
  labels: [],
  assignee: "김혁규",
  source: null,
  subscribers: ["김혁규"],
  hasDescription: false,
  hasLinks: false,
  dueDate: null,
  overdue: false
}, {
  id: "DSGN-1",
  title: "Redesign settings nav",
  team: "DSGN",
  status: "todo",
  priority: "medium",
  created: "Apr 10",
  updated: "Apr 10",
  project: "Design system",
  labels: ["Feature"],
  assignee: "김혁규",
  source: null,
  subscribers: ["김혁규"],
  hasDescription: true,
  hasLinks: false,
  dueDate: null,
  overdue: false
}, {
  id: "DSGN-2",
  title: "Audit color contrast",
  team: "DSGN",
  status: "done",
  priority: "low",
  created: "Mar 15",
  updated: "Apr 2",
  project: "Design system",
  labels: ["Improvement"],
  assignee: "김혁규",
  source: null,
  subscribers: [],
  hasDescription: true,
  hasLinks: false,
  dueDate: null,
  overdue: false
}];
const PROJECTS = [{
  id: "p1",
  name: "Q3 Platform revamp",
  team: "VEC",
  status: "backlog",
  health: "onTrack",
  priority: "high",
  lead: "김혁규",
  target: "Sep 30",
  start: "Jul 8",
  issues: 12,
  progress: 0,
  members: 3,
  deps: 0,
  created: "Feb 27",
  updated: "Mar 4",
  completed: null,
  labels: []
}, {
  id: "p2",
  name: "Mobile app v2",
  team: "ENG",
  status: "progress",
  health: "atRisk",
  priority: "urgent",
  lead: "김혁규",
  target: "Aug 15",
  start: "May 1",
  issues: 8,
  progress: 42,
  members: 4,
  deps: 1,
  created: "Jan 10",
  updated: "May 2",
  completed: null,
  labels: ["Feature"]
}, {
  id: "p3",
  name: "Billing migration",
  team: "ENG",
  status: "planned",
  health: "onTrack",
  priority: "medium",
  lead: null,
  target: "Oct 20",
  start: "Sep 1",
  issues: 5,
  progress: 0,
  members: 2,
  deps: 0,
  created: "Mar 1",
  updated: "Mar 1",
  completed: null,
  labels: []
}, {
  id: "p4",
  name: "Design system",
  team: "DSGN",
  status: "progress",
  health: "onTrack",
  priority: "high",
  lead: "김혁규",
  target: "Jul 1",
  start: "Apr 2",
  issues: 20,
  progress: 68,
  members: 5,
  deps: 2,
  created: "Apr 2",
  updated: "May 6",
  completed: null,
  labels: ["Improvement"]
}, {
  id: "p5",
  name: "Q1 retro actions",
  team: "VEC",
  status: "done",
  health: "onTrack",
  priority: "low",
  lead: "김혁규",
  target: "Jun 1",
  start: "Mar 1",
  issues: 6,
  progress: 100,
  members: 2,
  deps: 0,
  created: "Mar 1",
  updated: "Jun 1",
  completed: "Jun 1",
  labels: []
}];
const PROJECT_STATUS = {
  backlog: {
    key: "backlog",
    label: "Backlog"
  },
  planned: {
    key: "todo",
    label: "Planned"
  },
  progress: {
    key: "progress",
    label: "In Progress"
  },
  done: {
    key: "done",
    label: "Completed"
  },
  canceled: {
    key: "canceled",
    label: "Canceled"
  }
};
const PROJECT_STATUS_ORDER = ["backlog", "planned", "progress", "done", "canceled"];
const HEALTH = {
  onTrack: {
    label: "On track",
    color: "#4CB782"
  },
  atRisk: {
    label: "At risk",
    color: "#F2C94C"
  },
  offTrack: {
    label: "Off track",
    color: "#EB5757"
  }
};
const PROJECT_PROPS_ALL = ["Priority", "Status", "Health", "Lead", "Members", "Dependencies", "Start date", "Target date", "Issues", "Created", "Updated", "Completed", "Labels"];
const PROJECT_PROPS_DEFAULT = ["Health", "Priority", "Lead", "Target date", "Issues", "Status", "Created", "Updated"];

// ---- helpers shared across views ----
const PRIORITIES = ["urgent", "high", "medium", "low", "none"];
const priorityLabel = p => p === "none" ? "No priority" : p[0].toUpperCase() + p.slice(1);
const statusLabel = s => (STATUS[s] || STATUS.todo).label;
// status → workflow type, used by Active / Backlog / All tabs
const STATUS_TYPE = {
  backlog: "backlog",
  todo: "active",
  progress: "active",
  review: "active",
  done: "completed",
  canceled: "canceled"
};
const ASSIGNEES = ["Unassigned", "김혁규", "Current user"];

// ---- teams ----
const TEAMS = [{
  id: "VEC",
  name: "vector-team",
  color: "#C026D3",
  icon: "user"
}, {
  id: "ENG",
  name: "Engineering",
  color: "#2D9CDB",
  icon: "code"
}, {
  id: "DSGN",
  name: "Design",
  color: "#BB6BD9",
  icon: "palette"
}];
Object.assign(window, {
  TEAMS
});

// ---- cycles (sprints) ----
const CYCLES = [{
  id: "c1",
  num: 1,
  team: "VEC",
  name: "Cycle 1",
  start: "May 12",
  end: "May 26",
  state: "completed",
  scope: 8,
  completed: 8
}, {
  id: "c2",
  num: 2,
  team: "VEC",
  name: "Cycle 2",
  start: "May 26",
  end: "Jun 9",
  state: "active",
  scope: 6,
  completed: 2
}, {
  id: "c3",
  num: 3,
  team: "VEC",
  name: "Cycle 3",
  start: "Jun 9",
  end: "Jun 23",
  state: "upcoming",
  scope: 3,
  completed: 0
}, {
  id: "c4",
  num: 4,
  team: "VEC",
  name: "Cycle 4",
  start: "Jun 23",
  end: "Jul 7",
  state: "upcoming",
  scope: 0,
  completed: 0
}, {
  id: "ec1",
  num: 1,
  team: "ENG",
  name: "Cycle 1",
  start: "May 19",
  end: "Jun 2",
  state: "completed",
  scope: 6,
  completed: 5
}, {
  id: "ec2",
  num: 2,
  team: "ENG",
  name: "Cycle 2",
  start: "Jun 2",
  end: "Jun 16",
  state: "active",
  scope: 4,
  completed: 1
}, {
  id: "ec3",
  num: 3,
  team: "ENG",
  name: "Cycle 3",
  start: "Jun 16",
  end: "Jun 30",
  state: "upcoming",
  scope: 2,
  completed: 0
}];
// ---- triage queue (unclassified incoming issues) ----
const TRIAGE_SEED = [{
  id: "VEC-21",
  title: "App crashes on logout (mobile)",
  team: "VEC",
  priority: "urgent",
  labels: ["Bug"],
  source: "Customer · Slack",
  desc: "Reported by 3 users — logout throws on iOS 17.",
  created: "2h",
  assignee: null,
  status: "triage"
}, {
  id: "VEC-22",
  title: "Add dark mode to email digests",
  team: "VEC",
  priority: "none",
  labels: ["Feature"],
  source: "Email",
  desc: "Several requests for dark-themed notification emails.",
  created: "5h",
  assignee: null,
  status: "triage"
}, {
  id: "VEC-23",
  title: "Typo on pricing page footer",
  team: "VEC",
  priority: "low",
  labels: [],
  source: "GitHub",
  desc: "“Recieve” → “Receive”.",
  created: "1d",
  assignee: null,
  status: "triage"
}, {
  id: "ENG-21",
  title: "API returns 500 on empty payload",
  team: "ENG",
  priority: "urgent",
  labels: ["Bug"],
  source: "Sentry",
  desc: "Unhandled exception when POST body is empty.",
  created: "1h",
  assignee: null,
  status: "triage"
}, {
  id: "ENG-22",
  title: "Add OpenTelemetry tracing",
  team: "ENG",
  priority: "medium",
  labels: ["Improvement"],
  source: "GitHub",
  desc: "Proposed in RFC-14 for cross-service tracing.",
  created: "6h",
  assignee: null,
  status: "triage"
}];
Object.assign(window, {
  TRIAGE_SEED
});
Object.assign(window, {
  CYCLES
});
Object.assign(window, {
  PRIORITIES,
  priorityLabel,
  statusLabel,
  STATUS_TYPE,
  ASSIGNEES,
  PROJECT_STATUS,
  PROJECT_STATUS_ORDER,
  HEALTH,
  PROJECT_PROPS_ALL,
  PROJECT_PROPS_DEFAULT
});
Object.assign(window, {
  STATUS,
  STATUS_CYCLE,
  StatusIcon,
  PriorityIcon,
  Lic,
  Avatar,
  PanelIcon,
  VECTOR_RESERVED,
  LABELS,
  SEED_ISSUES,
  PROJECTS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/modules.jsx
try { (() => {
// modules.jsx — single source of truth for module metadata (id, title, icon).
// Sidebar items, view titles, and breadcrumb icons all derive from this, so
// adding a module = one entry here (+ its render case in App.jsx).
const MODULES = [{
  id: "issues",
  title: "Issues",
  icon: "copy"
}, {
  id: "my",
  title: "My issues",
  icon: "crosshair"
}, {
  id: "inbox",
  title: "Inbox",
  icon: "inbox"
}, {
  id: "reviews",
  title: "Reviews",
  icon: "git-pull-request"
}, {
  id: "cycles",
  title: "Cycles",
  icon: "refresh-cw"
}, {
  id: "triage",
  title: "Triage",
  icon: "shield-alert"
}, {
  id: "insights",
  title: "Insights",
  icon: "bar-chart-3"
}, {
  id: "docs",
  title: "Documents",
  icon: "file-text"
}, {
  id: "wiki",
  title: "Wiki",
  icon: "book-open"
}, {
  id: "import",
  title: "Import",
  icon: "download"
}, {
  id: "database",
  title: "Roadmap",
  icon: "table-2"
}, {
  id: "canvas",
  title: "Whiteboard",
  icon: "pen-tool"
}, {
  id: "graph",
  title: "Graph",
  icon: "share-2"
}, {
  id: "chat",
  title: "Chat",
  icon: "message-square"
}, {
  id: "crm",
  title: "CRM",
  icon: "contact"
}, {
  id: "calendar",
  title: "Calendar",
  icon: "calendar"
}, {
  id: "forms",
  title: "Forms",
  icon: "clipboard-list"
}, {
  id: "support",
  title: "Support",
  icon: "life-buoy"
}, {
  id: "changelog",
  title: "Changelog",
  icon: "megaphone"
}, {
  id: "projects",
  title: "Projects",
  icon: "box"
}, {
  id: "views",
  title: "Views",
  icon: "layers"
}, {
  id: "search",
  title: "Search",
  icon: "search"
}];
const MODULE_TITLE = Object.fromEntries(MODULES.map(m => [m.id, m.title]));
const MODULE_ICON = Object.fromEntries(MODULES.map(m => [m.id, m.icon]));
if (typeof window !== "undefined") Object.assign(window, {
  MODULES,
  MODULE_TITLE,
  MODULE_ICON
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/modules.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/numerics.js
try { (() => {
// numerics.js — Vector DS contribution (plain JS, no JSX/React needed)
// Linear-style number & date formatting conventions, plus a global
// display-currency layer: values stay in their NATIVE currency everywhere in
// app state; conversion happens at FORMAT TIME, so no call site ever threads
// a currency preference through props.

/* ---- global display currency ---- */
let VEC_FX = 1380; // ₩ per $ — mock; swap via setFxRate(liveRate) and the whole app reflows
let VEC_DISP = null; // null = native | "KRW" | "USD"

function setDisplayCurrency(c) {
  VEC_DISP = c || null;
}
function setFxRate(r) {
  if (r > 0) VEC_FX = r;
}
function getFxRate() {
  return VEC_FX;
}

/* convert a native-currency amount to the active display currency */
function toDispCur(n, nativeCur) {
  const pc = nativeCur || "KRW";
  if (!VEC_DISP || VEC_DISP === pc) return {
    v: n,
    cur: pc
  };
  const v = pc === "KRW" ? n / VEC_FX : n * VEC_FX;
  return {
    v,
    cur: VEC_DISP
  };
}

/* ---- money ----
   Conventions: ₩ always integer; $ always 2dp (full) / 2dp under $1k (compact).
   null → "—" (em dash, never "N/A" or empty). Sign comes from the caller via
   fmtSigned, so plain amounts never carry a spurious "+". */
function fmtMoney(n, cur) {
  if (n == null) return "—";
  const d = toDispCur(n, cur);
  if (d.cur === "USD") return "$" + d.v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return "₩" + Math.round(d.v).toLocaleString("en-US");
}
function fmtCompact(n, cur) {
  if (n == null) return "—";
  const d = toDispCur(n, cur);
  if (d.cur === "USD") return "$" + (d.v >= 1000 ? d.v.toLocaleString("en-US", {
    maximumFractionDigits: 0
  }) : d.v.toFixed(2));
  return "₩" + Math.round(d.v).toLocaleString("en-US");
}

/* ---- signed figures ----
   Gains/deltas always show the sign explicitly: "+12.4%" / "−3.1%".
   Pair with .v-num.pos / .v-num.neg for color. */
function fmtSignedPct(rate, digits = 1) {
  if (rate == null) return "—";
  return (rate >= 0 ? "+" : "") + rate.toFixed(digits) + "%";
}
function fmtSignedMoney(n, cur) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "−") + fmtMoney(Math.abs(n), cur);
}

/* ---- dates ----
   Stored as terse English ("Mon D", "Mon D, YYYY", "2d", "4h", "3mo", "now").
   English UI shows them as-is (Linear voice). Korean UI localizes at format
   time — never store localized strings. */
const MON_KO = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12
};
function fmtDate(s, lang) {
  if (!s || lang !== "ko") return s;
  const m = /^([A-Z][a-z]{2})\s+(\d+)(?:,?\s+(\d{4}))?$/.exec(s);
  if (!m || !MON_KO[m[1]]) return s;
  return (m[3] ? m[3] + "년 " : "") + MON_KO[m[1]] + "월 " + m[2] + "일";
}
function fmtRel(s, lang) {
  if (!s || lang !== "ko") return s;
  if (s === "now") return "방금";
  let m;
  if (m = /^(\d+)d$/.exec(s)) return m[1] + "일 전";
  if (m = /^(\d+)h$/.exec(s)) return m[1] + "시간 전";
  if (m = /^(\d+)mo$/.exec(s)) return m[1] + "개월 전";
  if (m = /^(\d+)y$/.exec(s)) return m[1] + "년 전";
  return fmtDate(s, lang);
}
Object.assign(window, {
  setDisplayCurrency,
  setFxRate,
  getFxRate,
  toDispCur,
  fmtMoney,
  fmtCompact,
  fmtSignedPct,
  fmtSignedMoney,
  fmtDate,
  fmtRel
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/numerics.js", error: String((e && e.message) || e) }); }

// ui_kits/app/parse.jsx
try { (() => {
// parse.jsx — text table parsers, ported from FlowBase lib/parsers.ts.
// Pure, zero deps. detectFormat + parseAny(text) -> {format, rows}, inferType.
(function () {
  function parseDelimited(text, delim) {
    const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const lines = cleaned.replace(/\r\n?/g, "\n").split("\n").filter(l => l.length > 0);
    return lines.map(line => {
      const cells = [];
      let cur = "",
        inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
          if (c === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (c === '"') inQ = false;else cur += c;
        } else {
          if (c === '"') inQ = true;else if (c === delim) {
            cells.push(cur);
            cur = "";
          } else cur += c;
        }
      }
      cells.push(cur);
      return cells.map(s => s.trim());
    });
  }
  function parseMarkdownTable(text) {
    const lines = text.split("\n").filter(l => l.trim().startsWith("|"));
    if (lines.length < 2) return null;
    const split = line => line.replace(/^\||\|$/g, "").split("|").map(s => s.trim());
    return lines.filter(l => !/^\|?[\s|:-]+\|?$/.test(l)).map(split);
  }
  function detectFormat(text) {
    const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const t = cleaned.trim();
    if (!t) return null;
    if (/^\|.+\|/m.test(t) && /[-:]+/.test(t)) return "md";
    const first = t.split("\n")[0];
    const tabs = (first.match(/\t/g) || []).length;
    const commas = (first.match(/,/g) || []).length;
    if (tabs > 0 && tabs >= commas) return "tsv";
    if (commas > 0) return "csv";
    return null;
  }
  function parseAny(text) {
    const format = detectFormat(text);
    if (format === "md") return {
      format,
      rows: parseMarkdownTable(text) || []
    };
    if (format === "tsv") return {
      format,
      rows: parseDelimited(text, "\t")
    };
    if (format === "csv") return {
      format,
      rows: parseDelimited(text, ",")
    };
    return {
      format: null,
      rows: []
    };
  }
  // infer a Vector field type from sample column values
  function inferType(samples) {
    const vals = samples.filter(s => s != null && s !== "");
    if (!vals.length) return "text";
    if (vals.every(v => /^\d{4}-\d{2}-\d{2}/.test(v))) return "date";
    if (vals.every(v => /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(v))) return "text"; // email→text
    if (vals.every(v => /^-?\d+(\.\d+)?$/.test(v))) return "number";
    if (new Set(vals).size <= Math.max(5, vals.length / 4)) return "select";
    return "text";
  }
  function normalizeHeader(s, idx) {
    const fb = "col_" + (idx + 1);
    if (!s || !s.trim()) return fb;
    const n = s.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    return n || fb;
  }
  if (typeof window !== "undefined") Object.assign(window, {
    parseAny,
    detectFormat,
    inferType,
    normalizeHeader
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/parse.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/store.jsx
try { (() => {
// store.jsx — single observable store for all Vector app state.
// API mirrors usePersist: useStore(key, fallback) -> [value, setValue].
// State lives in ONE external store (subscribable + localStorage-persisted),
// so any component can read/write directly without prop-drilling.
const VECTOR_STORE = function () {
  const state = {};
  const listeners = new Set();
  function read(key, fallback) {
    if (!(key in state)) {
      try {
        const s = localStorage.getItem("vector:" + key);
        state[key] = s ? JSON.parse(s) : fallback;
      } catch (e) {
        state[key] = fallback;
      }
    }
    return state[key];
  }
  function set(key, val) {
    state[key] = val;
    try {
      localStorage.setItem("vector:" + key, JSON.stringify(val));
    } catch (e) {}
    listeners.forEach(l => l());
  }
  function subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  }
  return {
    read,
    set,
    subscribe,
    state
  };
}();

// Same signature as the old usePersist — drop-in replacement.
function useStore(key, fallback) {
  const value = React.useSyncExternalStore(VECTOR_STORE.subscribe, () => VECTOR_STORE.read(key, fallback));
  const setValue = React.useCallback(v => {
    const cur = VECTOR_STORE.read(key, fallback);
    VECTOR_STORE.set(key, typeof v === "function" ? v(cur) : v);
  }, [key]);
  return [value, setValue];
}
if (typeof window !== "undefined") Object.assign(window, {
  VECTOR_STORE,
  useStore
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/store.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.LucideIcon = __ds_scope.LucideIcon;

__ds_ns.Menu = __ds_scope.Menu;

__ds_ns.MenuItem = __ds_scope.MenuItem;

__ds_ns.PriorityIcon = __ds_scope.PriorityIcon;

__ds_ns.StatusIcon = __ds_scope.StatusIcon;

__ds_ns.Tag = __ds_scope.Tag;

})();

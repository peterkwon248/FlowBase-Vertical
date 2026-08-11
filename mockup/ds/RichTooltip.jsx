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
      position: "absolute", zIndex: 40, width: 200,
      display: "flex", flexDirection: "column", gap: 3,
      padding: "9px 11px",
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--r-md)",
      boxShadow: "var(--shadow-popover)",
      textAlign: "left", pointerEvents: "none",
      opacity: 0, transition: "opacity .12s ease",
    },
  };

  function toneColor(tone) {
    return tone === "pos" ? "var(--pos, #4CB782)" : tone === "neg" ? "var(--neg, #EB5757)" : "var(--fg-2)";
  }

  function RichTooltip({ children, header, rows = [], footer, placement = "top", align = "center", width, style }) {
    const pos = {};
    if (placement === "bottom") pos.top = "calc(100% + 8px)"; else pos.bottom = "calc(100% + 8px)";
    if (align === "start") { pos.left = 0; }
    else if (align === "end") { pos.right = 0; }
    else { pos.left = "50%"; pos.transform = "translateX(-50%)"; }

    const box = Object.assign({}, TOKENS.box, width ? { width } : null, pos, style);

    return React.createElement(
      "span",
      { className: "v-richtip-anchor", style: { position: "relative", display: "inline-flex" } },
      children,
      React.createElement(
        "span",
        { className: "v-richtip", style: box },
        header != null && React.createElement("span", {
          style: {
            display: "flex", alignItems: "center", gap: 6,
            font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg)",
            paddingBottom: rows.length ? 6 : 0,
            marginBottom: rows.length ? 4 : 0,
            borderBottom: rows.length ? "1px solid var(--border)" : "none",
          },
        }, header),
        rows.map((r, i) => React.createElement("span", {
          key: i,
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 },
        },
          React.createElement("span", {
            style: { display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
          },
            r.flag != null ? r.flag : null,
            r.dot != null ? React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: r.dot, flexShrink: 0 } }) : null,
            r.name,
          ),
          React.createElement("span", {
            style: { flexShrink: 0, font: "var(--fw-semi) 12px var(--font-mono)", fontVariantNumeric: "tabular-nums", color: toneColor(r.tone) },
          }, r.val),
        )),
        footer != null && React.createElement("span", {
          style: { font: "var(--fw-medium) 10px var(--font-mono)", color: "var(--fg-4)", marginTop: rows.length ? 4 : 0, paddingTop: rows.length ? 5 : 0, borderTop: rows.length ? "1px solid var(--border)" : "none" },
        }, footer),
      ),
    );
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

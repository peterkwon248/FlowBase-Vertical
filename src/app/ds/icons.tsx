/**
 * 아이콘 — 목업 `ds/icons.jsx`에서 **템플릿이 실제로 쓰는 것만** 옮겼다.
 *
 * 목업은 Lucide를 **CDN**(`window.lucide`)으로 불렀다. 로컬퍼스트 데스크톱
 * 앱이라 오프라인에서 깨지므로 `lucide-react`로 번들한다 — 같은 아이콘 세트고
 * 전달 방식만 바꾼 것이라 발명이 아니다.
 *
 * 이름이 **런타임에 정해지는 자리가 6곳**이다 (`{{ themeIcon }}` 등). 그래서
 * 손으로 만든 매핑 표로는 부족하고, 모듈 네임스페이스에서 이름으로 찾는다.
 * `icons` 객체만 보면 안 되는데, `History`·`MoreHorizontal`처럼 **개명 전 이름은
 * alias로만 남아** 거기 없기 때문이다 (목업이 쓰던 CDN 시절 이름이 그렇다).
 *
 * 못 찾은 이름은 조용히 넘기지 않고 자리를 비운 채 한 번 경고한다 (헌장 6).
 */

import * as Lucide from "lucide-react"
import type { LucideIcon } from "lucide-react"

const REGISTRY = Lucide as unknown as Record<string, LucideIcon | undefined>

/** `file-spreadsheet` → `FileSpreadsheet`. lucide의 컴포넌트 이름 규칙이다. */
function pascal(name: string): string {
  return name
    .split("-")
    .map((p) => (p.length > 0 ? p[0]!.toUpperCase() + p.slice(1) : ""))
    .join("")
}

const warned = new Set<string>()

export interface LicProps {
  name: string
  size?: number
  cls?: string
  color?: string
}

/** 목업 `Lic`의 자리를 그대로 채운다 — span 래퍼 + 그 안의 SVG. */
export function Lic({ name, size = 16, cls = "icon", color }: LicProps): React.JSX.Element {
  const Icon = REGISTRY[pascal(name)]
  const box: React.CSSProperties = {
    display: "inline-flex",
    color,
    width: size,
    height: size,
  }

  if (!Icon) {
    if (!warned.has(name)) {
      warned.add(name)
      console.warn(`[icons] lucide에 없는 이름: "${name}" — 자리만 비워 둔다`)
    }
    return <span className={cls} style={box} />
  }

  return (
    <span className={cls} style={box}>
      <Icon size={size} />
    </span>
  )
}

export interface PanelIconProps {
  side?: "left" | "right"
  size?: number
  color?: string
}

/** 목업 원문 그대로 (icons.jsx L106~115). Lucide보다 모서리가 둥근 Vector 원본이다. */
export function PanelIcon({
  side = "left",
  size = 16,
  color = "currentColor",
}: PanelIconProps): React.JSX.Element {
  const railLeft = side === "left"
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="3" width="14" height="12" rx="4" stroke={color} strokeWidth="1.6" />
      <line
        x1={railLeft ? "7" : "11"}
        y1="3.6"
        x2={railLeft ? "7" : "11"}
        y2="14.4"
        stroke={color}
        strokeWidth="1.6"
      />
      <rect
        x={railLeft ? "2.8" : "11.2"}
        y="3.8"
        width="4"
        height="10.4"
        rx="2.4"
        fill={color}
        opacity="0.18"
      />
    </svg>
  )
}

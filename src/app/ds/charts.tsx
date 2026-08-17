/**
 * 차트 — 목업 `ds/charts.jsx`에서 **템플릿이 실제로 쓰는 것만** 옮겼다.
 *
 * 목업의 `VChart`는 13종을 담고 있지만 변환된 템플릿이 부르는 것은
 * `VChart.Line` 하나뿐이다 (L814, 일별 기여이익 추세). 나머지를 미리 옮기지
 * 않는 이유는 **§21이 차트를 재편**하기 때문이다 — 도넛은 가로 막대로 바뀌고
 * 스파크라인은 사라진다. 지금 옮기면 곧 버릴 것을 옮기는 셈이다.
 *
 * 필요해지면 그때 하나씩 추가한다. 없는 것을 부르면 타입이 먼저 막는다.
 */

const PAL = ["#4C8DFF", "#4CB782", "#F2C94C", "#F2994A", "#BB6BD9", "#EB5757", "#2D9CDB", "#E879B9"]

export interface Point {
  k: string
  v: number
}

export interface LineProps {
  /** 차트는 읽기만 한다. `readonly`라야 값 골격의 `readonly any[]`가 그대로 들어온다. */
  data: readonly Point[]
  area?: boolean
}

/**
 * ★ 라벨은 **솎는다** — 목업에 없던 판단이다 (2026-08-17) ★
 *
 * 목업의 기간은 8/1~8/8 **8일**이라 라벨 8개가 편히 들어갔다. 우리는 달 단위로
 * 조회하므로 31개가 서고, 실제로 «7/17/27/37/4…»처럼 **겹쳐 뭉개졌다**(실측).
 *
 * 점은 다 찍고 **라벨만** 줄인다 — 추세의 해상도를 낮추지 않으면서 축을 읽히게
 * 하는 유일한 방법이다. 간격은 기간 길이에서 자동으로 나오므로 주 단위로 보면
 * 7개가 그대로 다 뜬다(사용자가 «주간이면 딱 맞는다»고 한 그 상태).
 *
 * 처음과 **마지막**은 언제나 남긴다. 축의 양 끝이 없으면 «언제부터 언제까지»가
 * 사라진다.
 */
function showLabel(i: number, n: number): boolean {
  if (n <= 10) return true
  const step = Math.ceil(n / 7)
  return i === 0 || i === n - 1 || i % step === 0
}

/** 목업 `charts.jsx` L28~38 그대로. 좌표 계산과 토큰을 손대지 않았다. */
function Line({ data, area }: LineProps): React.JSX.Element {
  const W = 460
  const H = 200
  const P = 30
  const max = Math.max(...data.map((d) => d.v), 1)
  const x = (i: number): number => P + ((W - 2 * P) * i) / Math.max(1, data.length - 1)
  const y = (v: number): number => P + (H - 2 * P) * (1 - v / max)
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.v).toFixed(1)}`).join(" ")

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {[0, 0.5, 1].map((f, i) => (
        <line
          key={i}
          x1={P}
          x2={W - P}
          y1={P + (H - 2 * P) * f}
          y2={P + (H - 2 * P) * f}
          stroke="var(--border)"
        />
      ))}
      {area && data.length > 1 && (
        <path
          d={`${path} L${x(data.length - 1)} ${H - P} L${x(0)} ${H - P} Z`}
          fill="var(--accent-soft)"
        />
      )}
      <path d={path} fill="none" stroke={PAL[0]} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.v)} r="2.5" fill={PAL[0]} />
          {showLabel(i, data.length) && (
            <text x={x(i)} y={H - 8} textAnchor="middle" className="ins-axis">
              {d.k}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

export const VChart = { Line }

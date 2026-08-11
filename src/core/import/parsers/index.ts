/**
 * 파서 디스패치.
 *
 * Recognition이 고른 포맷으로 파서를 찾는다. 헌장 B-8 — 여기에도 마켓 이름은 없다.
 * 파서는 컨테이너 포맷만 알고, 그 안에 쿠팡 정산서가 들었는지 11번가 광고
 * 보고서가 들었는지는 Mapping 단계와 팩의 몫이다.
 */

import type { ContainerFormat, Parser } from "../types.js"
import { xlsxParser } from "./xlsx.js"
import { biffParser } from "./biff.js"
import { htmlTableParser } from "./html-table.js"
import { delimitedParser } from "./delimited.js"

const PARSERS: Readonly<Record<ContainerFormat, Parser>> = {
  xlsx: xlsxParser,
  biff: biffParser,
  "html-table": htmlTableParser,
  delimited: delimitedParser,
}

export function parserFor(format: ContainerFormat): Parser {
  return PARSERS[format]
}

export { xlsxParser, biffParser, htmlTableParser, delimitedParser }
export { parseDelimited, iterateDelimited } from "./delimited.js"
export { charsetFromMeta, decodeHtml } from "./html-table.js"
export { dateToRaw } from "./sheetjs-common.js"

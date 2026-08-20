/**
 * ★ 자동 생성 — 손으로 고치지 않는다 ★
 *
 * 만든 것: `tools/convert/convert.ts`
 *
 * 예전 `renderVals()`가 템플릿에 넘기던 값의 **모양**이다. 타입은 변환기가
 * 홀의 쓰임에서 추론했다 — `{{ x }}`가 `<sc-if value>`에 있었으면 boolean,
 * `<sc-for list>`였으면 배열, `onClick`이었으면 함수다.
 *
 * `emptyVals()`는 **아무 데이터도 없는 상태**를 그린다. 시드가 아니다 —
 * 목록은 비어 있고 숫자 자리는 빈 문자열이다. 3a 게이트의 "빈 DB로 기동해
 * 전 화면이 데이터 없음으로 렌더된다"가 이 값으로 판정된다.
 *
 * 배선하면서 화면별로 실제 값(리포지토리 조회 · `computePnl`)이 이 자리를
 * 하나씩 대체한다. **산수를 여기로 가져오지 않는다** — 계산기는 `computePnl`
 * 하나다 (단일 계산기 LOCK).
 */

/**
 * 월 선택기의 값. **손으로 더한 것**이라 변환기가 만들지 않는다 (`periodPick` 참조).
 *
 * 목록은 «데이터가 있는 달»뿐이다 — 그 판정은 DB가 한다
 * (`core/profit/months.ts`). 화면은 고를 수 있는 것만 보여준다.
 */
/**
 * ★ 손으로 더한 자리 — 원본 파일 격자 (§21 «import-grid», 2026-08-20) ★
 *
 * 목업에 대응물이 없어 변환기가 만들지 않는다. 가져오기 위저드가 «이 열이 무슨
 * 뜻인가»(열 목록)에만 답하고 «내 파일이 어떻게 생겼나»에 답하지 않던 자리다.
 */
export interface ImportGridCol {
  /** 엑셀 열 좌표 (A · B · … · AA) — 사용자가 파일을 여는 도구의 말이다. */
  readonly ref: string
  /** 헤더 행에서 읽은 이름. 헤더 폭 밖의 꼬리 칸은 ""다. */
  readonly name: string
  /** 헤더에 이름이 없는 칸인가 — 세어서 말해야 하는 자리다 (LOCK 6). */
  readonly extra: boolean
}

/** 격자 한 줄. 데이터 행·헤더 행·제외된 행·접힌 빈 구간이 **한 좌표계**에 산다. */
export interface ImportGridRow {
  /** 왼쪽 행 번호. **1-기준**(엑셀과 같다). 접힌 구간은 "17–35" 범위다. */
  readonly no: string
  /** "head" 헤더 · "" 데이터 · "excl" 제외 · "skip" 접힌 빈 구간 */
  readonly kind: string
  /** 셀. 제외·접힘 줄은 **비어 있다** — 그 행의 내용은 남아 있지 않다. */
  readonly cells: readonly { readonly text: string; readonly num: boolean }[]
  /** 제외 사유 · 접힌 행 수. 데이터 행은 ""다. */
  readonly note: string
}

/**
 * ★ 손으로 더한 자리 — 보는 범위 (§21 «scope-bar», 2026-08-21 · ADR-021) ★
 *
 * 목업에 대응물이 없다. 목업은 **모든 파일이 늘 합쳐진 세계**를 그렸기 때문이다 —
 * 「어느 파일을 볼까」라는 물음 자체가 없었다.
 *
 * ★ 이름을 가른다 ★
 * 저장된 것은 **묶음**(`collection`)이고, 화면이 말하는 것은 **범위**(지금 무엇을
 * 보고 있나)다. 둘은 다르다 — 묶음은 여럿이고 범위는 하나다. `colRows`(열 목록)와
 * 한 글자 차이가 나는 이름을 피하는 뜻도 있다.
 */
export interface ScopeBundle {
  /** 「전체」는 `id`가 `null`이다 — 저장된 행이 아니라 지울 수 없는 기본 항목이다. */
  readonly id: string | null
  readonly name: string
  /** 담긴 파일 수. 「전체」는 전부다. */
  readonly count: number
  readonly active: boolean
  readonly pick: () => void
}

/** 묶음 편집 패널 한 줄 — 파일 하나. `batch_id`는 화면에 안 나온다 (헌장 C-4). */
export interface ScopeFile {
  /** React key 전용. 화면에 그리지 않는다. */
  readonly key: string
  readonly name: string
  /** "07-14 09:20 · 쿠팡" — 사람이 파일을 알아보는 말 */
  readonly at: string
  readonly checked: boolean
  readonly toggle: () => void
  /** 「나중 파일이 12행을 가져갔습니다」 같은 사실. 없으면 "". */
  readonly note: string
}

/** 묶음 만들기·편집. 열려 있을 때만 있다. */
export interface ScopeEdit {
  readonly title: string
  readonly name: string
  readonly setName: (v: string) => void
  readonly query: string
  readonly setQuery: (v: string) => void
  readonly files: readonly ScopeFile[]
  /** 고른 파일 수 — 「3개 담김」 */
  readonly picked: number
  readonly canSave: boolean
  /** 못 저장하는 이유. 아무 말 없이 회색인 버튼은 «고장»으로 읽힌다 (§21-1). */
  readonly why: string
  readonly save: () => void
  readonly cancel: () => void
  /** 편집 중인 묶음 지우기. 새로 만드는 중이면 `null`. */
  readonly remove: (() => void) | null
}

export interface ScopeBar {
  /** 지금 보는 범위의 이름 — 「전체」 또는 묶음 이름. */
  readonly label: string
  /** 「파일 12개 전부」 / 「12개 중 3개 · 9개는 계산 밖」 */
  readonly summary: string
  /**
   * 계산 밖으로 뺀 것의 **크기**. ADR-021 — 막지 않는 대신 크기를 말한다.
   * 「전체」를 보고 있으면 뺀 것이 없으므로 "".
   */
  readonly excluded: string
  readonly bundles: readonly ScopeBundle[]
  /**
   * 방금 넣었는데 지금 묶음 밖인 파일. 없으면 `null`.
   * 「전체」를 보는 중이면 늘 `null`이다 — 새 파일이 자동으로 들어가므로 할 말이 없다.
   */
  readonly fresh: { readonly text: string; readonly add: () => void; readonly dismiss: () => void } | null
  readonly openNew: () => void
  /** 지금 묶음을 고쳐 연다. 「전체」를 보는 중이면 `null` — 전체는 편집 대상이 아니다. */
  readonly openEdit: (() => void) | null
  readonly edit: ScopeEdit | null
}

export interface PeriodPick {
  /** "2026년 7월" — 지금 보고 있는 달. */
  readonly label: string
  /** 목록이 펼쳐져 있나. */
  readonly open: boolean
  readonly toggle: () => void
  readonly items: readonly {
    readonly label: string
    /**
     * «정산만» 같은 꼬리표. 주문이 있는 평범한 달에서는 빈 문자열이다.
     * 7월 정산 파일의 지급일이 8월로 찍혀 생기는 달이 여기 걸린다 (`period.ts`).
     */
    readonly sub: string
    readonly fg: string
    readonly bg: string
    readonly pick: () => void
  }[]
  /** 목록 아래 한 줄. «왜 이 달들만 있나»를 말한다 (§22 — 부재를 설명한다). */
  readonly note: string
}

export interface TemplateVals {
  actions: readonly any[]
  adAlloc: string
  adCount: string
  addCf: (...args: any[]) => void
  adjAddOpacity: string
  adjBlockWhy: string
  adjBlocked: boolean
  adjDraft: string
  adjPosLeft: string
  adjPosTop: string
  adjRows: readonly any[]
  adjWhy: string
  adRoas: string
  adRows: readonly any[]
  adTotal: string
  adUnalloc: string
  applyUpdate: (...args: any[]) => void
  appNavClass: string
  archiveList: readonly any[]
  archiveOpen: boolean
  askReset: (...args: any[]) => void
  attnFoot: string
  attnItems: readonly any[]
  attnOpen: boolean
  bridgeCaption: string
  bridgeDown: {
    items: readonly any[]
    segs: readonly any[]
    total: string
    width: string
  }
  bridgeFrom: string
  bridgeSentences: readonly any[]
  bridgeTitle: string
  bridgeTo: string
  bridgeUp: {
    items: readonly any[]
    segs: readonly any[]
    total: string
    width: string
  }
  cacAvg: string
  cacBreakeven: string
  cacColor: string
  cacNote: string
  cacRows: readonly any[]
  calCells: readonly any[]
  calDaysView: boolean
  calendar: readonly any[]
  calHint: string
  calMonthsView: boolean
  calTitle: string
  calViewIcon: string
  calYearsView: boolean
  cashByCh: readonly any[]
  cashDue: string
  cashGap: string
  cashNet: string
  cashNote: string
  cashPaid: string
  catItems: readonly any[]
  cdCost: string
  cdFrom: string
  cdMemo: string
  cfBadge: string
  cfRows: readonly any[]
  cfSummary: string
  chRows: readonly any[]
  clearImpChannel: (...args: any[]) => void
  clearOrderFilter: (...args: any[]) => void
  clearPnlFilter: (...args: any[]) => void
  clearQuery: (...args: any[]) => void
  closeCmd: (...args: any[]) => void
  closeConfirm: (...args: any[]) => void
  closeDetail: (...args: any[]) => void
  closeDisp: (...args: any[]) => void
  closeMenus: (...args: any[]) => void
  closeModal: (...args: any[]) => void
  closeNav: (...args: any[]) => void
  closeQuadFull: (...args: any[]) => void
  cmdEmpty: boolean
  cmdItems: readonly any[]
  cmdOpen: boolean
  cmdQuery: string
  colRows: readonly any[]
  comparisons: readonly any[]
  confirm: {
    body: string
    btnBorder: string
    btnFg: string
    btnOp: string
    choices: readonly any[]
    confirmLabel: string
    hasChoice: boolean
    hasRows: boolean
    hasType: boolean
    rows: readonly any[]
    run: (...args: any[]) => void
    title: string
  } | null
  confirmFm: (...args: any[]) => void
  confirmType: string
  connBadge: string
  conns: readonly any[]
  contribColor: string
  contribMargin: string
  costChanges: string
  costDonut: string
  /**
   * ★ 손으로 더한 자리 — 도넛이 **거짓말하지 않는가** (2026-08-16) ★
   *
   * 참이면 도넛, 거짓이면 가로 막대다. 판정은 데이터가 한다 —
   * 「일곱 항 + 기여이익 = 매출」이 성립할 때만 도넛이 사실을 그린다
   * (`dashboard.ts`의 `partitionsRevenue`).
   */
  costDonutOk: boolean
  costDraft: string
  /**
   * §21 신설 (`data-s21="cost-gauge"`) — 원가 입력 진척. **분모는 SKU 수**다.
   * `note`는 «게이지가 꽉 차도 손익은 아직 안 움직인다»를 말하는 자리이고,
   * 품목 적재가 생기면 빈 문자열이 되어 스스로 사라진다.
   */
  costGauge: {
    color: string
    costed: number
    note: string
    pctWidth: string
    text: string
    total: number
  }
  costMissColor: string
  costMissing: string
  costMix: readonly any[]
  costRows: readonly any[]
  costTabs: readonly any[]
  costTotal: string
  creds: readonly any[]
  ctAd: boolean
  ctCogs: boolean
  ctOps: boolean
  dayTip: {
    foot: string
    head: string
    left: string
    rows: readonly any[]
  } | null
  detail: {
    actions: readonly any[]
    adj: readonly any[]
    hasActions: boolean
    hasAdj: boolean
    hasMerge: boolean
    lines: readonly any[]
    merge: readonly any[]
    mergeNote: string
    prov: readonly any[]
    sub: string
    title: string
  }
  diagBadge: string
  diagOnboard: boolean
  diagReady: boolean
  diagTabs: readonly any[]
  diagToTable: (...args: any[]) => void
  diagUnbuilt: boolean
  diffLabel: string
  diffOpen: boolean
  diffRows: readonly any[]
  dispCards: readonly any[]
  dispModes: readonly any[]
  dispShown: boolean
  dowHead: readonly any[]
  downBody: string
  downTitle: string
  dtAct: boolean
  dtAd: boolean
  dtNew: boolean
  dtQuad: boolean
  emptyHint: string
  emptyTitle: string
  entities: readonly any[]
  errRows: readonly any[]
  exitReport: (...args: any[]) => void
  expCst: {
    on: boolean
    open: (...args: any[]) => void
    /** ★ 손 추가 ★ LOCK 8 — 목업 버튼에는 핸들러가 아예 없었다 (감사 A-2-2). `npm run convert -- --force` 금지 사유 하나. */
    xlsx: (...args: any[]) => void
    csv: (...args: any[]) => void
  }
  expHiddenBg: string
  expNote: string
  expOrd: {
    on: boolean
    open: (...args: any[]) => void
    /** ★ 손 추가 ★ LOCK 8 — 목업 버튼에는 핸들러가 아예 없었다 (감사 A-2-2). `npm run convert -- --force` 금지 사유 하나. */
    xlsx: (...args: any[]) => void
    csv: (...args: any[]) => void
  }
  expPrd: {
    on: boolean
    open: (...args: any[]) => void
    /** ★ 손 추가 ★ LOCK 8 — 목업 버튼에는 핸들러가 아예 없었다 (감사 A-2-2). `npm run convert -- --force` 금지 사유 하나. */
    xlsx: (...args: any[]) => void
    csv: (...args: any[]) => void
  }
  expScope: string
  expSet: {
    on: boolean
    open: (...args: any[]) => void
    /** ★ 손 추가 ★ LOCK 8 — 목업 버튼에는 핸들러가 아예 없었다 (감사 A-2-2). `npm run convert -- --force` 금지 사유 하나. */
    xlsx: (...args: any[]) => void
    csv: (...args: any[]) => void
  }
  expSyn: {
    on: boolean
    open: (...args: any[]) => void
    /** ★ 손 추가 ★ LOCK 8 — 목업 버튼에는 핸들러가 아예 없었다 (감사 A-2-2). `npm run convert -- --force` 금지 사유 하나. */
    xlsx: (...args: any[]) => void
    csv: (...args: any[]) => void
  }
  fetchUrl: (...args: any[]) => void
  filterChannels: readonly any[]
  filterOpen: boolean
  filterPills: readonly any[]
  firstRun: boolean
  firstRunLabel: string
  fixRows: readonly any[]
  fixTotal: string
  flagCount: string
  flags: readonly any[]
  fmBadge: string
  fmChannel: string
  fmCols: readonly any[]
  fmConfirmable: boolean
  fmDest: string
  fmDoc: string
  fmFieldOptions: readonly any[]
  fmList: readonly any[]
  fmSrc: string
  fmSummary: string
  fmTitle: string
  fmUpdate: boolean
  fmUpdateBody: string
  fmUpdateTitle: string
  fmWarn: boolean
  /** 배너 문장 (B2 — 손으로 더한 홀). 미확인 안내 또는 초안 저장 안내/거절 이유. */
  fmWarnText: string
  formula: readonly any[]
  freshness: readonly any[]
  genRows: readonly any[]
  go: {
    connect: (...args: any[]) => void
    costs: (...args: any[]) => void
    dash: (...args: any[]) => void
    design: (...args: any[]) => void
    diag: (...args: any[]) => void
    fieldmap: (...args: any[]) => void
    import: (...args: any[]) => void
    linking: (...args: any[]) => void
    myfields: (...args: any[]) => void
    orders: (...args: any[]) => void
    products: (...args: any[]) => void
    settings: (...args: any[]) => void
    settlement: (...args: any[]) => void
    sync: (...args: any[]) => void
  }
  goFieldmap: (...args: any[]) => void
  goImport: (...args: any[]) => void
  growthColor: string
  growthNote: string
  growthRoas: string
  growthRows: readonly any[]
  hasDetail: boolean
  hasFilters: boolean
  hasOrderFilter: boolean
  hasQuery: boolean
  hasRest: boolean
  headMoreItems: readonly any[]
  headMoreOpen: boolean
  heroBasis: string
  heroBasisGo: (...args: any[]) => void
  heroBg: string
  heroColor: string
  heroCompare: readonly any[]
  heroDelta: string
  heroIcon: string
  heroLabel: string
  heroNet: string
  heroRev: string
  /** §21 «cost-fixed-save» — 목업의 고정비 표가 못 하는 것들(적용일·항목 추가·저장·선언). */
  fixAdd: (...args: any[]) => void
  fixAddWhy: string
  fixCanAdd: boolean
  fixAddOpacity: string
  fixSaveOpacity: string
  fixCanSave: boolean
  fixDate: string
  /** 「이 기간 몫」의 분수. 달을 걸치면 빈 문자열 — 분수를 지어내지 않는다. */
  fixDays: string
  fixNewAmount: string
  fixNewName: string
  fixNone: boolean
  fixNoneBg: string
  fixNoneNote: string
  fixNoneReason: string
  fixSave: (...args: any[]) => void
  fixSaveWhy: string
  setFixDate: (...args: any[]) => void
  setFixNewAmount: (...args: any[]) => void
  setFixNewName: (...args: any[]) => void
  setFixNoneReason: (...args: any[]) => void
  toggleFixNone: (...args: any[]) => void
  /** ADR-019 B4 — 「일치한 시트 전부 넣기」 토글 상태. */
  impAllSheets: boolean
  /** 토글 옆 문장. ""면 토글 자체가 숨는다 (기준 경로 · 매칭 시트 복수일 때만). */
  impAllSheetsLabel: string
  /** 토글 클릭. */
  toggleImpAllSheets: (...args: any[]) => void
  impBig: boolean
  impBusy: boolean
  impCanRun: boolean
  impChannelName: string
  impDigest: readonly any[]
  impDigestTitle: string
  impDone: boolean
  impDupNote: string
  /** «매핑 수정» — 필드 매핑 화면으로 (B1). 목업부터 있던 버튼의 첫 일. */
  impEditMap: (...args: any[]) => void
  impError: string
  impExcludedLabel: string
  /**
   * §21 «shell-loading» — 첫 조회가 아직 안 끝났다. 손으로 더한 자리 (2026-08-21).
   * 이 값이 참인 동안 `firstRun`·`notFirstRun`이 **둘 다 거짓**이다.
   */
  appLoading: boolean
  /**
   * §21 «dash-partial-ack» — 제외 배너의 「확인하고 접기」 (2026-08-21 · 마이그레이션 012).
   * `partial`은 **배너**, `partialChip`은 **칩**이다 — 접어도 칩은 남는다.
   */
  partialAck: (...args: any[]) => void
  partialAckLabel: string
  partialChip: boolean
  partialChipLabel: string
  /**
   * §21 «history-rows» — 이 batch가 넣은 행 패널. 손으로 더한 자리 (2026-08-21).
   * **원본 파일이 아니라 앱이 해석한 Fact 행이다** — 원본은 저장되지 않는다.
   */
  rowsOpen: boolean
  rowsTitle: string
  rowsTabs: readonly any[]
  rowsCols: readonly any[]
  rowsBody: readonly any[]
  rowsNote: string
  rowsPages: readonly any[]
  rowsBusy: boolean
  /** §21 «import-grid» — 격자를 그릴 수 있나. 표본이 0행이면 거짓이다. */
  impGrid: boolean
  impGridCols: readonly ImportGridCol[]
  impGridNote: string
  impGridRows: readonly ImportGridRow[]
  impHasError: boolean
  impManySheets: boolean
  importCounts: readonly any[]
  impPick: (...args: any[]) => void
  /** §21 «import-reference» — 기준 데이터 프로파일일 때만 참. 적용일을 묻는다. */
  impRefer: boolean
  impReferDate: string
  impReferNote: string
  setImpReferDate: (...args: any[]) => void
  impReset: (...args: any[]) => void
  impRun: (...args: any[]) => void
  impRunLabel: string
  /** ADR-019 — 표지 시트를 건너뛰고 맞는 시트를 자동으로 열었을 때의 고지. ""면 숨김. */
  impSheetAutoNote: string
  impSheets: readonly any[]
  impSteps: readonly any[]
  isDraftTab: boolean
  isReport: boolean
  kpis: readonly any[]
  kpiTip: {
    foot: string
    head: string
    left: string
    rows: readonly any[]
    w: string
  } | null
  lastActions: readonly any[]
  lastDone: string
  lastImpact: string
  lastNote: string
  layerNote: string
  layerRows: readonly any[]
  licAction: string
  licActive: boolean
  licBg: string
  licChannels: string
  licColor: string
  licKey: string
  licLink: string
  licNote: string
  licPlan: string
  licRenew: string
  licState: string
  licTabs: readonly any[]
  linkBadge: string
  linkBulkNewSku: (...args: any[]) => void
  /** §21 «link-cost-pending» — 원가 대기 탭 (011 · D2). */
  linkCostDismissed: readonly any[]
  linkCostNote: string
  linkCostRows: readonly any[]
  linkTabCost: boolean
  linkEmpty: boolean
  linkEmptyMsg: string
  linkPickAll: (...args: any[]) => void
  linkPickAllLabel: string
  linkPicked: boolean
  linkPickedLabel: string
  linkRows: readonly any[]
  linkTabDone: boolean
  linkTabs: readonly any[]
  linkTabSkip: boolean
  linkTabTodo: boolean
  manChannel: string
  manChannels: readonly any[]
  manCols: readonly any[]
  manNote: string
  manRows: readonly any[]
  manScope: string
  manTargets: readonly any[]
  marketDown: boolean
  mixHiClip: string
  mixTip: {
    amount: string
    color: string
    label: string
    pct: string
    per: string
    x: string
    x2: string
  } | null
  modal: {
    desc: string
    fields: readonly any[]
    title: string
  }
  modalOpen: boolean
  monthCells: readonly any[]
  moversDown: readonly any[]
  moversUp: readonly any[]
  nav: {
    connect: string
    costs: string
    dash: string
    design: string
    diag: string
    fieldmap: string
    import: string
    linking: string
    myfields: string
    orders: string
    products: string
    settings: string
    settlement: string
    sync: string
  }
  navBorder: string
  navClosed: boolean
  navOpenAttr: string
  navPad: string
  navScrim: boolean
  navW: string
  netTrend: readonly any[]
  newProds: readonly any[]
  newViewName: string
  nextDis: string
  nextMonth: (...args: any[]) => void
  notFirstRun: boolean
  onboard: readonly any[]
  onCmdInput: (...args: any[]) => void
  onCmdKey: (...args: any[]) => void
  onPnlQuery: (...args: any[]) => void
  openCmd: (...args: any[]) => void
  openQuadFull: (...args: any[]) => void
  /** §21 «cost-ops-save» — 운영비 제어부. 손으로 더한 자리 (2026-08-21). */
  opsAdd: (...args: any[]) => void
  opsAddOpacity: string
  opsAddWhy: string
  /** 새 운영비의 부담 기준 — `ORDER`(주문당) · `UNIT`(개당). 고정비에는 없는 칸이다. */
  opsBasis: string
  opsBasisOptions: readonly { readonly value: string; readonly label: string }[]
  opsCanAdd: boolean
  opsCanSave: boolean
  opsDate: string
  opsNewAmount: string
  opsNewName: string
  opsNone: boolean
  opsNoneBg: string
  opsNoneNote: string
  opsNoneReason: string
  opsRows: readonly any[]
  opsSave: (...args: any[]) => void
  opsSaveOpacity: string
  opsSaveWhy: string
  opsTotal: string
  setOpsBasis: (...args: any[]) => void
  setOpsDate: (...args: any[]) => void
  setOpsNewAmount: (...args: any[]) => void
  setOpsNewName: (...args: any[]) => void
  setOpsNoneReason: (...args: any[]) => void
  toggleOpsNone: (...args: any[]) => void
  orderFilterLabel: string
  orderRows: readonly any[]
  orderScope: string
  ordersEmpty: boolean
  partial: boolean
  partialBody: string
  partialTitle: string
  pendingCount: string
  pipeline: readonly any[]
  pnlCaption: string
  pnlEmpty: boolean
  pnlQuery: string
  pnlRows: readonly any[]
  /**
   * ★ 손으로 더한 자리 — 월 선택기 (MVP 1, 2026-08-16) ★
   *
   * 목업에는 없다. 헤더 부제가 «2026년 8월»이라는 **박힌 문자열**이었고, 앱도
   * 기간을 상수로 들고 있어 8월 파일을 넣어도 7월만 보였다.
   *
   * `null`이면 그리지 않는다 — 기간이 실제로 걸리지 않는 화면(연결·기록·채널)에서
   * 선택기를 그리면 «여기서 달을 고를 수 있다»가 거짓이 된다.
   */
  periodPick: PeriodPick | null
  /** 보는 범위 — 묶음 전환 + 편집 (ADR-021 · 013). 늘 있다. */
  scope: ScopeBar
  presetItems: readonly any[]
  prevDis: string
  prevMonth: (...args: any[]) => void
  printLabel: string
  printReport: (...args: any[]) => void
  prodHint: string
  prodListTab: boolean
  prodReady: boolean
  prodTabs: readonly any[]
  prodUnbuilt: boolean
  profileMeta: string
  profileTabs: readonly any[]
  quadDots: readonly any[]
  quadFull: boolean
  quadGroups: readonly any[]
  quadHy: string
  quadLabels: readonly any[]
  quadTip: {
    name: string
    rows: readonly any[]
    x: string
    y: string
  } | null
  quadVx: string
  rangeLabel: string
  rangeOpen: boolean
  reportFoot: string
  reportLead: string
  reportLead2: string
  reportLead3: string
  reportMeta: readonly any[]
  resetRange: (...args: any[]) => void
  rest: {
    ad: string
    cogs: string
    disc: string
    fee: string
    margin: string
    name: string
    net: string
    qty: string
    rev: string
    ship: string
  }
  savedViews: readonly any[]
  saveView: (...args: any[]) => void
  scopeLine: string
  sectionGap: string
  sectionPad: string
  setAdjDraft: (...args: any[]) => void
  setAdjWhy: (...args: any[]) => void
  setCdCost: (...args: any[]) => void
  setCdFrom: (...args: any[]) => void
  setCdMemo: (...args: any[]) => void
  setConfirmType: (...args: any[]) => void
  setCostDraft: (...args: any[]) => void
  setEmpty: boolean
  setLicKey: (...args: any[]) => void
  setNewViewName: (...args: any[]) => void
  setRows: readonly any[]
  setSections: readonly any[]
  setSummary: string
  setTabs: readonly any[]
  setUrl: (...args: any[]) => void
  showAllProducts: (...args: any[]) => void
  /** §21 패치 — 비교(전월 대비) 문장이 존재할 조건. `snap.hasPriorPeriod`가 정한다. */
  hasCompare: boolean
  /** §21 패치 — 스파크라인·비교 줄이 빠지면서 KPI 카드 행 정의가 데이터를 따른다. */
  kpiRows: string
  showCal: boolean
  showCost: boolean
  showCoverage: boolean
  showFresh: boolean
  showHero: boolean
  showSide: boolean
  showToolbar: boolean
  skuRows: readonly any[]
  sortCols: readonly any[]
  sortNote: string
  srcManual: boolean
  srcMeta: string
  srcName: string
  srcSwap: string
  srcTabs: readonly any[]
  srcUrl: boolean
  srcWizard: boolean
  ssData: boolean
  ssGen: boolean
  ssLic: boolean
  stateTabs: readonly any[]
  stop: (...args: any[]) => void
  stopEvt: (...args: any[]) => void
  subtitle: string
  syncAll: (...args: any[]) => void
  syncColor: string
  syncLine: string
  syncRows: readonly any[]
  tabbar: readonly any[]
  themeIcon: string
  title: string
  toggleArchive: (...args: any[]) => void
  toggleAttn: (...args: any[]) => void
  toggleCalView: (...args: any[]) => void
  toggleDiff: (...args: any[]) => void
  toggleDisp: (...args: any[]) => void
  toggleExpHidden: (...args: any[]) => void
  toggleFilter: (...args: any[]) => void
  toggleFirstRun: (...args: any[]) => void
  toggleHeadMore: (...args: any[]) => void
  toggleNav: (...args: any[]) => void
  toggleRange: (...args: any[]) => void
  toggleTheme: (...args: any[]) => void
  toggleViews: (...args: any[]) => void
  tot: {
    ad: string
    cogs: string
    disc: string
    fee: string
    margin: string
    net: string
    qty: string
    rev: string
    ship: string
  }
  trendCols: readonly any[]
  trendTip: {
    head: string
    left: string
    rows: readonly any[]
  } | null
  unmappedCount: string
  urlBusy: boolean
  urlError: string
  urlImported: boolean
  urlValue: string
  v: {
    connect: boolean
    costs: boolean
    dash: boolean
    design: boolean
    diag: boolean
    fieldmap: boolean
    import: boolean
    linking: boolean
    myfields: boolean
    orders: boolean
    products: boolean
    settings: boolean
    settlement: boolean
    sync: boolean
  }
  viewDirty: string
  viewName: string
  viewSaveNote: string
  viewsOpen: boolean
  yearCells: readonly any[]
}

/** 데이터가 하나도 없을 때의 값. 빈 상태를 **정직하게** 그리기 위한 것이다. */
export function emptyVals(): TemplateVals {
  return {
    actions: [],
    adAlloc: "",
    adCount: "",
    addCf: () => {},
    // §21 신설 (settle-adj-guard) — 「조정 추가」를 못 누를 때 왜인지 (ADR-020 A5)
    adjAddOpacity: "0.45",
    adjBlockWhy: "",
    adjBlocked: true,
    adjDraft: "",
    adjPosLeft: "",
    adjPosTop: "",
    adjRows: [],
    adjWhy: "",
    adRoas: "",
    adRows: [],
    adTotal: "",
    adUnalloc: "",
    applyUpdate: () => {},
    appNavClass: "",
    archiveList: [],
    archiveOpen: false,
    askReset: () => {},
    attnFoot: "",
    attnItems: [],
    attnOpen: false,
    bridgeCaption: "",
    bridgeDown: {
      items: [],
      segs: [],
      total: "",
      width: "",
    },
    bridgeFrom: "",
    bridgeSentences: [],
    bridgeTitle: "",
    bridgeTo: "",
    bridgeUp: {
      items: [],
      segs: [],
      total: "",
      width: "",
    },
    cacAvg: "",
    cacBreakeven: "",
    cacColor: "",
    cacNote: "",
    cacRows: [],
    calCells: [],
    calDaysView: false,
    calendar: [],
    calHint: "",
    calMonthsView: false,
    calTitle: "",
    calViewIcon: "",
    calYearsView: false,
    cashByCh: [],
    cashDue: "",
    cashGap: "",
    cashNet: "",
    cashNote: "",
    cashPaid: "",
    catItems: [],
    cdCost: "",
    cdFrom: "",
    cdMemo: "",
    cfBadge: "",
    cfRows: [],
    cfSummary: "",
    chRows: [],
    clearImpChannel: () => {},
    clearOrderFilter: () => {},
    clearPnlFilter: () => {},
    clearQuery: () => {},
    closeCmd: () => {},
    closeConfirm: () => {},
    closeDetail: () => {},
    closeDisp: () => {},
    closeMenus: () => {},
    closeModal: () => {},
    closeNav: () => {},
    closeQuadFull: () => {},
    cmdEmpty: false,
    cmdItems: [],
    cmdOpen: false,
    cmdQuery: "",
    colRows: [],
    comparisons: [],
    confirm: null,
    confirmFm: () => {},
    confirmType: "",
    connBadge: "",
    conns: [],
    contribColor: "",
    contribMargin: "",
    costChanges: "",
    costDonut: "",
    // 데이터가 없으면 도넛도 막대도 그릴 게 없다. 판정은 배선이 채운다.
    costDonutOk: false,
    costDraft: "",
    costGauge: { color: "", costed: 0, note: "", pctWidth: "0%", text: "", total: 0 },
    costMissColor: "",
    costMissing: "",
    costMix: [],
    costRows: [],
    costTabs: [],
    costTotal: "",
    creds: [],
    ctAd: false,
    ctCogs: false,
    ctOps: false,
    dayTip: null,
    detail: {
      actions: [],
      adj: [],
      hasActions: false,
      hasAdj: false,
      hasMerge: false,
      lines: [],
      merge: [],
      mergeNote: "",
      prov: [],
      sub: "",
      title: "",
    },
    diagBadge: "",
    diagOnboard: false,
    diagReady: false,
    diagTabs: [],
    diagToTable: () => {},
    diagUnbuilt: true,
    diffLabel: "",
    diffOpen: false,
    diffRows: [],
    dispCards: [],
    dispModes: [],
    dispShown: false,
    dowHead: [],
    downBody: "",
    downTitle: "",
    dtAct: false,
    dtAd: false,
    dtNew: false,
    dtQuad: false,
    emptyHint: "",
    emptyTitle: "",
    entities: [],
    errRows: [],
    exitReport: () => {},
    expCst: {
      on: false,
      open: () => {},
      xlsx: () => {},
      csv: () => {},
    },
    expHiddenBg: "",
    expNote: "",
    expOrd: {
      on: false,
      open: () => {},
      xlsx: () => {},
      csv: () => {},
    },
    expPrd: {
      on: false,
      open: () => {},
      xlsx: () => {},
      csv: () => {},
    },
    expScope: "",
    expSet: {
      on: false,
      open: () => {},
      xlsx: () => {},
      csv: () => {},
    },
    expSyn: {
      on: false,
      open: () => {},
      xlsx: () => {},
      csv: () => {},
    },
    fetchUrl: () => {},
    filterChannels: [],
    filterOpen: false,
    filterPills: [],
    firstRun: false,
    firstRunLabel: "",
    fixRows: [],
    fixTotal: "",
    flagCount: "",
    flags: [],
    fmBadge: "",
    fmChannel: "",
    fmCols: [],
    fmConfirmable: false,
    fmDest: "",
    fmDoc: "",
    fmFieldOptions: [],
    fmList: [],
    fmSrc: "",
    fmSummary: "",
    fmTitle: "",
    fmUpdate: false,
    fmUpdateBody: "",
    fmUpdateTitle: "",
    fmWarn: false,
    fmWarnText: "",
    formula: [],
    freshness: [],
    genRows: [],
    go: {
      connect: () => {},
      costs: () => {},
      dash: () => {},
      design: () => {},
      diag: () => {},
      fieldmap: () => {},
      import: () => {},
      linking: () => {},
      myfields: () => {},
      orders: () => {},
      products: () => {},
      settings: () => {},
      settlement: () => {},
      sync: () => {},
    },
    goFieldmap: () => {},
    goImport: () => {},
    growthColor: "",
    growthNote: "",
    growthRoas: "",
    growthRows: [],
    hasDetail: false,
    hasFilters: false,
    hasOrderFilter: false,
    hasQuery: false,
    hasRest: false,
    headMoreItems: [],
    headMoreOpen: false,
    heroBasis: "",
    heroBasisGo: () => {},
    heroBg: "",
    heroColor: "",
    heroCompare: [],
    heroDelta: "",
    heroIcon: "",
    heroLabel: "",
    heroNet: "",
    heroRev: "",
    fixAdd: () => {},
    fixAddWhy: "",
    fixCanAdd: false,
    fixAddOpacity: "",
    fixSaveOpacity: "",
    fixCanSave: false,
    fixDate: "",
    fixDays: "",
    fixNewAmount: "",
    fixNewName: "",
    fixNone: false,
    fixNoneBg: "",
    fixNoneNote: "",
    fixNoneReason: "",
    fixSave: () => {},
    fixSaveWhy: "",
    setFixDate: () => {},
    setFixNewAmount: () => {},
    setFixNewName: () => {},
    setFixNoneReason: () => {},
    toggleFixNone: () => {},
    impAllSheets: false,
    impAllSheetsLabel: "",
    toggleImpAllSheets: () => {},
    impBig: false,
    impBusy: false,
    impCanRun: false,
    impChannelName: "",
    impDigest: [],
    impDigestTitle: "",
    impDone: false,
    impDupNote: "",
    impEditMap: () => {},
    impError: "",
    appLoading: true,
    partialAck: () => {},
    partialAckLabel: "",
    partialChip: false,
    partialChipLabel: "",
    rowsOpen: false,
    rowsTitle: "",
    rowsTabs: [],
    rowsCols: [],
    rowsBody: [],
    rowsNote: "",
    rowsPages: [],
    rowsBusy: false,
    impExcludedLabel: "",
    impGrid: false,
    impGridCols: [],
    impGridNote: "",
    impGridRows: [],
    impHasError: false,
    impManySheets: false,
    importCounts: [],
    impPick: () => {},
    impRefer: false,
    impReferDate: "",
    impReferNote: "",
    setImpReferDate: () => {},
    impReset: () => {},
    impRun: () => {},
    impRunLabel: "",
    impSheetAutoNote: "",
    impSheets: [],
    impSteps: [],
    isDraftTab: false,
    isReport: false,
    kpis: [],
    kpiTip: null,
    lastActions: [],
    lastDone: "",
    lastImpact: "",
    lastNote: "",
    layerNote: "",
    layerRows: [],
    licAction: "",
    licActive: false,
    licBg: "",
    licChannels: "",
    licColor: "",
    licKey: "",
    licLink: "",
    licNote: "",
    licPlan: "",
    licRenew: "",
    licState: "",
    licTabs: [],
    linkBadge: "",
    linkBulkNewSku: () => {},
    linkCostDismissed: [],
    linkCostNote: "",
    linkCostRows: [],
    linkTabCost: false,
    linkEmpty: false,
    linkEmptyMsg: "",
    linkPickAll: () => {},
    linkPickAllLabel: "",
    linkPicked: false,
    linkPickedLabel: "",
    linkRows: [],
    linkTabDone: false,
    linkTabs: [],
    linkTabSkip: false,
    linkTabTodo: false,
    manChannel: "",
    manChannels: [],
    manCols: [],
    manNote: "",
    manRows: [],
    manScope: "",
    manTargets: [],
    marketDown: false,
    mixHiClip: "",
    mixTip: null,
    modal: {
      desc: "",
      fields: [],
      title: "",
    },
    modalOpen: false,
    monthCells: [],
    moversDown: [],
    moversUp: [],
    nav: {
      connect: "",
      costs: "",
      dash: "",
      design: "",
      diag: "",
      fieldmap: "",
      import: "",
      linking: "",
      myfields: "",
      orders: "",
      products: "",
      settings: "",
      settlement: "",
      sync: "",
    },
    navBorder: "",
    navClosed: false,
    navOpenAttr: "",
    navPad: "",
    navScrim: false,
    navW: "",
    netTrend: [],
    newProds: [],
    newViewName: "",
    nextDis: "",
    nextMonth: () => {},
    notFirstRun: false,
    onboard: [],
    onCmdInput: () => {},
    onCmdKey: () => {},
    onPnlQuery: () => {},
    openCmd: () => {},
    openQuadFull: () => {},
    opsAdd: () => {},
    opsAddOpacity: "",
    opsAddWhy: "",
    opsBasis: "",
    opsBasisOptions: [],
    opsCanAdd: false,
    opsCanSave: false,
    opsDate: "",
    opsNewAmount: "",
    opsNewName: "",
    opsNone: false,
    opsNoneBg: "",
    opsNoneNote: "",
    opsNoneReason: "",
    opsRows: [],
    opsSave: () => {},
    opsSaveOpacity: "",
    opsSaveWhy: "",
    opsTotal: "",
    setOpsBasis: () => {},
    setOpsDate: () => {},
    setOpsNewAmount: () => {},
    setOpsNewName: () => {},
    setOpsNoneReason: () => {},
    toggleOpsNone: () => {},
    orderFilterLabel: "",
    orderRows: [],
    orderScope: "",
    ordersEmpty: false,
    partial: false,
    partialBody: "",
    partialTitle: "",
    pendingCount: "",
    pipeline: [],
    pnlCaption: "",
    pnlEmpty: false,
    pnlQuery: "",
    pnlRows: [],
    // 데이터가 하나도 없으면 고를 달도 없다. 빈 목록이 아니라 **선택기 자체가 없다**.
    periodPick: null,
    scope: {
      label: "전체",
      summary: "",
      excluded: "",
      bundles: [],
      fresh: null,
      openNew: () => {},
      openEdit: null,
      edit: null,
    },
    presetItems: [],
    prevDis: "",
    prevMonth: () => {},
    printLabel: "",
    printReport: () => {},
    prodHint: "",
    prodListTab: false,
    prodReady: false,
    prodTabs: [],
    prodUnbuilt: true,
    profileMeta: "",
    profileTabs: [],
    quadDots: [],
    quadFull: false,
    quadGroups: [],
    quadHy: "",
    quadLabels: [],
    quadTip: null,
    quadVx: "",
    rangeLabel: "",
    rangeOpen: false,
    reportFoot: "",
    reportLead: "",
    reportLead2: "",
    reportLead3: "",
    reportMeta: [],
    resetRange: () => {},
    rest: {
      ad: "",
      cogs: "",
      disc: "",
      fee: "",
      margin: "",
      name: "",
      net: "",
      qty: "",
      rev: "",
      ship: "",
    },
    savedViews: [],
    saveView: () => {},
    scopeLine: "",
    sectionGap: "",
    sectionPad: "",
    setAdjDraft: () => {},
    setAdjWhy: () => {},
    setCdCost: () => {},
    setCdFrom: () => {},
    setCdMemo: () => {},
    setConfirmType: () => {},
    setCostDraft: () => {},
    setEmpty: false,
    setLicKey: () => {},
    setNewViewName: () => {},
    setRows: [],
    setSections: [],
    setSummary: "",
    setTabs: [],
    setUrl: () => {},
    showAllProducts: () => {},
    // 데이터가 없으면 비교도 없다 — 빈 화면에서 "전월 대비"가 뜨지 않는다
    hasCompare: false,
    kpiRows: "",
    showCal: false,
    showCost: false,
    showCoverage: false,
    showFresh: false,
    showHero: false,
    showSide: false,
    showToolbar: false,
    skuRows: [],
    sortCols: [],
    sortNote: "",
    srcManual: false,
    srcMeta: "",
    srcName: "",
    srcSwap: "",
    srcTabs: [],
    srcUrl: false,
    srcWizard: false,
    ssData: false,
    ssGen: false,
    ssLic: false,
    stateTabs: [],
    stop: () => {},
    stopEvt: () => {},
    subtitle: "",
    syncAll: () => {},
    syncColor: "",
    syncLine: "",
    syncRows: [],
    tabbar: [],
    themeIcon: "",
    title: "",
    toggleArchive: () => {},
    toggleAttn: () => {},
    toggleCalView: () => {},
    toggleDiff: () => {},
    toggleDisp: () => {},
    toggleExpHidden: () => {},
    toggleFilter: () => {},
    toggleFirstRun: () => {},
    toggleHeadMore: () => {},
    toggleNav: () => {},
    toggleRange: () => {},
    toggleTheme: () => {},
    toggleViews: () => {},
    tot: {
      ad: "",
      cogs: "",
      disc: "",
      fee: "",
      margin: "",
      net: "",
      qty: "",
      rev: "",
      ship: "",
    },
    trendCols: [],
    trendTip: null,
    unmappedCount: "",
    urlBusy: false,
    urlError: "",
    urlImported: false,
    urlValue: "",
    v: {
      connect: false,
      costs: false,
      dash: false,
      design: false,
      diag: false,
      fieldmap: false,
      import: false,
      linking: false,
      myfields: false,
      orders: false,
      products: false,
      settings: false,
      settlement: false,
      sync: false,
    },
    viewDirty: "",
    viewName: "",
    viewSaveNote: "",
    viewsOpen: false,
    yearCells: [],
  }
}

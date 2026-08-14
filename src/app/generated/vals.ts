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

export interface TemplateVals {
  actions: readonly any[]
  adAlloc: string
  adCount: string
  addCf: (...args: any[]) => void
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
  }
  expHiddenBg: string
  expNote: string
  expOrd: {
    on: boolean
    open: (...args: any[]) => void
  }
  expPrd: {
    on: boolean
    open: (...args: any[]) => void
  }
  expScope: string
  expSet: {
    on: boolean
    open: (...args: any[]) => void
  }
  expSyn: {
    on: boolean
    open: (...args: any[]) => void
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
  impBig: boolean
  impBusy: boolean
  impCanRun: boolean
  impChannelName: string
  impDigest: readonly any[]
  impDigestTitle: string
  impDone: boolean
  impDupNote: string
  impError: string
  impExcludedLabel: string
  impHasError: boolean
  impManySheets: boolean
  importCounts: readonly any[]
  impPick: (...args: any[]) => void
  impReset: (...args: any[]) => void
  impRun: (...args: any[]) => void
  impRunLabel: string
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
  opsRows: readonly any[]
  opsTotal: string
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
    },
    expHiddenBg: "",
    expNote: "",
    expOrd: {
      on: false,
      open: () => {},
    },
    expPrd: {
      on: false,
      open: () => {},
    },
    expScope: "",
    expSet: {
      on: false,
      open: () => {},
    },
    expSyn: {
      on: false,
      open: () => {},
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
    impBig: false,
    impBusy: false,
    impCanRun: false,
    impChannelName: "",
    impDigest: [],
    impDigestTitle: "",
    impDone: false,
    impDupNote: "",
    impError: "",
    impExcludedLabel: "",
    impHasError: false,
    impManySheets: false,
    importCounts: [],
    impPick: () => {},
    impReset: () => {},
    impRun: () => {},
    impRunLabel: "",
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
    opsRows: [],
    opsTotal: "",
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

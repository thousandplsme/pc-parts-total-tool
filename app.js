"use strict";

const TYPES = ["CPU", "GPU", "RAM", "マザーボード", "SSD", "HDD", "電源", "ケース", "クーラー", "OS", "その他"];
const CATEGORY_ALIASES = new Map([
  ["GPU", "GPU"], ["グラボ", "GPU"], ["グラフィックボード", "GPU"],
  ["CPU", "CPU"], ["プロセッサ", "CPU"], ["RAM", "RAM"], ["メモリ", "RAM"],
  ["マザーボード", "マザーボード"], ["マザボ", "マザーボード"], ["MB", "マザーボード"],
  ["SSD", "SSD"], ["HDD", "HDD"], ["電源", "電源"], ["PSU", "電源"],
  ["ケース", "ケース"], ["クーラー", "クーラー"], ["OS", "OS"], ["その他", "その他"]
]);
const VIEWING_POINTS = {
  GPU: "型番の世代とグレード、VRAM容量を確認。検索結果には「単体」と「搭載PC」が混ざるので、価格は単体のものだけを採用する",
  CPU: "Intel／AMD、世代、末尾の文字（K＝オーバークロック可、F＝内蔵GPUなし）を確認",
  RAM: "DDRの世代（4か5）、容量、枚数を確認。デスクトップ用とノート用は別物",
  マザーボード: "対応ソケットとチップセット、サイズ（ATX／microATX等）を確認",
  SSD: "NVMeかSATAか、容量を確認。健康状態は別途ツールで確認する",
  HDD: "容量と使用時間を確認。使用時間が長いものは価格が付きにくい",
  電源: "容量（W数）と80PLUS認証の有無を確認",
  ケース: "サイズと、側面パネル等の付属品が揃っているかを確認",
  クーラー: "対応ソケットと、付属品（取り付け金具）が揃っているかを確認",
  OS: "エディション（Home／Pro）とライセンスの有無を確認",
  その他: "型番が正確に控えられているかを最初に確認する"
};
const STATES = ["不明", "動作品", "ジャンク"];
const SITES = [
  ["オークフリー", q => `https://aucfree.com/search?o=t2&q=${q}`],
  ["パソコン工房", q => `https://www.pc-koubou.jp/user_data/search.php?q=${q}`],
  ["ドスパラ", q => `https://www.dospara.co.jp/used?q=${q}&lang=ja_JP&includeNotInventory=true`],
  ["じゃんぱら", q => `https://www.janpara.co.jp/sale/search/result/?KEYWORDS=${q}`],
  ["ソフマップ", q => `https://www.sofmap.com/product_list_parts.aspx?product_type=USED&keyword=${q}`],
  ["メルカリ", q => `https://jp.mercari.com/search?keyword=${q}`]
];
// 将来の書き出しにも使える、パーツごとの素直な配列。未入力の価格は null。
const parts = [];
const rows = document.querySelector("#rows");
const kake = document.querySelector("#kake");
const memo = document.querySelector("#memo");
const yen = value => value.toLocaleString("ja-JP");
const normalize = value => value.trim().replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/．/g, ".").replace(/，/g, ",");

function parsePrice(raw) {
  const text = normalize(raw);
  if (!text) return { value: null, error: "" };
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) return { value: null, error: "0以上の整数（円）を入力してください。" };
  const value = Number(text.replaceAll(",", ""));
  if (!Number.isSafeInteger(value)) return { value: null, error: "金額が大きすぎます。" };
  return { value, error: "" };
}

function getKake() {
  const text = normalize(kake.value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const [integer, decimal = ""] = text.split(".");
  const whole = BigInt(integer).toString();
  const fraction = decimal.replace(/0+$/, "");
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole + fraction);
  if (numerator > 10n * scale) return null;
  const amount = whole + (fraction ? `.${fraction}` : "");
  const percentWhole = BigInt(whole) * 10n + BigInt(fraction[0] || "0");
  const percent = String(percentWhole) + (fraction.length > 1 ? `.${fraction.slice(1)}` : "");
  return { numerator, denominator: scale * 10n, label: `${amount}掛け（売価の${percent}%）` };
}

function update() {
  const elements = [...rows.children];
  let sum = 0n;
  let missing = 0;
  let invalid = false;
  const lines = parts.map((part, index) => {
    const input = elements[index].querySelector(".price");
    const result = parsePrice(input.value);
    part.price = result.value;
    input.setAttribute("aria-invalid", String(Boolean(result.error)));
    elements[index].querySelector(".price-error").textContent = result.error;
    if (result.error) invalid = true;
    else if (part.price === null) missing++;
    else sum += BigInt(part.price);
    const model = part.model.trim().replace(/[\r\n\t]/g, " ") || "（型番未入力）";
    const price = result.error ? "入力エラー" : part.price === null ? "未入力" : `${yen(part.price)}円`;
    return `${index + 1}. ${part.type} / ${model} / ${part.state} / 採用価格：${price}`;
  });
  const rate = getKake();
  kake.setAttribute("aria-invalid", String(rate === null));
  document.querySelector("#kake-error").textContent = rate === null ? "0〜10の数値を入力してください（小数可）。" : "";
  const rateLabel = rate === null ? "掛け：入力エラー" : rate.label;
  document.querySelectorAll(".kake-description").forEach(element => { element.textContent = rateLabel; });
  // 整数計算で、円未満の四捨五入と大きな合計金額の精度を保つ。
  const estimate = !invalid && rate !== null ? (sum * rate.numerator + rate.denominator / 2n) / rate.denominator : null;
  document.querySelector("#sum").textContent = invalid ? "計算不可" : yen(sum);
  document.querySelector("#estimate").textContent = estimate === null ? "計算不可" : yen(estimate);
  document.querySelector("#sticky-sum").textContent = document.querySelector("#sum").textContent;
  document.querySelector("#sticky-estimate").textContent = document.querySelector("#estimate").textContent;
  const status = `全${parts.length}行・価格未入力${missing}行${invalid ? "・価格の入力エラーがあります" : "（未入力は合算対象外）"}`;
  document.querySelector("#price-status").textContent = status;
  document.querySelector("#empty").hidden = parts.length !== 0;
  memo.value = ["自作PC買取 査定メモ", ...lines, "", status,
    `売価合算：${invalid ? "計算不可（価格を修正してください）" : `${yen(sum)}円`}`,
    `掛け：${rate === null ? "入力エラー" : rate.label}`,
    `買取目安（参考値）：${estimate === null ? "計算不可" : `${yen(estimate)}円`}`,
    "※目安は売価合算×（掛け÷10）、1円未満を四捨五入。",
    "※合算は売価の合計であり、査定額そのものではありません。最終判断は人が行います。"
  ].join("\n");
  document.querySelector("#print-memo").textContent = memo.value;
  document.querySelector("#copy-status").textContent = "";
}

function refreshLinks(element, model) {
  const container = element.querySelector(".links");
  const expanded = container.querySelector("details")?.open || false;
  container.replaceChildren();
  element.querySelector(".open-major").disabled = !model.trim();
  element.querySelector(".open-all").disabled = !model.trim();
  if (!model.trim()) {
    const hint = document.createElement("span");
    hint.textContent = "型番を入力すると、各サイトの検索リンクが表示されます。";
    container.append(hint);
    return;
  }
  const primaryLinks = document.createElement("div");
  primaryLinks.className = "primary-links";
  const otherSites = document.createElement("details");
  otherSites.open = expanded;
  const summary = document.createElement("summary");
  summary.textContent = "他のサイト";
  const otherLinks = document.createElement("div");
  otherLinks.className = "other-links";
  otherSites.append(summary, otherLinks);
  for (const [index, [name, searchUrl]] of SITES.entries()) {
    const link = document.createElement("a");
    link.textContent = name;
    link.href = searchUrl(encodeURIComponent(model.trim()));
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${name}で「${model.trim()}」を検索（別タブ）`);
    (index < 3 ? primaryLinks : otherLinks).append(link);
  }
  container.append(primaryLinks, otherSites);
}

function suggestCategory(model) {
  const text = model.normalize("NFKC");
  if (/RTX|GTX|RX\s*[765]|Radeon|GeForce/i.test(text)) return { type: "GPU" };
  if (/Core\s*i|Ryzen|Athlon|Celeron|Pentium/i.test(text)) return { type: "CPU" };
  if (/DDR\s*[345]/i.test(text)) return { type: "RAM" };
  const hasCapacity = /\d+(?:\.\d+)?\s*(?:TB|GB)\b/i.test(text);
  if (hasCapacity && /NVMe|M\.2|SATA\s*SSD|SSD/i.test(text)) return { type: "SSD" };
  if (hasCapacity && /HDD|WD|Seagate|BarraCuda/i.test(text)) return { type: "HDD" };
  if (/80\s*PLUS|\b[1-9]\d{2,3}\s*W\b/i.test(text)) return { type: "電源", weak: true };
  return null;
}

function refreshCategoryHint(element, part) {
  const hint = element.querySelector(".category-hint");
  const modelSearch = element.querySelector(".model-search");
  hint.replaceChildren();
  modelSearch.replaceChildren();
  if (!["その他", "不明"].includes(part.type) || !part.model.trim()) return;
  const candidate = suggestCategory(part.model);
  if (candidate) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `候補：${candidate.type}を採用${candidate.weak ? "（弱い候補）" : ""}`;
    button.addEventListener("click", () => {
      const select = element.querySelector(".type");
      select.value = candidate.type;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      select.focus();
    });
    hint.append(button);
  } else {
    const link = document.createElement("a");
    link.textContent = "この型番を調べる";
    link.href = `https://www.google.com/search?q=${encodeURIComponent(part.model.trim())}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    modelSearch.append(link);
  }
}

let nextId = 0;
function addPart(type = "その他", focus = true, model = "") {
  const part = { type, model, state: "不明", price: null };
  const id = `part-${++nextId}`;
  const element = document.createElement("div");
  element.className = "part";
  // 固定のUIだけをHTMLで構築。入力値はvalue/textContentに設定する。
  element.innerHTML = `<div class="fields">
    <div class="field-type"><label for="${id}-type">種別</label><select id="${id}-type" class="type"></select></div>
    <div class="field-model"><label for="${id}-model">型番・仕様</label><input id="${id}-model" class="model" type="text" autocomplete="off" spellcheck="false" placeholder="例：Core i7-12700 / RTX 3060"><div class="category-hint"></div></div>
    <div class="field-price"><label for="${id}-price">採用価格（円）</label><input id="${id}-price" class="price" type="text" inputmode="numeric" autocomplete="off" placeholder="未入力" aria-describedby="${id}-error"><p id="${id}-error" class="price-error error"></p></div>
    <div class="field-next"><button type="button" class="open-major" disabled>次のサイトを開く</button><span class="site-progress" role="status">0/3 まだ開いていません</span></div>
    </div>
    <details class="row-details"><summary>詳細を開く</summary>
      <div class="detail-controls"><div class="field-state"><label for="${id}-state">状態</label><select id="${id}-state" class="state"></select></div><button type="button" class="delete">削除</button></div>
      <details class="viewing-points"><summary>見るポイント</summary><p></p></details>
      <div class="model-search"></div>
      <div class="search-controls"><button type="button" class="open-all" disabled aria-describedby="${id}-popup-note">主要3サイトを一括で開く</button><p class="hint popup-note" id="${id}-popup-note">一括オープンはブラウザのポップアップ許可が必要です。開かない場合は『次のサイトを開く』を使ってください</p><div class="links"></div></div>
    </details>
    <p class="popup-warning hint" role="status" hidden></p>`;
  let nextSite = 0;
  const popupWarning = element.querySelector(".popup-warning");
  element.querySelector(".open-all").addEventListener("click", () => {
    const model = part.model.trim();
    if (!model) return;
    let opened = 0;
    for (const [, searchUrl] of SITES.slice(0, 3)) {
      const tab = window.open("about:blank", "_blank");
      if (!tab || tab.closed) continue;
      // 外部ページへ移動する前に、元ページへの参照とリファラーを遮断する。
      tab.opener = null;
      const referrer = tab.document.createElement("meta");
      referrer.name = "referrer";
      referrer.content = "no-referrer";
      tab.document.head.append(referrer);
      tab.location.replace(searchUrl(encodeURIComponent(model)));
      opened++;
    }
    element.querySelector(".site-progress").textContent = `${opened}/3 一括で開きました`;
    popupWarning.hidden = opened === 3;
    popupWarning.textContent = opened === 3 ? "" : "ポップアップがブロックされました。Chromeではアドレスバーの右端に表示されるアイコンから、このサイトのポップアップを許可してください。許可できない場合は『次のサイトを開く』を使ってください";
    nextSite = 0;
  });
  element.querySelector(".open-major").addEventListener("click", () => {
    const model = part.model.trim();
    if (!model) return;
    // 1クリックにつき1タブだけを同期して開く。
    const [name, searchUrl] = SITES[nextSite];
    window.open(searchUrl(encodeURIComponent(model)), "_blank", "noopener,noreferrer");
    element.querySelector(".site-progress").textContent = nextSite === 2
      ? "3サイトとも開いた" : `${nextSite + 1}/3 ${name}まで開いた`;
    nextSite = (nextSite + 1) % 3;
  });
  for (const [selector, values, selected] of [[".type", TYPES, type], [".state", STATES, "不明"]]) {
    const select = element.querySelector(selector);
    values.forEach(value => select.add(new Option(value, value)));
    select.value = selected;
  }
  element.querySelector(".model").value = model;
  element.querySelector(".viewing-points p").textContent = VIEWING_POINTS[type];
  element.querySelector(".type").addEventListener("change", event => {
    part.type = event.target.value;
    element.querySelector(".viewing-points p").textContent = VIEWING_POINTS[part.type];
    refreshCategoryHint(element, part);
    update();
  });
  element.querySelector(".state").addEventListener("change", event => { part.state = event.target.value; update(); });
  element.querySelector(".model").addEventListener("input", event => {
    part.model = event.target.value;
    nextSite = 0;
    popupWarning.hidden = true;
    popupWarning.textContent = "";
    element.querySelector(".site-progress").textContent = "0/3 まだ開いていません";
    refreshLinks(element, part.model);
    refreshCategoryHint(element, part);
    update();
  });
  const price = element.querySelector(".price");
  price.addEventListener("input", update);
  price.addEventListener("blur", () => {
    const result = parsePrice(price.value);
    if (!result.error && result.value !== null) price.value = String(result.value);
    update();
  });
  element.querySelector(".delete").addEventListener("click", () => {
    const index = parts.indexOf(part);
    parts.splice(index, 1);
    element.remove();
    update();
    (rows.children[index] || rows.children[index - 1])?.querySelector(".type").focus();
    if (!parts.length) document.querySelector("#add").focus();
  });
  parts.push(part);
  rows.append(element);
  refreshLinks(element, model);
  refreshCategoryHint(element, part);
  update();
  if (focus) element.querySelector(".type").focus();
}

TYPES.slice(0, 8).forEach(type => addPart(type, false));
document.querySelector("#add").addEventListener("click", () => addPart());
const importText = document.querySelector("#import-text");
const importStatus = document.querySelector("#import-status");
document.querySelector("#reset-import-template").addEventListener("click", () => {
  importText.value = importText.defaultValue;
  importStatus.textContent = "";
});
function importParts() {
  const before = parts.length;
  const lines = importText.value.split(/\r\n|[\r\n]/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^([^:：]*)[:：](.*)$/);
    const model = match?.[2].trim();
    if (match && !model) continue;
    const type = match && CATEGORY_ALIASES.get(match[1].trim().toUpperCase());
    // 未知のカテゴリやコロンのない行は、元の行全体を「その他」に残す。
    if (type) addPart(type, false, model);
    else addPart("その他", false, line);
  }
  const importedCount = parts.length - before;
  importStatus.textContent = importedCount
    ? `${importedCount}行取り込みました（既存行の末尾に追加）。`
    : "取り込む行がありません（空行は除外します）。";
  return importedCount;
}

document.querySelector("#import-parts").addEventListener("click", () => {
  const firstNewIndex = parts.length;
  const importedCount = importParts();
  if (importedCount) {
    document.querySelector("#parts-import-status").textContent = importStatus.textContent;
    selectMode(document.querySelector("#tab-parts"), { scrollToTop: false });
    const firstModel = rows.children[firstNewIndex].querySelector(".model");
    firstModel.scrollIntoView?.({ block: "center" });
    firstModel.focus({ preventScroll: true });
  }
});

function showMode(mode, { scrollToTop = true } = {}) {
  document.querySelectorAll(".mode-panel").forEach(panel => { panel.hidden = panel.id !== `panel-${mode}`; });
  const showTotals = ["parts", "import"].includes(mode);
  totalsBar.hidden = !showTotals;
  document.body.classList.toggle("has-fixed-totals", showTotals);
  if (mode === "compatibility") document.querySelector(".compatibility-section").open = true;
  if (mode === "help") document.querySelector("#guide-desktop details").open = true;
  if (scrollToTop) window.scrollTo(0, 0);
}

const totalsBar = document.querySelector(".sticky-summary");
if (typeof ResizeObserver === "function") {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--totals-height", `${totalsBar.offsetHeight}px`);
  }).observe(totalsBar);
}

function wireTabs(selector, onSelect) {
  const tabs = [...document.querySelectorAll(`${selector} [role="tab"]`)];
  function select(tab, options) {
    for (const item of tabs) {
      item.setAttribute("aria-selected", String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    }
    onSelect(tab, options);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", event => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(tabs[next]);
      tabs[next].focus({ preventScroll: true });
    });
  });
  return select;
}

const selectMode = wireTabs(".mode-tabs", (tab, options) => showMode(tab.dataset.mode, options));
wireTabs(".guide-tabs", tab => {
  document.querySelectorAll('#panel-help [role="tabpanel"]').forEach(panel => {
    panel.hidden = panel.id !== tab.getAttribute("aria-controls");
  });
  document.querySelector(`#${tab.getAttribute("aria-controls")} details`)?.setAttribute("open", "");
});
document.addEventListener("keydown", event => {
  if ((!normalMain.hidden || (!guidedFlow.hidden && guideStep === 2 && guideList)) &&
      (event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.isComposing && !event.repeat) {
    event.preventDefault();
    addPart();
  }
});

const entry = document.querySelector("#guide-start");
const guidedFlow = document.querySelector("#guided-flow");
const normalMain = document.querySelector("#normal-main");
const guideContent = document.querySelector("#guide-content");
const guideTitle = document.querySelector("#guide-step-title");
const importPanel = document.querySelector("#panel-import");
const partsPanel = document.querySelector("#panel-parts");
const importSection = importPanel.querySelector(".import-section");
const workspace = partsPanel.querySelector(".workspace");
const summary = partsPanel.querySelector(".summary");
const memoSection = partsPanel.querySelector(".memo-section");
const priceStatus = document.querySelector("#guide-price-status");
const switchView = document.createElement("button");
switchView.type = "button";
switchView.className = "guide-view-switch";
const currentPart = document.createElement("div");
currentPart.className = "guide-current";
let guideStep = 0;
let guideList = false;
let activeRow = null;
const eligibleRows = () => [...rows.children].filter(row =>
  row.querySelector(".model").value.trim() || row.querySelector(".price").value.trim());

function restoreNormalSections() {
  importPanel.append(importSection);
  partsPanel.append(workspace, summary, memoSection);
  workspace.classList.remove("guide-single");
  for (const row of rows.children) row.hidden = false;
  switchView.remove();
  currentPart.remove();
}

function openNormal(returnToParts = false) {
  restoreNormalSections();
  entry.hidden = guidedFlow.hidden = true;
  normalMain.hidden = document.querySelector(".top-bars").hidden = false;
  const tab = returnToParts ? document.querySelector("#tab-parts")
    : document.querySelector('.mode-tabs [aria-selected="true"]');
  selectMode(tab);
  tab.focus({ preventScroll: true });
}

function showGuide(step, { focus = true } = {}) {
  guideStep = step;
  restoreNormalSections();
  normalMain.hidden = document.querySelector(".top-bars").hidden = true;
  totalsBar.hidden = true;
  document.body.classList.remove("has-fixed-totals");
  entry.hidden = step !== 0;
  guidedFlow.hidden = step === 0;
  const copyInResult = step === 3;
  guidedFlow.classList.toggle("guide-result", copyInResult);
  document.querySelector("#guide-to-normal").hidden = copyInResult;
  document.querySelector("#guide-memo-actions").hidden = step !== 1;
  document.querySelector("#guide-price-actions").hidden = step !== 2;
  document.querySelector("#guide-result-actions").hidden = !copyInResult;

  if (step === 1) {
    guideContent.append(importSection);
  } else if (step === 2) {
    const eligible = eligibleRows();
    if (!eligible.includes(activeRow)) activeRow = eligible[0] ?? null;
    if (!activeRow && !guideList) return showGuide(3);
    workspace.classList.toggle("guide-single", !guideList);
    switchView.textContent = guideList ? "1つずつ調べる" : "一覧でまとめて見る";
    guideContent.append(switchView);
    if (!guideList) {
      const category = activeRow.querySelector(".type").value;
      const model = activeRow.querySelector(".model").value;
      const title = document.createElement("h2");
      title.textContent = `${category} ／ ${model || "型番未入力"}`;
      const points = document.createElement("p");
      points.textContent = VIEWING_POINTS[category];
      const position = document.createElement("p");
      position.className = "hint";
      position.textContent = `${eligible.indexOf(activeRow) + 1} / ${eligible.length} パーツ`;
      const pointTitle = document.createElement("h3");
      pointTitle.textContent = "見るポイント";
      currentPart.replaceChildren(position, title, pointTitle, points);
      if (category === "マザーボード") {
        const note = document.createElement("p");
        note.className = "hint";
        note.textContent = "CPUとマザーボードの対応世代を確認してください。";
        currentPart.append(note);
      }
      guideContent.append(currentPart);
      for (const row of rows.children) row.hidden = row !== activeRow;
    }
    guideContent.append(workspace);
    document.querySelector("#guide-price-next").hidden = guideList;
    document.querySelector("#guide-price-skip").hidden = guideList;
    document.querySelector("#guide-list-done").hidden = !guideList;
    priceStatus.textContent = "";
  } else if (copyInResult) {
    guideContent.append(summary, memoSection);
  }

  if (step) guideTitle.textContent = `ステップ${step}／3 ${["", "パーツを控える", "価格を調べる", "結果"][step]}`;
  window.scrollTo(0, 0);
  if (focus) (step ? guideTitle : document.querySelector("#start-appraisal")).focus({ preventScroll: true });
}

document.querySelector("#start-appraisal").addEventListener("click", () => showGuide(1));
document.querySelector("#open-normal").addEventListener("click", () => openNormal());
document.querySelector("#guide-to-normal").addEventListener("click", () => openNormal(guideStep === 2));
document.querySelector("#guide-edit").addEventListener("click", () => openNormal(true));
document.querySelector("#return-guided").addEventListener("click", () => showGuide(guideStep));
document.querySelector("#guide-import").addEventListener("click", () => {
  if (!importParts()) return;
  // 通常モードで入力済みのパーツも、共有リストの順番で確認する。
  activeRow = eligibleRows()[0];
  guideList = false;
  showGuide(2);
});
switchView.addEventListener("click", () => {
  guideList = !guideList;
  showGuide(2, { focus: false });
  if (guideStep === 2) switchView.focus({ preventScroll: true });
  else guideTitle.focus({ preventScroll: true });
});

function advancePart(skipPrice) {
  const price = activeRow.querySelector(".price");
  const parsed = parsePrice(price.value);
  if (!skipPrice && (parsed.error || parsed.value === null)) {
    priceStatus.textContent = parsed.error || "価格を入力するか、「次へ（価格なしで進む）」を選んでください。";
    price.focus();
    return;
  }
  const eligible = eligibleRows();
  const nextRow = eligible[eligible.indexOf(activeRow) + 1];
  if (skipPrice) {
    price.value = "";
    update();
  }
  activeRow = nextRow ?? null;
  showGuide(nextRow ? 2 : 3);
}

document.querySelector("#guide-price-next").addEventListener("click", () => advancePart(false));
document.querySelector("#guide-price-skip").addEventListener("click", () => advancePart(true));
document.querySelector("#guide-list-done").addEventListener("click", () => {
  const invalidPrice = rows.querySelector('.price[aria-invalid="true"]');
  if (invalidPrice) {
    priceStatus.textContent = "採用価格の入力エラーを修正してください。";
    invalidPrice.focus();
    return;
  }
  showGuide(3);
});
document.querySelector("#guide-restart").addEventListener("click", () => {
  rows.replaceChildren();
  parts.length = 0;
  kake.value = kake.defaultValue;
  importText.value = importText.defaultValue;
  importStatus.textContent = "";
  document.querySelector("#parts-import-status").textContent = "";
  guideList = false;
  activeRow = null;
  TYPES.slice(0, 8).forEach(type => addPart(type, false));
  showGuide(1);
});
kake.addEventListener("input", update);
document.querySelector("#print").addEventListener("click", () => window.print());
document.querySelector("#copy").addEventListener("click", async () => {
  const text = memo.value;
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch { /* file:// や端末の権限で失敗した場合は選択コピーへ進む。 */ }
  if (!copied) {
    memo.focus();
    memo.select();
    memo.setSelectionRange(0, memo.value.length);
    try { copied = document.execCommand("copy"); } catch { copied = false; }
  }
  document.querySelector("#copy-status").textContent = copied
    ? "査定メモをコピーしました。"
    : "自動コピーできませんでした。選択中のメモを Ctrl+C（Macは⌘+C）、スマホは選択メニューからコピーしてください。";
});

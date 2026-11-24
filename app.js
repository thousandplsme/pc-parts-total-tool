"use strict";

const TYPES = ["CPU", "GPU", "RAM", "マザーボード", "SSD", "HDD", "電源", "ケース", "OS", "その他"];
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

let nextId = 0;
function addPart(type = "その他", focus = true) {
  const part = { type, model: "", state: "不明", price: null };
  const id = `part-${++nextId}`;
  const element = document.createElement("div");
  element.className = "part";
  // 固定のUIだけをHTMLで構築。入力値はvalue/textContentに設定する。
  element.innerHTML = `<div class="fields">
    <div class="field-type"><label for="${id}-type">種別</label><select id="${id}-type" class="type"></select></div>
    <div class="field-model"><label for="${id}-model">型番・仕様</label><input id="${id}-model" class="model" type="text" autocomplete="off" spellcheck="false" placeholder="例：Core i7-12700 / RTX 3060"></div>
    <div class="field-state"><label for="${id}-state">状態</label><select id="${id}-state" class="state"></select></div>
    <div class="field-price"><label for="${id}-price">採用価格（円）</label><input id="${id}-price" class="price" type="text" inputmode="numeric" autocomplete="off" placeholder="未入力" aria-describedby="${id}-error"><p id="${id}-error" class="price-error error"></p></div>
    <button type="button" class="delete">削除</button>
    </div><div class="search-controls"><button type="button" class="open-major" disabled>次のサイトを開く</button><span class="site-progress" role="status">0/3 まだ開いていません</span><div class="links"></div></div>`;
  let nextSite = 0;
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
  element.querySelector(".type").addEventListener("change", event => { part.type = event.target.value; update(); });
  element.querySelector(".state").addEventListener("change", event => { part.state = event.target.value; update(); });
  element.querySelector(".model").addEventListener("input", event => {
    part.model = event.target.value;
    nextSite = 0;
    element.querySelector(".site-progress").textContent = "0/3 まだ開いていません";
    refreshLinks(element, part.model);
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
  refreshLinks(element, "");
  update();
  if (focus) element.querySelector(".type").focus();
}

TYPES.slice(0, 8).forEach(type => addPart(type, false));
document.querySelector("#add").addEventListener("click", () => addPart());
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.isComposing && !event.repeat) {
    event.preventDefault();
    addPart();
  }
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

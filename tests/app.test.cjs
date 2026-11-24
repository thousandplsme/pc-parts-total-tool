// 検証専用。実行例: node tests/app.test.cjs <jsdomのインストール先>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(path.join(process.argv[2], 'node_modules/jsdom'));
const root = path.resolve(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
  runScripts: 'outside-only', url: 'file:///test/index.html'
});
const { window } = dom;
const document = window.document;
window.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
const $ = selector => document.querySelector(selector);
const set = (selector, value, event = 'input') => {
  $(selector).value = value;
  $(selector).dispatchEvent(new window.Event(event, { bubbles: true }));
};
const text = selector => $(selector).textContent;
let assertions = 0;
function check(callback) { callback(); assertions++; }

(async () => {
  check(() => assert.equal(document.querySelectorAll('.part').length, 8));
  check(() => assert.equal($('.state').value, '不明'));
  check(() => assert.equal(text('#sum'), '0'));
  const expectedUrls = [
    'https://aucfree.com/search?o=t2&q=RTX%205070',
    'https://www.pc-koubou.jp/user_data/search.php?q=RTX%205070',
    'https://www.dospara.co.jp/used?q=RTX%205070&lang=ja_JP&includeNotInventory=true',
    'https://www.janpara.co.jp/sale/search/result/?KEYWORDS=RTX%205070',
    'https://www.sofmap.com/product_list_parts.aspx?product_type=USED&keyword=RTX%205070',
    'https://jp.mercari.com/search?keyword=RTX%205070'
  ];
  const opened = [];
  window.open = (...args) => { opened.push(args); return null; };
  check(() => assert.equal($('.open-major').disabled, true));
  $('.open-major').click();
  check(() => assert.equal(opened.length, 0));
  set('#part-1-model', 'RTX 5070');
  const links = [...document.querySelectorAll('.part:first-child .links a')];
  expectedUrls.forEach((url, index) => check(() => assert.equal(links[index].href, url)));
  check(() => assert.equal(document.querySelectorAll('.primary-links a').length, 3));
  check(() => assert.equal(document.querySelectorAll('.other-links a').length, 3));
  check(() => assert.equal($('.links details').open, false));
  check(() => assert.equal($('.links summary').textContent, '他のサイト'));
  check(() => assert.equal($('.open-major').disabled, false));
  $('.open-major').click();
  check(() => assert.equal(opened.length, 1));
  check(() => assert.equal($('.site-progress').textContent, '1/3 オークフリーまで開いた'));
  $('.open-major').click();
  check(() => assert.equal(opened.length, 2));
  check(() => assert.equal($('.site-progress').textContent, '2/3 パソコン工房まで開いた'));
  $('.open-major').click();
  check(() => assert.equal($('.site-progress').textContent, '3サイトとも開いた'));
  check(() => assert.deepEqual(opened.map(args => args[0]), expectedUrls.slice(0, 3)));
  $('.open-major').click();
  check(() => assert.equal(opened[3][0], expectedUrls[0]));
  check(() => assert.equal($('.site-progress').textContent, '1/3 オークフリーまで開いた'));
  set('#part-2-model', 'RTX 5070');
  document.querySelectorAll('.open-major')[1].click();
  check(() => assert.equal(opened[4][0], expectedUrls[0]));
  check(() => assert.equal($('.site-progress').textContent, '1/3 オークフリーまで開いた'));
  set('#part-2-model', '');
  check(() => assert.ok(opened.every(args => args[1] === '_blank' && args[2] === 'noopener,noreferrer')));
  check(() => assert.ok(links.every(link => link.rel === 'noopener noreferrer')));
  $('.links details').open = true;
  set('#part-1-model', 'Core i7 & <script>alert(1)</script> 日本語');
  check(() => assert.equal($('.site-progress').textContent, '0/3 まだ開いていません'));
  check(() => assert.equal($('.links details').open, true));
  check(() => assert.equal(document.querySelectorAll('.links a').length, 6));
  check(() => assert.equal(new URL($('.links a').href).searchParams.get('q'), 'Core i7 & <script>alert(1)</script> 日本語'));
  check(() => assert.equal(document.querySelectorAll('a[href*="google.com"],a[href*="pasotsuku.jp"]').length, 0));
  $('.open-major').click();
  check(() => assert.equal(new URL(opened[5][0]).searchParams.get('q'), 'Core i7 & <script>alert(1)</script> 日本語'));
  check(() => assert.equal(document.querySelectorAll('.links script').length, 0));
  check(() => assert.ok($('#memo').value.includes('Core i7 & <script>')));
  set('#part-1-price', '２０，０００');
  set('#part-2-price', '30,001');
  check(() => assert.equal(text('#sum'), '50,001'));
  check(() => assert.equal(text('#estimate'), '25,001'));
  check(() => assert.equal(text('#sticky-sum'), text('#sum')));
  check(() => assert.equal(text('#sticky-estimate'), text('#estimate')));
  set('#part-1-price', '110000');
  set('#part-2-price', '0');
  for (const [value, estimate, description] of [
    ['5', '55,000', '5掛け（売価の50%）'],
    ['4', '44,000', '4掛け（売価の40%）'],
    ['4.5', '49,500', '4.5掛け（売価の45%）'],
    ['0', '0', '0掛け（売価の0%）'],
    ['10', '110,000', '10掛け（売価の100%）'],
    ['0.005', '55', '0.005掛け（売価の0.05%）'],
    ['04.5000', '49,500', '4.5掛け（売価の45%）']
  ]) {
    set('#kake', value);
    check(() => assert.equal(text('#estimate'), estimate));
    check(() => assert.equal(text('#sticky-estimate'), estimate));
    check(() => assert.ok([...document.querySelectorAll('.kake-description')].every(el => el.textContent === description)));
    check(() => assert.ok($('#memo').value.includes(`掛け：${description}`)));
    check(() => assert.ok(!$('#memo').value.includes('係数')));
  }
  set('#part-1-price', '20000');
  set('#part-2-price', '30001');
  set('#kake', '6.5');
  check(() => assert.equal(text('#estimate'), '32,501'));
  set('#part-1-state', 'ジャンク', 'change');
  set('#part-1-type', 'その他', 'change');
  check(() => assert.ok($('#memo').value.includes('その他 / Core i7')));
  check(() => assert.ok($('#memo').value.includes('/ ジャンク /')));
  set('#part-1-model', '');
  check(() => assert.equal(document.querySelectorAll('.links a').length, 0));
  check(() => assert.equal($('.open-major').disabled, true));
  check(() => assert.equal(document.querySelectorAll('.links details').length, 0));
  check(() => assert.ok(!$('#memo').value.includes('Core i7')));
  set('#part-1-price', '0');
  check(() => assert.ok($('#memo').value.includes('採用価格：0円')));
  set('#part-1-price', '');
  check(() => assert.ok($('#memo').value.includes('採用価格：未入力')));
  for (const value of ['-1', '1.5', '1e3', '1,00', 'abc', '9007199254740992']) {
    set('#part-1-price', value);
    check(() => assert.equal(text('#sum'), '計算不可'));
    check(() => assert.equal(text('#sticky-sum'), '計算不可'));
    check(() => assert.equal(text('#sticky-estimate'), '計算不可'));
    check(() => assert.equal($('#part-1-price').getAttribute('aria-invalid'), 'true'));
  }
  set('#part-1-price', '1');
  set('#part-2-price', '0');
  set('#kake', '5.0000');
  check(() => assert.equal(text('#estimate'), '1'));
  for (const value of ['', '-1', '10.01', 'NaN', '1e1']) {
    set('#kake', value);
    check(() => assert.equal(text('#estimate'), '計算不可'));
    check(() => assert.equal(text('#sticky-estimate'), '計算不可'));
  }
  set('#kake', '５．０');
  check(() => assert.equal(text('#estimate'), '1'));
  set('#part-1-price', '9007199254740991');
  set('#part-2-price', '9007199254740991');
  check(() => assert.equal(text('#sum'), '18,014,398,509,481,982'));
  check(() => assert.equal(text('#estimate'), '9,007,199,254,740,991'));
  const shortcut = new window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true });
  document.dispatchEvent(shortcut);
  check(() => assert.equal(document.querySelectorAll('.part').length, 9));
  check(() => assert.equal(document.activeElement.id, 'part-9-type'));
  $('#part-9-model').focus();
  $('#part-9-model').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true, bubbles: true }));
  check(() => assert.equal(document.querySelectorAll('.part').length, 9));
  document.querySelectorAll('.delete')[8].click();
  check(() => assert.equal(document.activeElement.id, 'part-8-type'));
  let clipboard = '';
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async value => { clipboard = value; } } });
  $('#copy').click();
  await new Promise(setImmediate);
  check(() => assert.equal(clipboard, $('#memo').value));
  check(() => assert.ok(text('#copy-status').includes('コピーしました')));
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } });
  let fallbackCalled = false;
  document.execCommand = () => { fallbackCalled = true; return true; };
  $('#copy').click();
  await new Promise(setImmediate);
  check(() => assert.ok(fallbackCalled));
  check(() => assert.ok(text('#copy-status').includes('コピーしました')));
  document.execCommand = () => false;
  $('#copy').click();
  await new Promise(setImmediate);
  check(() => assert.ok(text('#copy-status').includes('自動コピーできませんでした')));
  check(() => assert.equal($('#memo').selectionEnd, $('#memo').value.length));
  let printCalled = false;
  window.print = () => { printCalled = true; };
  $('#print').click();
  check(() => assert.ok(printCalled));
  check(() => assert.equal(text('#print-memo'), $('#memo').value));
  while ($('.delete')) $('.delete').click();
  check(() => assert.equal(text('#sum'), '0'));
  check(() => assert.equal(text('#sticky-sum'), '0'));
  check(() => assert.equal($('#empty').hidden, false));
  check(() => assert.equal(document.activeElement.id, 'add'));
  $('#add').click();
  check(() => assert.equal(document.querySelectorAll('.part').length, 1));
  check(() => assert.equal($('.type').value, 'その他'));
  check(() => assert.equal(document.querySelectorAll('[src^="https:"], [href^="https:"]').length, 0));
  console.log(`PASS: ${assertions} assertions (DOM integration; real browser/print/clipboard policies not simulated)`);
  window.close();
})().catch(error => { console.error(error); process.exitCode = 1; window.close(); });

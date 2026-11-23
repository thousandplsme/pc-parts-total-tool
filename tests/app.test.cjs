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
  set('#part-1-model', 'Core i7 & <script>alert(1)</script> 日本語');
  check(() => assert.equal(document.querySelectorAll('.links a').length, 7));
  check(() => assert.equal(new URL($('.links a').href).searchParams.get('q'), 'site:aucfree.com Core i7 & <script>alert(1)</script> 日本語'));
  check(() => assert.equal(document.querySelectorAll('.links script').length, 0));
  check(() => assert.ok($('#memo').value.includes('Core i7 & <script>')));
  set('#part-1-price', '２０，０００');
  set('#part-2-price', '30,001');
  check(() => assert.equal(text('#sum'), '50,001'));
  check(() => assert.equal(text('#estimate'), '25,001'));
  set('#coefficient', '0.65');
  check(() => assert.equal(text('#estimate'), '32,501'));
  set('#part-1-state', 'ジャンク', 'change');
  set('#part-1-type', 'その他', 'change');
  check(() => assert.ok($('#memo').value.includes('その他 / Core i7')));
  check(() => assert.ok($('#memo').value.includes('/ ジャンク /')));
  set('#part-1-model', '');
  check(() => assert.equal(document.querySelectorAll('.links a').length, 0));
  check(() => assert.ok(!$('#memo').value.includes('Core i7')));
  set('#part-1-price', '0');
  check(() => assert.ok($('#memo').value.includes('採用価格：0円')));
  set('#part-1-price', '');
  check(() => assert.ok($('#memo').value.includes('採用価格：未入力')));
  for (const value of ['-1', '1.5', '1e3', '1,00', 'abc', '9007199254740992']) {
    set('#part-1-price', value);
    check(() => assert.equal(text('#sum'), '計算不可'));
    check(() => assert.equal($('#part-1-price').getAttribute('aria-invalid'), 'true'));
  }
  set('#part-1-price', '1');
  set('#part-2-price', '0');
  set('#coefficient', '0.5000');
  check(() => assert.equal(text('#estimate'), '1'));
  for (const value of ['', '-1', '1.01', 'NaN', '0.12345']) {
    set('#coefficient', value);
    check(() => assert.equal(text('#estimate'), '計算不可'));
  }
  set('#coefficient', '０．５０');
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
  check(() => assert.equal($('#empty').hidden, false));
  check(() => assert.equal(document.activeElement.id, 'add'));
  $('#add').click();
  check(() => assert.equal(document.querySelectorAll('.part').length, 1));
  check(() => assert.equal($('.type').value, 'その他'));
  check(() => assert.equal(document.querySelectorAll('[src^="https:"], [href^="https:"]').length, 0));
  console.log(`PASS: ${assertions} assertions (DOM integration; real browser/print/clipboard policies not simulated)`);
  window.close();
})().catch(error => { console.error(error); process.exitCode = 1; window.close(); });

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
  const expectedPoints = {
    GPU: '型番の世代とグレード、VRAM容量を確認。検索結果には「単体」と「搭載PC」が混ざるので、価格は単体のものだけを採用する',
    CPU: 'Intel／AMD、世代、末尾の文字（K＝オーバークロック可、F＝内蔵GPUなし）を確認',
    RAM: 'DDRの世代（4か5）、容量、枚数を確認。デスクトップ用とノート用は別物',
    マザーボード: '対応ソケットとチップセット、サイズ（ATX／microATX等）を確認',
    SSD: 'NVMeかSATAか、容量を確認。健康状態は別途ツールで確認する',
    HDD: '容量と使用時間を確認。使用時間が長いものは価格が付きにくい',
    電源: '容量（W数）と80PLUS認証の有無を確認',
    ケース: 'サイズと、側面パネル等の付属品が揃っているかを確認',
    クーラー: '対応ソケットと、付属品（取り付け金具）が揃っているかを確認',
    OS: 'エディション（Home／Pro）とライセンスの有無を確認',
    その他: '型番が正確に控えられているかを最初に確認する'
  };
  for (const [category, points] of Object.entries(expectedPoints)) {
    set('.type', category, 'change');
    check(() => assert.equal($('.viewing-points').open, false));
    check(() => assert.equal(text('.viewing-points p'), points));
    $('.viewing-points summary').click();
    check(() => assert.equal($('.viewing-points').open, true));
    $('.viewing-points summary').click();
    check(() => assert.equal($('.viewing-points').open, false));
  }
  set('.model', '既存の型番');
  set('.price', '100');
  set('#import-text', 'GPU：RTX 5070\r\nCPU：Core i7-12700\r\nRAM：DDR4 16GB×2\r\nSSD：NVMe 1TB\r\n型番だけのメモ');
  $('#import-parts').click();
  let imported = [...document.querySelectorAll('.part')].slice(1);
  check(() => assert.equal(imported.length, 5));
  check(() => assert.equal($('.model').value, '既存の型番'));
  check(() => assert.equal($('.price').value, '100'));
  check(() => assert.equal(text('#import-status'), '5行取り込みました（既存行の末尾に追加）。'));
  const expectedParts = [['GPU', 'RTX 5070'], ['CPU', 'Core i7-12700'], ['RAM', 'DDR4 16GB×2'], ['SSD', 'NVMe 1TB'], ['その他', '型番だけのメモ']];
  imported.forEach((row, index) => {
    check(() => assert.equal(row.querySelector('.type').value, expectedParts[index][0]));
    check(() => assert.equal(row.querySelector('.model').value, expectedParts[index][1]));
    check(() => assert.equal(row.querySelector('.state').value, '不明'));
    check(() => assert.equal(row.querySelector('.price').value, ''));
    check(() => assert.equal(row.querySelectorAll('.links a').length, 6));
    check(() => assert.equal(row.querySelector('.viewing-points').open, false));
  });
  let previousOpenCount = opened.length;
  imported[0].querySelector('.open-major').click();
  check(() => assert.equal(opened.length, previousOpenCount + 1));
  check(() => assert.equal(opened.at(-1)[0], expectedUrls[0]));
  imported[0].querySelector('.price').value = '110000';
  imported[0].querySelector('.price').dispatchEvent(new window.Event('input', { bubbles: true }));
  set('#kake', '5');
  check(() => assert.equal(text('#sum'), '110,100'));
  check(() => assert.equal(text('#sticky-estimate'), '55,050'));
  check(() => assert.ok($('#memo').value.includes('GPU / RTX 5070')));
  const aliases = [['グラボ','GPU'],['グラフィックボード','GPU'],['プロセッサ','CPU'],['メモリ','RAM'],['マザボ','マザーボード'],['MB','マザーボード'],['PSU','電源'],['クーラー','クーラー'],['OS','OS'],['その他','その他'],['マザーボード','マザーボード'],['HDD','HDD'],['ケース','ケース'],['電源','電源']];
  set('#import-text', aliases.map(([alias]) => `${alias}:テスト`).join('\n'));
  $('#import-parts').click();
  imported = [...document.querySelectorAll('.part')].slice(-aliases.length);
  imported.forEach((row, index) => check(() => assert.equal(row.querySelector('.type').value, aliases[index][1])));
  set('#import-text', '  gpu : RTX 5070:追記\n未知：型番\nGPU：\n  <script>alert(1)</script>  \n\n  \n');
  $('#import-parts').click();
  imported = [...document.querySelectorAll('.part')].slice(-4);
  check(() => assert.equal(imported[0].querySelector('.type').value, 'GPU'));
  check(() => assert.equal(imported[0].querySelector('.model').value, 'RTX 5070:追記'));
  check(() => assert.equal(imported[1].querySelector('.model').value, '未知：型番'));
  check(() => assert.equal(imported[1].querySelector('.type').value, 'その他'));
  check(() => assert.equal(imported[2].querySelector('.model').value, 'GPU：'));
  check(() => assert.equal(imported[3].querySelector('.model').value, '  <script>alert(1)</script>  '));
  check(() => assert.equal(document.querySelectorAll('.part script').length, 0));
  const beforeEmptyImport = document.querySelectorAll('.part').length;
  set('#import-text', '\n  \n');
  $('#import-parts').click();
  check(() => assert.equal(document.querySelectorAll('.part').length, beforeEmptyImport));
  check(() => assert.ok(text('#import-status').includes('取り込む行がありません')));
  $('#add').click();
  const last = selector => document.querySelector(`.part:last-child ${selector}`);
  const setLastModel = value => set('.part:last-child .model', value);
  check(() => assert.equal(last('.open-all').disabled, true));
  const candidateCases = [
    ['RTX 3060','GPU'], ['GTX 1650','GPU'], ['RX 7900 XT','GPU'], ['RX 6600','GPU'], ['RX 580','GPU'], ['Radeon','GPU'], ['GeForce','GPU'],
    ['Ryzen 7 7800X3D','CPU'], ['Core i7-12700','CPU'], ['Athlon 3000G','CPU'], ['Celeron G5900','CPU'], ['Pentium G6400','CPU'],
    ['DDR5 32GB','RAM'], ['DDR4 16GB','RAM'], ['DDR3 8GB','RAM'],
    ['NVMe 1TB','SSD'], ['M.2 512GB','SSD'], ['SATA SSD 500GB','SSD'], ['SSD 2TB','SSD'],
    ['HDD 4TB','HDD'], ['WD Blue 1TB','HDD'], ['Seagate 2TB','HDD'], ['BarraCuda 500GB','HDD'],
    ['750W','電源'], ['80PLUS Gold','電源'], ['ｒｔｘ ３０６０','GPU']
  ];
  for (const [model, category] of candidateCases) {
    setLastModel(model);
    check(() => assert.ok(last('.category-hint button').textContent.includes(`${category}を採用`)));
    check(() => assert.equal(last('.type').value, 'その他'));
    check(() => assert.equal(last('.model-search a'), null));
    if (category === '電源') check(() => assert.ok(last('.category-hint button').textContent.includes('弱い候補')));
  }
  setLastModel('RTX 3060');
  last('.open-major').click();

  const beforeBulk = opened.length;
  last('.open-all').click();
  check(() => assert.equal(opened.length, beforeBulk + 3));
  check(() => assert.deepEqual(opened.slice(-3).map(args => args[0]), expectedUrls.slice(0, 3).map(url => url.replace('5070','3060'))));
  check(() => assert.equal(last('.site-progress').textContent, '3/3 一括オープンを実行'));
  check(() => assert.equal(last('.open-all').textContent, '主要3サイトを一括で開く'));
  check(() => assert.equal(last('.popup-note').textContent, '一括オープンはブラウザのポップアップ許可が必要です。開かない場合は『次のサイトを開く』を使ってください'));
  last('.category-hint button').click();
  check(() => assert.equal(last('.type').value, 'GPU'));
  check(() => assert.equal(last('.category-hint').textContent, ''));
  check(() => assert.equal(last('.viewing-points p').textContent, expectedPoints.GPU));
  check(() => assert.ok($('#memo').value.includes('GPU / RTX 3060')));
  setLastModel('DDR5 32GB');
  check(() => assert.equal(last('.type').value, 'GPU'));
  check(() => assert.equal(last('.category-hint').textContent, ''));
  set('.part:last-child .type', 'その他', 'change');
  check(() => assert.ok(last('.category-hint button').textContent.includes('RAM')));
  for (const model of ['型番不明 & 日本語', 'NVMe', 'WD Blue', 'SSD']) {
    setLastModel(model);
    check(() => assert.equal(last('.category-hint button'), null));
    check(() => assert.equal(last('.model-search a').href, `https://www.google.com/search?q=${encodeURIComponent(model)}`));
    check(() => assert.equal(last('.model-search a').textContent, 'この型番を調べる'));
  }
  setLastModel('');
  check(() => assert.equal(last('.category-hint').textContent, ''));
  check(() => assert.equal(last('.open-all').disabled, true));
  set('#import-text','RTX 3060\nRyzen 7 7800X3D\nDDR5 32GB\n不明なパーツ');
  $('#import-parts').click();
  imported=[...document.querySelectorAll('.part')].slice(-4);
  imported.slice(0,3).forEach((row,index)=> {
    check(() => assert.equal(row.querySelector('.type').value, 'その他'));
    check(() => assert.ok(row.querySelector('.category-hint button').textContent.includes(['GPU','CPU','RAM'][index])));
  });
  check(() => assert.equal(imported[3].querySelector('.model-search a').textContent, 'この型番を調べる'));
  const expectedHelp = `■ msinfo32（システム情報）
1. Windowsキー＋R を押す
2. 「msinfo32」と入力して Enter
3. 「システムの要約」でプロセッサ（CPU）と実装メモリ（RAM容量）が分かる
4. 左の「コンポーネント」→「ディスプレイ」でグラフィックボード（GPU）が分かる
■ タスクマネージャー
1. Ctrl＋Shift＋Esc を押す
2. 「パフォーマンス」タブを開く
3. CPU（型番）、メモリ（容量と速度）、ディスク（SSD／HDDの別と容量）、GPU（型番とVRAM）が1画面ずつ確認できる
4. 型番はそのままこのツールに貼ればよい
■ 分からないとき
- 型番だけ控えて、このツールの「この型番を調べる」から調べる
- ノートPCは型番シール（底面）も写真に撮っておくと後で確認できる`;
  check(() => assert.equal($('.help-text').textContent, expectedHelp));
  check(() => assert.equal($('.research-help').open, false));
  $('.research-help summary').click();
  check(() => assert.equal($('.research-help').open, true));
  $('.research-help summary').click();
  check(() => assert.equal($('.research-help').open, false));
  console.log(`PASS: ${assertions} assertions (DOM integration; real browser/print/clipboard policies not simulated)`);
  window.close();
})().catch(error => { console.error(error); process.exitCode = 1; window.close(); });

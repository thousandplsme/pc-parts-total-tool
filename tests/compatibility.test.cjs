// 検証専用: node tests/compatibility.test.cjs <jsdomのインストール先>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(path.join(process.argv[2], 'node_modules/jsdom'));
const root = path.resolve(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { runScripts: 'outside-only', url: 'https://example.test/' });
const { window } = dom;
const document = window.document;
window.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(root, 'compatibility.js'), 'utf8'));
const $ = selector => document.querySelector(selector);
const text = selector => $(selector).textContent;
let count = 0;
const check = callback => { callback(); count++; };
const set = (selector, value) => {
  $(selector).value = value;
  $(selector).dispatchEvent(new window.Event('input', { bubbles: true }));
};
const pair = (cpu, board) => { set('#compat-cpu', cpu); set('#compat-board', board); };

check(() => assert.equal($('.compatibility-section').open, false));
$('.compatibility-section > summary').click();
check(() => assert.equal($('.compatibility-section').open, true));
$('.compatibility-section > summary').click();
check(() => assert.equal($('.compatibility-section').open, false));
check(() => assert.equal(text('.compat-memory-warning'), 'メモリの『R』表記（例：PC4-2400R）はサーバー用（RDIMM）の可能性があり、一般向けマザーボードでは使えません'));

pair('i5-6600', 'H310');
check(() => assert.equal(text('#compat-result'), '非対応'));
check(() => assert.equal(text('#compat-reason'), 'ソケットは同じLGA1151ですが世代が違うため対応しません。物理的に刺さっても起動しません'));
pair('i5-8400', 'B150');
check(() => assert.equal(text('#compat-result'), '非対応'));
check(() => assert.ok(text('#compat-reason').includes('物理的に刺さっても起動しません')));
pair('i5-12400F', 'H610');
check(() => assert.equal(text('#compat-result'), '対応'));
check(() => assert.ok(text('#compat-memory-condition').includes('メモリ互換性：条件付き')));
pair('Ryzen 5 3500', 'A520');
check(() => assert.equal(text('#compat-result'), '条件付き'));
check(() => assert.ok(text('#compat-reason').includes('BIOS')));
pair('i5-12400F', 'B450');
check(() => assert.equal(text('#compat-result'), '非対応'));
check(() => assert.equal(text('#compat-reason'), 'ソケットが違うため取り付けできません'));
pair('Ryzen 7 7800X3D', 'B450');
check(() => assert.equal(text('#compat-result'), '非対応'));
pair('i5-11400', 'H410');
check(() => assert.equal(text('#compat-result'), '条件付き'));
check(() => assert.ok(text('#compat-reason').includes('非対応の型番')));
pair('Ryzen 5 2600', 'B550');
check(() => assert.equal(text('#compat-result'), '条件付き'));
check(() => assert.ok(text('#compat-reason').includes('非対応のものが多い')));
pair('Ryzen 5 5600X', 'B350');
check(() => assert.equal(text('#compat-result'), '条件付き'));
pair('Ryzen 7 7800X3D', 'B650');
check(() => assert.equal(text('#compat-result'), '対応'));
check(() => assert.ok(text('#compat-board-info').includes('DDR5のみ')));

for (const [cpu, generation, socket] of [
  ['Intel Core i5-6500',6,'LGA1151'], ['i7-7700K',7,'LGA1151'], ['i5-8400',8,'LGA1151'], ['i9-9900KF',9,'LGA1151'],
  ['i5-10400',10,'LGA1200'], ['i5-11400F',11,'LGA1200'], ['i5-12400F',12,'LGA1700'], ['Core i7 13700K',13,'LGA1700'], ['i9-14900KS',14,'LGA1700']
]) {
  pair(cpu, '');
  check(() => assert.equal(text('#compat-result'), '単体情報'));
  check(() => assert.ok(text('#compat-cpu-info').includes(`第${generation}世代`)));
  check(() => assert.ok(text('#compat-cpu-info').includes(socket)));
  check(() => assert.ok(text('#compat-cpu-info').includes('対応表の相手側')));
}
for (const cpu of ['Ryzen 5 1600','Ryzen 5 2600','Ryzen 5 3500','Ryzen 5 4600G','Ryzen 5 5600X','Ryzen 7 7800X3D','Ryzen 5 8600G','Ryzen 9 9950X']) {
  pair(cpu,'');
  check(() => assert.equal(text('#compat-result'), '単体情報'));
  check(() => assert.ok(text('#compat-cpu-info').includes(Number(cpu.match(/\b\d{4}/)[0]) < 6000 ? 'AM4' : 'AM5')));
}
const table = [
  [['H110','B150','H170','Z170'], 'LGA1151（第6・7世代用）、CPUは第6・7世代、メモリDDR4（一部DDR3L）'],
  [['B250','H270','Z270'], 'LGA1151（第6・7世代用）、CPUは第6・7世代、メモリDDR4'],
  [['H310','B360','H370','Z370','Z390'], 'LGA1151（第8・9世代用）、CPUは第8・9世代、メモリDDR4'],
  [['H410','B460','H470','Z490'], 'LGA1200、CPUは第10世代（一部第11世代は非対応あり）、メモリDDR4'],
  [['H510','B560','H570','Z590'], 'LGA1200、CPUは第10・11世代、メモリDDR4'],
  [['H610','B660','H670','Z690'], 'LGA1700、CPUは第12・13・14世代、メモリDDR4またはDDR5（型番による）'],
  [['H770','B760','Z790'], 'LGA1700、CPUは第12・13・14世代、メモリDDR4またはDDR5（型番による）'],
  [['A320','B350','X370','B450','X470'], 'AM4、Ryzen 1000〜5000番台（世代の組み合わせによりBIOS更新が必要な場合あり）、メモリDDR4'],
  [['A520','B550','X570'], 'AM4、Ryzen 3000〜5000番台（2000番台以前は非対応のものが多い）、メモリDDR4'],
  [['A620','B650','X670','X870'], 'AM5、Ryzen 7000番台以降、メモリDDR5のみ']
];
for (const [chips, description] of table) {
  for (const chip of chips) {
    pair('',chip);
    check(() => assert.equal(text('#compat-result'), '単体情報'));
    check(() => assert.equal(text('#compat-board-info').split('：')[1], description));
  }
}
pair('ｉ５－１２４００Ｆ','ASUS PRIME H610M-K D4');
check(() => assert.equal(text('#compat-result'), '対応'));
pair('i5-12400F','H6100');
check(() => assert.equal(text('#compat-result'), '判定できませんでした'));
for (const cpu of ['不明','Core Ultra 5 245K','i5-8250U','i7-7800X','Ryzen 5 7520U','Ryzen 5 6600','i5-6600 / i5-12400F']) {
  pair(cpu, 'H610');
  check(() => assert.equal(text('#compat-result'), '判定できませんでした'));
  check(() => assert.equal(new URL($('#compat-searches a').href).searchParams.get('q'), cpu));
}
pair('i5-12400F','B650 / B450');
check(() => assert.equal(text('#compat-result'), '判定できませんでした'));
pair('<script>alert(1)</script> & CPU','不明マザー');
check(() => assert.equal(document.querySelectorAll('#compat-searches a').length,2));
check(() => assert.equal(document.querySelectorAll('#compat-searches script').length,0));
check(() => assert.equal(new URL($('#compat-searches a').href).searchParams.get('q'), '<script>alert(1)</script> & CPU'));
pair('','A520');
check(() => assert.equal(document.querySelectorAll('#compat-searches a').length,0));
pair('','');
check(() => assert.equal(text('#compat-cpu-info'), ''));
check(() => assert.equal(text('#compat-board-info'), ''));
check(() => assert.equal(text('#compat-memory-condition'), ''));
check(() => assert.equal(document.querySelectorAll('.part').length,8));
check(() => assert.equal(text('#sum'),'0'));
check(() => assert.equal($('#kake').value,'5'));
console.log(`PASS: ${count} compatibility assertions`);
window.close();

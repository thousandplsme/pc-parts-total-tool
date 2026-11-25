"use strict";

(() => {
  // 判定範囲と表示文は依頼された確定稿。型番別のサポート表は推測しない。
  const BOARDS = [
    { family: "Intel", series: "100系", chips: ["H110", "B150", "H170", "Z170"], socket: "LGA1151", generations: [6, 7], text: "LGA1151（第6・7世代用）、CPUは第6・7世代、メモリDDR4（一部DDR3L）" },
    { family: "Intel", series: "200系", chips: ["B250", "H270", "Z270"], socket: "LGA1151", generations: [6, 7], text: "LGA1151（第6・7世代用）、CPUは第6・7世代、メモリDDR4" },
    { family: "Intel", series: "300系", chips: ["H310", "B360", "H370", "Z370", "Z390"], socket: "LGA1151", generations: [8, 9], text: "LGA1151（第8・9世代用）、CPUは第8・9世代、メモリDDR4" },
    { family: "Intel", series: "400系", chips: ["H410", "B460", "H470", "Z490"], socket: "LGA1200", generations: [10], text: "LGA1200、CPUは第10世代（一部第11世代は非対応あり）、メモリDDR4" },
    { family: "Intel", series: "500系", chips: ["H510", "B560", "H570", "Z590"], socket: "LGA1200", generations: [10, 11], text: "LGA1200、CPUは第10・11世代、メモリDDR4" },
    { family: "Intel", series: "600系", chips: ["H610", "B660", "H670", "Z690"], socket: "LGA1700", generations: [12, 13, 14], memoryConditional: true, text: "LGA1700、CPUは第12・13・14世代、メモリDDR4またはDDR5（型番による）" },
    { family: "Intel", series: "700系", chips: ["H770", "B760", "Z790"], socket: "LGA1700", generations: [12, 13, 14], memoryConditional: true, text: "LGA1700、CPUは第12・13・14世代、メモリDDR4またはDDR5（型番による）" },
    { family: "AMD", chips: ["A320", "B350", "X370", "B450", "X470"], socket: "AM4", generations: [1, 2, 3, 4, 5], text: "AM4、Ryzen 1000〜5000番台（世代の組み合わせによりBIOS更新が必要な場合あり）、メモリDDR4" },
    { family: "AMD", chips: ["A520", "B550", "X570"], socket: "AM4", generations: [3, 4, 5], text: "AM4、Ryzen 3000〜5000番台（2000番台以前は非対応のものが多い）、メモリDDR4" },
    { family: "AMD", chips: ["A620", "B650", "X670", "X870"], socket: "AM5", text: "AM5、Ryzen 7000番台以降、メモリDDR5のみ" }
  ];
  const normalize = text => text.normalize("NFKC").trim();
  const cpuInput = document.querySelector("#compat-cpu");
  const boardInput = document.querySelector("#compat-board");
  const result = document.querySelector("#compat-result");
  const reason = document.querySelector("#compat-reason");
  const cpuInfo = document.querySelector("#compat-cpu-info");
  const boardInfo = document.querySelector("#compat-board-info");
  const searches = document.querySelector("#compat-searches");
  const memory = document.querySelector("#compat-memory-condition");

  function readCpu(raw) {
    const text = normalize(raw);
    const intel = [...text.matchAll(/\b(?:Core\s*)?i[3579][\s-]+(\d{4,5})([A-Z]*)\b/gi)];
    const amd = [...text.matchAll(/\bRyzen\s+(?:[3579]\s+)?(\d{4})([A-Z0-9]*)\b/gi)];
    if (intel.length + amd.length !== 1) return null;
    if (intel.length) {
      const [, number, suffix] = intel[0];
      // モバイル用やX系は提示表のソケットへ割り当てない。
      if (!["", "K", "F", "KF", "KS", "S", "T"].includes(suffix.toUpperCase())) return null;
      const generation = Number(number.slice(0, number.length === 4 ? 1 : 2));
      if (generation < 6 || generation > 14) return null;
      const socket = generation <= 9 ? "LGA1151" : generation <= 11 ? "LGA1200" : "LGA1700";
      return { family: "Intel", generation, socket, label: `Intel 第${generation}世代`, socketLabel: generation <= 9 ? `${socket}（第${generation <= 7 ? "6・7" : "8・9"}世代用）` : socket };
    }
    const [, number, suffix] = amd[0];
    if (!["", "X", "XT", "X3D", "G", "GE", "GT"].includes(suffix.toUpperCase())) return null;
    const generation = Number(number[0]);
    if (![1, 2, 3, 4, 5, 7, 8, 9].includes(generation)) return null;
    const socket = generation <= 5 ? "AM4" : "AM5";
    return { family: "AMD", generation, socket, socketLabel: socket, label: `Ryzen ${generation}000番台` };
  }

  function readBoard(raw) {
    const text = normalize(raw).toUpperCase();
    const found = [];
    for (const board of BOARDS) {
      for (const chip of board.chips) {
        // H610Mなどの型番内も読むが、H6100や別のチップセットは推測しない。
        if (new RegExp(`(?:^|[^A-Z0-9])${chip}(?![0-9])`).test(text)) found.push({ ...board, chip });
      }
    }
    return found.length === 1 ? found[0] : null;
  }

  function addSearch(label, raw) {
    const item = document.createElement("p");
    item.append(`${label}：`);
    const link = document.createElement("a");
    link.textContent = "この型番を調べる";
    link.href = `https://www.google.com/search?q=${encodeURIComponent(raw.trim())}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    item.append(link);
    searches.append(item);
  }

  function setResult(status, explanation) {
    result.textContent = status;
    reason.textContent = explanation;
  }

  function checkCompatibility() {
    const cpuText = cpuInput.value.trim();
    const boardText = boardInput.value.trim();
    const cpu = readCpu(cpuText);
    const board = readBoard(boardText);
    searches.replaceChildren();
    cpuInfo.textContent = "";
    boardInfo.textContent = "";
    memory.textContent = "";
    if (cpu) {
      const partners = BOARDS.filter(item => item.family === cpu.family && item.socket === cpu.socket && (!item.generations || item.generations.includes(cpu.generation)));
      cpuInfo.textContent = `${cpu.label}／${cpu.socketLabel}。対応表の相手側：${partners.map(item => item.chips.join("／")).join("、")}${cpu.socket === "AM4" ? "（BIOS条件は型番による）" : ""}`;
      if (cpu.family === "Intel" && cpu.generation === 11) cpuInfo.textContent += "。400系は一部非対応あり・型番別確認が必要";
    } else if (cpuText) {
      cpuInfo.textContent = "判定できませんでした（CPUの世代・ソケットを提示表から特定できません）。";
      addSearch("CPU", cpuText);
    }
    if (board) {
      boardInfo.textContent = `${board.chip}${board.series ? `（${board.series}）` : ""}：${board.text}`;
      if (board.memoryConditional) memory.textContent = "メモリ互換性：条件付き。DDR4またはDDR5はマザーボードの型番によるため、使用するメモリの種類を確認してください。";
    } else if (boardText) {
      boardInfo.textContent = "判定できませんでした（チップセットを提示表から特定できません）。";
      addSearch("マザーボード", boardText);
    }
    if ((cpuText && !cpu) || (boardText && !board)) {
      setResult("判定できませんでした", "読み取れなかった型番は、検索先で世代・チップセットを確認してください。");
    } else if (!cpuText && !boardText) {
      setResult("CPUまたはマザーボードを入力してください。", "片方だけでも部品情報を表示します。");
    } else if (!cpu || !board) {
      setResult("単体情報", "両方入力すると、CPUとマザーボードの組み合わせを判定します。");
    } else if (cpu.socket !== board.socket) {
      setResult("非対応", "ソケットが違うため取り付けできません");
    } else if (cpu.socket === "LGA1151" && !board.generations.includes(cpu.generation)) {
      setResult("非対応", "ソケットは同じLGA1151ですが世代が違うため対応しません。物理的に刺さっても起動しません");
    } else if (cpu.socket === "AM4") {
      setResult("条件付き", board.generations.includes(cpu.generation)
        ? "対応表では対象ですが、世代の組み合わせによりBIOS更新が必要な場合があります。型番別のCPUサポートを確認してください。"
        : "2000番台以前は非対応のものが多いため、マザーボード型番別のCPUサポート・BIOS条件を確認してください。");
    } else if (board.series === "400系" && cpu.generation === 11) {
      setResult("条件付き", "400系は第11世代が非対応の型番もあるため、マザーボード型番別のCPUサポート・BIOS条件を確認してください。");
    } else {
      setResult("対応", "提示された対応表では、CPU世代とソケットが対応しています。");
    }
  }

  cpuInput.addEventListener("input", checkCompatibility);
  boardInput.addEventListener("input", checkCompatibility);
  checkCompatibility();
})();

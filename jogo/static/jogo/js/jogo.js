(function(){
  "use strict";

  var LS_KEY = "leonardoVaultPlaysStarted";
  var GAME_SECONDS = 900; // 15 minutos

  // ---------- Seeded RNG ----------
  function makeRng(seed){
    var t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(rng, min, max){
    return min + Math.floor(rng() * (max - min + 1));
  }
  function shuffle(rng, arr){
    var a = arr.slice();
    for(var i = a.length - 1; i > 0; i--){
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function fmtNum(n){
    if(Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return n.toFixed(1).replace(".", ",");
  }

  // ---------- Multiple choice builder ----------
  function buildMC(rng, correct, distractorCandidates){
    var pool = [];
    distractorCandidates.forEach(function(d){
      d = Math.round(d * 10) / 10;
      if(d !== correct && d >= 0 && pool.indexOf(d) === -1) pool.push(d);
    });
    var guard = 0;
    while(pool.length < 3 && guard < 50){
      guard++;
      var delta = randInt(rng, 1, 6) * (rng() < 0.5 ? -1 : 1);
      var cand = Math.round((correct + delta) * 10) / 10;
      if(cand !== correct && cand >= 0 && pool.indexOf(cand) === -1) pool.push(cand);
    }
    pool = pool.slice(0, 3);
    var all = shuffle(rng, pool.concat([correct]));
    var correctIndex = -1;
    for(var i=0;i<all.length;i++){ if(all[i] === correct){ correctIndex = i; break; } }
    return { options: all.map(fmtNum), correctIndex: correctIndex };
  }

  // ---------- Word search builder ----------
  function buildWordSearch(rng, size, words){
    var grid = [];
    for(var r=0;r<size;r++){ grid.push(new Array(size).fill(null)); }
    var placements = [];
    var dirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
    words.forEach(function(word){
      var placed = false;
      for(var attempt=0; attempt<300 && !placed; attempt++){
        var dir = dirs[randInt(rng,0,dirs.length-1)];
        var startR = randInt(rng,0,size-1);
        var startC = randInt(rng,0,size-1);
        var endR = startR + dir[0]*(word.length-1);
        var endC = startC + dir[1]*(word.length-1);
        if(endR<0||endR>=size||endC<0||endC>=size) continue;
        var cells = [];
        var ok = true;
        for(var i=0;i<word.length;i++){
          var rr = startR+dir[0]*i, cc = startC+dir[1]*i;
          var existing = grid[rr][cc];
          if(existing !== null && existing !== word[i]){ ok=false; break; }
          cells.push([rr,cc]);
        }
        if(!ok) continue;
        for(var i=0;i<word.length;i++){ grid[cells[i][0]][cells[i][1]] = word[i]; }
        placements.push({ word: word, cells: cells });
        placed = true;
      }
    });
    var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for(var r=0;r<size;r++){
      for(var c=0;c<size;c++){
        if(grid[r][c] === null){
          grid[r][c] = alphabet[randInt(rng,0,alphabet.length-1)];
        }
      }
    }
    return { grid: grid, placements: placements };
  }
  function cellsInLine(r1,c1,r2,c2){
    var dr = r2-r1, dc = c2-c1;
    var steps = Math.max(Math.abs(dr), Math.abs(dc));
    if(steps === 0) return null;
    if(!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
    var stepR = dr === 0 ? 0 : dr/Math.abs(dr);
    var stepC = dc === 0 ? 0 : dc/Math.abs(dc);
    var cells = [];
    for(var i=0;i<=steps;i++){
      cells.push([r1+stepR*i, c1+stepC*i]);
    }
    return cells;
  }

  // ---------- Puzzle content generators ----------
  function exprForValue(rng, v){
    var useAddition = v >= 2 && rng() < 0.5;
    if(useAddition){
      var a = randInt(rng, 1, v-1);
      var b = v - a;
      return a + " + " + b;
    } else {
      var b2 = randInt(rng, 1, 6);
      var a2 = v + b2;
      return a2 + " − " + b2;
    }
  }
  function genR1P1(rng){
    var rows = 3, cols = 2;
    var total = rows*cols;
    var positions = [];
    for(var i=1;i<=total;i++){ positions.push(i); }
    var order = positions;
    var guard = 0;
    while(guard < 20){
      order = shuffle(rng, positions);
      var identity = order.every(function(v, i){ return v === i+1; });
      if(!identity) break;
      guard++;
    }
    var items = order.map(function(correctPosition){
      var idx = correctPosition - 1;
      return {
        correctPosition: correctPosition,
        row: Math.floor(idx / cols),
        col: idx % cols,
        expr: exprForValue(rng, correctPosition)
      };
    });
    return {
      type: "picture",
      question: "Leonardo escondeu os pedaços de uma pintura, e cada um traz uma continha. Resolva a conta de cada pedaço para descobrir sua posição (1 a " + total + ") e reconstrua o quadro.",
      hint: "Calcule o resultado de cada conta: esse número é a posição exata do pedaço. A posição 1 é o canto superior esquerdo e a " + total + " é o canto inferior direito, contando da esquerda para a direita, de cima para baixo.",
      rows: rows, cols: cols, items: items
    };
  }
  var SAFE_POLYGONS = { 3: "um triângulo", 4: "um quadrado", 5: "um pentágono", 6: "um hexágono", 8: "um octógono" };
  function safeClue(rng, d, usedKinds){
    var kinds = ["sub", "div", "metade"];
    if(d >= 2) kinds.push("soma");
    if(d % 2 === 0) kinds.push("dobro");
    if(SAFE_POLYGONS[d]) kinds.push("lados");
    var fresh = kinds.filter(function(k){ return usedKinds.indexOf(k) === -1; });
    var pool = fresh.length ? fresh : kinds;
    var kind = pool[randInt(rng, 0, pool.length - 1)];
    usedKinds.push(kind);
    if(kind === "sub"){
      var b = randInt(rng, 11, 40);
      return "o resultado de " + (b + d) + " − " + b;
    }
    if(kind === "div"){
      var k = randInt(rng, 2, 9);
      return "o resultado de " + (d * k) + " ÷ " + k;
    }
    if(kind === "metade") return "a metade de " + (d * 2);
    if(kind === "soma"){
      var a = randInt(rng, 4, 15);
      return "o número que, somado a " + a + ", dá " + (a + d);
    }
    if(kind === "dobro") return "o dobro de " + (d / 2);
    return "o número de lados de " + SAFE_POLYGONS[d];
  }
  function genR1P2(rng){
    var code = [], clues = [], usedKinds = [];
    for(var i=0;i<3;i++){
      var d = randInt(rng, 1, 9);
      code.push(d);
      clues.push(safeClue(rng, d, usedKinds));
    }
    return {
      type: "safe",
      question: "Um pequeno cofre guarda as ferramentas de Leonardo. Ele tem três roletas giratórias numeradas de 0 a 9. Decifre a pista matemática de cada roleta, gire-as até o número certo e abra o cofre.",
      hint: "Cada pista dá um único algarismo de 0 a 9. Resolva uma pista de cada vez e use as setas ▲ e ▼ para girar a roleta até esse número. A 1ª pista é da roleta da esquerda.",
      code: code, clues: clues
    };
  }
  // Pergaminhos rasgados: cada metade da esquerda traz uma conta e cada metade da
  // direita, um resultado; o jogador junta as metades que combinam.
  var SCROLL_PAIRS = 5;
  function genR1P3(rng){
    var values = [];
    while(values.length < SCROLL_PAIRS){
      var v = randInt(rng, 4, 30);
      if(values.indexOf(v) === -1) values.push(v);
    }
    var pairs = values.map(function(value){ return { expr: bridgeExpr(rng, value), value: value }; });
    var indices = pairs.map(function(_, i){ return i; });
    return {
      type: "scrolls",
      question: "Uma rajada de vento rasgou os pergaminhos de Leonardo ao meio! Cada metade da esquerda tem uma conta e cada metade da direita tem um resultado. Clique em uma conta e depois no resultado certo para colar o pergaminho de volta.",
      hint: "Resolva uma conta de cada vez e procure o resultado na coluna da direita. Por exemplo: " + pairs[0].expr + " = " + pairs[0].value + ".",
      pairs: pairs,
      leftOrder: shuffle(rng, indices),
      rightOrder: shuffle(rng, indices)
    };
  }
  // Ponte de Leonardo: posições dos nós (tabuleiro embaixo, arco em cima).
  var BRIDGE_NODES = [ [60,220], [170,110], [220,220], [300,70], [380,220], [430,110], [540,220] ];
  // Ordens em que os nós podem ser ligados (do menor para o maior resultado): bem
  // embaralhadas e com as vigas se cruzando. Os nós estão listados da esquerda para
  // a direita, então índices seguidos são nós vizinhos.
  var bridgeOrdersCache = null;
  function bridgeOrders(){
    if(bridgeOrdersCache) return bridgeOrdersCache;
    var P = BRIDGE_NODES;
    function distToBeam(p, a, b){
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
      t = Math.max(0, Math.min(1, t));
      return Math.sqrt(Math.pow(p[0] - a[0] - t * dx, 2) + Math.pow(p[1] - a[1] - t * dy, 2));
    }
    function side(p, q, r){
      var v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      return v > 0 ? 1 : (v < 0 ? -1 : 0);
    }
    function cross(a, b, c, d){
      return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
    }
    function ok(order){
      var i, j, k, crossings = 0;
      for(i = 0; i < order.length - 1; i++){
        // nunca liga um nó ao vizinho
        if(Math.abs(order[i] - order[i + 1]) === 1) return false;
        // nenhuma viga passa por cima de outro nó
        for(k = 0; k < P.length; k++){
          if(k !== order[i] && k !== order[i + 1] && distToBeam(P[k], P[order[i]], P[order[i + 1]]) < 42) return false;
        }
        for(j = i + 2; j < order.length - 1; j++){
          if(cross(P[order[i]], P[order[i + 1]], P[order[j]], P[order[j + 1]])) crossings++;
        }
      }
      return crossings >= 2;
    }
    var found = [];
    (function permute(prefix, rest){
      if(!rest.length){ if(ok(prefix)) found.push(prefix); return; }
      rest.forEach(function(v, i){
        permute(prefix.concat([v]), rest.slice(0, i).concat(rest.slice(i + 1)));
      });
    })([], P.map(function(_, i){ return i; }));
    bridgeOrdersCache = found;
    return found;
  }
  function bridgeExpr(rng, v){
    var kinds = ["soma", "sub", "div"];
    var factors = [];
    for(var f=2;f<=9;f++){ if(v % f === 0 && v/f >= 2 && v/f <= 9) factors.push(f); }
    if(factors.length){ kinds.push("mult"); kinds.push("mult"); }
    var kind = kinds[randInt(rng, 0, kinds.length - 1)];
    if(kind === "mult"){
      var a = factors[randInt(rng, 0, factors.length - 1)];
      return a + " × " + (v / a);
    }
    if(kind === "soma"){
      var s = randInt(rng, 1, v - 1);
      return s + " + " + (v - s);
    }
    if(kind === "sub"){
      var b = randInt(rng, 2, 12);
      return (v + b) + " − " + b;
    }
    var k = v <= 15 ? randInt(rng, 2, 4) : 2;
    return (v * k) + " ÷ " + k;
  }
  function genR1P4(rng){
    var values = [];
    while(values.length < BRIDGE_NODES.length){
      var v = randInt(rng, 4, 30);
      if(values.indexOf(v) === -1) values.push(v);
    }
    values.sort(function(a,b){ return a-b; });
    var orders = bridgeOrders();
    var path = orders[randInt(rng, 0, orders.length - 1)];
    var nodes = values.map(function(value, order){
      var pos = BRIDGE_NODES[path[order]];
      return { x: pos[0], y: pos[1], expr: bridgeExpr(rng, value) };
    });
    return {
      type: "bridge",
      question: "Leonardo projetou uma ponte, mas as vigas ainda não foram encaixadas. Cada nó (ponto de força) da ponte traz uma continha. Comece pelo nó de MENOR resultado e clique nos nós em ordem crescente: cada acerto encaixa uma viga entre dois nós. Atenção: os nós estão embaralhados!",
      hint: "Calcule o resultado de todos os nós antes de clicar. O menor resultado é o do nó “" + nodes[0].expr + "”. Depois vá sempre para o nó com o próximo resultado maior — ele nunca é o vizinho, e as vigas se cruzam.",
      nodes: nodes, extra: []
    };
  }
  function genR1P5(rng){
    // pirâmide de 4 andares; sorteia de novo até não haver nenhum número repetido
    var levelsUp, all, guard = 0;
    do{
      guard++;
      var row = shuffle(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).slice(0, 4);
      levelsUp = [row];
      while(row.length > 1){
        var next = [];
        for(var i = 0; i < row.length - 1; i++) next.push(row[i] + row[i + 1]);
        levelsUp.push(next);
        row = next;
      }
      all = [].concat.apply([], levelsUp);
    } while(guard < 200 && all.some(function(v, i){ return all.indexOf(v) !== i; }));
    var base = levelsUp[0];
    return {
      type: "pyramid",
      question: "Complete a pirâmide mágica de números: cada número é a soma dos dois números logo abaixo dele.",
      hint: "Comece de baixo para cima. Some os pares vizinhos da base (" + base[0] + " + " + base[1] + ", " + base[1] + " + " + base[2] + " e " + base[2] + " + " + base[3] + ") para achar o andar de cima. Repita com os números que você encontrou até chegar ao topo.",
      rows: levelsUp.slice().reverse().map(function(r, idx){
        var isBase = idx === levelsUp.length - 1;
        return r.map(function(v){ return { blank: !isBase, value: v }; });
      }),
      poolValues: all.slice(4).sort(function(a, b){ return a - b; })
    };
  }
  function genR2P1(rng){
    // uma continha de cada operação; cada acerto põe um peso no prato direito
    var a, b, specs = [];
    a = randInt(rng, 12, 49); b = randInt(rng, 12, 49);
    specs.push({ expr: a + " + " + b, answer: a + b, wrong: [a + b + 10, a + b - 10, a + b + 1, a + b - 2] });
    b = randInt(rng, 11, 29); a = b + randInt(rng, 12, 60);
    specs.push({ expr: a + " − " + b, answer: a - b, wrong: [a - b + 10, a - b - 10, a - b + 2, a - b - 1] });
    a = randInt(rng, 3, 9); b = randInt(rng, 3, 9);
    specs.push({ expr: a + " × " + b, answer: a * b, wrong: [a * b + a, a * b - b, a + b, a * b + 1] });
    b = randInt(rng, 2, 9); a = randInt(rng, 3, 12);
    specs.push({ expr: (a * b) + " ÷ " + b, answer: a, wrong: [a + 1, a - 1, a + 2, b] });
    var questions = specs.map(function(spec){
      var mc = buildMC(rng, spec.answer, spec.wrong.filter(function(w){ return w > 0; }));
      return { expr: spec.expr, answer: spec.answer, options: mc.options, correctIndex: mc.correctIndex };
    });
    return {
      type: "scale",
      question: "A máquina voadora de Leonardo está desequilibrada: o cesto da asa esquerda está cheio de pesos e o da asa direita está vazio. Resolva as continhas de soma, subtração, multiplicação e divisão — a cada acerto, um peso cai no cesto da asa direita e a máquina se endireita um pouco. Acerte as quatro para deixá-la voando em equilíbrio.",
      hint: "Faça uma conta de cada vez, com calma. A primeira é " + questions[0].expr + " = " + questions[0].answer + ".",
      questions: questions
    };
  }
  function genR2P2(rng, era){
    var base = [2,7,6, 9,5,1, 4,3,8];
    var offset = (era % 4) * 2;
    var grid = base.map(function(v){ return v + offset; });
    var magicConstant = 15 + 3*offset;
    // 4 casas vazias; cada padrão ainda tem solução única
    var patterns = [ [1,3,5,7], [0,2,4,8], [0,2,4,6] ];
    var blanks = patterns[era % patterns.length];
    var poolValues = blanks.map(function(i){ return grid[i]; });
    return {
      type: "magic",
      question: "Complete o quadrado mágico de Leonardo: todas as linhas, colunas e as duas diagonais devem somar " + magicConstant + ".",
      hint: "Use os números disponíveis e teste as somas das linhas, colunas e diagonais até encontrar " + magicConstant + " em todas elas.",
      grid: grid, blanks: blanks, poolValues: poolValues
    };
  }
  function genR2P3(rng){
    var pool = ["ARTE","MONALISA","GENIO"];
    var chosen = shuffle(rng, pool).slice(0,3);
    var size = 9;
    var built = buildWordSearch(rng, size, chosen);
    return {
      type: "wordsearch",
      question: "Caça-palavras de Leonardo da Vinci: encontre as 3 palavras escondidas. Clique na primeira letra da palavra e depois na última.",
      hint: "As palavras podem estar na horizontal, vertical ou diagonal — inclusive de trás para frente!",
      grid: built.grid,
      words: chosen,
      placements: built.placements
    };
  }
  function genR2P4(rng){
    var variant = randInt(rng, 0, 3);
    var a, b, answer, clue, steps;
    if(variant === 0){
      a = randInt(rng, 11, 19); b = randInt(rng, 3, 9);
      answer = 3 * a - b;
      clue = "o triplo de " + a + " menos " + b;
      steps = "multiplique por 3 e depois subtraia";
    } else if(variant === 1){
      a = randInt(rng, 12, 29); b = randInt(rng, 5, 15);
      answer = 2 * a + b;
      clue = "o dobro de " + a + " mais " + b;
      steps = "multiplique por 2 e depois some";
    } else if(variant === 2){
      a = 2 * randInt(rng, 11, 24); b = randInt(rng, 4, 12);
      answer = a / 2 + b;
      clue = "a metade de " + a + " mais " + b;
      steps = "divida por 2 e depois some";
    } else {
      a = randInt(rng, 4, 9); b = randInt(rng, 2, 9);
      answer = a * a - b;
      clue = "o quadrado de " + a + " menos " + b;
      steps = "multiplique o número por ele mesmo e depois subtraia";
    }
    return {
      type: "mirror",
      question: "Leonardo escrevia de trás para frente, para que só desse para ler com um espelho. Este pergaminho traz uma mensagem cifrada: ela está espelhada e girada. Use o espelho e gire o pergaminho até conseguir ler, decifre a pista matemática e digite o número secreto.",
      hint: "Clique em Espelho para desfazer a escrita espelhada e em Girar até o texto ficar de pé. Depois faça a conta da mensagem na ordem em que ela aparece: " + steps + ".",
      message: "Quem lê no espelho descobre o segredo: o número secreto é " + clue + ".",
      answer: answer,
      startRotation: [90, 180, 270][randInt(rng, 0, 2)]
    };
  }
  // Mesa de cartas: escolher 3 cartas do baralho que somem o número-alvo
  // Ponte autoportante de Leonardo: 6 troncos, cada um com uma conta de duas operações;
  // cada encaixe da ponte mostra o resultado de um dos troncos
  var DAVINCI_LOGS = 6;
  function davinciExpr(rng){
    var kind = randInt(rng, 0, 3), a, b, c;
    if(kind === 0){
      a = randInt(rng, 3, 9); b = randInt(rng, 3, 9); c = randInt(rng, 2, 9);
      return { expr: a + " × " + b + " + " + c, answer: a * b + c };
    }
    if(kind === 1){
      a = randInt(rng, 4, 9); b = randInt(rng, 3, 9); c = randInt(rng, 2, 9);
      return { expr: a + " × " + b + " − " + c, answer: a * b - c };
    }
    if(kind === 2){
      a = randInt(rng, 2, 9); b = randInt(rng, 2, 9); c = randInt(rng, 2, 6);
      return { expr: "(" + a + " + " + b + ") × " + c, answer: (a + b) * c };
    }
    a = randInt(rng, 3, 12); b = randInt(rng, 2, 9); c = randInt(rng, 5, 20);
    return { expr: (a * b) + " ÷ " + b + " + " + c, answer: a + c };
  }
  function genR2P5(rng){
    var pieces = [];
    while(pieces.length < DAVINCI_LOGS){
      var p = davinciExpr(rng);
      if(p.answer >= 8 && p.answer <= 99 && !pieces.some(function(q){ return q.answer === p.answer; })) pieces.push(p);
    }
    return {
      type: "davinci",
      question: "Leonardo inventou uma ponte que se sustenta sozinha, sem pregos nem cordas: os troncos se travam uns nos outros. Monte a ponte sobre o rio! Cada tronco da pilha traz uma conta e cada encaixe da ponte mostra um resultado. Clique em um tronco e depois no encaixe com o resultado certo. Encaixe os " + DAVINCI_LOGS + " troncos para a ponte ficar firme.",
      hint: "Faça primeiro a multiplicação, a divisão ou o que está entre parênteses, e só depois a soma ou a subtração. Por exemplo: o tronco “" + pieces[0].expr + "” vale " + pieces[0].answer + ".",
      pieces: pieces,
      slots: shuffle(rng, pieces.map(function(p){ return p.answer; }))
    };
  }
  var MEMORY_ICONS = {
    monalisa: '<svg viewBox="0 0 100 100"><rect x="15" y="8" width="70" height="84" rx="4" fill="none" stroke="#a678ff" stroke-width="4"/><circle cx="50" cy="42" r="14" fill="none" stroke="#a678ff" stroke-width="4"/><path d="M28,82 C28,62 38,56 50,56 C62,56 72,62 72,82" fill="none" stroke="#a678ff" stroke-width="4"/></svg>',
    vitruvio: '<svg viewBox="0 0 100 100"><circle cx="50" cy="52" r="40" fill="none" stroke="#a678ff" stroke-width="3"/><rect x="15" y="17" width="70" height="70" fill="none" stroke="#a678ff" stroke-width="3"/><circle cx="50" cy="24" r="7" fill="none" stroke="#a678ff" stroke-width="3"/><path d="M50,31 L50,72 M18,42 L82,42 M22,22 L50,31 M78,22 L50,31 M50,72 L26,94 M50,72 L74,94" fill="none" stroke="#a678ff" stroke-width="3" stroke-linecap="round"/></svg>',
    ceia: '<svg viewBox="0 0 100 100"><rect x="8" y="62" width="84" height="6" fill="#a678ff"/><line x1="14" y1="68" x2="14" y2="86" stroke="#a678ff" stroke-width="4"/><line x1="86" y1="68" x2="86" y2="86" stroke="#a678ff" stroke-width="4"/><circle cx="18" cy="42" r="8" fill="none" stroke="#a678ff" stroke-width="3"/><circle cx="36" cy="39" r="8" fill="none" stroke="#a678ff" stroke-width="3"/><circle cx="50" cy="34" r="10" fill="none" stroke="#a678ff" stroke-width="3.5"/><circle cx="64" cy="39" r="8" fill="none" stroke="#a678ff" stroke-width="3"/><circle cx="82" cy="42" r="8" fill="none" stroke="#a678ff" stroke-width="3"/></svg>',
    maquina: '<svg viewBox="0 0 100 100"><ellipse cx="50" cy="52" rx="9" ry="17" fill="none" stroke="#a678ff" stroke-width="3"/><path d="M50,42 C32,24 12,28 6,42 C22,40 36,44 50,52" fill="none" stroke="#a678ff" stroke-width="3"/><path d="M50,42 C68,24 88,28 94,42 C78,40 64,44 50,52" fill="none" stroke="#a678ff" stroke-width="3"/><path d="M50,62 C36,76 22,79 16,70" fill="none" stroke="#a678ff" stroke-width="3"/><path d="M50,62 C64,76 78,79 84,70" fill="none" stroke="#a678ff" stroke-width="3"/></svg>'
  };
  var MEMORY_ICON_KEYS = ["monalisa", "vitruvio", "ceia", "maquina"];
  var FIBONACCI_SPIRAL_SVG = '<svg viewBox="-4 -6 15 10" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="0" y="0" width="1" height="1" fill="none" stroke="#a678ff" stroke-width="0.05"/>' +
    '<rect x="1" y="0" width="1" height="1" fill="none" stroke="#a678ff" stroke-width="0.05"/>' +
    '<rect x="0" y="1" width="2" height="2" fill="none" stroke="#a678ff" stroke-width="0.05"/>' +
    '<rect x="-3" y="0" width="3" height="3" fill="none" stroke="#a678ff" stroke-width="0.05"/>' +
    '<rect x="-3" y="-5" width="5" height="5" fill="none" stroke="#a678ff" stroke-width="0.05"/>' +
    '<rect x="2" y="-5" width="8" height="8" fill="none" stroke="#a678ff" stroke-width="0.05"/>' +
    '<text x="0.5" y="0.65" font-size="0.42" fill="#cdb4ff" text-anchor="middle">1</text>' +
    '<text x="1.5" y="0.65" font-size="0.42" fill="#cdb4ff" text-anchor="middle">1</text>' +
    '<text x="1" y="2.25" font-size="0.62" fill="#cdb4ff" text-anchor="middle">2</text>' +
    '<text x="-1.5" y="1.75" font-size="0.82" fill="#cdb4ff" text-anchor="middle">3</text>' +
    '<text x="-0.5" y="-2.15" font-size="1.2" fill="#cdb4ff" text-anchor="middle">5</text>' +
    '<text x="6" y="-0.6" font-size="1.8" fill="#cdb4ff" text-anchor="middle">8</text>' +
    '<path d="M 0,1 A 1,1 0 0 1 1,0 A 1,1 0 0 1 2,1 A 2,2 0 0 1 0,3 A 3,3 0 0 1 -3,0 A 5,5 0 0 1 2,-5 A 8,8 0 0 1 10,3" fill="none" stroke="#ff5fd2" stroke-width="0.09"/>' +
    '</svg>';
  var BRIDGE_SVG = '<svg viewBox="0 0 300 190" xmlns="http://www.w3.org/2000/svg">' +
    '<line x1="15" y1="155" x2="285" y2="155" stroke="#a678ff" stroke-width="4"/>' +
    '<polygon points="150,22 25,155 275,155" fill="none" stroke="#a678ff" stroke-width="5"/>' +
    '<line x1="150" y1="22" x2="150" y2="155" stroke="#cdb4ff" stroke-width="2" stroke-dasharray="6,6"/>' +
    '<line x1="87" y1="88" x2="150" y2="155" stroke="#5cc8ff" stroke-width="2.5"/>' +
    '<line x1="213" y1="88" x2="150" y2="155" stroke="#5cc8ff" stroke-width="2.5"/>' +
    '<line x1="118" y1="55" x2="150" y2="155" stroke="#5cc8ff" stroke-width="2" opacity="0.6"/>' +
    '<line x1="182" y1="55" x2="150" y2="155" stroke="#5cc8ff" stroke-width="2" opacity="0.6"/>' +
    '<text x="150" y="176" font-size="17" fill="#cdb4ff" text-anchor="middle">base</text>' +
    '<text x="160" y="92" font-size="17" fill="#cdb4ff" text-anchor="start">altura</text>' +
    '</svg>';
  function genR3P1(rng){
    var deck = MEMORY_ICON_KEYS.concat(MEMORY_ICON_KEYS);
    var shuffled = shuffle(rng, deck);
    var cards = shuffled.map(function(key){ return { key: key }; });
    return {
      type: "memory",
      question: "Jogo da memória: encontre os pares de obras de Leonardo da Vinci. Clique em duas cartas para revelá-las.",
      hint: "As quatro obras são a Mona Lisa, o Homem Vitruviano, a Última Ceia e um esboço de máquina voadora. Preste atenção em qual carta mostra cada uma.",
      cards: cards,
      totalPairs: MEMORY_ICON_KEYS.length
    };
  }
  var PAINT_COLORS = [
    { key: "r", name: "vermelho", css: "#d92b2b" },
    { key: "y", name: "amarelo", css: "#f2d13a" },
    { key: "b", name: "azul", css: "#2a5fb8" }
  ];
  var PAINT_MAX_DROPS = 20;
  // Mistura de pigmentos no modelo vermelho-amarelo-azul (RYB), como tinta de verdade:
  // amarelo + azul dá verde, vermelho + amarelo dá laranja, os três juntos dão marrom.
  var PAINT_CUBE = [ [1,1,1], [1,0,0], [1,1,0], [1,0.5,0], [0.163,0.373,0.6], [0.5,0,0.5], [0,0.66,0.2], [0.47,0.28,0.13] ];
  function mixPaint(r, y, b){
    var max = Math.max(r, y, b);
    if(max === 0) return null;
    r /= max; y /= max; b /= max;
    var out = [0, 0, 0];
    for(var i=0;i<8;i++){
      var w = ((i & 1) ? r : 1 - r) * ((i & 2) ? y : 1 - y) * ((i & 4) ? b : 1 - b);
      for(var c=0;c<3;c++){ out[c] += w * PAINT_CUBE[i][c]; }
    }
    return "rgb(" + out.map(function(v){ return Math.round(v * 255); }).join(",") + ")";
  }
  // multiplicações básicas cujo resultado é o número de gotas de cada cor
  var PAINT_PRODUCTS = [ [2,2], [2,3], [2,4], [3,3], [2,5], [2,6], [3,4] ];
  function genR3P2(rng){
    var order = shuffle(rng, [0, 1, 2]); // em que ordem as cores aparecem na fórmula
    // três multiplicações com resultados diferentes, para a mistura nunca ficar em partes iguais
    var products = shuffle(rng, PAINT_PRODUCTS).slice(0, 3);
    var counts = products.map(function(p){ return p[0] * p[1]; });
    while(counts[0] === counts[1] || counts[1] === counts[2] || counts[0] === counts[2]){
      products = shuffle(rng, PAINT_PRODUCTS).slice(0, 3);
      counts = products.map(function(p){ return p[0] * p[1]; });
    }
    var sums = products.map(function(p){
      return rng() < 0.5 ? p[0] + " × " + p[1] : p[1] + " × " + p[0];
    });
    var pieces = order.map(function(colorIdx, pos){
      return sums[pos] + " gotas de " + PAINT_COLORS[colorIdx].name;
    });
    var answer = { r: 0, y: 0, b: 0 };
    order.forEach(function(colorIdx, pos){ answer[PAINT_COLORS[colorIdx].key] = counts[pos]; });
    return {
      type: "paint",
      question: "Falta pintar o manto de uma figura neste afresco. Leonardo deixou a fórmula da cor: resolva a multiplicação de cada cor primária para saber quantas gotas pingar e recrie a cor exata da amostra.",
      hint: "Resolva uma multiplicação de cada vez: o resultado é o número de gotas daquela cor. Use os botões + e − de cada pote até o número certo.",
      formula: "Pingue " + pieces[0] + ", " + pieces[1] + " e " + pieces[2] + ".",
      total: counts[0] + counts[1] + counts[2], answer: answer
    };
  }
  function genR3P3(rng){
    var a, digits;
    var guard = 0;
    do{
      a = randInt(rng, 10, 89);
      digits = String(a).split("");
      guard++;
    } while(digits[0] === digits[1] && guard < 20);
    var reversedDisplay = digits.slice().reverse().join("");
    var reversedValue = parseInt(reversedDisplay, 10);
    var addend = randInt(rng, 5, 20);
    var correct = a + addend;
    var mistake = reversedValue + addend;
    var distractors = [mistake, correct - 10, correct + 10];
    var mc = buildMC(rng, correct, distractors);
    return {
      type: "mc",
      parchmentText: reversedDisplay,
      question: "Leonardo era famoso por escrever seus pergaminhos em escrita espelhada, de trás para frente! Neste pergaminho, os algarismos de um número aparecem invertidos. Depois de descobrir o número correto, some " + addend + " a ele. Qual é o resultado?",
      hint: "Inverta a ordem dos algarismos '" + reversedDisplay + "' para descobrir o número real (" + a + "). Depois some " + addend + ": " + a + " + " + addend + ".",
      options: mc.options,
      correctIndex: mc.correctIndex
    };
  }
  function genR3P4(rng, era){
    var variant = era % 3;
    var correct, distractors, question, hint;
    if(variant === 0){
      correct = 13;
      distractors = [11, 14, 16];
      question = "Leonardo adorava estudar os padrões da natureza, como esta espiral formada por quadrados cujo lado é sempre a soma dos dois lados anteriores: 1, 1, 2, 3, 5, 8... Seguindo esse padrão, qual é o próximo número depois do 8?";
      hint = "Some os dois últimos números da sequência: 5 + 8.";
    } else if(variant === 1){
      correct = 20;
      distractors = [18, 21, 24];
      question = "Leonardo adorava estudar os padrões da natureza, como esta espiral formada por quadrados: 1, 1, 2, 3, 5 e 8. Qual é a soma de todos os números mostrados nesta espiral?";
      hint = "Some todos os números: 1 + 1 + 2 + 3 + 5 + 8.";
    } else {
      correct = 21;
      distractors = [13, 18, 24];
      question = "Leonardo adorava estudar os padrões da natureza, como esta espiral formada por quadrados cujo lado é sempre a soma dos dois lados anteriores: 1, 1, 2, 3, 5, 8... Se a sequência continuasse, qual número apareceria duas posições depois do 8 (ou seja, o número que vem depois do número seguinte ao 8)?";
      hint = "Depois do 8 vem 5 + 8 = 13. Depois do 13 vem 8 + 13 = 21.";
    }
    var mc = buildMC(rng, correct, distractors);
    return {
      type: "mc",
      spiralSvg: true,
      question: question,
      hint: hint,
      options: mc.options,
      correctIndex: mc.correctIndex
    };
  }
  var PERSP_WALL_NAMES = { relogio: "o relógio", janela: "a janela", quadro: "o quadro" };
  // Escritório de Leonardo: objetos espalhados pelo cenário; o jogador acha os três
  // que as pistas descrevem. Cada desenho cabe num quadrado de -15 a 15.
  var STUDY_OBJECTS = [
    { name: "o compasso", clue: "Com ele, Leonardo traçava círculos perfeitos.",
      svg: '<path d="M0 -11L-7 13M0 -11L7 13M-4 3H4" fill="none" stroke="#f6e2a4" stroke-width="2.6" stroke-linecap="round"/><circle cy="-11" r="3" fill="#c9a35a" stroke="#1a1008"/>' },
    { name: "o esquadro", clue: "Tem a forma de um triângulo e serve para traçar ângulos retos.",
      svg: '<path d="M-12 12H12L-12 -12Z M-7 7V-1L1 7Z" fill="#e0bb7e" fill-rule="evenodd" stroke="#1a1008" stroke-width="1.2" stroke-linejoin="round"/>' },
    { name: "a ampulheta", clue: "Mede a passagem do tempo com areia.",
      svg: '<path d="M-7 -12C-7 -3 7 3 7 12H-7C-7 3 7 -3 7 -12Z" fill="#bfe6ff" fill-opacity="0.45" stroke="#f6e2a4" stroke-width="1.6"/><path d="M-4 12C-3 7 3 7 4 12Z" fill="#e6c67c"/><path d="M-9 -13H9M-9 13H9" stroke="#c9a35a" stroke-width="3" stroke-linecap="round"/>' },
    { name: "a chave", clue: "Sem ela, nenhuma fechadura se abre.",
      svg: '<circle cx="-8" r="5" fill="none" stroke="#f6e2a4" stroke-width="3"/><path d="M-3 0H13M8 0V6M12 0V5" fill="none" stroke="#f6e2a4" stroke-width="3" stroke-linecap="round"/>' },
    { name: "a pena", clue: "Leonardo a molhava na tinta para escrever em seus cadernos.",
      svg: '<path d="M-4 5C-7 -6 3 -14 12 -13C13 -4 6 6 -4 5Z" fill="#f3ead2" stroke="#1a1008" stroke-width="1.2"/><path d="M-12 13L8 -9" stroke="#8c6d46" stroke-width="1.8" stroke-linecap="round"/>' },
    { name: "o espelho", clue: "Sem ele, ninguém consegue ler a escrita invertida de Leonardo.",
      svg: '<rect x="-2" y="4" width="4" height="10" rx="1.5" fill="#c9a35a" stroke="#1a1008"/><ellipse cy="-4" rx="8" ry="9" fill="#bfe6ff" stroke="#c9a35a" stroke-width="2.6"/><path d="M-4 -7L1 -11" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>' },
    { name: "a lupa", clue: "Faz os detalhes pequenos parecerem maiores.",
      svg: '<path d="M2 2L12 12" stroke="#8a5a2b" stroke-width="4.5" stroke-linecap="round"/><circle cx="-3" cy="-3" r="7.5" fill="#bfe6ff" fill-opacity="0.45" stroke="#f6e2a4" stroke-width="2.6"/>' },
    { name: "a vela", clue: "Ilumina o escritório quando a noite chega.",
      svg: '<rect x="-4" y="-4" width="8" height="16" fill="#f3ead2" stroke="#1a1008"/><path d="M0 -14C4 -9 2 -5 0 -5C-2 -5 -4 -9 0 -14Z" fill="#ffab3d"/><rect x="-8" y="11" width="16" height="3" rx="1" fill="#c9a35a" stroke="#1a1008" stroke-width="0.8"/>' },
    { name: "a régua", clue: "Serve para medir comprimentos e traçar linhas retas.",
      svg: '<g transform="rotate(-18)"><rect x="-14" y="-4" width="28" height="8" fill="#e0bb7e" stroke="#1a1008" stroke-width="1.2"/><path d="M-10 -4v4M-6 -4v2.5M-2 -4v4M2 -4v2.5M6 -4v4M10 -4v2.5" stroke="#1a1008"/></g>' },
    { name: "o cubo de madeira", clue: "É um sólido geométrico com 6 faces quadradas, todas iguais.",
      svg: '<path d="M0 -12L11 -6V7L0 13L-11 7V-6Z" fill="#c79a5b" stroke="#1a1008" stroke-width="1.2" stroke-linejoin="round"/><path d="M-11 -6L0 0L11 -6M0 0V13" fill="none" stroke="#1a1008" stroke-width="1.2"/>' },
    { name: "o tinteiro", clue: "Guarda a tinta que Leonardo usava para escrever e desenhar.",
      svg: '<path d="M-8 13H8V-1L3 -6V-11H-3V-6L-8 -1Z" fill="#3b5fd0" stroke="#e6dcff" stroke-width="1.4" stroke-linejoin="round"/><rect x="-4" y="-13" width="8" height="3" fill="#c9a35a"/>' },
    { name: "o pergaminho enrolado", clue: "É uma folha enrolada, onde Leonardo guardava seus esboços.",
      svg: '<rect x="-13" y="-6" width="26" height="12" rx="6" fill="#f0deb0" stroke="#8c6d46" stroke-width="1.4"/><ellipse cx="-9" rx="3" ry="4.5" fill="none" stroke="#8c6d46" stroke-width="1.2"/><path d="M2 -6V6" stroke="#a02c4f" stroke-width="3"/>' }
  ];
  // lugares onde um objeto pode estar: estante, alto da estante, mesa, janela, prateleira e chão
  var STUDY_SPOTS = [
    [107,80], [217,80], [62,145], [167,145], [127,210], [222,210], [140,13],
    [392,190], [445,190], [510,190], [450,135], [325,161],
    [445,300], [300,318], [85,310], [175,290], [575,310]
  ];
  var STUDY_CLUES = 6;
  function genR3P5(rng){
    var spots = shuffle(rng, STUDY_SPOTS);
    var items = STUDY_OBJECTS.map(function(o, i){ return { obj: i, x: spots[i][0], y: spots[i][1] }; });
    var targets = shuffle(rng, items.map(function(it){ return it.obj; })).slice(0, STUDY_CLUES);
    var names = targets.map(function(t){ return STUDY_OBJECTS[t].name; });
    return {
      type: "study",
      question: "Leonardo era genial, mas muito bagunceiro: seis objetos sumiram no meio do seu escritório! Leia cada pista, descubra de qual objeto ela fala e clique nele na imagem.",
      hint: "Os objetos procurados são, na ordem das pistas: " + names.slice(0, -1).join(", ") + " e " + names[names.length - 1] + ". Procure na estante, em cima da mesa, na janela e pelo chão.",
      items: items,
      targets: targets
    };
  }

  function buildLevels(era){
    function rngFor(salt){ return makeRng(era*7919 + salt*104729 + 17); }
    // um número por sala; os três juntos formam o código do cofre
    var fragRng = rngFor(16);
    var digits = [0, 1, 2].map(function(){ return String(randInt(fragRng, 1, 9)); });
    return [
      {
        name: "Sala 1 — A Entrada da Oficina",
        difficulty: "FÁCIL",
        story: "A porta de entrada está trancada por três fechaduras simples. Leonardo deixou pistas em suas anotações de aritmética e geometria básica.",
        fragmentDigit: digits[0],
        fragmentStory: "A primeira fechadura se abre com um clique. Na madeira, um número está gravado a fogo.",
        puzzles: [ genR1P1(rngFor(1)), genR1P2(rngFor(2)), genR1P3(rngFor(3)), genR1P4(rngFor(4)), genR1P5(rngFor(5)) ]
      },
      {
        name: "Sala 2 — O Códice Secreto",
        difficulty: "MÉDIA",
        story: "Você encontra um baú com um códice cifrado. Para abri-lo, é preciso conhecer sequências, áreas e equações simples — o tipo de matemática que fascinava Leonardo.",
        fragmentDigit: digits[1],
        fragmentStory: "O baú racha e se abre. Dentro, uma página do códice mostra um novo número.",
        puzzles: [ genR2P1(rngFor(6)), genR2P2(rngFor(7), era), genR2P3(rngFor(8)), genR2P4(rngFor(9)), genR2P5(rngFor(10)) ]
      },
      {
        name: "Sala 3 — A Razão Áurea",
        difficulty: "DIFÍCIL",
        story: "A última sala guarda o segredo matemático favorito de Leonardo: a proporção que aparece na natureza, na arte e em suas próprias pinturas.",
        fragmentDigit: digits[2],
        fragmentStory: "A última porta range e se abre. No batente, Leonardo deixou gravado o último número.",
        puzzles: [ genR3P1(rngFor(11)), genR3P2(rngFor(12)), genR3P3(rngFor(13)), genR3P4(rngFor(14), era), genR3P5(rngFor(15)) ]
      }
    ];
  }

  // ---------- Play-count / era persistence ----------
  // conta as partidas iniciadas: cada nova partida recebe uma era (e desafios) diferente,
  // mesmo que a anterior não tenha sido concluída
  var playsStarted = 0;
  function nextEra(){
    try{
      var v = parseInt(localStorage.getItem(LS_KEY) || "0", 10);
      if(!isNaN(v)) playsStarted = Math.max(playsStarted, v);
    } catch(e){}
    var era = playsStarted;
    playsStarted++;
    try{ localStorage.setItem(LS_KEY, String(playsStarted)); } catch(e){}
    return era;
  }

  // ---------- State ----------
  var levels = buildLevels(0);
  var state = {
    levelIndex: 0,
    puzzleIndex: 0,
    fragments: ["", "", ""],
    secondsLeft: GAME_SECONDS,
    timerHandle: null,
    started: false,
    era: 0
  };

  // ---------- DOM refs ----------
  var screens = {
    intro: document.getElementById("screen-intro"),
    level: document.getElementById("screen-level"),
    fragment: document.getElementById("screen-fragment"),
    vault: document.getElementById("screen-vault"),
    victory: document.getElementById("screen-victory"),
    timeout: document.getElementById("screen-timeout")
  };

  var roomDots = document.getElementById("roomDots");
  var timerEl = document.getElementById("timer");
  var btnSair = document.getElementById("btnSair");
  var sairConfirma = document.getElementById("sairConfirma");
  // telas em que a partida está em andamento e dá para desistir
  var TELAS_EM_JOGO = ["level", "fragment", "vault"];

  var levelStoryEl = document.getElementById("levelStory");
  var puzzleLabelEl = document.getElementById("puzzleLabel");
  var puzzleQuestionEl = document.getElementById("puzzleQuestion");
  var puzzleBodyEl = document.getElementById("puzzleBody");
  // caminho vem do template Django; se faltar, usa o caminho padrão do static
  var MONALISA_URL = puzzleBodyEl.getAttribute("data-monalisa") || "/static/jogo/img/monalisa.jpg?v=2";
  new Image().src = MONALISA_URL; // pré-carrega para os pedaços aparecerem na hora
  var feedbackEl = document.getElementById("feedback");
  var hintBox = document.getElementById("hintBox");
  var btnHint = document.getElementById("btnHint");
  var btnCheck = document.getElementById("btnCheck");

  var fragmentStoryEl = document.getElementById("fragmentStory");
  var fragmentNumEl = document.getElementById("fragmentNum");

  var vaultInput = document.getElementById("vaultInput");
  var vaultFeedback = document.getElementById("vaultFeedback");
  var slots = [
    document.getElementById("slot0"),
    document.getElementById("slot1"),
    document.getElementById("slot2")
  ];

  var finalTimeEl = document.getElementById("finalTime");
  var cofreAnim = document.getElementById("cofreAnim");
  var capaEl = document.getElementById("screen-capa");
  var videoEl = document.getElementById("screen-video");
  var videoQuadro = document.getElementById("videoQuadro");

  // ---------- Rooms progress dots ----------
  function renderDots(){
    roomDots.innerHTML = "";
    for(var i=0;i<levels.length;i++){
      var dot = document.createElement("div");
      dot.className = "room-dot";
      if(i < state.levelIndex) dot.className += " done";
      else if(i === state.levelIndex) dot.className += " current";
      roomDots.appendChild(dot);
    }
  }

  // ---------- Timer (contagem regressiva de 15 minutos) ----------
  function startTimer(){
    if(state.timerHandle) return;
    state.timerHandle = setInterval(function(){
      state.secondsLeft--;
      updateTimerDisplay();
      if(state.secondsLeft <= 0){
        stopTimer();
        onTimeUp();
      }
    }, 1000);
  }
  function stopTimer(){
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
  function updateTimerDisplay(){
    timerEl.textContent = "⏱ " + formatTime(state.secondsLeft);
    timerEl.classList.toggle("warning", state.secondsLeft <= 60);
  }
  function formatTime(total){
    total = Math.max(0, total);
    var m = Math.floor(total/60);
    var s = total % 60;
    return (m<10?"0":"")+m+":"+(s<10?"0":"")+s;
  }
  function onTimeUp(){
    showScreen("timeout");
  }

  // ---------- Screen switching ----------
  function showScreen(name){
    Object.keys(screens).forEach(function(k){
      if(screens[k]) screens[k].classList.toggle("hidden", k !== name);
    });
    btnSair.classList.toggle("hidden", TELAS_EM_JOGO.indexOf(name) === -1);
    sairConfirma.classList.add("hidden");
  }

  // ---------- Puzzle body renderers ----------
  function clearBody(){ puzzleBodyEl.innerHTML = ""; }

  function renderParchmentNote(text){
    var box = document.createElement("div");
    box.className = "parchment-note";
    var val = document.createElement("div");
    val.className = "parchment-value";
    val.textContent = text;
    var cap = document.createElement("div");
    cap.className = "parchment-caption";
    cap.textContent = "— escrita espelhada de Leonardo —";
    box.appendChild(val);
    box.appendChild(cap);
    puzzleBodyEl.appendChild(box);
  }

  function renderSpiralNote(){
    var box = document.createElement("div");
    box.className = "spiral-note";
    box.innerHTML = FIBONACCI_SPIRAL_SVG;
    puzzleBodyEl.appendChild(box);
  }

  // ---------- Pergaminhos rasgados (juntar conta e resultado) ----------
  function renderScrolls(puzzle){
    puzzle._matched = 0; // quantos pergaminhos já foram colados
    var total = puzzle.pairs.length;
    var selected = null; // metade da esquerda escolhida no momento
    var wrap = document.createElement("div");
    wrap.className = "scroll-wrap";

    var status = document.createElement("div");
    status.className = "scroll-status";
    wrap.appendChild(status);
    function showStatus(){
      status.innerHTML = "Pergaminhos restaurados: <strong>" + puzzle._matched + " de " + total + "</strong>";
    }
    showStatus();

    var cols = document.createElement("div");
    cols.className = "scroll-cols";
    var leftCol = document.createElement("div");
    leftCol.className = "scroll-col";
    var rightCol = document.createElement("div");
    rightCol.className = "scroll-col";
    cols.appendChild(leftCol);
    cols.appendChild(rightCol);

    function piece(side, text, label){
      var el = document.createElement("button");
      el.type = "button";
      el.className = "scroll-piece scroll-" + side;
      el.setAttribute("aria-label", label);
      var paper = document.createElement("span");
      paper.className = "scroll-paper";
      paper.textContent = text;
      el.appendChild(paper);
      return el;
    }
    function shake(el){
      el.classList.remove("wrong");
      void el.getBoundingClientRect();
      el.classList.add("wrong");
      setTimeout(function(){ el.classList.remove("wrong"); }, 900);
    }

    puzzle.leftOrder.forEach(function(idx){
      var pair = puzzle.pairs[idx];
      var el = piece("esq", pair.expr, "Conta " + pair.expr);
      el.addEventListener("click", function(){
        if(el.classList.contains("inteiro")) return;
        if(selected) selected.el.classList.remove("selected");
        selected = { el: el, idx: idx };
        el.classList.add("selected");
        feedbackEl.textContent = "";
        feedbackEl.className = "feedback";
      });
      leftCol.appendChild(el);
    });

    puzzle.rightOrder.forEach(function(idx){
      var pair = puzzle.pairs[idx];
      var el = piece("dir", String(pair.value), "Resultado " + pair.value);
      el.addEventListener("click", function(){
        if(!selected){
          feedbackEl.textContent = "Primeiro clique em uma conta, na coluna da esquerda.";
          feedbackEl.className = "feedback err";
          return;
        }
        if(selected.idx !== idx){
          shake(el);
          feedbackEl.textContent = "Essas metades não se encaixam. Refaça a conta com calma.";
          feedbackEl.className = "feedback err";
          return;
        }
        // cola as duas metades: a da esquerda vira o pergaminho inteiro
        selected.el.classList.remove("selected");
        selected.el.classList.add("inteiro");
        selected.el.firstChild.textContent = pair.expr + " = " + pair.value;
        selected.el.disabled = true;
        el.classList.add("usado");
        el.disabled = true;
        selected = null;
        puzzle._matched++;
        showStatus();
        feedbackEl.textContent = puzzle._matched >= total ?
          "Todos os pergaminhos foram restaurados! Clique em Verificar para continuar." :
          "As metades se encaixam! Continue com as outras.";
        feedbackEl.className = "feedback ok";
      });
      rightCol.appendChild(el);
    });

    wrap.appendChild(cols);
    puzzleBodyEl.appendChild(wrap);
  }

  // ---------- Ponte autoportante de Leonardo (encaixar os troncos pelo resultado) ----------
  // encaixes na ordem de puzzle.slots: 4 troncos compridos e 2 troncos atravessados no alto
  var DAVINCI_SLOTS = [
    { x1: 84, y1: 214, x2: 258, y2: 104, bx: 136, by: 181 },
    { x1: 516, y1: 214, x2: 342, y2: 104, bx: 464, by: 181 },
    { x1: 172, y1: 146, x2: 342, y2: 104, bx: 214, by: 136 },
    { x1: 428, y1: 146, x2: 258, y2: 104, bx: 386, by: 136 },
    { cx: 258, cy: 98 },
    { cx: 342, cy: 98 }
  ];
  function renderDavinci(puzzle){
    puzzle._placed = 0;
    var total = puzzle.pieces.length;
    var selLog = null, selSlot = null;
    var wrap = document.createElement("div");
    wrap.className = "dv-wrap";

    var status = document.createElement("div");
    status.className = "dv-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    wrap.appendChild(status);
    function showStatus(){
      if(puzzle._placed >= total){
        status.innerHTML = "A ponte está pronta! <strong>" + total + " de " + total + "</strong> troncos encaixados.";
      } else if(selLog !== null){
        status.innerHTML = "Tronco <strong>" + puzzle.pieces[selLog].expr + "</strong> na mão — agora clique no encaixe com o resultado.";
      } else if(selSlot !== null){
        status.innerHTML = "Encaixe <strong>" + puzzle.slots[selSlot] + "</strong> escolhido — agora clique no tronco com essa conta.";
      } else {
        status.innerHTML = "Troncos encaixados: <strong>" + puzzle._placed + " de " + total + "</strong>";
      }
    }

    var svg = svgEl("svg", { viewBox: "0 0 600 320", "class": "dv-svg" });
    svg.appendChild(svgEl("circle", { cx: 520, cy: 48, r: 22, "class": "dv-moon" }));
    svg.appendChild(svgEl("path", { d: "M-100 286Q-75 276 -50 286T0 286T50 286T100 286T150 286T200 286T250 286T300 286T350 286T400 286T450 286T500 286T550 286T600 286T650 286T700 286V320H-100Z", "class": "dv-water dv-water-fundo" }));
    svg.appendChild(svgEl("path", { d: "M-100 300Q-75 290 -50 300T0 300T50 300T100 300T150 300T200 300T250 300T300 300T350 300T400 300T450 300T500 300T550 300T600 300T650 300T700 300V320H-100Z", "class": "dv-water" }));
    svg.appendChild(svgEl("path", { d: "M0 214H98L124 320H0ZM600 214H502L476 320H600Z", "class": "bridge-bank" }));

    var slotEls = [];
    function onSlot(j){
      if(slotEls[j].classList.contains("placed")) return;
      selSlot = selSlot === j ? null : j;
      tryPlace();
    }
    puzzle.slots.forEach(function(value, j){
      var spec = DAVINCI_SLOTS[j];
      var isBeam = spec.cx === undefined;
      var g = svgEl("g", { "class": "dv-slot", tabindex: 0, role: "button", "aria-label": "Encaixe da ponte com o resultado " + value });
      var bx, by;
      if(isBeam){
        g.appendChild(svgEl("line", { x1: spec.x1, y1: spec.y1, x2: spec.x2, y2: spec.y2, "class": "dv-hit" }));
        g.appendChild(svgEl("line", { x1: spec.x1, y1: spec.y1, x2: spec.x2, y2: spec.y2, "class": "dv-shape" }));
        bx = spec.bx; by = spec.by;
      } else {
        g.appendChild(svgEl("circle", { cx: spec.cx, cy: spec.cy, r: 19, "class": "dv-shape dv-shape-ponta" }));
        bx = spec.cx; by = spec.cy;
      }
      g.appendChild(svgEl("circle", { cx: bx, cy: by, r: 16, "class": "dv-badge" }));
      var text = svgEl("text", { x: bx, y: by + 6, "text-anchor": "middle", "class": "dv-badge-text" });
      text.textContent = String(value);
      g.appendChild(text);
      g.addEventListener("click", function(){ onSlot(j); });
      g.addEventListener("keydown", function(e){
        if(e.key === "Enter" || e.key === " "){ e.preventDefault(); onSlot(j); }
      });
      slotEls.push(g);
      svg.appendChild(g);
    });
    // os troncos atravessados das pontas já vêm travados nas margens
    svg.insertBefore(svgEl("circle", { cx: 172, cy: 152, r: 11, "class": "dv-fixo" }), slotEls[4]);
    svg.insertBefore(svgEl("circle", { cx: 428, cy: 152, r: 11, "class": "dv-fixo" }), slotEls[4]);
    wrap.appendChild(svg);

    var pile = document.createElement("div");
    pile.className = "dv-pile";
    var logEls = puzzle.pieces.map(function(piece, i){
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dv-log";
      btn.textContent = piece.expr;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function(){
        selLog = selLog === i ? null : i;
        tryPlace();
      });
      pile.appendChild(btn);
      return btn;
    });
    wrap.appendChild(pile);

    function refresh(){
      logEls.forEach(function(el, i){
        el.classList.toggle("selected", i === selLog);
        el.setAttribute("aria-pressed", i === selLog ? "true" : "false");
      });
      slotEls.forEach(function(el, j){ el.classList.toggle("selected", j === selSlot); });
      svg.classList.toggle("escolhendo", selLog !== null);
      showStatus();
    }

    // um viajante atravessa a ponte pronta
    function crossBridge(){
      var walker = svgEl("g", { "class": "dv-walker" });
      walker.appendChild(svgEl("circle", { cx: 0, cy: -27, r: 5 }));
      walker.appendChild(svgEl("path", { d: "M0 -22V-9M0 -9L-5 0M0 -9L5 0M-6 -16L6 -18M6 -18V-34" }));
      walker.appendChild(svgEl("path", { d: "M6 -34L17 -30L6 -26Z", "class": "dv-flag" }));
      var motion = svgEl("animateMotion", { dur: "5s", fill: "freeze", begin: "indefinite", path: "M20 208L84 208Q300 -34 516 208L570 208" });
      walker.appendChild(motion);
      walker.setAttribute("transform", "translate(20 208)");
      svg.appendChild(walker);
      try{ walker.removeAttribute("transform"); motion.beginElement(); }
      catch(e){ walker.setAttribute("transform", "translate(570 208)"); }
    }

    function tryPlace(){
      feedbackEl.textContent = "";
      feedbackEl.className = "feedback";
      if(selLog === null || selSlot === null){ refresh(); return; }
      var i = selLog, j = selSlot;
      selLog = null; selSlot = null;
      if(puzzle.pieces[i].answer !== puzzle.slots[j]){
        var el = slotEls[j];
        el.classList.remove("wrong");
        void el.getBoundingClientRect();
        el.classList.add("wrong");
        setTimeout(function(){ el.classList.remove("wrong"); }, 900);
        feedbackEl.textContent = "Esse tronco não trava nesse encaixe. Refaça a conta com calma.";
        feedbackEl.className = "feedback err";
        refresh();
        return;
      }
      puzzle._placed++;
      slotEls[j].classList.add("placed");
      slotEls[j].removeAttribute("tabindex");
      logEls[i].classList.add("usado");
      logEls[i].disabled = true;
      if(puzzle._placed >= total){
        svg.classList.add("pronta");
        crossBridge();
        feedbackEl.textContent = "A ponte ficou firme, sem nenhum prego! Clique em Verificar para atravessar.";
      } else {
        feedbackEl.textContent = "Encaixou! O tronco travou no lugar.";
      }
      feedbackEl.className = "feedback ok";
      refresh();
    }

    refresh();
    puzzleBodyEl.appendChild(wrap);
  }

  // ---------- Escritório de Leonardo (achar os objetos perdidos) ----------
  function studySceneSvg(puzzle){
    var s = '<svg viewBox="0 -10 600 370" class="study-svg" xmlns="http://www.w3.org/2000/svg">';
    // parede e piso
    s += '<rect y="-10" width="600" height="262" fill="#3d3270"/>' +
      '<rect y="252" width="600" height="108" fill="#6b5235"/>' +
      '<rect y="246" width="600" height="6" fill="#2b2350"/>' +
      '<path d="M0 282H600M0 318H600M120 252V282M330 252V282M520 252V282M40 282V318M250 282V318M450 282V318M160 318V360M380 318V360" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>' +
      '<ellipse cx="300" cy="326" rx="105" ry="20" fill="#7a3fd0" opacity="0.55"/>' +
      '<ellipse cx="300" cy="326" rx="84" ry="13" fill="none" stroke="#cdb4ff" opacity="0.5"/>';
    // janela com a noite lá fora
    s += '<rect x="395" y="40" width="110" height="110" fill="#16204d" stroke="#c9a35a" stroke-width="5"/>' +
      '<circle cx="478" cy="68" r="11" fill="#f6e2a4"/>' +
      '<circle cx="415" cy="60" r="1.5" fill="#fff"/><circle cx="432" cy="118" r="1.5" fill="#fff"/><circle cx="470" cy="125" r="1.5" fill="#fff"/>' +
      '<path d="M450 40V150M395 95H505" stroke="#c9a35a" stroke-width="3"/>' +
      '<rect x="385" y="150" width="130" height="7" fill="#c9a35a"/>';
    // quadro e prateleira na parede
    s += '<rect x="283" y="52" width="84" height="66" fill="#e2c88f" stroke="#c9a35a" stroke-width="5"/>' +
      '<circle cx="325" cy="85" r="23" fill="none" stroke="#5a3a1a" stroke-width="1.5"/>' +
      '<rect x="306" y="66" width="38" height="38" fill="none" stroke="#5a3a1a" stroke-width="1.5"/>' +
      '<path d="M325 70V96M325 78L308 72M325 78L342 72M325 96L315 108M325 96L335 108" stroke="#5a3a1a" stroke-width="1.5" fill="none"/>' +
      '<rect x="285" y="176" width="80" height="6" fill="#8a5a2b" stroke="#4a2c14"/>' +
      '<path d="M295 182L301 194M355 182L349 194" stroke="#4a2c14" stroke-width="3"/>';
    // estante de livros, com vãos onde os objetos podem ficar
    s += '<rect x="30" y="30" width="220" height="225" fill="#2a1a0c" stroke="#8a5a2b" stroke-width="7"/>' +
      '<rect x="34" y="231" width="212" height="21" fill="#4a2c14"/>';
    var bookColors = ["#8b2f3f", "#2f5d8b", "#3f7a4a", "#8b6a2f", "#5b3f8b"];
    var shelves = [
      { y: 95, gaps: [[88,126], [198,236]] },
      { y: 160, gaps: [[43,81], [148,186]] },
      { y: 225, gaps: [[108,146], [203,241]] }
    ];
    shelves.forEach(function(shelf){
      var x = 40, i = 0;
      while(x < 236){
        var w = 9 + ((i * 7 + shelf.y) % 6);
        var h = 34 + ((i * 13 + shelf.y) % 16);
        var gap = null;
        shelf.gaps.forEach(function(g){ if(x + w > g[0] && x < g[1]) gap = g; });
        if(gap){ x = gap[1]; continue; }
        if(x + w > 244) break;
        s += '<rect x="' + x + '" y="' + (shelf.y - h) + '" width="' + (w - 1) + '" height="' + h +
          '" fill="' + bookColors[(i + shelf.y) % bookColors.length] + '" stroke="#1a1008" stroke-width="0.8"/>';
        x += w; i++;
      }
      s += '<rect x="30" y="' + shelf.y + '" width="220" height="6" fill="#8a5a2b"/>';
    });
    // mesa de trabalho
    s += '<rect x="342" y="215" width="10" height="78" fill="#6a461a"/><rect x="545" y="215" width="10" height="78" fill="#6a461a"/>' +
      '<rect x="455" y="215" width="84" height="30" fill="#7a4e24" stroke="#4a2c14"/><circle cx="497" cy="230" r="3" fill="#c9a35a"/>' +
      '<rect x="330" y="205" width="238" height="10" fill="#8a5a2b" stroke="#4a2c14"/>';
    // objetos
    puzzle.items.forEach(function(it, idx){
      s += '<g transform="translate(' + it.x + ' ' + (it.y - 3) + ') scale(1.2)">' +
        '<g class="study-obj" data-idx="' + idx + '" tabindex="0" role="button" aria-label="Objeto do escritório">' +
        '<circle r="18" class="study-hit"/>' + STUDY_OBJECTS[it.obj].svg + '</g></g>';
    });
    return s + '</svg>';
  }

  function renderStudy(puzzle){
    puzzle._found = 0; // quantas pistas já foram resolvidas
    var total = puzzle.targets.length;
    var wrap = document.createElement("div");
    wrap.className = "study-wrap";

    var clue = document.createElement("div");
    clue.className = "study-clue";
    wrap.appendChild(clue);
    function showClue(){
      if(puzzle._found >= total){
        clue.innerHTML = "<strong>Todos os objetos foram encontrados!</strong>";
        return;
      }
      clue.innerHTML = "<strong>Pista " + (puzzle._found + 1) + " de " + total + ":</strong> " +
        STUDY_OBJECTS[puzzle.targets[puzzle._found]].clue;
    }
    showClue();

    var scene = document.createElement("div");
    scene.className = "study-scene";
    scene.innerHTML = studySceneSvg(puzzle);
    wrap.appendChild(scene);

    function onObject(el){
      if(puzzle._found >= total || el.classList.contains("found")) return;
      var obj = puzzle.items[parseInt(el.getAttribute("data-idx"), 10)].obj;
      if(obj !== puzzle.targets[puzzle._found]){
        el.classList.remove("wrong");
        void el.getBoundingClientRect();
        el.classList.add("wrong");
        setTimeout(function(){ el.classList.remove("wrong"); }, 900);
        feedbackEl.textContent = "Esse é " + STUDY_OBJECTS[obj].name + ". Ele não combina com esta pista.";
        feedbackEl.className = "feedback err";
        return;
      }
      el.classList.add("found");
      puzzle._found++;
      showClue();
      if(puzzle._found >= total){
        feedbackEl.textContent = "Você achou tudo o que Leonardo perdeu! Clique em Verificar para continuar.";
      } else {
        feedbackEl.textContent = "Isso mesmo: " + STUDY_OBJECTS[obj].name + "! Agora leia a próxima pista.";
      }
      feedbackEl.className = "feedback ok";
    }
    scene.querySelectorAll(".study-obj").forEach(function(el){
      el.addEventListener("click", function(){ onObject(el); });
      el.addEventListener("keydown", function(e){
        if(e.key === "Enter" || e.key === " "){ e.preventDefault(); onObject(el); }
      });
    });

    puzzleBodyEl.appendChild(wrap);
  }

  function renderBridgeNote(){
    var box = document.createElement("div");
    box.className = "spiral-note";
    box.innerHTML = BRIDGE_SVG;
    puzzleBodyEl.appendChild(box);
  }

  function renderMC(puzzle){
    var wrap = document.createElement("div");
    wrap.className = "mc-options";
    puzzle.options.forEach(function(optText, idx){
      var id = "mcOpt" + idx;
      var label = document.createElement("label");
      label.className = "mc-option";
      label.setAttribute("for", id);
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "mcChoice";
      input.id = id;
      input.value = String(idx);
      var span = document.createElement("span");
      span.textContent = optText;
      label.appendChild(input);
      label.appendChild(span);
      wrap.appendChild(label);
    });
    puzzleBodyEl.appendChild(wrap);
  }

  function renderMagic(puzzle){
    var wrap = document.createElement("div");
    wrap.className = "magic-grid";
    var poolStrings = puzzle.poolValues.map(String);
    for(var i=0;i<9;i++){
      var cell = document.createElement("div");
      cell.className = "magic-cell";
      if(puzzle.blanks.indexOf(i) !== -1){
        var select = document.createElement("select");
        select.className = "magic-select";
        select.setAttribute("data-answer", String(puzzle.grid[i]));
        var blank = document.createElement("option");
        blank.value = ""; blank.textContent = "—";
        select.appendChild(blank);
        shuffle(makeRng(Date.now() % 2147483647 + i), poolStrings).forEach(function(val){
          var opt = document.createElement("option");
          opt.value = val; opt.textContent = val;
          select.appendChild(opt);
        });
        cell.appendChild(select);
      } else {
        cell.classList.add("fixed");
        cell.textContent = String(puzzle.grid[i]);
      }
      wrap.appendChild(cell);
    }
    puzzleBodyEl.appendChild(wrap);
  }

  function renderOrder(puzzle){
    var wrap = document.createElement("div");
    wrap.className = "order-list";
    puzzle.items.forEach(function(item, idx){
      var row = document.createElement("div");
      row.className = "order-item";
      var label = document.createElement("span");
      label.textContent = item.label;
      var select = document.createElement("select");
      select.className = "order-select";
      select.setAttribute("data-answer", String(item.correctPosition));
      select.setAttribute("aria-label", "Posição de " + item.label);
      var blank = document.createElement("option");
      blank.value = ""; blank.textContent = "Posição";
      select.appendChild(blank);
      for(var p=1;p<=puzzle.items.length;p++){
        var opt = document.createElement("option");
        opt.value = String(p); opt.textContent = String(p) + "º";
        select.appendChild(opt);
      }
      row.appendChild(label);
      row.appendChild(select);
      wrap.appendChild(row);
    });
    puzzleBodyEl.appendChild(wrap);
  }

  function renderMatch(puzzle){
    var wrap = document.createElement("div");
    wrap.className = "match-table";
    var rightValues = puzzle.pairs.map(function(p){ return p.right; });
    var rightShuffled = shuffle(makeRng(Date.now() % 2147483647), rightValues);
    puzzle.pairs.forEach(function(pair){
      var row = document.createElement("div");
      row.className = "match-row";
      var label = document.createElement("span");
      label.textContent = pair.left;
      var select = document.createElement("select");
      select.className = "match-select";
      select.setAttribute("data-answer", pair.right);
      select.setAttribute("aria-label", "Resultado para " + pair.left);
      var blank = document.createElement("option");
      blank.value = ""; blank.textContent = "—";
      select.appendChild(blank);
      rightShuffled.forEach(function(val){
        var opt = document.createElement("option");
        opt.value = val; opt.textContent = val;
        select.appendChild(opt);
      });
      row.appendChild(label);
      row.appendChild(select);
      wrap.appendChild(row);
    });
    puzzleBodyEl.appendChild(wrap);
  }

  function renderPyramid(puzzle){
    var wrap = document.createElement("div");
    wrap.className = "pyramid-wrap";
    var poolStrings = puzzle.poolValues.map(String);
    var blankCounter = 0;
    puzzle.rows.forEach(function(row){
      var rowEl = document.createElement("div");
      rowEl.className = "pyramid-row";
      row.forEach(function(cellSpec){
        var cell = document.createElement("div");
        cell.className = "pyramid-cell";
        if(cellSpec.blank){
          var select = document.createElement("select");
          select.className = "pyramid-select";
          select.setAttribute("data-answer", String(cellSpec.value));
          select.setAttribute("aria-label", "Número da pirâmide");
          var blankOpt = document.createElement("option");
          blankOpt.value = ""; blankOpt.textContent = "—";
          select.appendChild(blankOpt);
          shuffle(makeRng(Date.now() % 2147483647 + blankCounter), poolStrings).forEach(function(val){
            var opt = document.createElement("option");
            opt.value = val; opt.textContent = val;
            select.appendChild(opt);
          });
          blankCounter++;
          cell.appendChild(select);
        } else {
          cell.classList.add("fixed");
          cell.textContent = String(cellSpec.value);
        }
        rowEl.appendChild(cell);
      });
      wrap.appendChild(rowEl);
    });
    puzzleBodyEl.appendChild(wrap);
  }

  var TANGRAM_SHAPES = {
    grande: "10,90 90,90 90,10",
    medio: "22,78 78,78 78,22",
    pequeno: "32,68 68,68 68,32",
    quadrado: "28,28 72,28 72,72 28,72",
    paralelogramo: "18,72 55,72 82,28 45,28"
  };
  function renderTangram(puzzle){
    var wrap = document.createElement("div");
    wrap.className = "tangram-wrap";
    var optionOrder = ["grande","medio","pequeno","quadrado","paralelogramo"];
    puzzle.pieces.forEach(function(type, idx){
      var box = document.createElement("div");
      box.className = "tangram-piece";
      var svgWrap = document.createElement("div");
      svgWrap.className = "tangram-svg-wrap";
      svgWrap.innerHTML = '<svg viewBox="0 0 100 100" class="tangram-svg" aria-hidden="true">' +
        '<polygon points="' + TANGRAM_SHAPES[type] + '"></polygon></svg>' +
        '<span class="tangram-num">' + (idx+1) + '</span>';
      var select = document.createElement("select");
      select.className = "tangram-select";
      select.setAttribute("data-answer", type);
      select.setAttribute("aria-label", "Nome da peça " + (idx+1));
      var blank = document.createElement("option");
      blank.value = ""; blank.textContent = "Escolha…";
      select.appendChild(blank);
      optionOrder.forEach(function(key){
        var opt = document.createElement("option");
        opt.value = key; opt.textContent = puzzle.pieceNames[key];
        select.appendChild(opt);
      });
      box.appendChild(svgWrap);
      box.appendChild(select);
      wrap.appendChild(box);
    });
    puzzleBodyEl.appendChild(wrap);
  }

  function renderPicture(puzzle){
    var wrap = document.createElement("div");
    wrap.className = "picture-wrap";
    var totalPieces = puzzle.rows * puzzle.cols;
    puzzle.items.forEach(function(item, idx){
      var box = document.createElement("div");
      box.className = "picture-piece";
      var imgWrap = document.createElement("div");
      imgWrap.className = "picture-img-wrap";
      var bgPosX = puzzle.cols === 1 ? 0 : (item.col / (puzzle.cols - 1)) * 100;
      var bgPosY = puzzle.rows === 1 ? 0 : (item.row / (puzzle.rows - 1)) * 100;
      imgWrap.style.backgroundImage = "url('" + MONALISA_URL + "')";
      imgWrap.style.backgroundSize = (puzzle.cols * 100) + "% " + (puzzle.rows * 100) + "%";
      imgWrap.style.backgroundPosition = bgPosX + "% " + bgPosY + "%";
      var exprBadge = document.createElement("div");
      exprBadge.className = "picture-expr";
      exprBadge.textContent = item.expr;
      var select = document.createElement("select");
      select.className = "picture-select";
      select.setAttribute("data-answer", String(item.correctPosition));
      select.setAttribute("aria-label", "Posição do pedaço com a conta " + item.expr);
      var blank = document.createElement("option");
      blank.value = ""; blank.textContent = "Posição";
      select.appendChild(blank);
      for(var p=1;p<=totalPieces;p++){
        var opt = document.createElement("option");
        opt.value = String(p); opt.textContent = String(p);
        select.appendChild(opt);
      }
      box.appendChild(imgWrap);
      box.appendChild(exprBadge);
      box.appendChild(select);
      wrap.appendChild(box);
    });
    puzzleBodyEl.appendChild(wrap);
  }

  function renderSafe(puzzle){
    puzzle._values = puzzle._values || puzzle.code.map(function(){ return 0; });
    var wrap = document.createElement("div");
    wrap.className = "safe-wrap";

    var door = document.createElement("div");
    door.className = "safe-door";
    var wheels = document.createElement("div");
    wheels.className = "safe-wheels";

    puzzle.code.forEach(function(_, idx){
      var wheel = document.createElement("div");
      wheel.className = "safe-wheel";
      var win = document.createElement("div");
      win.className = "safe-window";
      win.setAttribute("role", "status");
      win.setAttribute("aria-live", "polite");
      var strip = document.createElement("div");
      strip.className = "safe-strip";
      win.appendChild(strip);

      function paint(){
        var v = puzzle._values[idx];
        strip.innerHTML = "<span>" + ((v + 9) % 10) + "</span><span class=\"atual\">" + v + "</span><span>" + ((v + 1) % 10) + "</span>";
        win.setAttribute("aria-label", "Roleta " + (idx + 1) + ": " + v);
      }
      function spin(step){
        puzzle._values[idx] = (puzzle._values[idx] + step + 10) % 10;
        paint();
        // reinicia a animação de giro
        win.classList.remove("gira-cima", "gira-baixo");
        void win.offsetWidth;
        win.classList.add(step > 0 ? "gira-cima" : "gira-baixo");
      }
      function arrow(symbol, step, label){
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "safe-arrow";
        btn.textContent = symbol;
        btn.setAttribute("aria-label", label + " a roleta " + (idx + 1));
        btn.addEventListener("click", function(){ spin(step); });
        return btn;
      }

      var num = document.createElement("div");
      num.className = "safe-wheel-num";
      num.textContent = (idx + 1) + "ª";
      wheel.appendChild(num);
      wheel.appendChild(arrow("▲", 1, "Aumentar"));
      wheel.appendChild(win);
      wheel.appendChild(arrow("▼", -1, "Diminuir"));
      wheels.appendChild(wheel);
      paint();
    });

    var handle = document.createElement("div");
    handle.className = "safe-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.innerHTML = '<span class="safe-luz"></span>' +
      '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/><circle cx="50" cy="50" r="12"/>' +
      '<path d="M50 10V38M50 62V90M10 50H38M62 50H90"/></svg>';

    door.appendChild(wheels);
    door.appendChild(handle);
    wrap.appendChild(door);

    var clueBox = document.createElement("div");
    clueBox.className = "safe-clues";
    var title = document.createElement("div");
    title.className = "safe-clues-title";
    title.textContent = "Pista de Leonardo";
    clueBox.appendChild(title);
    var list = document.createElement("ol");
    puzzle.clues.forEach(function(clue, idx){
      var li = document.createElement("li");
      li.innerHTML = "<strong>" + (idx + 1) + "ª roleta:</strong> " + clue + ".";
      list.appendChild(li);
    });
    clueBox.appendChild(list);
    wrap.appendChild(clueBox);

    puzzleBodyEl.appendChild(wrap);
  }

  function svgEl(name, attrs){
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach(function(k){ el.setAttribute(k, attrs[k]); });
    return el;
  }

  function renderBridge(puzzle){
    puzzle._step = 0; // quantos nós já foram ligados
    var totalBeams = puzzle.nodes.length - 1;
    var wrap = document.createElement("div");
    wrap.className = "bridge-wrap";

    var status = document.createElement("div");
    status.className = "bridge-status";
    status.innerHTML = 'Vigas encaixadas: <strong id="bridgeBeamsLabel">0</strong> de ' + totalBeams;
    wrap.appendChild(status);

    var svg = svgEl("svg", { viewBox: "0 0 600 300", "class": "bridge-svg" });
    svg.appendChild(svgEl("path", { d: "M0 290 Q50 278 100 290 T200 290 T300 290 T400 290 T500 290 T600 290 V300 H0Z M0 268 Q50 256 100 268 T200 268 T300 268 T400 268 T500 268 T600 268 V300 H0Z", "class": "bridge-water" }));
    svg.appendChild(svgEl("path", { d: "M0 196 H86 L118 300 H0Z M600 196 H514 L482 300 H600Z", "class": "bridge-bank" }));

    function line(a, b, cls){
      return svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, pathLength: 1, "class": cls });
    }
    // vigas de reforço em tracejado (o caminho das vigas principais não é mostrado, para não entregar a resposta)
    var plan = svgEl("g", { "class": "bridge-plan" });
    puzzle.extra.forEach(function(pair){ plan.appendChild(line(puzzle.nodes[pair[0]], puzzle.nodes[pair[1]], "")); });
    svg.appendChild(plan);

    var beams = svgEl("g", {});
    svg.appendChild(beams);

    var nodeEls = [];
    function onNode(idx){
      var el = nodeEls[idx];
      if(puzzle._step >= puzzle.nodes.length || el.classList.contains("done")) return;
      if(idx !== puzzle._step){
        el.classList.remove("wrong");
        void el.getBoundingClientRect();
        el.classList.add("wrong");
        setTimeout(function(){ el.classList.remove("wrong"); }, 900);
        feedbackEl.textContent = "Essa viga não encaixa aqui. Confira o resultado deste nó.";
        feedbackEl.className = "feedback err";
        return;
      }
      feedbackEl.textContent = "";
      feedbackEl.className = "feedback";
      if(idx > 0){
        nodeEls[idx-1].classList.remove("current");
        beams.appendChild(line(puzzle.nodes[idx-1], puzzle.nodes[idx], "bridge-beam"));
        document.getElementById("bridgeBeamsLabel").textContent = String(idx);
      }
      el.classList.remove("wrong");
      el.classList.add("done", "current");
      puzzle._step = idx + 1;
      if(puzzle._step === puzzle.nodes.length){
        el.classList.remove("current");
        puzzle.extra.forEach(function(pair){
          beams.appendChild(line(puzzle.nodes[pair[0]], puzzle.nodes[pair[1]], "bridge-beam bridge-beam-extra"));
        });
        svg.classList.add("pronta");
        feedbackEl.textContent = "A ponte está firme! Clique em Verificar para atravessar.";
        feedbackEl.className = "feedback ok";
      }
    }

    puzzle.nodes.forEach(function(node, idx){
      var g = svgEl("g", { "class": "bridge-node", tabindex: 0, role: "button", "aria-label": "Nó com a conta " + node.expr });
      g.appendChild(svgEl("circle", { cx: node.x, cy: node.y, r: 33 }));
      var text = svgEl("text", { x: node.x, y: node.y + 6, "text-anchor": "middle" });
      text.textContent = node.expr;
      g.appendChild(text);
      g.addEventListener("click", function(){ onNode(idx); });
      g.addEventListener("keydown", function(e){
        if(e.key === "Enter" || e.key === " "){ e.preventDefault(); onNode(idx); }
      });
      nodeEls.push(g);
    });
    // os nós são desenhados embaralhados para a ordem do código não entregar a resposta
    shuffle(makeRng(Date.now() % 2147483647), nodeEls).forEach(function(g){ svg.appendChild(g); });

    wrap.appendChild(svg);
    puzzleBodyEl.appendChild(wrap);
  }

  function renderScale(puzzle){
    puzzle._solved = 0; // continhas já acertadas (= pesos no prato direito)
    var total = puzzle.questions.length;
    var PIVOT_X = 300, PIVOT_Y = 110, ARM = 190, MAX_TILT = 14;
    var wrap = document.createElement("div");
    wrap.className = "scale-wrap";

    // máquina voadora de Leonardo vista de frente: as asas fazem o papel da trave
    // e um cesto pendurado na ponta de cada asa faz o papel do prato
    var svg = svgEl("svg", { viewBox: "0 0 600 330", "class": "scale-svg" });
    [[95, 300, 70], [300, 316, 95], [505, 296, 80], [205, 40, 45], [455, 30, 55]].forEach(function(c){
      svg.appendChild(svgEl("ellipse", { cx: c[0], cy: c[1], rx: c[2], ry: c[2] * 0.22, "class": "flyer-cloud" }));
    });

    // asa de morcego (a direita; a esquerda é a mesma, espelhada)
    function buildWing(mirrored){
      var g = svgEl("g", mirrored ? { transform: "translate(" + (2 * PIVOT_X) + " 0) scale(-1 1)" } : {});
      g.appendChild(svgEl("path", { d: "M300 100Q395 52 490 110Q450 118 420 150Q396 132 372 158Q350 134 328 150Q312 128 300 124Z", "class": "flyer-membrane" }));
      g.appendChild(svgEl("path", { d: "M318 97L420 150M318 97L372 158M318 97L328 150", "class": "flyer-rib" }));
      g.appendChild(svgEl("path", { d: "M300 100Q395 52 490 110", "class": "flyer-spar" }));
      return g;
    }

    // cesto com os pesos; "labels" são os números escritos nos pesos ("" = peso liso)
    function buildPan(){
      var g = svgEl("g", {});
      g.appendChild(svgEl("path", { d: "M0 0L-58 70M0 0L58 70", "class": "scale-chain" }));
      var weights = svgEl("g", {});
      g.appendChild(weights);
      g.appendChild(svgEl("path", { d: "M-66 70Q0 104 66 70Z", "class": "scale-metal" }));
      g._weights = weights;
      return g;
    }
    function setWeights(pan, labels, cls){
      var g = pan._weights;
      while(g.firstChild) g.removeChild(g.firstChild);
      labels.forEach(function(label, i){
        var cx = (i - (total - 1) / 2) * 31;
        g.appendChild(svgEl("rect", { x: cx - 4, y: 31, width: 8, height: 8, rx: 3, "class": cls }));
        g.appendChild(svgEl("path", { d: "M" + (cx - 14) + " 70L" + (cx - 10) + " 38H" + (cx + 10) + "L" + (cx + 14) + " 70Z", "class": cls }));
        var t = svgEl("text", { x: cx, y: 61, "text-anchor": "middle", "class": "scale-weight-text mystery" });
        t.textContent = label;
        g.appendChild(t);
      });
    }
    var leftPan = buildPan();
    var rightPan = buildPan();
    setWeights(leftPan, puzzle.questions.map(function(){ return ""; }), "scale-weight");

    var beam = svgEl("g", {});
    beam.appendChild(buildWing(false));
    beam.appendChild(buildWing(true));
    // leme, escoras, piloto e casco de madeira
    beam.appendChild(svgEl("path", { d: "M294 102L300 58L306 102Z", "class": "scale-metal" }));
    beam.appendChild(svgEl("path", { d: "M272 190L250 84M328 190L350 84M300 112V190", "class": "flyer-rib" }));
    beam.appendChild(svgEl("circle", { cx: 300, cy: 168, r: 10, "class": "flyer-pilot" }));
    beam.appendChild(svgEl("path", { d: "M282 192Q300 170 318 192Z", "class": "flyer-pilot" }));
    beam.appendChild(svgEl("path", { d: "M256 188H344Q300 236 256 188Z", "class": "scale-metal" }));
    beam.appendChild(svgEl("circle", { cx: PIVOT_X, cy: PIVOT_Y, r: 11, "class": "scale-metal" }));
    svg.appendChild(beam);
    svg.appendChild(leftPan);
    svg.appendChild(rightPan);
    wrap.appendChild(svg);

    var status = document.createElement("div");
    status.className = "scale-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    wrap.appendChild(status);

    var quiz = document.createElement("div");
    quiz.className = "scale-quiz";
    wrap.appendChild(quiz);

    // inclina a máquina e mantém os cestos pendurados na vertical
    var angle = 0, frameId = null;
    function place(a){
      var rad = a * Math.PI / 180;
      var dx = ARM * Math.cos(rad), dy = ARM * Math.sin(rad);
      beam.setAttribute("transform", "rotate(" + a + " " + PIVOT_X + " " + PIVOT_Y + ")");
      leftPan.setAttribute("transform", "translate(" + (PIVOT_X - dx) + " " + (PIVOT_Y - dy) + ")");
      rightPan.setAttribute("transform", "translate(" + (PIVOT_X + dx) + " " + (PIVOT_Y + dy) + ")");
    }
    function tiltTo(target){
      var from = angle, start = null;
      if(frameId) cancelAnimationFrame(frameId);
      function frame(ts){
        if(start === null) start = ts;
        var t = Math.min(1, (ts - start) / 900);
        // oscila um pouco antes de parar, como uma máquina pendurada no ar
        var ease = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 3);
        angle = from + (target - from) * ease;
        place(angle);
        if(t < 1) frameId = requestAnimationFrame(frame);
      }
      frameId = requestAnimationFrame(frame);
    }
    // quanto mais pesos faltam no cesto direito, mais a asa esquerda desce
    function targetAngle(){ return -MAX_TILT * (total - puzzle._solved) / total; }

    function showQuestion(){
      quiz.innerHTML = "";
      svg.classList.toggle("equilibrada", puzzle._solved >= total);
      if(puzzle._solved >= total){
        status.textContent = "A máquina voadora ficou em equilíbrio! Clique em Verificar.";
        return;
      }
      status.textContent = "Pesos no cesto da asa direita: " + puzzle._solved + " de " + total + ".";
      var q = puzzle.questions[puzzle._solved];
      var label = document.createElement("div");
      label.className = "scale-question";
      label.innerHTML = "Conta " + (puzzle._solved + 1) + " de " + total + ": <strong>" + q.expr + " = ?</strong>";
      quiz.appendChild(label);
      var options = document.createElement("div");
      options.className = "scale-options";
      q.options.forEach(function(text, idx){
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "scale-opt";
        btn.textContent = text;
        btn.addEventListener("click", function(){
          if(idx !== q.correctIndex){
            btn.classList.add("errada");
            btn.disabled = true;
            feedbackEl.textContent = "Esse não é o resultado. A máquina voadora continua torta — tente outra resposta.";
            feedbackEl.className = "feedback err";
            return;
          }
          puzzle._solved++;
          setWeights(rightPan, puzzle.questions.slice(0, puzzle._solved).map(function(done){ return String(done.answer); }), "scale-weight mystery");
          tiltTo(targetAngle());
          feedbackEl.textContent = puzzle._solved >= total ? "" : "Certo! Um peso caiu no cesto da asa direita.";
          feedbackEl.className = "feedback ok";
          showQuestion();
        });
        options.appendChild(btn);
      });
      quiz.appendChild(options);
    }

    angle = targetAngle();
    place(angle);
    showQuestion();

    puzzleBodyEl.appendChild(wrap);
  }

  function renderMirror(puzzle){
    // o pergaminho começa espelhado e girado; só fica legível sem espelho e com rotação 0
    var flipped = true;
    var rotation = puzzle.startRotation;
    var wrap = document.createElement("div");
    wrap.className = "mirror-wrap";

    var stage = document.createElement("div");
    stage.className = "mirror-stage";
    var sheet = document.createElement("div");
    sheet.className = "mirror-sheet";
    var text = document.createElement("p");
    text.textContent = puzzle.message;
    var sign = document.createElement("span");
    sign.className = "mirror-sign";
    sign.textContent = "— Leonardo";
    sheet.appendChild(text);
    sheet.appendChild(sign);
    stage.appendChild(sheet);
    wrap.appendChild(stage);

    function apply(){
      sheet.style.transform = "rotate(" + rotation + "deg) scaleX(" + (flipped ? -1 : 1) + ")";
    }
    function tool(label, aria, action){
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mirror-btn";
      btn.textContent = label;
      btn.setAttribute("aria-label", aria);
      btn.addEventListener("click", function(){ action(); apply(); });
      return btn;
    }
    var tools = document.createElement("div");
    tools.className = "mirror-tools";
    tools.appendChild(tool("Espelho", "Colocar ou tirar o espelho", function(){ flipped = !flipped; }));
    tools.appendChild(tool("Girar ↻", "Girar o pergaminho um quarto de volta", function(){ rotation += 90; }));
    wrap.appendChild(tools);

    var row = document.createElement("div");
    row.className = "mirror-answer";
    var label = document.createElement("label");
    label.setAttribute("for", "mirrorInput");
    label.textContent = "Número secreto:";
    var input = document.createElement("input");
    input.type = "text";
    input.id = "mirrorInput";
    input.className = "mirror-input";
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("autocomplete", "off");
    input.maxLength = 4;
    input.addEventListener("keydown", function(e){
      if(e.key === "Enter") checkAnswer();
    });
    row.appendChild(label);
    row.appendChild(input);
    wrap.appendChild(row);

    apply();
    puzzleBodyEl.appendChild(wrap);
  }

  var FRESCO_SVG =
    '<rect width="300" height="220" fill="#e8d9b5"/>' +
    '<path d="M18 220V92A132 132 0 0 1 282 92V220Z" fill="#b9cfd6"/>' +
    '<circle cx="222" cy="62" r="20" fill="#e9bf62"/>' +
    '<path d="M18 150Q80 112 140 142T282 128V220H18Z" fill="#9aa77a"/>' +
    '<path d="M18 178Q90 150 160 172T282 160V220H18Z" fill="#7f8f63"/>' +
    '<path d="M52 150V104H60V96H68V104H76V96H84V104H92V150Z" fill="#c9a77a" stroke="#7a5a34" stroke-width="1.5"/>' +
    '<rect x="67" y="124" width="10" height="26" fill="#7a5a34"/>' +
    '<path class="fresco-manto" d="M150 112C128 122 122 170 116 212H184C178 170 172 122 150 112Z"/>' +
    '<circle cx="150" cy="96" r="13" fill="#e6c69c" stroke="#7a5a34" stroke-width="1.5"/>' +
    '<path d="M137 94C138 78 162 78 163 94C158 86 142 86 137 94Z" fill="#5a3a1a"/>' +
    '<path d="M18 220V92A132 132 0 0 1 282 92V220" fill="none" stroke="#8c6d46" stroke-width="6"/>' +
    '<path d="M40 40L62 70L55 96M250 150L236 176L246 204M120 30L134 52" fill="none" stroke="rgba(90,60,30,0.4)" stroke-width="1.2"/>';

  function renderPaint(puzzle){
    puzzle._drops = { r: 0, y: 0, b: 0 };
    var wrap = document.createElement("div");
    wrap.className = "paint-wrap";

    var top = document.createElement("div");
    top.className = "paint-top";
    var fresco = svgEl("svg", { viewBox: "0 0 300 220", "class": "paint-fresco", role: "img", "aria-label": "Afresco com o manto de uma figura ainda sem pintar" });
    fresco.innerHTML = FRESCO_SVG;
    var manto = fresco.querySelector(".fresco-manto");
    top.appendChild(fresco);

    var swatches = document.createElement("div");
    swatches.className = "paint-swatches";
    function swatch(title){
      var box = document.createElement("div");
      box.className = "paint-swatch";
      var chip = document.createElement("div");
      chip.className = "paint-chip";
      var cap = document.createElement("span");
      cap.textContent = title;
      box.appendChild(chip);
      box.appendChild(cap);
      swatches.appendChild(box);
      return chip;
    }
    swatch("Amostra de Leonardo").style.background = mixPaint(puzzle.answer.r, puzzle.answer.y, puzzle.answer.b);
    var mixChip = swatch("Sua mistura");
    top.appendChild(swatches);
    wrap.appendChild(top);

    var formula = document.createElement("div");
    formula.className = "paint-formula";
    formula.innerHTML = "<strong>Fórmula de Leonardo:</strong> ";
    formula.appendChild(document.createTextNode(puzzle.formula));
    wrap.appendChild(formula);

    var palette = document.createElement("div");
    palette.className = "paint-palette";
    var countEls = {};
    PAINT_COLORS.forEach(function(color){
      var pot = document.createElement("div");
      pot.className = "paint-pot";
      var blob = document.createElement("div");
      blob.className = "paint-blob";
      blob.style.background = color.css;
      var name = document.createElement("div");
      name.className = "paint-name";
      name.textContent = color.name;
      var row = document.createElement("div");
      row.className = "paint-row";
      function stepButton(symbol, step, verb){
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "paint-btn";
        btn.textContent = symbol;
        btn.setAttribute("aria-label", verb + " uma gota de " + color.name);
        btn.addEventListener("click", function(){
          puzzle._drops[color.key] = Math.max(0, Math.min(PAINT_MAX_DROPS, puzzle._drops[color.key] + step));
          update();
        });
        return btn;
      }
      var count = document.createElement("span");
      count.className = "paint-count";
      countEls[color.key] = count;
      row.appendChild(stepButton("−", -1, "Tirar"));
      row.appendChild(count);
      row.appendChild(stepButton("+", 1, "Pingar"));
      pot.appendChild(blob);
      pot.appendChild(name);
      pot.appendChild(row);
      palette.appendChild(pot);
    });
    wrap.appendChild(palette);

    var totalEl = document.createElement("div");
    totalEl.className = "paint-total";
    totalEl.setAttribute("role", "status");
    totalEl.setAttribute("aria-live", "polite");
    wrap.appendChild(totalEl);

    function update(){
      var d = puzzle._drops;
      var used = d.r + d.y + d.b;
      var mixed = mixPaint(d.r, d.y, d.b);
      PAINT_COLORS.forEach(function(color){ countEls[color.key].textContent = String(d[color.key]); });
      mixChip.style.background = mixed || "";
      mixChip.classList.toggle("vazio", !mixed);
      manto.style.fill = mixed || "";
      manto.classList.toggle("pintado", !!mixed);
      totalEl.innerHTML = "Gotas usadas: <strong>" + used + "</strong> de " + puzzle.total;
    }
    update();

    puzzleBodyEl.appendChild(wrap);
  }

  var PERSP_ICONS = {
    relogio: '<circle r="21" fill="#f3e6c2" stroke="#c9a35a" stroke-width="5"/><path d="M0 0V-13M0 0L9 5" stroke="#3a2713" stroke-width="3" stroke-linecap="round"/><circle r="2.5" fill="#7a3b12"/>',
    janela: '<rect x="-19" y="-23" width="38" height="46" fill="#9fd0e8" stroke="#6a461a" stroke-width="4"/><path d="M0 -23V23M-19 0H19" stroke="#6a461a" stroke-width="3"/>',
    quadro: '<rect x="-23" y="-18" width="46" height="36" fill="#7d9a6a" stroke="#c9a35a" stroke-width="5"/><path d="M-20 15L-6 -4L4 8L11 0L20 15Z" fill="#4f6b45"/><circle cx="12" cy="-8" r="4" fill="#f2d13a"/>',
    vela: '<ellipse cx="0" cy="-14" rx="12" ry="14" fill="rgba(255,179,71,0.35)"/><path d="M0 -24C5 -15 5 -11 0 -5C-5 -11 -5 -15 0 -24Z" fill="#ffab3d"/><rect x="-6" y="-4" width="12" height="22" rx="2" fill="#efe0b8"/><path d="M-14 18H14L10 24H-10Z" fill="#c9a35a"/>',
    ampulheta: '<path d="M-11 -20H11C11 -8 3 -3 3 0C3 3 11 8 11 20H-11C-11 8 -3 3 -3 0C-3 -3 -11 -8 -11 -20Z" fill="rgba(210,230,255,0.3)" stroke="#e9dcc0" stroke-width="1.5"/><path d="M-8 20C-6 12 6 12 8 20Z" fill="#e2b25a"/><rect x="-15" y="-24" width="30" height="5" rx="2" fill="#c9a35a"/><rect x="-15" y="19" width="30" height="5" rx="2" fill="#c9a35a"/>',
    lustre: '<path d="M0 -30V-8" stroke="#c9a35a" stroke-width="2.5"/><path d="M-18 6A18 18 0 0 1 18 6Z" fill="#c9a35a" stroke="#6a461a" stroke-width="2"/><ellipse cx="0" cy="11" rx="8" ry="6" fill="#ffd27a"/>'
  };
  var PERSP_NAMES = { relogio: "o relógio", janela: "a janela", quadro: "o quadro", vela: "a vela", ampulheta: "a ampulheta", lustre: "o lustre", caixa: "uma caixa" };

  function renderPerspective(puzzle){
    puzzle._step = 0; // 0: achar o ponto de fuga · 1: achar a caixa certa · 2: concluído
    var W = 600, H = 360, CELL = 60, DEPTH = 0.55;
    var vp = { x: puzzle.vpCol * CELL + 30, y: 2 * CELL + 30 };
    function toward(p, f, target){
      var t = target || vp;
      return { x: p.x + f * (t.x - p.x), y: p.y + f * (t.y - p.y) };
    }
    function pts(list){ return list.map(function(p){ return p.x + "," + p.y; }).join(" "); }
    function seg(a, b, cls){ return svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, "class": cls }); }
    function coord(x, y){ return "ABCDEFGHIJ"[Math.floor(x / CELL)] + (Math.floor(y / CELL) + 1); }

    var wrap = document.createElement("div");
    wrap.className = "persp-wrap";
    var stepEl = document.createElement("div");
    stepEl.className = "persp-step";
    wrap.appendChild(stepEl);

    var svg = svgEl("svg", { viewBox: "-26 -24 632 390", "class": "persp-svg" });
    var corners = [ { x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H } ];
    var back = corners.map(function(c){ return toward(c, DEPTH); });

    // sala: teto, paredes, piso e parede do fundo
    svg.appendChild(svgEl("polygon", { points: pts([corners[0], corners[1], back[1], back[0]]), "class": "persp-teto" }));
    svg.appendChild(svgEl("polygon", { points: pts([corners[0], back[0], back[3], corners[3]]), "class": "persp-parede" }));
    svg.appendChild(svgEl("polygon", { points: pts([corners[1], back[1], back[2], corners[2]]), "class": "persp-parede" }));
    svg.appendChild(svgEl("polygon", { points: pts([corners[3], corners[2], back[2], back[3]]), "class": "persp-piso" }));
    svg.appendChild(svgEl("polygon", { points: pts(back), "class": "persp-fundo" }));
    var x0, y0;
    for(x0 = 0; x0 <= W; x0 += 75){ svg.appendChild(seg({ x: x0, y: H }, toward({ x: x0, y: H }, DEPTH), "persp-tabua")); }
    for(x0 = 0; x0 <= W; x0 += 150){ svg.appendChild(seg({ x: x0, y: 0 }, toward({ x: x0, y: 0 }, DEPTH), "persp-tabua")); }
    for(y0 = 120; y0 <= 240; y0 += 120){
      svg.appendChild(seg({ x: 0, y: y0 }, toward({ x: 0, y: y0 }, DEPTH), "persp-tabua"));
      svg.appendChild(seg({ x: W, y: y0 }, toward({ x: W, y: y0 }, DEPTH), "persp-tabua"));
    }
    corners.forEach(function(c, i){ svg.appendChild(seg(c, back[i], "persp-quina")); });

    // objetos clicáveis: { key, name, coord, x1, y1, x2, y2 }
    var objects = [];
    function addIcon(key, cx, cy){
      var g = svgEl("g", { transform: "translate(" + cx + " " + cy + ")" });
      g.innerHTML = PERSP_ICONS[key];
      svg.appendChild(g);
      objects.push({ key: key, name: PERSP_NAMES[key], coord: coord(cx, cy), x1: cx - 26, y1: cy - 26, x2: cx + 26, y2: cy + 26 });
    }
    puzzle.wall.forEach(function(key, i){ addIcon(key, (puzzle.vpCol - 1 + i) * CELL + 30, vp.y); });
    var cubeOnRight = vp.x <= W / 2;
    addIcon("lustre", cubeOnRight ? 90 : 510, 36);
    addIcon("vela", 30, 210);
    addIcon("ampulheta", 570, 210);

    // caixas no piso: só uma tem as arestas apontando para o ponto de fuga
    var wrongIdx = 0;
    [90, 330, 510].forEach(function(cx, i){
      var front = [ { x: cx - 27, y: 298 }, { x: cx + 27, y: 298 }, { x: cx + 27, y: 352 }, { x: cx - 27, y: 352 } ];
      var side = cx - vp.x >= 0 ? 1 : -1;
      var style = i === puzzle.correctBox ? "certa" : puzzle.wrongStyles[wrongIdx++];
      var rear = front.map(function(p){
        if(style === "certa") return toward(p, 0.3);
        if(style === "lado") return toward(p, 0.3, { x: cx + side * 230, y: vp.y });   // foge para o lado errado
        return { x: p.x + side * 24, y: p.y - 30 };                                    // arestas paralelas, sem convergir
      });
      var g = svgEl("g", { "class": "persp-caixa" });
      if(rear[1].x > front[1].x) g.appendChild(svgEl("polygon", { points: pts([front[1], rear[1], rear[2], front[2]]), "class": "persp-caixa-lado" }));
      else if(rear[0].x < front[0].x) g.appendChild(svgEl("polygon", { points: pts([front[0], rear[0], rear[3], front[3]]), "class": "persp-caixa-lado" }));
      g.appendChild(svgEl("polygon", { points: pts([front[0], front[1], rear[1], rear[0]]), "class": "persp-caixa-topo" }));
      g.appendChild(svgEl("polygon", { points: pts(front), "class": "persp-caixa-frente" }));
      g.appendChild(svgEl("path", { d: "M" + (cx - 27) + " 298L" + (cx + 27) + " 352M" + (cx + 27) + " 298L" + (cx - 27) + " 352", "class": "persp-caixa-ripa" }));
      svg.appendChild(g);
      var all = front.concat(rear);
      objects.unshift({
        key: "caixa", name: PERSP_NAMES.caixa, coord: coord(cx, 325), box: i, el: g,
        x1: Math.min.apply(null, all.map(function(p){ return p.x; })), y1: Math.min.apply(null, all.map(function(p){ return p.y; })),
        x2: Math.max.apply(null, all.map(function(p){ return p.x; })), y2: 352
      });
    });

    // figura 3D projetada sobre a cena: um cubo em arame com as arestas indo para o ponto de fuga
    var cx0 = cubeOnRight ? 430 : 90;
    var cubeFront = [ { x: cx0, y: 22 }, { x: cx0 + 80, y: 22 }, { x: cx0 + 80, y: 102 }, { x: cx0, y: 102 } ];
    var cubeRear = cubeFront.map(function(p){ return toward(p, 0.35); });
    var cube = svgEl("g", { "class": "persp-cubo" });
    cube.appendChild(svgEl("polygon", { points: pts(cubeRear) }));
    cubeFront.forEach(function(p, i){ cube.appendChild(seg(p, cubeRear[i], "")); });
    cube.appendChild(svgEl("polygon", { points: pts(cubeFront) }));
    cubeRear.forEach(function(p){ cube.appendChild(seg(p, toward(p, 0.3), "persp-raio")); });
    svg.appendChild(cube);

    // grade de coordenadas (colunas A-J, linhas 1-6)
    var grid = svgEl("g", { "class": "persp-grade" });
    for(var c = 0; c <= 10; c++){ grid.appendChild(seg({ x: c * CELL, y: 0 }, { x: c * CELL, y: H }, "")); }
    for(var r = 0; r <= 6; r++){ grid.appendChild(seg({ x: 0, y: r * CELL }, { x: W, y: r * CELL }, "")); }
    for(c = 0; c < 10; c++){
      var tc = svgEl("text", { x: c * CELL + 30, y: -8, "text-anchor": "middle" });
      tc.textContent = "ABCDEFGHIJ"[c];
      grid.appendChild(tc);
    }
    for(r = 0; r < 6; r++){
      var tr = svgEl("text", { x: -13, y: r * CELL + 36, "text-anchor": "middle" });
      tr.textContent = String(r + 1);
      grid.appendChild(tr);
    }
    svg.appendChild(grid);

    // linhas até o ponto de fuga, reveladas depois da primeira resposta
    var reveal = svgEl("g", { "class": "persp-revela" });
    corners.concat(cubeRear).forEach(function(p){ reveal.appendChild(seg(p, vp, "")); });
    reveal.appendChild(svgEl("circle", { cx: vp.x, cy: vp.y, r: 30 }));
    svg.appendChild(reveal);

    var mark = svgEl("rect", { width: CELL, height: CELL, "class": "persp-marca" });
    svg.appendChild(mark);
    wrap.appendChild(svg);

    var status = document.createElement("div");
    status.className = "persp-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    wrap.appendChild(status);

    function showStep(){
      if(puzzle._step === 0) stepEl.innerHTML = "<strong>1ª pergunta:</strong> clique no objeto que está exatamente no ponto de fuga.";
      else if(puzzle._step === 1) stepEl.innerHTML = "<strong>2ª pergunta:</strong> clique na caixa que foi desenhada corretamente em perspectiva.";
      else stepEl.innerHTML = "<strong>Respondido!</strong> Clique em Verificar para continuar.";
    }
    function say(text, ok){
      status.textContent = text;
      status.className = "persp-status" + (ok ? " ok" : " err");
    }

    svg.addEventListener("click", function(e){
      if(puzzle._step >= 2) return;
      var p = svg.createSVGPoint();
      p.x = e.clientX; p.y = e.clientY;
      p = p.matrixTransform(svg.getScreenCTM().inverse());
      if(p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return;
      var where = coord(p.x, p.y);
      mark.setAttribute("x", Math.floor(p.x / CELL) * CELL);
      mark.setAttribute("y", Math.floor(p.y / CELL) * CELL);
      mark.classList.add("visivel");
      var hit = null;
      objects.forEach(function(o){ if(!hit && p.x >= o.x1 && p.x <= o.x2 && p.y >= o.y1 && p.y <= o.y2) hit = o; });
      if(!hit){ say("Coordenada " + where + ": não há nenhum objeto aqui.", false); return; }

      if(puzzle._step === 0){
        if(hit.key === puzzle.wall[1]){
          puzzle._step = 1;
          svg.classList.add("fuga-achada");
          say("Isso! " + hit.name.charAt(0).toUpperCase() + hit.name.slice(1) + ", na coordenada " + hit.coord + ", está no ponto de fuga: todas as linhas se encontram ali.", true);
        } else {
          say("Coordenada " + where + " (" + hit.name + "): as linhas da sala não se encontram neste objeto.", false);
        }
      } else if(hit.key !== "caixa"){
        say("Coordenada " + where + " (" + hit.name + "): agora procure entre as três caixas do piso.", false);
      } else if(hit.box === puzzle.correctBox){
        puzzle._step = 2;
        hit.el.classList.add("certa");
        say("Perfeito! As arestas da caixa em " + hit.coord + " apontam para o ponto de fuga.", true);
      } else {
        say("Coordenada " + where + ": as arestas desta caixa não apontam para o ponto de fuga.", false);
      }
      showStep();
    });

    showStep();
    puzzleBodyEl.appendChild(wrap);
  }

  function renderPictureComplete(){
    clearBody();
    var wrap = document.createElement("div");
    wrap.className = "picture-complete";
    var img = document.createElement("img");
    img.src = MONALISA_URL;
    img.alt = "Mona Lisa, de Leonardo da Vinci, com o quadro reconstruído";
    var cap = document.createElement("div");
    cap.className = "picture-complete-caption";
    cap.textContent = "Mona Lisa — Leonardo da Vinci";
    wrap.appendChild(img);
    wrap.appendChild(cap);
    puzzleBodyEl.appendChild(wrap);
  }

  function handleMemoryCardClick(puzzle, idx, cardEl){
    if(cardEl.classList.contains("flipped") || cardEl.classList.contains("matched")) return;
    if(!puzzle._flipped){
      if(puzzle._busy) return;
      cardEl.classList.add("flipped");
      puzzle._flipped = { idx: idx, el: cardEl };
      return;
    }
    var first = puzzle._flipped;
    if(first.idx === idx) return;
    cardEl.classList.add("flipped");
    puzzle._flipped = null;
    var isMatch = puzzle.cards[first.idx].key === puzzle.cards[idx].key;
    if(isMatch){
      first.el.classList.add("matched");
      cardEl.classList.add("matched");
      puzzle._matchedCount = (puzzle._matchedCount || 0) + 1;
      var label = puzzleBodyEl.querySelector("#memoryFoundLabel");
      if(label) label.textContent = String(puzzle._matchedCount);
    } else {
      puzzle._busy = true;
      setTimeout(function(){
        first.el.classList.remove("flipped");
        cardEl.classList.remove("flipped");
        puzzle._busy = false;
      }, 700);
    }
  }

  function renderMemory(puzzle){
    var wrap = document.createElement("div");
    wrap.className = "memory-wrap";
    var status = document.createElement("div");
    status.className = "memory-status";
    status.innerHTML = 'Pares encontrados: <strong id="memoryFoundLabel">0</strong> de ' + puzzle.totalPairs;
    wrap.appendChild(status);
    var grid = document.createElement("div");
    grid.className = "memory-grid";
    puzzle.cards.forEach(function(card, idx){
      var cardEl = document.createElement("button");
      cardEl.type = "button";
      cardEl.className = "memory-card";
      cardEl.setAttribute("aria-label", "Carta " + (idx + 1));
      cardEl.innerHTML = '<span class="memory-card-back">?</span><span class="memory-card-front">' + MEMORY_ICONS[card.key] + '</span>';
      cardEl.addEventListener("click", function(){
        handleMemoryCardClick(puzzle, idx, cardEl);
      });
      grid.appendChild(cardEl);
    });
    wrap.appendChild(grid);
    puzzleBodyEl.appendChild(wrap);
  }

  function handleWsCellClick(puzzle, r, c, cellEl, cellEls){
    if(!puzzle._selection){
      puzzle._selection = { r:r, c:c, el:cellEl };
      cellEl.classList.add("selecting");
      return;
    }
    var start = puzzle._selection;
    start.el.classList.remove("selecting");
    puzzle._selection = null;
    if(start.r === r && start.c === c) return;

    var line = cellsInLine(start.r, start.c, r, c);
    if(!line) return;

    var letters = line.map(function(pos){ return puzzle.grid[pos[0]][pos[1]]; }).join("");
    var lettersRev = letters.split("").reverse().join("");
    var matchedWord = null;
    puzzle.words.forEach(function(w){
      if(puzzle._foundWords[w]) return;
      if(letters !== w && lettersRev !== w) return;
      var placement = puzzle.placements.filter(function(p){ return p.word === w; })[0];
      if(!placement) return;
      var lineSorted = JSON.stringify(line.slice().sort());
      var placementSorted = JSON.stringify(placement.cells.slice().sort());
      if(lineSorted === placementSorted) matchedWord = w;
    });

    if(matchedWord){
      puzzle._foundWords[matchedWord] = true;
      line.forEach(function(pos){ cellEls[pos[0]][pos[1]].classList.add("found"); });
      var wordTag = puzzleBodyEl.querySelector('.ws-word[data-word="' + matchedWord + '"]');
      if(wordTag) wordTag.classList.add("found");
      var label = puzzleBodyEl.querySelector('#wsFoundLabel');
      if(label) label.textContent = String(Object.keys(puzzle._foundWords).length);
    }
  }

  function renderWordSearch(puzzle){
    var wrap = document.createElement("div");
    wrap.className = "wordsearch-wrap";

    puzzle._foundWords = puzzle._foundWords || {};
    puzzle._selection = null;

    var status = document.createElement("div");
    status.className = "ws-status";
    status.innerHTML = "Encontradas: <strong id=\"wsFoundLabel\">" + Object.keys(puzzle._foundWords).length + "</strong> de " + puzzle.words.length;
    wrap.appendChild(status);

    var gridEl = document.createElement("div");
    gridEl.className = "ws-grid";
    gridEl.style.gridTemplateColumns = "repeat(" + puzzle.grid.length + ", 1fr)";
    var cellEls = [];
    for(var r=0;r<puzzle.grid.length;r++){
      cellEls.push([]);
      for(var c=0;c<puzzle.grid[r].length;c++){
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "ws-cell";
        cell.textContent = puzzle.grid[r][c];
        (function(rr, cc, cellRef){
          cellRef.addEventListener("click", function(){
            handleWsCellClick(puzzle, rr, cc, cellRef, cellEls);
          });
        })(r, c, cell);
        gridEl.appendChild(cell);
        cellEls[r].push(cell);
      }
    }
    wrap.appendChild(gridEl);

    var listEl = document.createElement("div");
    listEl.className = "ws-wordlist";
    puzzle.words.forEach(function(w){
      var tag = document.createElement("span");
      tag.className = "ws-word";
      tag.textContent = w;
      tag.setAttribute("data-word", w);
      if(puzzle._foundWords[w]) tag.classList.add("found");
      listEl.appendChild(tag);
    });
    wrap.appendChild(listEl);

    // restore any already-found words' highlighting (e.g. after a failed Verificar click re-render)
    Object.keys(puzzle._foundWords).forEach(function(w){
      var placement = puzzle.placements.filter(function(p){ return p.word === w; })[0];
      if(placement){
        placement.cells.forEach(function(pos){ cellEls[pos[0]][pos[1]].classList.add("found"); });
      }
    });

    puzzleBodyEl.appendChild(wrap);
  }

  function renderPuzzleBody(puzzle){
    clearBody();
    if(puzzle.type === "mc"){
      if(puzzle.parchmentText) renderParchmentNote(puzzle.parchmentText);
      if(puzzle.spiralSvg) renderSpiralNote();
      if(puzzle.bridgeSvg) renderBridgeNote();
      renderMC(puzzle);
    }
    else if(puzzle.type === "magic") renderMagic(puzzle);
    else if(puzzle.type === "order") renderOrder(puzzle);
    else if(puzzle.type === "match") renderMatch(puzzle);
    else if(puzzle.type === "pyramid") renderPyramid(puzzle);
    else if(puzzle.type === "wordsearch") renderWordSearch(puzzle);
    else if(puzzle.type === "tangram") renderTangram(puzzle);
    else if(puzzle.type === "picture") renderPicture(puzzle);
    else if(puzzle.type === "memory") renderMemory(puzzle);
    else if(puzzle.type === "safe") renderSafe(puzzle);
    else if(puzzle.type === "bridge") renderBridge(puzzle);
    else if(puzzle.type === "scale") renderScale(puzzle);
    else if(puzzle.type === "mirror") renderMirror(puzzle);
    else if(puzzle.type === "paint") renderPaint(puzzle);
    else if(puzzle.type === "perspective") renderPerspective(puzzle);
    else if(puzzle.type === "study") renderStudy(puzzle);
    else if(puzzle.type === "davinci") renderDavinci(puzzle);
    else if(puzzle.type === "scrolls") renderScrolls(puzzle);
  }

  // ---------- Level rendering ----------
  function renderPuzzle(){
    var level = levels[state.levelIndex];
    var puzzle = level.puzzles[state.puzzleIndex];

    levelStoryEl.textContent = level.story;
    puzzleLabelEl.textContent = "SALA " + (state.levelIndex+1) + " · " + level.difficulty +
      " — DESAFIO " + (state.puzzleIndex+1) + " DE " + level.puzzles.length;
    puzzleQuestionEl.textContent = puzzle.question;
    feedbackEl.textContent = "";
    feedbackEl.className = "feedback";
    hintBox.textContent = puzzle.hint;
    hintBox.classList.remove("show");
    state.awaitingContinue = false;
    btnCheck.textContent = "Verificar";
    btnHint.classList.remove("hidden");

    renderPuzzleBody(puzzle);

    renderDots();
    showScreen("level");
  }

  function evaluatePuzzle(puzzle){
    if(puzzle.type === "mc"){
      var checked = puzzleBodyEl.querySelector('input[name="mcChoice"]:checked');
      if(!checked) return null;
      return parseInt(checked.value, 10) === puzzle.correctIndex;
    }
    if(puzzle.type === "wordsearch"){
      var foundCount = puzzle._foundWords ? Object.keys(puzzle._foundWords).length : 0;
      if(foundCount < puzzle.words.length) return null;
      return true;
    }
    if(puzzle.type === "memory"){
      var matchedCount = puzzle._matchedCount || 0;
      if(matchedCount < puzzle.totalPairs) return null;
      return true;
    }
    if(puzzle.type === "bridge"){
      if((puzzle._step || 0) < puzzle.nodes.length) return null;
      return true;
    }
    if(puzzle.type === "scale"){
      return puzzle._solved >= puzzle.questions.length ? true : null;
    }
    if(puzzle.type === "scrolls"){
      return puzzle._matched >= puzzle.pairs.length ? true : null;
    }
    if(puzzle.type === "davinci"){
      return puzzle._placed >= puzzle.pieces.length ? true : null;
    }
    if(puzzle.type === "study"){
      return puzzle._found >= puzzle.targets.length ? true : null;
    }
    if(puzzle.type === "perspective"){
      if((puzzle._step || 0) < 2) return null;
      return true;
    }
    if(puzzle.type === "paint"){
      var drops = puzzle._drops;
      if(drops.r + drops.y + drops.b === 0) return null;
      return drops.r === puzzle.answer.r && drops.y === puzzle.answer.y && drops.b === puzzle.answer.b;
    }
    if(puzzle.type === "mirror"){
      var typed = puzzleBodyEl.querySelector(".mirror-input").value.replace(/\s/g, "");
      if(typed === "") return null;
      return typed === String(puzzle.answer);
    }
    if(puzzle.type === "safe"){
      return puzzle.code.every(function(d, i){ return puzzle._values[i] === d; });
    }
    var selects = puzzleBodyEl.querySelectorAll("select[data-answer]");
    if(selects.length === 0) return null;
    var allFilled = true;
    var allCorrect = true;
    selects.forEach(function(sel){
      if(sel.value === ""){ allFilled = false; }
      else if(sel.value !== sel.getAttribute("data-answer")){ allCorrect = false; }
    });
    if(!allFilled) return null;
    return allCorrect;
  }

  function advancePuzzle(){
    var level = levels[state.levelIndex];
    state.puzzleIndex++;
    if(state.puzzleIndex >= level.puzzles.length){
      onLevelComplete();
    } else {
      renderPuzzle();
    }
  }

  function checkAnswer(){
    if(state.awaitingContinue){
      advancePuzzle();
      return;
    }
    var level = levels[state.levelIndex];
    var puzzle = level.puzzles[state.puzzleIndex];
    var result = evaluatePuzzle(puzzle);

    if(result === null){
      feedbackEl.textContent = "Complete o desafio antes de verificar.";
      feedbackEl.className = "feedback err";
      return;
    }

    if(result === true){
      if(puzzle.type === "picture"){
        // mostra o quadro montado e espera o jogador clicar em Continuar
        renderPictureComplete();
        feedbackEl.textContent = "Correto! O quadro foi reconstruído.";
        feedbackEl.className = "feedback ok";
        hintBox.classList.remove("show");
        btnHint.classList.add("hidden");
        btnCheck.textContent = "Continuar";
        state.awaitingContinue = true;
        return;
      }
      var delay = 700;
      feedbackEl.textContent = "Correto! A engrenagem gira...";
      if(puzzle.type === "safe"){
        // gira a maçaneta e acende a luz antes de avançar
        puzzleBodyEl.querySelector(".safe-door").classList.add("aberto");
        feedbackEl.textContent = "Correto! As roletas travam e o cofre se abre...";
        delay = 1500;
      }
      if(puzzle.type === "paint"){
        feedbackEl.textContent = "Correto! A cor é idêntica e o afresco está completo...";
        delay = 1500;
      }
      feedbackEl.className = "feedback ok";
      btnCheck.disabled = true;
      setTimeout(function(){
        btnCheck.disabled = false;
        advancePuzzle();
      }, delay);
    } else {
      feedbackEl.textContent = "Ainda não é isso. Tente novamente ou peça uma dica.";
      feedbackEl.className = "feedback err";
    }
  }

  function onLevelComplete(){
    var level = levels[state.levelIndex];
    state.fragments[state.levelIndex] = level.fragmentDigit;

    fragmentStoryEl.textContent = level.fragmentStory;
    fragmentNumEl.textContent = level.fragmentDigit;
    showScreen("fragment");
  }

  function goToNextLevel(){
    if(state.levelIndex === levels.length - 1){
      showScreen("vault");
      renderDots();
      vaultInput.value = "";
      vaultFeedback.textContent = "";
      updateVaultSlots("");
      vaultInput.focus();
      return;
    }
    state.levelIndex++;
    state.puzzleIndex = 0;
    renderPuzzle();
  }

  // ---------- Vault ----------
  function updateVaultSlots(str){
    for(var i=0;i<3;i++){
      var ch = str[i];
      if(ch){
        slots[i].textContent = ch;
        slots[i].classList.add("filled");
      } else {
        slots[i].textContent = "•";
        slots[i].classList.remove("filled");
      }
    }
  }

  function checkVault(){
    var raw = vaultInput.value.replace(/\s/g,"");
    if(raw === state.fragments.join("")){
      vaultFeedback.textContent = "O cofre se abre!";
      vaultFeedback.className = "feedback ok";
      stopTimer();
      finalTimeEl.textContent = formatTime(GAME_SECONDS - state.secondsLeft);
      setTimeout(function(){
        showScreen("victory");
        // tira e põe a classe para a porta do cofre abrir de novo a cada vitória
        cofreAnim.classList.remove("abrindo");
        void cofreAnim.offsetWidth;
        cofreAnim.classList.add("abrindo");
      }, 800);
    } else {
      vaultFeedback.textContent = "O mecanismo resiste... esse não é o código certo.";
      vaultFeedback.className = "feedback err";
    }
  }

  // ---------- Vídeo de abertura ----------
  // Passa entre a capa e as regras. Termina sozinho ao fim do vídeo ou pelo botão "Pular vídeo".
  function abrirVideo(){
    var iframe = document.createElement("iframe");
    iframe.src = "https://www.youtube.com/embed/" + videoEl.getAttribute("data-video") +
      "?autoplay=1&rel=0&enablejsapi=1&origin=" + encodeURIComponent(location.origin);
    iframe.title = "Vídeo de abertura";
    iframe.allow = "autoplay; encrypted-media; fullscreen";
    // sem isto o YouTube recusa o vídeo (erro 153), pois o Django envia Referrer-Policy: same-origin
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    videoQuadro.appendChild(iframe);
    videoEl.classList.remove("hidden");
    document.getElementById("btnPularVideo").focus();
    observarFimDoVideo(iframe);
  }

  function fecharVideo(){
    if(videoEl.classList.contains("hidden")) return;
    videoEl.classList.add("hidden");
    videoQuadro.innerHTML = ""; // remove o iframe para o som parar
    document.getElementById("btnStart").focus();
  }

  // Usa a API do YouTube só para saber quando o vídeo acabou. Se ela não carregar
  // (sem internet, por exemplo), o botão "Pular vídeo" continua funcionando.
  function observarFimDoVideo(iframe){
    function ligar(){
      if(!iframe.parentNode) return;
      new YT.Player(iframe, {
        events: {
          onStateChange: function(ev){
            if(ev.data === YT.PlayerState.ENDED) fecharVideo();
          }
        }
      });
    }
    if(window.YT && window.YT.Player){
      ligar();
      return;
    }
    window.onYouTubeIframeAPIReady = ligar;
    if(!document.getElementById("ytApi")){
      var s = document.createElement("script");
      s.id = "ytApi";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  }

  // ---------- Restart ----------
  function restart(){
    state.levelIndex = 0;
    state.puzzleIndex = 0;
    state.fragments = ["","",""];
    state.secondsLeft = GAME_SECONDS;
    stopTimer();
    updateTimerDisplay();
    renderDots();
    showScreen("intro");
    capaEl.classList.remove("hidden");
  }

  // ---------- Events ----------
  document.getElementById("btnCapa").addEventListener("click", function(){
    // garante a tela cheia no telão, caso o navegador não tenha aberto assim
    var raiz = document.documentElement;
    if(!document.fullscreenElement && raiz.requestFullscreen){
      raiz.requestFullscreen().catch(function(){});
    }
    capaEl.classList.add("hidden");
    abrirVideo();
  });

  document.getElementById("btnPularVideo").addEventListener("click", fecharVideo);

  document.getElementById("btnStart").addEventListener("click", function(){
    state.era = nextEra();
    levels = buildLevels(state.era);
    state.levelIndex = 0;
    state.puzzleIndex = 0;
    state.fragments = ["", "", ""];
    state.secondsLeft = GAME_SECONDS;
    updateTimerDisplay();
    startTimer();
    renderPuzzle();
  });

  btnCheck.addEventListener("click", checkAnswer);

  btnHint.addEventListener("click", function(){
    hintBox.classList.toggle("show");
  });

  document.getElementById("btnNextLevel").addEventListener("click", goToNextLevel);

  document.getElementById("btnVaultCheck").addEventListener("click", checkVault);
  vaultInput.addEventListener("input", function(){
    updateVaultSlots(vaultInput.value.replace(/\D/g,""));
  });
  vaultInput.addEventListener("keydown", function(e){
    if(e.key === "Enter") checkVault();
  });

  document.getElementById("btnRestart").addEventListener("click", restart);
  var btnRestartTimeout = document.getElementById("btnRestartTimeout");
  if(btnRestartTimeout) btnRestartTimeout.addEventListener("click", restart);

  // Voltar ao início no meio da partida: pede confirmação antes de perder o progresso.
  // O relógio continua correndo enquanto a pergunta está na tela.
  btnSair.addEventListener("click", function(){
    sairConfirma.classList.remove("hidden");
    document.getElementById("btnSairNao").focus();
  });
  document.getElementById("btnSairNao").addEventListener("click", function(){
    sairConfirma.classList.add("hidden");
    btnSair.focus();
  });
  document.getElementById("btnSairSim").addEventListener("click", restart);

  // ---------- Init ----------
  updateTimerDisplay();
  renderDots();
})();

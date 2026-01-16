
// Wheel of Fortune — fixed & robust

const VOWELS = new Set(["A","E","I","O","U"]);
const WHEEL_SLICES = [
  { label:"50", value:50, color:"#1d4ed8"},
  { label:"100", value:100, color:"#0ea5e9"},
  { label:"150", value:150, color:"#22c55e"},
  { label:"200", value:200, color:"#f59e0b"},
  { label:"250", value:250, color:"#84cc16"},
  { label:"300", value:300, color:"#eab308"},
  { label:"350", value:350, color:"#06b6d4"},
  { label:"400", value:400, color:"#a855f7"},
  { label:"500", value:500, color:"#ef4444"},
  { label:"Lose Turn", value:0, loseTurn:true, color:"#991b1b"},
  { label:"Bankrupt", value:0, bankrupt:true, color:"#7c3aed"},
  { label:"1000", value:1000, color:"#16a34a"}
];

let teams = [
  {name:()=>document.getElementById('team1Name').value, scoreEl:()=>document.getElementById('team1Score')},
  {name:()=>document.getElementById('team2Name').value, scoreEl:()=>document.getElementById('team2Score')},
  {name:()=>document.getElementById('team3Name').value, scoreEl:()=>document.getElementById('team3Score')}
];

let lastSliceIndex = null; // remember what we landed on last
let turn=0,
    currentWord='',
    currentHint='',
    currentCategory='General',
    revealed=[],
    wheelAngle=0,
    spinning=false,
    dataSets=[];

function setMessage(msg){
  const el = document.getElementById('messages');
  if (el) el.textContent = msg;
}

// Load default vocab (works well on iPhone/GitHub Pages)
async function loadDefaultVocab(){
  const fallback = [{
    category:'Cybersecurity',
    words:[
      {term:'CAESAR CIPHER', hint:'A substitution cipher that shifts letters by a fixed number'},
      {term:'CRYPTOGRAPHY', hint:'Secure communication techniques'},
      {term:'DIGITAL CERTIFICATE', hint:'Proves ownership of a public key'},
      {term:'OPERATING SYSTEM', hint:'Manages device hardware/software'},
      {term:'FILE ENCRYPTION AND COMPRESSION', hint:'Secure + reduce file size'},
      {term:'PATCHES', hint:'Updates fixing vulnerabilities or bugs'},
      {term:'UPDATE', hint:'Install the latest version of software'},
      {term:'COMPUTER VIRUS', hint:'Malicious program that can replicate and spread'},
      {term:'POPUP BLOCKER', hint:'Prevents unwanted pop-up windows'}
    ]
  }];

  try{
    const res = await fetch('./vocab.json?cache=' + Date.now());
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const parsed = Array.isArray(json) ? json : [json];

    // Minimal schema check
    const shapeOK = parsed.every(s => s && typeof s.category === 'string' && Array.isArray(s.words));
    const wordsOK = shapeOK && parsed.every(s => s.words.every(w => w && typeof w.term === 'string'));
    if(!shapeOK || !wordsOK){
      console.error('Invalid vocab.json schema:', json);
      setMessage('Using fallback (invalid vocab.json schema).');
      dataSets = fallback;
    } else {
      dataSets = parsed;
    }
  }catch(e){
    console.error('Failed to load vocab.json:', e);
    setMessage('Using fallback (could not load vocab.json).');
    dataSets = fallback;
  }
}

function sanitizeWord(w){ return (w || '').toUpperCase(); }

function pickRandom(){
  if (!dataSets.length){
    setMessage('No vocabulary loaded.');
    return;
  }
  const set  = dataSets[Math.floor(Math.random()*dataSets.length)];
  const item = set.words[Math.floor(Math.random()*set.words.length)];

  currentCategory = set.category || 'General';
  currentHint = item.hint || '';
  currentWord = sanitizeWord(item.term);

  revealed = currentWord.split('').map(ch => ch === ' ' ? ' ' : '_');
  drawPuzzle();
}

function drawPuzzle(){
  const p = document.getElementById('puzzle');
  if(!p) return;
  p.innerHTML='';

  for(const ch of revealed){
    const d = document.createElement('div');
    if(ch === ' '){
      d.className = 'tile space';
    } else if(ch === '_'){
      d.className = 'tile';
    } else {
      d.className = 'tile revealed';
      d.textContent = ch;
    }
    p.appendChild(d);
  }

  const cat = document.getElementById('categoryText');
  if (cat) cat.textContent = currentCategory;
}

function nextTurn(){
  turn = (turn + 1) % teams.length;
  const el = document.getElementById('turnName');
  if (el) el.textContent = teams[turn].name();
}

function addScore(points){
  const el = teams[turn].scoreEl();
  const current = parseInt(el.textContent, 10) || 0;
  el.textContent = String(current + points);
}


function buildKeyboard(){
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (const ch of letters){
    const btn = document.createElement('button');
    btn.className = 'key' + (VOWELS.has(ch) ? ' vowel' : '');
    btn.textContent = ch;

    // STEP 5: add the data attribute here 👇
    btn.dataset.letter = ch;

    btn.disabled = true;
    btn.addEventListener('click', () => pickLetter(ch));
    kb.appendChild(btn);
  }
}


function enableKeys(vowels){
  document.querySelectorAll('.key').forEach(b=>{
    const isVowel = VOWELS.has(b.textContent);
    b.disabled = vowels ? !isVowel : isVowel;
  });
}

function disableAllKeys(){
  document.querySelectorAll('.key').forEach(b=> b.disabled = true);
}

function revealLetter(ch){
  let count=0;
  for(let i=0;i<currentWord.length;i++){
    if(currentWord[i]===ch && revealed[i]==='_'){
      revealed[i]=ch;
      count++;
    }
  }
  drawPuzzle();
  return count;
}

function isSolved(){ return revealed.every(ch=>ch !== '_'); }

function drawWheel(angle = wheelAngle){
  const canvas = document.getElementById('wheel');
  if (!canvas) { console.warn('No #wheel canvas found.'); return; }
  const ctx = canvas.getContext('2d');
  const radius = 200, cx = 210, cy = 210;

  ctx.clearRect(0,0,420,420);

  const sliceAngle = 2 * Math.PI / WHEEL_SLICES.length;

  for (let i = 0; i < WHEEL_SLICES.length; i++){
    const start = angle + i * sliceAngle;
    const end   = start + sliceAngle;

    // fill slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = WHEEL_SLICES[i].color;
    ctx.fill();

    // text label
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + sliceAngle / 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(WHEEL_SLICES[i].label, radius - 10, 6);
    ctx.restore();

    // highlight stroke if this is the selected slice
    if (lastSliceIndex === i){
      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // inner rim highlight
      ctx.save();
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 8, start, end);
      ctx.stroke();
      ctx.restore();
    }
  }

  // pointer (static triangle)
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius - 10);
  ctx.lineTo(cx - 12, cy - radius - 35);
  ctx.lineTo(cx + 12, cy - radius - 35);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();

  // tiny pointer tip accent
  ctx.beginPath();
  ctx.arc(cx, cy - radius - 25, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();
}

function spin(vowels){
  if(spinning) return;

  spinning=true;
  disableAllKeys();
  setMessage('Spinning...');

  const target   = Math.random()*Math.PI*6 + Math.PI*3;
  const start    = wheelAngle;
  const duration = 1800 + Math.random()*800;
  const startTime= performance.now();

  function animate(t){
    const elapsed=t-startTime;
    const ease=x=>1-Math.pow(1-x,3);
    const p=Math.min(1,elapsed/duration);

    wheelAngle = start + target * ease(p);
    drawWheel();

    if(p<1){
      requestAnimationFrame(animate);
    } else {
      spinning=false;
      const sliceAngle=2*Math.PI/WHEEL_SLICES.length;
      const idx=Math.floor(((2*Math.PI-(wheelAngle%(2*Math.PI)))/sliceAngle))%WHEEL_SLICES.length;

      handleSpinResult(WHEEL_SLICES[idx], vowels);
    }
  }
  requestAnimationFrame(animate);
}

let currentSpinValue = 0;

function handleSpinResult(result, vowels){
  // Remember the landed slice
  const sliceAngle = 2 * Math.PI / WHEEL_SLICES.length;
  const idx = Math.floor(((2 * Math.PI - (wheelAngle % (2 * Math.PI))) / sliceAngle)) % WHEEL_SLICES.length;
  lastSliceIndex = idx;

  // Update visible readout (if present)
  const landedEl = document.getElementById('landedResult');
  if (landedEl){
    const label = WHEEL_SLICES[idx].label;
    landedEl.innerHTML = `Landed on: <span class="label">${label}</span>`;
  }

  // Redraw with highlight
  drawWheel();

  // Game logic
  if(result.bankrupt){
    teams[turn].scoreEl().textContent = '0';
    setMessage(`${teams[turn].name()}: Bankrupt! Points reset.`);
    nextTurn();
    return;
  }

  if(result.loseTurn){
    setMessage(`${teams[turn].name()}: Lose Turn.`);
    nextTurn();
    return;
  }

  setMessage(`${teams[turn].name()}: Choose ${vowels ? 'a vowel' : 'a consonant'} for ${result.value} points each.`);
  enableKeys(vowels);
  currentSpinValue = result.value;
}

function markLetterUsed(ch) {
  // Find the keyboard button that matches this letter and hide it
  const btns = document.querySelectorAll('.key');
  for (const b of btns) {
    if (b.textContent === ch) {
      b.classList.add('used');
      b.disabled = true;    // keep disabled for safety
      break;
    }
  }
}

function pickLetter(ch){
  disableAllKeys();
  markLetterUsed(ch);
  const count=revealLetter(ch);

  if(count>0){
    const earned=currentSpinValue*count;
    addScore(earned);
    setMessage(`Great! Revealed ${count} '${ch}'. +${earned} points.`);

    if(isSolved()){
      setMessage(`🎉 ${teams[turn].name()} solved the word: ${currentWord}!`);
    } else {
      enableKeys(VOWELS.has(ch)); // same team continues
    }
  }
  else{
    setMessage(`No '${ch}'. Next turn.`);
    nextTurn();
  }
}

function solvePrompt(){
  const guess=prompt('Enter your solution:') || '';
  if(sanitizeWord(guess.trim())===currentWord){
    revealed = currentWord.split('');
    drawPuzzle();
    setMessage(`🎉 Correct! ${teams[turn].name()} solved the word.`);
  }
  else{
    setMessage('Incorrect. Next turn.');
    nextTurn();
  }
}

window.addEventListener('DOMContentLoaded', async ()=>{
  await loadDefaultVocab();
  buildKeyboard();
  drawWheel();
  pickRandom();

  const tn = document.getElementById('turnName');
  if (tn) tn.textContent = teams[turn].name();

  document.getElementById('spinConsonant').addEventListener('click',()=>spin(false));
  document.getElementById('spinVowel').addEventListener('click',()=>spin(true));
  document.getElementById('solveBtn').addEventListener('click',solvePrompt);


document.getElementById('newWordBtn').addEventListener('click', ()=>{
  pickRandom();
  setMessage('New word loaded.');

  // Rebuild keyboard so all letters reappear
  buildKeyboard();

  // Keep letters disabled until the next spin
  disableAllKeys();

  // (Optional) clear the wheel highlight/readout if you’re using that feature
  if (typeof lastSliceIndex !== 'undefined') lastSliceIndex = null;
  const landedEl = document.getElementById('landedResult');
  if (landedEl) landedEl.textContent = '';
  if (typeof drawWheel === 'function') drawWheel();
});


  const hintEl=document.getElementById('hint');
  document.getElementById('toggleHintBtn').addEventListener('click',()=>{
    if(!currentHint){
      hintEl.textContent='No hint.';
      hintEl.hidden=false;
      return;
    }
    hintEl.textContent=currentHint;
    hintEl.hidden=!hintEl.hidden;
  });

  // Optional: load custom JSON in class
  document.getElementById('vocabFile').addEventListener('change',async e=>{
    const file=e.target.files[0];
    if(!file) return;
    try{
      const text=await file.text();
      const json=JSON.parse(text);
      dataSets = Array.isArray(json) ? json : [json];
      setMessage('Vocabulary loaded.');
      pickRandom();
    }catch(err){
      alert('Could not read JSON. Check the format.');
    }
  });
});

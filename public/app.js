// ============================================
// FLASH PEAK COMMUNITY — CLIENT (pure Node.js backend)
// Real-time via 1s polling + IndexedDB local cache
// ============================================

const AVATARS = ['avatar1.svg','avatar2.svg','avatar3.svg','avatar4.svg','avatar5.svg','avatar6.svg'];
const POLL_INTERVAL_MS = 1000;

let selectedAvatar = AVATARS[0];
let selectedPosisi = null;
let membersCache = [];
let knownIds = new Set();
let firstSyncDone = false;

/* ---------- Position picker ---------- */
document.querySelectorAll('#positionSelector .position-opt').forEach(el => {
  el.addEventListener('click', () => {
    selectedPosisi = el.dataset.val;
    document.querySelectorAll('#positionSelector .position-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('errPosisi').textContent = '';
  });
});

/* ---------- Ambient pitch particles ---------- */
(function pitchParticles(){
  const canvas = document.getElementById('pitch-canvas');
  const ctx = canvas.getContext('2d');
  let w, h, particles;
  function resize(){ w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  function init(){
    resize();
    const count = Math.min(46, Math.floor((w*h)/38000));
    particles = Array.from({length: count}, () => ({
      x: Math.random()*w, y: Math.random()*h,
      r: 1 + Math.random()*2, vy: 0.15 + Math.random()*0.35, vx: (Math.random()-0.5)*0.15,
      hue: Math.random() > 0.5 ? '34,211,238' : '57,255,136', a: 0.15 + Math.random()*0.35,
    }));
  }
  function tick(){
    ctx.clearRect(0,0,w,h);
    particles.forEach(p => {
      p.y -= p.vy; p.x += p.vx;
      if (p.y < -10) p.y = h + 10;
      if (p.x < -10) p.x = w + 10;
      if (p.x > w+10) p.x = -10;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${p.hue},${p.a})`; ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  window.addEventListener('resize', resize);
  init(); tick();
})();

/* ---------- Avatar picker ---------- */
function renderAvatarPicker(){
  const wrap = document.getElementById('avatarPicker');
  wrap.innerHTML = AVATARS.map(a => `
    <div class="avatar-opt ${a === selectedAvatar ? 'selected' : ''}" data-avatar="${a}">
      <img src="avatars/${a}" alt="Avatar"/>
    </div>
  `).join('');
  wrap.querySelectorAll('.avatar-opt').forEach(el => {
    el.addEventListener('click', () => {
      selectedAvatar = el.dataset.avatar;
      wrap.querySelectorAll('.avatar-opt').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}
renderAvatarPicker();

/* ---------- Notification ticker (queue, cycles every 2s) ---------- */
const notifQueue = [];
let tickerBusy = false;
function queueNotification(data){ notifQueue.push(data); processQueue(); }
function processQueue(){
  if (tickerBusy || notifQueue.length === 0) return;
  tickerBusy = true;
  const item = notifQueue.shift();
  showToast(item);
  setTimeout(() => { hideToast(() => { tickerBusy = false; processQueue(); }); }, 2000);
}
function showToast(data){
  const toast = document.getElementById('joinToast');
  document.getElementById('toastName').textContent = data.nama;
  document.getElementById('toastAge').textContent = data.usia + ' th';
  document.getElementById('toastStatus').textContent = data.status;
  toast.classList.add('show');
}
function hideToast(cb){
  document.getElementById('joinToast').classList.remove('show');
  setTimeout(cb, 300);
}

/* ---------- Live roster rendering ---------- */
function renderRoster(){
  const list = document.getElementById('rosterList');
  const empty = document.getElementById('rosterEmpty');
  document.getElementById('statTotal').textContent = membersCache.length;

  const todayStr = new Date().toDateString();
  const todayCount = membersCache.filter(m => new Date(m.joinedAt).toDateString() === todayStr).length;
  document.getElementById('statToday').textContent = todayCount;

  if (membersCache.length === 0){ list.innerHTML = ''; list.appendChild(empty); return; }

  const sorted = [...membersCache].reverse();
  list.innerHTML = sorted.map(m => `
    <div class="roster-item">
      <img class="roster-avatar" src="avatars/${m.avatar}" alt=""/>
      <div class="roster-info">
        <div class="roster-name">${escapeHtml(m.nama)}</div>
        <div class="roster-meta">${m.usia} th &middot; @${escapeHtml(m.username)} &middot; ${m.memberId}</div>
      </div>
      <span class="roster-pos">${m.posisi || '-'}</span>
      <span class="roster-badge">${m.status}</span>
    </div>
  `).join('');
}
function escapeHtml(str){ const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

/* ---------- Real-time polling loop (replaces Socket.IO) ---------- */
async function pollMembers(){
  try {
    const res = await fetch('/api/members', { cache: 'no-store' });
    const data = await res.json();
    if (!data.ok) return;

    const members = data.members;

    if (!firstSyncDone){
      members.forEach(m => knownIds.add(m.memberId));
      membersCache = members;
      firstSyncDone = true;
      renderRoster();
      await fpSaveMembers(members).catch(() => {});
      return;
    }

    const newOnes = members.filter(m => !knownIds.has(m.memberId));
    if (newOnes.length > 0 || members.length !== membersCache.length){
      membersCache = members;
      renderRoster();
      await fpSaveMembers(members).catch(() => {});
    }
    newOnes.forEach(m => {
      knownIds.add(m.memberId);
      queueNotification({ nama: m.nama, usia: m.usia, status: m.status });
    });
  } catch (e) {
    // network hiccup — try again next tick, no need to surface to the user
  }
}

// Load whatever IndexedDB already has (instant paint), then start polling
(async function initRealtime(){
  try {
    const cached = await fpGetAllMembers();
    if (cached.length){
      membersCache = cached;
      cached.forEach(m => knownIds.add(m.memberId));
      renderRoster();
    }
  } catch (e) { /* IndexedDB unavailable — proceed without cache */ }

  pollMembers();
  setInterval(pollMembers, POLL_INTERVAL_MS);
})();

/* ---------- Form submit ---------- */
const form = document.getElementById('regForm');
const submitBtn = document.getElementById('submitBtn');
const flashMsg = document.getElementById('flashMsg');
const flashMsgText = document.getElementById('flashMsgText');
const fields = ['nama','usia','gameId','username','alasan','posisi'];

function clearErrors(){
  fields.forEach(f => {
    const errEl = document.getElementById('err' + capitalize(f));
    if (errEl) errEl.textContent = '';
    const inputEl = document.getElementById(f);
    if (inputEl) inputEl.classList.remove('error');
  });
  document.getElementById('positionSelector').classList.remove('error');
  flashMsg.classList.remove('show');
}
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const payload = {
    nama: document.getElementById('nama').value.trim(),
    usia: document.getElementById('usia').value.trim(),
    gameId: document.getElementById('gameId').value.trim(),
    username: document.getElementById('username').value.trim(),
    alasan: document.getElementById('alasan').value.trim(),
    avatar: selectedAvatar,
    posisi: selectedPosisi,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses...';

  let res;
  try {
    const r = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    res = await r.json();
  } catch (err) {
    res = { ok: false, errors: { nama: 'Gagal terhubung ke server, coba lagi.' } };
  }

  submitBtn.disabled = false;
  submitBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Register Now`;

  if (!res.ok){
    flashMsgText.textContent = 'Periksa kembali data yang kamu isi.';
    flashMsg.classList.add('show');
    Object.entries(res.errors || {}).forEach(([field, msg]) => {
      const errEl = document.getElementById('err' + capitalize(field));
      if (errEl) errEl.textContent = msg;
      if (field === 'posisi'){
        document.getElementById('positionSelector').classList.add('error');
      } else {
        const inputEl = document.getElementById(field);
        if (inputEl) inputEl.classList.add('error');
      }
    });
    return;
  }

  form.reset();
  selectedAvatar = AVATARS[0];
  selectedPosisi = null;
  renderAvatarPicker();
  document.querySelectorAll('#positionSelector .position-opt').forEach(o => o.classList.remove('selected'));

  // Reflect immediately in local cache/UI, don't wait for next poll tick
  knownIds.add(res.member.memberId);
  membersCache.push(res.member);
  renderRoster();
  fpSaveMembers([res.member]).catch(() => {});

  openIdCard(res.member);
});

/* ---------- ID Card rendering ---------- */
let currentMember = null;

function openIdCard(member){
  currentMember = member;
  const canvas = document.getElementById('idcardCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0, '#101a2c');
  grad.addColorStop(1, '#0b1220');
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, W, H, 26);
  ctx.fill();

  ctx.strokeStyle = 'rgba(57,255,136,.55)';
  ctx.lineWidth = 2;
  roundRect(ctx, 2, 2, W-4, H-4, 24);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let y = 40; y < H; y += 36){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(W-70, 70, 46, 0, Math.PI*2); ctx.strokeStyle='rgba(34,211,238,.18)'; ctx.lineWidth=10; ctx.stroke();

  ctx.fillStyle = '#39FF88';
  ctx.font = '700 13px Arial';
  ctx.textBaseline = 'top';
  ctx.fillText('FLASH PEAK COMMUNITY', 32, 28);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.font = '600 10px Arial';
  ctx.fillText('OFFICIAL IDENTITY CARD', 32, 46);

  ctx.fillStyle = '#FFC94A';
  ctx.font = '700 11px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('LORD MEMBER', W-32, 28);
  ctx.textAlign = 'left';

  const avatarImg = new Image();
  avatarImg.onload = () => {
    const cx = 100, cy = 168, r = 62;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, cx-r, cy-r, r*2, r*2);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 3;
    ctx.stroke();

    const tx = 190;
    ctx.fillStyle = '#F3F6FC';
    ctx.font = '700 24px Arial';
    ctx.fillText(truncate(member.nama, 16), tx, 130);

    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '600 12px Arial';
    ctx.fillText('MEMBER ID', tx, 172);
    ctx.fillStyle = '#22D3EE';
    ctx.font = '700 16px Arial';
    ctx.fillText(member.memberId, tx, 188);

    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '600 12px Arial';
    ctx.fillText('USERNAME', tx, 216);
    ctx.fillStyle = '#F3F6FC';
    ctx.font = '700 16px Arial';
    ctx.fillText('@' + truncate(member.username, 18), tx, 232);

    if (member.posisi){
      const chipY = 280;
      ctx.fillStyle = '#FFC94A';
      roundRect(ctx, tx, chipY, 54, 24, 8);
      ctx.fill();
      ctx.fillStyle = '#2a1500';
      ctx.font = '700 13px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(member.posisi, tx + 27, chipY + 13);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(0, H-46, W, 46);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = '600 10px Arial';
    ctx.fillText('flashpeak.community  •  ID Game: ' + member.gameId, 32, H-30);

    ctx.fillStyle = '#39FF88';
    ctx.beginPath();
    roundRect(ctx, W-140, H-38, 108, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#04140c';
    ctx.font = '700 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SUCCEED', W-86, H-32);
    ctx.textAlign = 'left';
  };
  avatarImg.src = 'avatars/' + member.avatar;

  document.getElementById('idcardModal').classList.add('open');
}

function truncate(str, n){ return str.length > n ? str.slice(0,n-1) + '…' : str; }

function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

document.getElementById('idcardClose').addEventListener('click', () => {
  document.getElementById('idcardModal').classList.remove('open');
});

document.getElementById('downloadIdBtn').addEventListener('click', () => {
  const canvas = document.getElementById('idcardCanvas');
  const link = document.createElement('a');
  link.download = `flashpeak-idcard-${currentMember.username}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();

  document.getElementById('idcardModal').classList.remove('open');
  openWelcome(currentMember);
});

/* ---------- Welcome popup ---------- */
function openWelcome(member){
  document.getElementById('welcomeName').textContent = member.nama;
  document.getElementById('welcomeText').textContent =
    `Halo ${member.nama}, selamat bergabung di komunitas Lord. Setelah mendownload ID card ini, harap kirim di komunitas Lord ya, biar mudah kenalan.`;
  document.getElementById('welcomeModal').classList.add('open');
}
document.getElementById('welcomeClose').addEventListener('click', () => {
  document.getElementById('welcomeModal').classList.remove('open');
});

[document.getElementById('idcardModal'), document.getElementById('welcomeModal')].forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
});

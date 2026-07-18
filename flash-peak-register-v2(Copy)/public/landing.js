// ============================================
// FLASH PEAK COMMUNITY — LANDING PAGE CLIENT
// ============================================

/* ---------- Ambient pitch particles (shared with pendaftaran) ---------- */
(function pitchParticles(){
  const canvas = document.getElementById('pitch-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles;

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  function init(){
    resize();
    const count = Math.min(46, Math.floor((w*h)/38000));
    particles = Array.from({length: count}, () => ({
      x: Math.random()*w,
      y: Math.random()*h,
      r: 1 + Math.random()*2,
      vy: 0.15 + Math.random()*0.35,
      vx: (Math.random()-0.5)*0.15,
      hue: Math.random() > 0.5 ? '34,211,238' : '57,255,136',
      a: 0.15 + Math.random()*0.35,
    }));
  }
  function tick(){
    ctx.clearRect(0,0,w,h);
    particles.forEach(p => {
      p.y -= p.vy; p.x += p.vx;
      if (p.y < -10) p.y = h + 10;
      if (p.x < -10) p.x = w + 10;
      if (p.x > w+10) p.x = -10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${p.hue},${p.a})`;
      ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  window.addEventListener('resize', resize);
  init();
  tick();
})();

/* ---------- Navbar scroll state ---------- */
const lpNavbar = document.getElementById('lpNavbar');
function handleScroll(){
  if (window.scrollY > 20) lpNavbar.classList.add('scrolled');
  else lpNavbar.classList.remove('scrolled');
}
window.addEventListener('scroll', handleScroll);
handleScroll();

/* ---------- Mobile menu toggle ---------- */
const lpHamburger = document.getElementById('lpHamburger');
const lpMobileMenu = document.getElementById('lpMobileMenu');
lpHamburger.addEventListener('click', () => {
  lpHamburger.classList.toggle('active');
  lpMobileMenu.classList.toggle('open');
});
lpMobileMenu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    lpHamburger.classList.remove('active');
    lpMobileMenu.classList.remove('open');
  });
});

/* ---------- FAQ accordion ---------- */
document.querySelectorAll('.lp-faq-item').forEach(item => {
  const q = item.querySelector('.lp-faq-q');
  q.addEventListener('click', () => {
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.lp-faq-item').forEach(i => i.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
  });
});

/* ---------- Scroll reveal ---------- */
const revealEls = document.querySelectorAll('.lp-reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting){
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => revealObserver.observe(el));

/* ---------- Live total member stat (polling, matches API response shape) ---------- */
async function pollLandingStats(){
  try {
    const res = await fetch('/api/members', { cache: 'no-store' });
    const data = await res.json();
    const el = document.getElementById('statLordTotal');
    if (el && data.ok) el.textContent = data.members.length;
  } catch (e) { /* network hiccup, retry next tick */ }
}
pollLandingStats();
setInterval(pollLandingStats, 1000);

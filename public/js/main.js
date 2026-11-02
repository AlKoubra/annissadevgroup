// ===== NAVBAR =====
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// ===== NAV MOBILE =====
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle?.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});
navLinks?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ===== PARTICLES =====
const canvas = document.getElementById('particleCanvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animId;

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resize);
  resize();

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.size = Math.random() * 2 + 0.5;
      this.alpha = Math.random() * 0.5 + 0.1;
      this.color = Math.random() > 0.7 ? '#f0b429' : '#8896c4';
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < 120; i++) particles.push(new Particle());

  const drawLines = () => {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.save();
          ctx.globalAlpha = (1 - dist / 100) * 0.08;
          ctx.strokeStyle = '#f0b429';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  };

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    drawLines();
    animId = requestAnimationFrame(animate);
  };
  animate();
}

// ===== COUNTER ANIMATION =====
const observeCounters = () => {
  const counters = document.querySelectorAll('.stat-num[data-target]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target);
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;
        const timer = setInterval(() => {
          current += step;
          if (current >= target) { current = target; clearInterval(timer); }
          el.textContent = Math.floor(current);
        }, 16);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => observer.observe(c));
};
observeCounters();

// ===== CARD REVEAL ON SCROLL =====
const cards = document.querySelectorAll('.service-card, .tech-category, .step, .value-item, .value-card, .cred, .tl-step');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }, (entry.target.dataset.delay || 0));
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

cards.forEach(card => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(30px)';
  card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  revealObserver.observe(card);
});

// ===== CONTACT FORM =====
const contactForm = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

contactForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = contactForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<span>Envoi en cours...</span>';

  const data = Object.fromEntries(new FormData(contactForm));
  try {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch(err) {}

  contactForm.reset();
  btn.disabled = false;
  btn.innerHTML = '<span>Envoyer ma demande</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>';

  // Popup de confirmation
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,20,64,.35);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:#fff;border:1px solid rgba(15,20,64,.08);box-shadow:0 40px 90px -30px rgba(15,20,64,.45);border-radius:20px;padding:48px 40px;max-width:440px;width:100%;text-align:center;animation:slideUp .4s ease">
      <div style="width:72px;height:72px;background:linear-gradient(135deg,rgba(16,185,129,.2),rgba(16,185,129,.05));border:2px solid #10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px">
        <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" width="32" height="32"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style="margin:0 0 12px;color:#0f1440;font-size:22px;font-weight:800">Message envoyé !</h2>
      <p style="margin:0 0 8px;color:#545a7e;font-size:14px;line-height:1.6">Merci <strong style="color:#c8941f">${data.name || ''}</strong>, votre demande a bien été reçue.</p>
      <p style="margin:0 0 32px;color:#8a8fae;font-size:13px">Notre équipe vous contactera sous <strong style="color:#0f1440">24h</strong> à l'adresse <strong style="color:#c8941f">${data.email || ''}</strong>.</p>
      <button onclick="this.closest('div[style*=fixed]').remove()" style="background:linear-gradient(135deg,#f0b429,#d4940a);color:#0d1347;font-weight:800;font-size:14px;padding:14px 40px;border-radius:50px;border:none;cursor:pointer;letter-spacing:.3px">Parfait !</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => overlay.remove(), 8000);
});

// ===== SMOOTH ACTIVE LINK =====
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-links a[href^="#"]');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 120) current = section.id;
  });
  navItems.forEach(a => {
    a.style.color = a.getAttribute('href') === `#${current}` ? 'var(--gold)' : '';
  });
});

// ===== NAVIGATION PAR POINTS =====
const dotSections = [...document.querySelectorAll('[data-dot]')];
if (dotSections.length > 1) {
  const dotNav = document.createElement('nav');
  dotNav.className = 'dot-nav';
  dotNav.setAttribute('aria-label', 'Sections de la page');
  dotSections.forEach(sec => {
    const a = document.createElement('a');
    a.href = `#${sec.id}`;
    a.setAttribute('aria-label', sec.dataset.dot);
    a.innerHTML = `<span>${sec.dataset.dot}</span>`;
    dotNav.appendChild(a);
  });
  document.body.appendChild(dotNav);
  const dots = [...dotNav.children];

  const updateDots = () => {
    const line = window.innerHeight * 0.45;
    let idx = 0;
    dotSections.forEach((sec, i) => { if (sec.getBoundingClientRect().top <= line) idx = i; });
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  };
  window.addEventListener('scroll', updateDots, { passive: true });
  updateDots();
}

// ===== PARALLAXE + FONDU AU DÉFILEMENT =====
const fxEls = [...document.querySelectorAll('[data-fx]')];
const fxRows = [...document.querySelectorAll('[data-fx-x]')];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduceMotion && (fxEls.length || fxRows.length)) {
  let ticking = false;
  const runFx = () => {
    ticking = false;
    const vh = window.innerHeight;
    fxEls.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      // -1 quand l'élément arrive par le bas, 0 au centre de l'écran, 1 quand il sort par le haut
      const p = Math.max(-1, Math.min(1, ((vh / 2) - (r.top + r.height / 2)) / (vh / 2 + r.height / 2)));
      const amp = parseFloat(el.dataset.fx) || 0;
      el.style.transform = `translate3d(0, ${(-p * amp).toFixed(1)}px, 0)`;
      if ('fxFade' in el.dataset) {
        const fade = Math.max(0, Math.abs(p) - 0.5) / 0.5;
        el.style.opacity = (1 - fade).toFixed(3);
      }
    });
    fxRows.forEach(row => {
      const r = row.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const dir = parseFloat(row.dataset.fxX) || 1;
      const shift = (vh - r.top) * 0.35 * dir;
      row.style.transform = `translate3d(${(dir > 0 ? -600 : 0) + shift}px, 0, 0)`;
    });
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(runFx); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  runFx();
}

// ===== SLIDER « À LA UNE » =====
const hlSlider = document.querySelector('.hl-slider');
if (hlSlider) {
  const slides = [...hlSlider.querySelectorAll('.hl-slide')];
  const dotsWrap = hlSlider.querySelector('.hl-dots');
  const count = hlSlider.querySelector('.hl-count b');
  let current = 0;
  let timer;

  const dots = slides.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `Aller à la diapositive ${i + 1}`);
    b.addEventListener('click', () => { go(i); restart(); });
    dotsWrap.appendChild(b);
    return b;
  });

  const go = i => {
    current = (i + slides.length) % slides.length;
    slides.forEach((s, k) => {
      s.classList.toggle('is-active', k === current);
      s.setAttribute('aria-hidden', k === current ? 'false' : 'true');
      s.querySelectorAll('a, button').forEach(el => { el.tabIndex = k === current ? 0 : -1; });
    });
    dots.forEach((d, k) => d.classList.toggle('active', k === current));
    count.textContent = String(current + 1).padStart(2, '0');
  };
  const restart = () => {
    clearInterval(timer);
    if (!reduceMotion) timer = setInterval(() => go(current + 1), 7000);
  };

  hlSlider.querySelector('.hl-prev').addEventListener('click', () => { go(current - 1); restart(); });
  hlSlider.querySelector('.hl-next').addEventListener('click', () => { go(current + 1); restart(); });
  hlSlider.addEventListener('mouseenter', () => clearInterval(timer));
  hlSlider.addEventListener('mouseleave', restart);
  hlSlider.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { go(current - 1); restart(); }
    if (e.key === 'ArrowRight') { go(current + 1); restart(); }
  });

  let startX = null;
  hlSlider.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  hlSlider.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) { go(current + (dx < 0 ? 1 : -1)); restart(); }
    startX = null;
  });

  go(0);
  restart();
}

// ===== POPUP EN COIN =====
const cornerPop = document.getElementById('cornerPop');
if (cornerPop) {
  const KEY = 'annissa-cornerpop-closed';
  let closed = false;
  try { closed = localStorage.getItem(KEY) === '1'; } catch (e) {}
  const close = () => {
    cornerPop.classList.remove('is-open');
    setTimeout(() => { cornerPop.hidden = true; }, 400);
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
  };
  if (!closed) {
    setTimeout(() => {
      cornerPop.hidden = false;
      requestAnimationFrame(() => cornerPop.classList.add('is-open'));
    }, 6000);
  }
  cornerPop.querySelector('.cornerpop-close').addEventListener('click', close);
  cornerPop.querySelector('.cornerpop-btn').addEventListener('click', close);
}

// ===== APPARITIONS EN CASCADE + FRISE DU PROCESSUS =====
document.querySelectorAll('.cred-grid, .timeline').forEach(group => {
  [...group.children].forEach((child, i) => { child.dataset.delay = i * 90; });
});
const timelineWrap = document.querySelector('.timeline-wrap');
if (timelineWrap) {
  new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { timelineWrap.classList.add('is-in'); obs.disconnect(); }
    });
  }, { threshold: 0.35 }).observe(timelineWrap);
}

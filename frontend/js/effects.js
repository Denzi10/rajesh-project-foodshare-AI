/**
 * FoodShare AI - Advanced Visual Effects & Dynamic Micro-Interactions Engine
 */

const EffectsEngine = {
  canvas: null,
  ctx: null,
  particles: [],
  maxParticles: 42,
  mouse: { x: null, y: null, radius: 120 },
  spotlightElem: null,

  init() {
    this.setupSpotlight();
    this.setupCanvas();
    this.setupCard3DTilt();
    this.setupButtonRipples();
    window.addEventListener('resize', () => this.resizeCanvas());
  },

  // 1. Interactive Cursor Glow Spotlight
  setupSpotlight() {
    this.spotlightElem = document.createElement('div');
    this.spotlightElem.className = 'spotlight-overlay';
    document.body.appendChild(this.spotlightElem);

    window.addEventListener('mousemove', (e) => {
      this.spotlightElem.style.left = `${e.clientX}px`;
      this.spotlightElem.style.top = `${e.clientY}px`;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mouseout', () => {
      this.spotlightElem.style.opacity = '0';
      this.mouse.x = null;
      this.mouse.y = null;
    });

    window.addEventListener('mouseover', () => {
      this.spotlightElem.style.opacity = '1';
    });
  },

  // 2. Interactive Constellation Canvas Network
  setupCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'particles-bg-canvas';
    document.body.insertBefore(this.canvas, document.body.firstChild);
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    // Create particles
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1,
        color: i % 2 === 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(56, 189, 248, 0.7)'
      });
    }

    this.render();
  },

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  render() {
    const { ctx, canvas, particles, mouse } = this;
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update & draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      // Mouse repulsion subtle force
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          p.x -= (dx / dist) * force * 2;
          p.y -= (dy / dist) * force * 2;
        }
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw connecting filaments
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (dist < 130) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(16, 185, 129, ${0.15 * (1 - dist / 130)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(() => this.render());
  },

  // 3. Interactive 3D Perspective Tilt on Cards
  setupCard3DTilt() {
    document.addEventListener('mousemove', (e) => {
      const cards = document.querySelectorAll('.metric-card, .ai-predictor-card, .glass-panel-interactive');
      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        // Only calculate if card is visible in viewport
        if (
          e.clientX >= rect.left - 40 &&
          e.clientX <= rect.right + 40 &&
          e.clientY >= rect.top - 40 &&
          e.clientY <= rect.bottom + 40
        ) {
          const cardX = rect.left + rect.width / 2;
          const cardY = rect.top + rect.height / 2;
          const angleX = -((e.clientY - cardY) / (rect.height / 2)) * 6;
          const angleY = ((e.clientX - cardX) / (rect.width / 2)) * 6;
          card.style.transform = `perspective(1000px) rotateX(${angleX.toFixed(2)}deg) rotateY(${angleY.toFixed(2)}deg) translateY(-4px)`;
        } else {
          if (card.style.transform && card.style.transform !== '') {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
          }
        }
      });
    });
  },

  // 4. Smooth Rolling Number Counter Animation
  countUp(element, endVal, duration = 1200, suffix = '') {
    if (!element) return;
    const startVal = 0;
    const startTime = performance.now();
    const end = parseFloat(endVal) || 0;

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (end - startVal) * easeProgress;

      if (Number.isInteger(end)) {
        element.textContent = Math.round(current) + suffix;
      } else {
        element.textContent = current.toFixed(1) + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = end + suffix;
      }
    }

    requestAnimationFrame(updateCounter);
  },

  // 5. Button Click Ripple Micro-Interaction
  setupButtonRipples() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-primary-custom, .btn-sky-custom, .demo-btn');
      if (!btn) return;

      const ripple = document.createElement('span');
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.style.position = 'absolute';
      ripple.style.borderRadius = '50%';
      ripple.style.background = 'rgba(255, 255, 255, 0.35)';
      ripple.style.transform = 'scale(0)';
      ripple.style.animation = 'rippleAnim 0.6s linear';
      ripple.style.pointerEvents = 'none';

      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);

      setTimeout(() => ripple.remove(), 600);
    });

    // Add ripple animation keyframes
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes rippleAnim {
        to {
          transform: scale(2.8);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
};

window.EffectsEngine = EffectsEngine;
document.addEventListener('DOMContentLoaded', () => {
  EffectsEngine.init();
});

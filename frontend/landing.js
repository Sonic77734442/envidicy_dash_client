document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for internal anchors
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  const magnetForm = document.getElementById('magnet-form');
  const magnetStatus = document.getElementById('magnet-status');
  if (magnetForm) {
    magnetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      magnetStatus.textContent = 'Готово! Отправим PDF и чек-лист в течение нескольких минут.';
    });
  }

  const ctaForm = document.getElementById('cta-form');
  const ctaStatus = document.getElementById('cta-status');
  if (ctaForm) {
    ctaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      ctaStatus.textContent = 'Заявка получена. Свяжемся в ближайшие 15 минут в мессенджере.';
    });
  }
});


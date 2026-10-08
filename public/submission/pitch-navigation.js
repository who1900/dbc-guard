document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  const slides = [...document.querySelectorAll('.slide')];
  const current = slides.reduce((best, slide, index) => Math.abs(slide.getBoundingClientRect().top) < Math.abs(slides[best].getBoundingClientRect().top) ? index : best, 0);
  let next;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) next = current + 1;
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) next = current - 1;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = slides.length - 1;
  if (next !== undefined) {
    event.preventDefault();
    slides[Math.max(0, Math.min(slides.length - 1, next))].scrollIntoView({ behavior: 'smooth' });
  }
});

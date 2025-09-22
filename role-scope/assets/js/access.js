// Dark mode toggle
(() => {
  const btn = document.getElementById('modeToggle');
  const pref = localStorage.getItem('mode');
  if (pref === 'dark' || (!pref && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
  btn?.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('mode',
      document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  });
})();

// Role switcher
(() => {
  const sel = document.getElementById('roleSelect');
  if (!sel) return;
  const saved = localStorage.getItem('role') || 'public';
  sel.value = saved;
  sel.addEventListener('change', () => {
    localStorage.setItem('role', sel.value);
    alert("Role switched to: " + sel.value);
  });
})();

// Role-based rendering
document.addEventListener('DOMContentLoaded', () => {
  const role = localStorage.getItem('role') || 'public';
  document.querySelectorAll('[data-role]').forEach(el => {
    el.style.display = (el.getAttribute('data-role') === role) ? '' : 'none';
  });
  const badge = document.getElementById('currentRole');
  if (badge) badge.textContent = role;
});

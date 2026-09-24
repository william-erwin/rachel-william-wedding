window.initWeddingColors = function(root) {
  const panel = root.querySelector('.color-editor');
  const trigger = root.querySelector('.color-editor-toggle');
  if (!panel || panel.dataset.ready) return;
  panel.dataset.ready = 'true';
  const html = document.documentElement;
  const storageKey = 'wedding-colors-v1-' + (html.dataset.palette || 'original');
  const status = panel.querySelector('.color-editor-status');
  const fields = [
    ['background', 'Background', '--paper'],
    ['hero', 'Top section', '--hero-paper'],
    ['text', 'Body text', '--ink'],
    ['heroAccent', 'Top lettering & glyphs', '--hero-accent'],
    ['accent', 'Other lettering & art', '--accent'],
    ['labels', 'Small labels', '--ink-mute'],
    ['lines', 'Dotted lines', '--rule-medium']
  ];
  const changed = new Set();
  let saved = {};
  const normalize = value => {
    let hex = value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split('').map(c => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(hex) ? '#' + hex.toUpperCase() : null;
  };
  const context = document.createElement('canvas').getContext('2d');
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
  panel.append(probe);
  const toHex = color => {
    probe.style.backgroundColor = color;
    context.clearRect(0, 0, 1, 1);
    const computed = getComputedStyle(probe).backgroundColor;
    const rgb = computed.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
    if (rgb) return '#' + rgb.slice(1, 4).map(v => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase();
    context.fillStyle = computed;
    context.fillRect(0, 0, 1, 1);
    return '#' + Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const defaults = Object.fromEntries(fields.map(([key,,token]) => [key, toHex(key === 'hero' ? getComputedStyle(root.querySelector('#home')).backgroundColor : getComputedStyle(html).getPropertyValue(token))]));
  const set = (token, value) => { html.style.setProperty(token, value); changed.add(token); };
  const artFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  artFilter.id = 'duotone-custom';
  artFilter.setAttribute('color-interpolation-filters', 'sRGB');
  artFilter.innerHTML = '<feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table"/><feFuncG type="table"/><feFuncB type="table"/><feFuncA type="table" tableValues="0 1"/></feComponentTransfer>';
  root.querySelector('.palette-filters defs').append(artFilter);
  const updateArt = () => {
    const colors = { ...defaults, ...saved };
    ['R', 'G', 'B'].forEach((channel, index) => {
      const rgb = hex => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
      artFilter.querySelector('feFunc' + channel).setAttribute('tableValues', rgb(colors.accent) + ' ' + rgb(colors.background));
    });
    set('--art-filter', 'url("#duotone-custom")');
  };
  const apply = (key, value) => {
    html.dataset.customColors = 'true';
    saved[key] = value;
    set(fields.find(field => field[0] === key)[2], value);
    if (key === 'background') set('--paper-deep', value);
    if (key === 'text') { set('--ink-soft', value); set('--solid', value); }
    if (key === 'accent') set('--line', value);
    if (key === 'lines') {
      [['strong',92],['medium',56],['light',42],['detail',76]].forEach(([name, opacity]) => set('--rule-' + name, 'color-mix(in srgb,' + value + ' ' + opacity + '%,transparent)'));
    }
    if (key === 'background' || key === 'accent') updateArt();
    if (key === 'background' && !saved.hero) {
      const input = panel.querySelector('#color-hero');
      if (input) {
        input.value = toHex(getComputedStyle(root.querySelector('#home')).backgroundColor);
        input.previousElementSibling.value = input.value;
      }
    }
  };
  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); status.textContent = 'Saved in this browser.'; }
    catch { status.textContent = 'Preview updated. Browser storage is unavailable.'; }
  };
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    fields.forEach(([key]) => { if (typeof stored?.[key] === 'string' && normalize(stored[key])) apply(key, normalize(stored[key])); });
  } catch { /* Use the original palette when saved data is unavailable. */ }
  fields.forEach(([key, label]) => {
    const row = document.createElement('div');
    row.className = 'color-editor-row';
    row.innerHTML = '<label for="color-' + key + '">' + label + '</label><input type="color" aria-label="' + label + ' color picker"><input type="text" id="color-' + key + '" spellcheck="false" autocomplete="off" maxlength="7" aria-describedby="color-editor-status">';
    const picker = row.querySelector('[type="color"]');
    const hex = row.querySelector('[type="text"]');
    picker.value = hex.value = saved[key] || (key === 'hero' ? toHex(getComputedStyle(root.querySelector('#home')).backgroundColor) : defaults[key]);
    hex.addEventListener('input', () => {
      const color = normalize(hex.value);
      hex.setAttribute('aria-invalid', String(!color));
      if (!color) { status.textContent = 'Enter a 3- or 6-digit hex color.'; return; }
      picker.value = color;
      apply(key, color); persist();
    });
    hex.addEventListener('blur', () => { if (normalize(hex.value)) hex.value = normalize(hex.value); });
    picker.addEventListener('input', () => { hex.value = picker.value.toUpperCase(); hex.setAttribute('aria-invalid','false'); apply(key, hex.value); persist(); });
    panel.querySelector('.color-editor-fields').append(row);
  });
  const open = value => {
    panel.dataset.open = String(value);
    trigger.setAttribute('aria-expanded', String(value));
    if (value) panel.querySelector('.color-editor-close').focus();
  };
  trigger.addEventListener('click', () => open(panel.dataset.open !== 'true'));
  panel.querySelector('.color-editor-close').addEventListener('click', () => { open(false); trigger.focus(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && panel.dataset.open === 'true') { open(false); trigger.focus(); } });
  document.addEventListener('click', event => { if (!panel.contains(event.target) && !trigger.contains(event.target)) open(false); });
  panel.querySelector('[data-reset-colors]').addEventListener('click', () => {
    changed.forEach(token => html.style.removeProperty(token)); changed.clear(); saved = {}; delete html.dataset.customColors;
    fields.forEach(([key]) => {
      const hex = panel.querySelector('#color-' + key);
      hex.value = defaults[key]; hex.setAttribute('aria-invalid','false');
      hex.previousElementSibling.value = defaults[key];
    });
    persist(); status.textContent = 'Original colors restored.';
  });
  panel.querySelector('[data-copy-colors]').addEventListener('click', async () => {
    const values = { ...defaults, ...saved };
    // The hero follows the background until explicitly customized.
    if (!saved.hero) values.hero = toHex(getComputedStyle(root.querySelector('#home')).backgroundColor);
    try {
      await navigator.clipboard.writeText(fields.map(([key,label]) => label + ': ' + values[key]).join('\n'));
      status.textContent = 'Palette copied. Paste it here when you’re ready.';
    } catch { status.textContent = 'Could not copy. You can select each hex value above.'; }
  });
};

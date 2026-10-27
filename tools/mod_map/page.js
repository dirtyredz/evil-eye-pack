/* Browser-only controls; all report content is embedded and works without JavaScript. */
(() => {
  const filter = document.querySelector('#filter');
  function update() {
    const q = filter.value.toLocaleLowerCase().trim();
    const entries = [...document.querySelectorAll('.category .entry')];
    for (const category of document.querySelectorAll('.category')) {
      const categoryMatch = category.dataset.name.includes(q);
      const children = [...category.querySelectorAll('.entry')];
      for (const entry of children) entry.hidden = !categoryMatch && !entry.textContent.toLocaleLowerCase().includes(q);
      category.hidden = children.every(entry => entry.hidden);
    }
    document.querySelector('#count').textContent = entries.filter(entry => !entry.hidden).length + ' mods / families visible';
  }
  filter.addEventListener('input', update);
  document.querySelector('#sort').addEventListener('change', event => {
    const by = event.target.value;
    for (const group of document.querySelectorAll('.category-body')) {
      const cards = [...group.querySelectorAll(':scope > .entry')].sort((a, b) => by === 'cost'
        ? Number(b.dataset.cost) - Number(a.dataset.cost) || a.dataset.name.localeCompare(b.dataset.name)
        : a.dataset[by].localeCompare(b.dataset[by]) || a.dataset.name.localeCompare(b.dataset.name));
      group.append(...cards);
    }
  });
  for (const id of ['expand', 'collapse']) document.querySelector('#' + id).addEventListener('click', () => {
    for (const card of document.querySelectorAll('.category, .category .entry')) if (!card.hidden) card.open = id === 'expand';
  });
  update();
})();

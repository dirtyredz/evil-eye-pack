/* Browser-only controls; all report content is embedded and works without JavaScript. */
(() => {
  const groups = document.querySelector('#groups');
  const filter = document.querySelector('#filter');
  function update() {
    const q = filter.value.toLocaleLowerCase().trim();
    const cards = [...document.querySelectorAll('.group, .shared')];
    for (const card of cards) card.hidden = !card.textContent.toLocaleLowerCase().includes(q);
    document.querySelector('#count').textContent = cards.filter(c => !c.hidden).length + ' visible';
  }
  filter.addEventListener('input', update);
  document.querySelector('#sort').addEventListener('change', event => {
    const by = event.target.value;
    const cards = [...groups.children].sort((a, b) => by === 'cost'
      ? Number(b.dataset.cost) - Number(a.dataset.cost) || a.dataset.name.localeCompare(b.dataset.name)
      : a.dataset[by].localeCompare(b.dataset[by]) || a.dataset.name.localeCompare(b.dataset.name));
    groups.append(...cards);
  });
  for (const id of ['expand', 'collapse']) document.querySelector('#' + id).addEventListener('click', () => {
    for (const card of document.querySelectorAll('.group, .shared')) if (!card.hidden) card.open = id === 'expand';
  });
  update();
})();

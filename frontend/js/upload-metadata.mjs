import { catalogOptions, fileFormat } from './catalog.mjs';

for (const [name, values] of Object.entries(catalogOptions)) {
  const select = document.querySelector(`[name="${name}"]`);
  for (const value of values) select.add(new Option(value, value));
}
const file = document.getElementById('arquivo');
file.addEventListener('change', () => {
  document.getElementById('formato-detectado').textContent = file.files[0]
    ? `Formato: ${fileFormat(file.files[0].name)}`
    : 'O formato será identificado automaticamente pelo arquivo.';
});
document.getElementById('formulario-envio').addEventListener('reset', () => {
  document.getElementById('formato-detectado').textContent = 'O formato será identificado automaticamente pelo arquivo.';
});

import { render } from 'solid-js/web';
import './styles.css';
import { App } from './App';
import { whenReady } from './core/bridge';
import { bindLegacySelection, setTraceTick, traceTick } from './core/store';
import { pushKv, resetKv, type KvPoint } from './core/adv';
// Mount after the legacy app has built its panes (they are adopted into the v17 dock).
void whenReady().then(() => {
  bindLegacySelection();
  document.addEventListener('neuralese:trace', () => setTraceTick(traceTick() + 1));
  document.addEventListener('neuralese:kvgeom-reset', () => resetKv());
  document.addEventListener('neuralese:kvgeom', (e) => pushKv((e as CustomEvent<KvPoint>).detail));
  const park = document.createElement('div'); park.id = 'v17-park'; park.hidden = true; document.body.appendChild(park);
  const root = document.createElement('div'); root.id = 'v17'; document.body.appendChild(root); document.body.classList.add('v17-on');
  const top = document.querySelector('.logo i'); if (top) top.textContent = 'v' + __APP_VERSION__.replace(/\.0$/, '');
  render(() => <App />, root);
  if (window.NEURALESE?.lastTraces?.length) setTraceTick(traceTick() + 1);
});
declare const __APP_VERSION__: string;

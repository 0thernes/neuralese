import { render } from 'solid-js/web';
import './styles.css';
import { App } from './App';
import { legacy } from './core/bridge';
import { bindLegacySelection, setTraceTick, traceTick } from './core/store';
import { pushKv, resetKv, type KvPoint } from './core/adv';
// The shell is on screen before the weights and the tokenizer exist. Panes are adopted when the legacy app fires ready.
const park = document.createElement('div'); park.id = 'v17-park'; park.hidden = true; document.body.appendChild(park);
const root = document.createElement('div'); root.id = 'v17'; document.body.appendChild(root); document.body.classList.add('v17-on');
const top = document.querySelector('.logo i'); if (top) top.textContent = 'v' + __APP_VERSION__.replace(/\.0$/, '');
render(() => <App />, root);
function arm(): void {
  bindLegacySelection();
  document.addEventListener('neuralese:trace', () => setTraceTick(traceTick() + 1));
  document.addEventListener('neuralese:kvgeom-reset', () => resetKv());
  document.addEventListener('neuralese:kvgeom', (e) => pushKv((e as CustomEvent<KvPoint>).detail));
  if (window.NEURALESE?.lastTraces?.length) setTraceTick(traceTick() + 1);
}
if (legacy()) arm(); else document.addEventListener('neuralese:ready', arm, { once: true });
declare const __APP_VERSION__: string;

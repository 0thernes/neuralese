// three.js yields with scheduler.yield(), which Chrome runs as a timer whose callback is the
// native promise resolver. Long Animation Frames then show an empty sourceURL at position -1,
// and every synchronous step after the await is charged to that timer. The same thing happens
// for setTimeout(done) when done only calls resolve. Both wait for a paint, then a message.

const YIELD_TO_MAIN = `function yieldToMain() {

	const resumeStack = new Error('yieldToMain').stack;

	return new Promise( ( resolve ) => {

		const go = () => {

			if ( typeof globalThis.__timerResume === 'function' ) globalThis.__timerResume( resumeStack );

			const Channel = globalThis.MessageChannel;

			if ( typeof Channel === 'function' ) {

				const ch = new Channel();

				ch.port1.onmessage = () => { ch.port1.close(); ch.port2.close(); resolve(); };

				ch.port2.postMessage( 0 );

				return;

			}

			resolve();

		};

		if ( typeof requestAnimationFrame === 'function' ) requestAnimationFrame( go );

		else go();

	} );

}`;

const COMPILE_WAIT = `const resumeStack = new Error('compile-yield').stack;

				const finish = () => {

					if ( typeof globalThis.__timerResume === 'function' ) globalThis.__timerResume( resumeStack );

					done();

				};

				if ( typeof requestAnimationFrame === 'function' ) {

					requestAnimationFrame( () => {

						const Channel = globalThis.MessageChannel;

						if ( typeof Channel === 'function' ) {

							const ch = new Channel();

							ch.port1.onmessage = () => { ch.port1.close(); ch.port2.close(); finish(); };

							ch.port2.postMessage( 0 );

							return;

						}

						finish();

					} );

				} else finish();`;

function replaceFunction(code, name, body) {
  const start = code.indexOf(`function ${name}() {`);
  if (start < 0) return null;
  let depth = 0;
  let seen = false;
  for (let i = start; i < code.length; i++) {
    if (code[i] === '{') { depth++; seen = true; }
    else if (code[i] === '}') {
      depth--;
      if (seen && depth === 0) return code.slice(0, start) + body + code.slice(i + 1);
    }
  }
  return null;
}

export function patchThreeYield(code, id) {
  if (typeof code !== 'string') return null;
  const utils = id.includes(`${'three'}/src/utils.js`) || id.includes(`${'three'}/build/three.core.js`) || id.includes('three.webgpu.js');
  const renderer = id.includes('renderers/common/Renderer.js') || id.includes('three.webgpu.js');
  let next = code;
  let changed = false;
  if (utils && next.includes('function yieldToMain()') && next.includes('return self.scheduler.yield')) {
    const replaced = replaceFunction(next, 'yieldToMain', YIELD_TO_MAIN);
    if (!replaced || replaced.includes('return self.scheduler.yield')) return null;
    next = replaced;
    changed = true;
  }
  if (renderer && next.includes('setTimeout( done, 0 )')) {
    const from = next.indexOf('// continue in a new task after the next frame was rendered');
    const to = next.indexOf('} );', from);
    if (from < 0 || to < from) return null;
    next = next.slice(0, from) + COMPILE_WAIT + '\n\n\t\t\t\t' + next.slice(to);
    if (next.includes('setTimeout( done, 0 )') || next.includes('setTimeout( done, 100 )')) return null;
    changed = true;
  }
  return changed ? next : null;
}

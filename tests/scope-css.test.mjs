import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeCss } from '../scripts/scope-css.mjs';

const S = ':where(.syntari-component,[data-syntari-root])';

test('runtime CSS applies only to Syntari markup, with the same specificity', () => {
  assert.equal(scopeCss('button{border:0}'), `${S} button,button${S}{border:0}`);
  assert.equal(scopeCss('*,*:before{box-sizing:border-box}'), `${S} *,*${S},${S} *:before,*${S}:before{box-sizing:border-box}`);
  assert.equal(scopeCss('dialog::backdrop{opacity:0}'), `${S} dialog::backdrop,dialog${S}::backdrop{opacity:0}`);
  assert.equal(scopeCss('.a>.b:is(.c,.d) p{x:y}'), `${S} .a>.b:is(.c,.d) p,.a${S}>.b:is(.c,.d) p{x:y}`);
  assert.equal(scopeCss('@media(max-width:700px){main{padding:0}}'), `@media(max-width:700px){${S} main,main${S}{padding:0}}`);
});

test('theme context and keyframes stay global; body styles only Syntari pages', () => {
  assert.equal(scopeCss(':root{--a:1}html[data-theme="dark"]{color-scheme:dark}'), ':root{--a:1}html[data-theme="dark"]{color-scheme:dark}');
  assert.equal(scopeCss('[data-theme=dark] .code{color:red}'), `[data-theme=dark] ${S} .code,[data-theme=dark] .code${S}{color:red}`);
  assert.equal(scopeCss('body{margin:0}'), ':where(html[data-syntari-root]) body{margin:0}');
  assert.equal(scopeCss('@keyframes spin{from{opacity:0}to{opacity:1}}'), '@keyframes spin{from{opacity:0}to{opacity:1}}');
  assert.equal(scopeCss('/* note */.a{content:"}{"}'), `/* note */${S} .a,.a${S}{content:"}{"}`);
  assert.throws(() => scopeCss('html>body{x:y}'), /cannot scope/);
});

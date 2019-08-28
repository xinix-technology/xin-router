import { define } from '@xinix/xin';
import { View } from '@xinix/xin-router';

export default class RouterLazyFoo extends View {
  get template () {
    return `
      lazy foo
    `;
  }
}

define('router-lazy-foo', RouterLazyFoo);

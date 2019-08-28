import { define } from '@xinix/xin';
import { View } from '@xinix/xin-router';

export default class RouterLazyBar extends View {
  get template () {
    return `
      lazy bar
    `;
  }
}

define('router-lazy-bar', RouterLazyBar);

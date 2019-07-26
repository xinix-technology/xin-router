import { Component } from '@xinix/xin';

export class Middleware extends Component {
  attached () {
    super.attached();

    if (typeof this.parentElement === 'undefined' || typeof this.parentElement.use !== 'function') {
      throw new Error('Parent element is not a Router!');
    }

    this.parentElement.use(this.callback());
  }

  callback () {
    throw new Error('Please define #callback() which return function with signature function(ctx, next)');
  }
}

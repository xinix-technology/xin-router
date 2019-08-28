import { define, Component, Template } from '@xinix/xin';
import { Router } from './router';

export class Route extends Component {
  static routeRegExp (str) {
    const chunks = str.split('[');

    if (chunks.length > 2) {
      throw new Error('Invalid use of optional params');
    }

    const tokens = [];
    const re = chunks[0].replace(/{([^}]+)}/g, function (g, token) {
      tokens.push(token);
      return '([^/]+)';
    }).replace(/\//g, '\\/');

    let optRe = '';

    if (chunks[1]) {
      optRe = '(?:' + chunks[1].slice(0, -1).replace(/{([^}]+)}/g, function (g, token) {
        const [realToken, re = '[^/]+'] = token.split(':');
        tokens.push(realToken);
        return `(${re})`;
      }).replace(/\//g, '\\/') + ')?';
    }

    return [new RegExp('^' + re + optRe + '$'), tokens];
  }

  static isStatic (pattern) {
    return !pattern.match(/[[{]/);
  }

  get props () {
    return {
      ...super.props,

      uri: {
        type: String,
        observer: '__routeObserveUri(uri)',
        required: true,
      },

      view: {
        type: String,
      },
    };
  }

  get routers () {
    return this.__routeViewElement.routers;
  }

  attached () {
    super.attached();

    this.fire('route-attach');
  }

  detached () {
    super.detached();

    this.fire('route-detach');
  }

  __routeObserveUri (uri) {
    if (Route.isStatic(uri)) {
      this.type = 's';
      this.pattern = null;
      this.args = [];
    } else {
      const [pattern, args] = Route.routeRegExp(uri);
      this.type = 'v';
      this.pattern = pattern;
      this.args = args;
    }
  }

  __routeExtractSegmentParameters (uri) {
    const result = uri.match(this.pattern);

    if (!result) {
      return {};
    }

    return this.args.reduce((args, name, index) => {
      args[name] = result[index + 1];
      return args;
    }, {});
  }

  __componentInitTemplate () {
    this.__routeTemplate = this.firstElementChild;
    if (this.__routeTemplate) {
      this.removeChild(this.__routeTemplate);
    }

    Template.prototype.__templateInitialize.call(this);
  }

  test (uri) {
    return (this.type === 's' && this.uri === uri) || (this.type === 'v' && uri.match(this.pattern));
  }

  async enter (ctx) {
    if (!this.__routeViewElement) {
      if (this.view) {
        await Router.prepare(this.view);
      }

      const viewEl = document.createElement(this.view || 'xin-view');
      if (!this.view) {
        viewEl.template = this.__routeTemplate;
      }
      this.__routeViewElement = viewEl;
    }

    ctx = ctx.for(this);
    await this.__routeViewElement.__viewEnter(this, ctx);
  }

  async leave () {
    if (!this.__routeViewElement) {
      return;
    }

    await this.__routeViewElement.__viewLeave(this);

    this.__routeViewElement = undefined;
  }
}

define('xin-route', Route);

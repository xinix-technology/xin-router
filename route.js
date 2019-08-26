import { define, Component, Template, event } from '@xinix/xin';

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

  attached () {
    super.attached();

    this.__routeRouter = this.parentElement.closest('xin-router');
    if (!this.__routeRouter) {
      throw new Error('Missing router instance');
    }

    this.__routeRouter.__routerAddRoute(this);
  }

  detached () {
    super.detached();

    this.__routeRouter.__routerRemoveRoute(this);
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
      const viewEl = document.createElement(this.view || 'xin-view');
      if (!this.view) {
        viewEl.template = this.__routeTemplate;
      }
      this.__routeViewElement = viewEl;
    }

    const parameters = {
      ...this.__routeExtractSegmentParameters(ctx.pathname),
      ...ctx.parameters,
    };
    this.__routeViewElement.set('parameters', parameters);

    await this.__routeViewElement.focusing();
    event(this.__routeViewElement).fire('focusing', { view: this.__routeViewElement });

    await this.parentElement.insertBefore(this.__routeViewElement, this);

    await this.__routeViewElement.focused();
    event(this.__routeViewElement).fire('focus', { view: this.__routeViewElement });

    // TODO: this is workaround to make sure router children already attached
    // await Async.sleep(100);
  }

  async leave () {
    if (!this.__routeViewElement) {
      return;
    }

    await this.parentElement.removeChild(this.__routeViewElement);

    await this.__routeViewElement.blurred();
    event(this.__routeViewElement).fire('blur', { view: this.__routeViewElement });

    this.__routeViewElement = undefined;
  }
}

define('xin-route', Route);

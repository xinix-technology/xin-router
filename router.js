import { define, Component, Repository, event } from '@xinix/xin'; // eslint-disable-line max-lines
import { Context } from './context';

const debug = require('debug')('xin-router:router');

let loaders = [];

export class Router extends Component {
  static prepare (view) {
    const repo = Repository.singleton();
    if (repo.get(view)) {
      return;
    }

    Router.init();

    for (const loader of loaders) {
      if (view.match(loader.test)) {
        return loader.load(view);
      }
    }
  }

  static addLoader (loader) {
    Router.init();

    const index = loaders.indexOf(loader);
    if (index === -1) {
      loaders.push(loader);
    }
  }

  static removeLoader (loader) {
    Router.init();

    const index = loaders.indexOf(loader);
    if (index !== -1) {
      loaders.splice(index, 1);
    }
  }

  static init (reset) {
    if (reset) {
      loaders = [];
    }
    if (loaders.length === 0) {
      const repo = Repository.singleton();
      const repoLoaders = repo.get('view.loaders');
      if (repoLoaders && repoLoaders.length) {
        loaders.push(...repoLoaders);
      }
    }
  }

  get props () {
    return {
      ...super.props,

      mode: {
        type: String,
        value: 'hash',
      },

      manual: {
        type: Boolean,
        value: false,
      },

      hash: {
        type: String,
        value: '#!',
      },

      rootUri: {
        type: String,
        value: '/',
      },

      location: {
        type: Object,
        value: () => window.location,
      },

      history: {
        type: Object,
        value: () => window.history,
      },
    };
  }

  get hashRegexp () {
    if (!this.__routerHashRegexp || this.__routerHash !== this.hash) {
      this.__routerHashRegexp = new RegExp(`${this.hash}(.*)$`);
      this.__routerHash = this.hash;
    }

    return this.__routerHashRegexp;
  }

  getUri (location) {
    try {
      let uri;
      if (this.mode === 'history') {
        uri = decodeURI(location.pathname + location.search);
        uri = uri.replace(/\?(.*)$/, '');
        uri = this.rootUri === '/' ? uri : uri.replace(this.rootUri, '');
      } else {
        const match = location.href.match(this.hashRegexp);
        uri = match ? match[1] : '';
      }

      return '/' + uri.toString().replace(/\/$/, '').replace(/^\//, '');
    } catch (err) {
      console.error('Fragment is not match any pattern, fallback to /');
      console.error(err);
      return '/';
    }
  }

  created () {
    this.middlewares = [];
    this.routes = [];
  }

  async attached () {
    super.attached();

    this.__routerIsRoot = Boolean(!this.parentElement.closest('xin-router'));

    this.routes = [...this.querySelectorAll('xin-route')];
    await Promise.all(this.routes.map(async route => {
      await event(route).waitFor('route-attach');
    }));

    this.fire('router-attach');

    if (!this.manual) {
      this.start();
    }
  }

  detached () {
    super.detached();

    this.stop();

    this.__routerIsRoot = undefined;
  }

  use (middleware) {
    this.middlewares.push(middleware);
  }

  async start () {
    if (!this.__routerIsRoot) {
      return;
    }

    if (debug.enabled) debug(`Starting ${this.is}:${this.__id} ...`);

    this.__routerListen();

    const uri = this.getUri(this.location);
    await this.__routerDispatch(new Context({ uri }));
  }

  stop () {
    if (!this.__routerIsRoot) {
      return;
    }

    if (debug.enabled) debug(`Stopping ${this.is}:${this.__id} ...`);

    this.__middlewareChain = undefined;

    this.__routerUnlisten();
  }

  async push (uri, navParameters) {
    if (debug.enabled) debug(`Push ${this.is}:${this.__id} %s`, uri);

    if (this.currentUri === uri) {
      return;
    }

    const url = this.mode === 'history'
      ? this.rootUri + uri.toString().replace(/\/$/, '').replace(/^\//, '')
      : this.hash + uri;

    this.history.pushState(navParameters, document.title, url);
    await this.__routerDispatch(new Context({ uri, navParameters }));
  }

  async replace (uri, navParameters) {
    if (debug.enabled) debug(`Replace ${this.is}:${this.__id} %s`, uri);

    if (this.currentUri === uri) {
      return;
    }

    const url = this.mode === 'history'
      ? this.rootUri + uri.toString().replace(/\/$/, '').replace(/^\//, '')
      : this.hash + uri;

    this.history.replaceState(navParameters, document.title, url);
    await this.__routerDispatch(new Context({ uri, navParameters }));
  }

  async go (delta) {
    if (!delta) {
      return;
    }

    this.history.go(delta);

    await this.waitFor('router-dispatch');
  }

  __routerListen () {
    this.__routerPopstateListener = async () => {
      const uri = this.getUri(this.location);
      await this.__routerDispatch(new Context({ uri }));
    };

    this.__routerClickListener = evt => {
      if (!evt.defaultPrevented && evt.target.nodeName === 'A' && evt.target.target === '') {
        evt.preventDefault();

        const target = evt.target;
        let href = target.getAttribute('href');
        if (href.startsWith(this.hash)) {
          href = href.split(this.hash).pop();
        }

        this.push(href);
      }
    };

    event(window).on('popstate', this.__routerPopstateListener);
    event(document).on('click', this.__routerClickListener);
  }

  __routerUnlisten () {
    if (!this.__routerPopstateListener) {
      return;
    }

    event(window).off('popstate', this.__routerPopstateListener);
    event(document).off('click', this.__routerClickListener);
  }

  async __routerDispatch (ctx) {
    if (!this.__middlewareChain) {
      this.__middlewareChain = compose(this.middlewares);
    }

    this.currentUri = ctx.uri;

    ctx = ctx.shift(this);

    if (debug.enabled) debug(`Dispatching ${this.is}:${this.__id} with ctx: %O`, ctx);
    await this.__middlewareChain(ctx, async () => {
      await this.__routerRoute(ctx);
    });

    this.fire('router-dispatch', ctx);
  }

  async __routerRoute (ctx) {
    const routes = [];

    await Promise.all(this.routes.map(async route => {
      if (route.test(ctx.pathname)) {
        await route.enter(ctx);
        routes.push(route);
      } else {
        await route.leave();
      }
    }));

    if (!routes.length) {
      throw new Error(`Route not found! (uri:${ctx.originalUri})`);
    }

    return routes;
  }
}

define('xin-router', Router);

function compose (middlewares) {
  for (const fn of middlewares) {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be composed of functions!');
    }
  }

  return (context, next) => {
    // last called middlewares #
    let index = -1;

    function dispatch (i) {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }

      index = i;
      let fn = middlewares[i];
      if (i === middlewares.length) {
        fn = next;
      }
      if (!fn) {
        return;
      }

      return fn(context, () => dispatch(i + 1));
    }

    return dispatch(0);
  };
}

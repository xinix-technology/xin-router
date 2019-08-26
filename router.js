import { define, Component, event, Async } from '@xinix/xin'; // eslint-disable-line max-lines
import qs from 'querystring';

const debug = require('debug')('xin-router:router');
const URL = window.URL;

export class Router extends Component {
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

  getClientUri () {
    try {
      let uri;
      if (this.mode === 'history') {
        uri = decodeURI(this.location.pathname + this.location.search);
        uri = uri.replace(/\?(.*)$/, '');
        uri = this.rootUri === '/' ? uri : uri.replace(this.rootUri, '');
      } else {
        const match = this.location.href.match(this.hashRegexp);
        uri = match ? match[1] : '';
      }

      return '/' + uri.toString().replace(/\/$/, '').replace(/^\//, '');
    } catch (err) {
      console.error('Fragment is not match any pattern, fallback to /');
      return '/';
    }
  }

  get isRoot () {
    return Boolean(!this.__routerParent);
  }

  created () {
    this.middlewares = [];
    this.routes = [];
    this.routers = [];
  }

  async attached () {
    this.__routerParent = this.parentElement.closest('xin-router');
    if (!this.isRoot) {
      this.__routerParent.__routerAddRouter(this);
      await Async.sleep(1);
      this.__middlewareChain = compose(this.middlewares);
      return;
    }

    this.setAttribute('root', true);

    await Async.sleep(1);
    this.__middlewareChain = compose(this.middlewares);

    if (!this.manual) {
      this.start();
    }
  }

  detached () {
    this.stop();

    this.routes.forEach(route => route.leave());
    this.__middlewareChain = undefined;

    if (this.isRoot) {
      this.removeAttribute('root');
    } else {
      this.__routerParent.__routerRemoveRouter(this);
    }
    this.__routerParent = undefined;
  }

  use (middleware) {
    this.middlewares.push(middleware);
  }

  async start () {
    if (!this.isRoot) {
      return;
    }

    if (debug.enabled) debug(`Starting ${this.is}:${this.__id} ...`);

    this.__routerListen();

    await this.__routerDispatch(this.__routerCreateContext(this.getClientUri()));
  }

  stop () {
    if (!this.isRoot) {
      return;
    }

    if (debug.enabled) debug(`Stopping ${this.is}:${this.__id} ...`);

    this.__routerUnlisten();
  }

  async push (uri, navParameters) {
    debug('Push %s', uri);
    if (this.getClientUri() === uri) {
      return;
    }

    const url = this.mode === 'history'
      ? this.rootUri + uri.toString().replace(/\/$/, '').replace(/^\//, '')
      : this.hash + uri;

    this.history.pushState(navParameters, document.title, url);
    await this.__routerDispatch(this.__routerCreateContext(uri, navParameters));
  }

  async replace (uri, navParameters) {
    debug('Replace %s', uri);
    if (this.getClientUri() === uri) {
      return;
    }

    const url = this.mode === 'history'
      ? this.rootUri + uri.toString().replace(/\/$/, '').replace(/^\//, '')
      : this.hash + uri;

    this.history.replaceState(navParameters, document.title, url);
    await this.__routerDispatch(this.__routerCreateContext(uri, navParameters));
  }

  go (delta) {
    if (!delta) {
      return;
    }
    this.history.go(delta);
  }

  __routerAddRoute (route) {
    this.routes.push(route);
  }

  __routerRemoveRoute (route) {
    this.routes = this.routes.filter(r => r !== route);
  }

  __routerAddRouter (router) {
    this.routers.push(router);
  }

  __routerRemoveRouter (router) {
    this.routers = this.routers.filter(r => r !== router);
  }

  __routerListen () {
    this.__routerPopstateListener = async () => {
      await this.__routerDispatch(this.__routerCreateContext(this.getClientUri()));
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

  __routerCreateContext (uri, navParameters = {}) {
    let { pathname, search } = new URL(uri, 'http://localhost');
    if (search[0] === '?') {
      search = search.substr(1);
    }
    const queryParameters = qs.parse(search);

    const parameters = {
      ...queryParameters,
      ...navParameters,
    };

    return {
      // router: this,
      originalUri: uri,
      uri,
      pathname,
      parameters,
    };
  }

  async __routerDispatch (ctx) {
    await this.__middlewareChain(ctx, async () => {
      await this.__routerRoute(ctx);

      await Promise.all(this.routers.map(async router => {
        await router.__routerDispatch(ctx);
      }));
    });
  }

  async __routerRoute (ctx) {
    let found;

    await Promise.all(this.routes.map(async route => {
      if (route.test(ctx.pathname)) {
        found = true;
        await route.enter(ctx);
        return;
      }

      await route.leave(ctx);
    }));

    if (!found) {
      throw new Error(`Route not found! (uri:${ctx.getClientUri()})`);
    }
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

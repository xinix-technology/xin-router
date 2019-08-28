import qs from 'querystring';
import { Route } from './route'; // eslint-disable-line no-unused-vars

const URL = window.URL;

export class Context {
  constructor (ctx) {
    if (ctx instanceof Context) {
      this.originalUri = ctx.originalUri;
      this.uri = ctx.uri;
      this.pathname = ctx.pathname;
      this.search = ctx.search;
      this.queryParameters = ctx.queryParameters;
    } else {
      this.originalUri = ctx.originalUri || ctx.uri;
      this._setUri(ctx.uri);
    }

    this.navParameters = { ...ctx.navParameters };
    this.routeParameters = { ...ctx.routeParameters };
  }

  get parameters () {
    return {
      ...this.routeParameters,
      ...this.queryParameters,
      ...this.navParameters,
    };
  }

  _setUri (uri) {
    this.uri = uri;
    let { pathname, search } = new URL(uri, 'http://localhost');
    if (search[0] === '?') {
      search = search.substr(1);
    }

    this.pathname = pathname;
    this.search = search;
    this.queryParameters = qs.parse(search);
  }

  withUri (uri) {
    const ctx = new Context(this);
    ctx._setUri(uri);
    return ctx;
  }

  shift (router) {
    const { uri } = this;
    if (!uri.startsWith(router.rootUri)) {
      throw new Error(`Context not eligible for ${router.is}:${router.__id} with rootUri:${router.rootUri}`);
    }

    return this.withUri(router.rootUri === '/' ? uri : uri.substr(router.rootUri.length));
  }

  /**
   * Copy context for specific route
   * @param {Route} route
   */
  for (route) {
    const ctx = new Context(this);
    ctx.routeParameters = {
      ...this.routeParameters,
      ...route.__routeExtractSegmentParameters(this.pathname),
    };
    return ctx;
  }
}

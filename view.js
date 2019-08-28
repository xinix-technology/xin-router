import { Component, define, event } from '@xinix/xin';

export class View extends Component {
  get props () {
    return {
      ...super.props,

      parameters: {
        type: Object,
      },
    };
  }

  ready () {
    super.ready();

    this.setAttribute('xin-view', '');
  }

  async attached () {
    super.attached();

    this.routers = [...this.querySelectorAll('xin-router')];
    await Promise.all(this.routers.map(async router => {
      await event(router).waitFor('router-attach');
    }));

    this.fire('view-attach');
  }

  async __viewEnter (route, ctx) {
    this.set('ctx', ctx);
    this.set('parameters', ctx.parameters);

    await this.focusing();
    event(this).fire('focusing');

    if (this.parentElement !== route.parentElement) {
      await route.parentElement.insertBefore(this, route);
      await event(this).waitFor('view-attach');
    }

    await Promise.all(this.routers.map(async router => {
      await router.__routerDispatch(ctx);
    }));

    await this.focused();
    event(this).fire('focus');
  }

  async __viewLeave (route) {
    await route.parentElement.removeChild(this);

    await this.blurred();
    event(this).fire('blur');
  }

  focusing () {}

  focused () {}

  blurred () {}
}

define('xin-view', View);

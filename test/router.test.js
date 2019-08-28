import { define, Repository } from '@xinix/xin';
import { Fixture } from '@xinix/xin/components/fixture';
import assert from 'assert';
import { Router, View, Middleware } from '@xinix/xin-router';

describe('Router', () => {
  define('router-home', class extends View {
    get template () {
      return 'home';
    }
  });

  it('navigate', async () => {
    window.location.replace('#');

    const mockHistory = new MockHistory();
    Repository.singleton().put('test.history', mockHistory);

    const fixture = await Fixture.create(`
      <a href="#!/">home</a>
      <a id="fooLink" href="#!/foo">foo</a>
      <a href="#!/bar">bar</a>

      <xin-router id="router" history='[[$repository.get("test.history")]]'>
        <xin-route uri="/">
          <template>home</template>
        </xin-route>
        <xin-route uri="/foo">
          <template>foo</template>
        </xin-route>
        <xin-route uri="/bar">
          <template>bar</template>
        </xin-route>
      </xin-router>
    `);

    try {
      await fixture.waitConnected();
      const router = fixture.$.router;

      assert.strictEqual(router.getUri(router.location), '/');
      assert.strictEqual(fixture.$$('[xin-view]').nextElementSibling.uri, '/');

      await router.push('/foo');

      assert.strictEqual(router.getUri(router.location), '/foo');
      assert.strictEqual(fixture.$$('[xin-view]').nextElementSibling.uri, '/foo');
      assert.strictEqual(mockHistory.position, 0);

      await router.push('/bar');

      assert.strictEqual(router.getUri(router.location), '/bar');
      assert.strictEqual(fixture.$$('[xin-view]').nextElementSibling.uri, '/bar');
      assert.strictEqual(mockHistory.position, 1);

      await router.push('/foo');

      await router.go(-1);

      assert.strictEqual(fixture.$$('[xin-view]').nextElementSibling.uri, '/bar');

      await router.go(0);

      assert.strictEqual(fixture.$$('[xin-view]').nextElementSibling.uri, '/bar');

      await router.go(1);

      assert.strictEqual(fixture.$$('[xin-view]').nextElementSibling.uri, '/foo');

      await router.replace('/');

      assert.strictEqual(fixture.$$('[xin-view]').nextElementSibling.uri, '/');
      assert.strictEqual(mockHistory.position, 2);

      fixture.$.fooLink.click();
      await router.waitFor('router-dispatch');

      assert.strictEqual(fixture.$$('[xin-view]').nextElementSibling.uri, '/foo');
    } finally {
      fixture.dispose();
      window.location.replace('#');
    }
  });

  it('fill parameters from segment, query, nav parameters', async () => {
    window.location.replace('#');

    const mockHistory = new MockHistory();
    Repository.singleton().put('test.history', mockHistory);

    const fixture = await Fixture.create(`
      <a href="#!/">home</a>
      <a href="#!/foo/satu">satu</a>
      <a href="#!/bar?q=dua">dua</a>

      <xin-router id="router" history='[[$repository.get("test.history")]]'>
        <xin-route uri="/">
          <template>home</template>
        </xin-route>
        <xin-route uri="/foo/{segment}">
          <template><div>segment: <span id="segmentEl">[[parameters.segment]]</span></div></template>
        </xin-route>
        <xin-route uri="/bar">
          <template><div>query: <span id="queryEl">[[parameters.q]]</span></div></template>
        </xin-route>
      </xin-router>
    `);

    try {
      await fixture.waitConnected();
      const router = fixture.$.router;

      await router.push('/foo/satu');
      assert.strictEqual(fixture.$$('[xin-view]').$.segmentEl.textContent.trim(), 'satu');

      await router.push('/foo/dua');
      assert.strictEqual(fixture.$$('[xin-view]').$.segmentEl.textContent.trim(), 'dua');

      await router.push('/bar?q=satu');
      assert.strictEqual(fixture.$$('[xin-view]').$.queryEl.textContent.trim(), 'satu');

      await router.push('/bar?q=dua');
      assert.strictEqual(fixture.$$('[xin-view]').$.queryEl.textContent.trim(), 'dua');

      await router.push('/bar', { q: 'tiga' });
      assert.strictEqual(fixture.$$('[xin-view]').$.queryEl.textContent.trim(), 'tiga');
    } finally {
      fixture.dispose();
      window.location.replace('#');
    }
  });

  it('invoke view lifecycles', async () => {
    const order = [];
    define('router-lifecycle-foo', class extends View {
      get template () {
        return 'lifecycle-foo';
      }

      focusing () {
        order.push('foo focusing');
      }

      focused () {
        order.push('foo focused');
      }

      blurred () {
        order.push('foo blurred');
      }
    });

    define('router-lifecycle-bar', class extends View {
      get template () {
        return 'lifecycle-bar';
      }

      focusing () {
        order.push('bar focusing');
      }

      focused () {
        order.push('bar focused');
      }

      blurred () {
        order.push('bar blurred');
      }
    });

    window.location.replace('#');

    const mockHistory = new MockHistory();
    Repository.singleton().put('test.history', mockHistory);

    const fixture = await Fixture.create(`
      <a href="#!/">home</a>
      <a href="#!/foo?q=satu">satu</a>
      <a href="#!/bar?q=dua">dua</a>

      <xin-router id="router" history='[[$repository.get("test.history")]]'>
        <xin-route uri="/"><template>home</template></xin-route>
        <xin-route uri="/foo" view="router-lifecycle-foo"></xin-route>
        <xin-route uri="/bar" view="router-lifecycle-bar"></xin-route>
      </xin-router>
    `);

    try {
      await fixture.waitConnected();
      const router = fixture.$.router;

      await router.push('/foo?q=satu');
      await router.push('/bar?q=dua');

      assert.notStrictEqual(order.length, 0);
      assert.strictEqual(order[0], 'foo focusing');
      assert.strictEqual(order[1], 'foo focused');
      assert.strictEqual(order[2], 'foo blurred');
      assert.strictEqual(order[3], 'bar focusing');
      assert.strictEqual(order[4], 'bar focused');
    } finally {
      fixture.dispose();
      window.location.replace('#');
    }
  });

  it('invoke middlewares', async () => {
    window.location.replace('#');

    let stack = [];

    define('router-mw-1', class extends Middleware {
      get props () {
        return {
          ...super.props,

          name: {
            type: String,
            value: 'middleware',
          },
        };
      }

      callback () {
        return async (ctx, next) => {
          stack.push(`before ${this.name}`);
          await next();
          stack.push(`after ${this.name}`);
        };
      }
    });

    const fixture = await Fixture.create(`
      <a href="#!/">home</a>
      <a href="#!/foo">foo</a>
      <a href="#!/bar">bar</a>

      <xin-router id="router" manual>
        <router-mw-1 name="mw1"></router-mw-1>
        <router-mw-1 name="mw2"></router-mw-1>
        <xin-route uri="/"><template>home</template></xin-route>
        <xin-route uri="/foo"><template>foo</template></xin-route>
        <xin-route uri="/bar"><template>bar</template></xin-route>
      </xin-router>
    `);

    try {
      await fixture.waitConnected();
      const router = fixture.$.router;
      router.use((ctx, next) => {
        stack.push('programmatically');
        return next();
      });
      await router.start();

      assert.strictEqual(stack.length, 5);
      assert.strictEqual(stack[0], 'before mw1');
      assert.strictEqual(stack[1], 'before mw2');
      assert.strictEqual(stack[2], 'programmatically');
      assert.strictEqual(stack[3], 'after mw2');
      assert.strictEqual(stack[4], 'after mw1');

      stack = [];

      await router.push('/foo');

      assert.strictEqual(stack.length, 5);
      assert.strictEqual(stack[0], 'before mw1');
      assert.strictEqual(stack[1], 'before mw2');
      assert.strictEqual(stack[2], 'programmatically');
      assert.strictEqual(stack[3], 'after mw2');
      assert.strictEqual(stack[4], 'after mw1');
    } finally {
      fixture.dispose();
      window.location.replace('#');
    }
  });

  it('nested router', async () => {
    window.location.replace('#');

    const mockHistory = new MockHistory();
    Repository.singleton().put('test.history', mockHistory);

    const fixture = await Fixture.create(`
      <div>
        <span (click)='$global.router.push("/")'>home</span>
        <a href="#!/">home</a>
        <a href="#!/foo/bar">foo/bar</a>
        <a href="#!/foo/baz">foo/baz</a>
        <a href="#!/bar">bar</a>
      </div>

      <xin-router id="router" history='[[$repository.get("test.history")]]'>
        <xin-route uri="/">
          <template>home</template>
        </xin-route>
        <xin-route uri="/foo/{name}">
          <template>
            <div>foo</div>
            <xin-router root-uri="/foo" id="router2">
              <xin-route uri="/bar"><template>bar</template></xin-route>
              <xin-route uri="/baz"><template>baz</template></xin-route>
            </xin-router>
          </template>
        </xin-route>
        <xin-route uri="/bar">
          <template>bar</template>
        </xin-route>
      </xin-router>
    `);

    try {
      await fixture.waitConnected();
      const router = fixture.$.router;

      assert.strictEqual(router.textContent.trim(), 'home');

      await router.push('/foo/bar');
      assert(router.textContent.match(/foo\s+bar/));

      await router.push('/foo/baz');
      assert(router.textContent.match(/foo\s+baz/));

      await router.push('/bar');
      assert(router.textContent.match(/bar/));
    } finally {
      fixture.dispose();
      window.location.replace('#');
    }
  });

  it('lazy load view', async () => {
    Router.init(true);
    window.location.replace('#');

    Repository.bootstrap({
      'view.loaders': [
        {
          test: /^router-lazy-foo/,
          load (view) {
            return import('./views/router-lazy-foo');
          },
        },
      ],
    });

    Router.addLoader({
      test: /^router-lazy-bar/,
      load (view) {
        return import('./views/router-lazy-bar');
      },
    });

    const fixture = await Fixture.create(`
      <div>
        <a href="#!/">home</a>
        <a href="#!/foo">foo</a>
        <a href="#!/bar">bar</a>
      </div>

      <xin-router id="router">
        <xin-route uri="/">
          <template>home</template>
        </xin-route>
        <xin-route uri="/foo" view="router-lazy-foo"></xin-route>
        <xin-route uri="/bar" view="router-lazy-bar"></xin-route>
      </xin-router>
    `);

    try {
      await fixture.waitConnected();
      const router = fixture.$.router;

      assert.strictEqual(router.textContent.trim(), 'home');

      let view;

      await router.push('/foo');
      view = router.$$('router-lazy-foo');
      assert(view);
      assert('__id' in view);

      await router.push('/bar');
      view = router.$$('router-lazy-bar');
      assert(view);
      assert('__id' in view);
    } finally {
      fixture.dispose();
      window.location.replace('#');

      Router.init(true);
    }
  });
});

class MockHistory {
  constructor () {
    this.position = -1;
    this.stack = [];
  }

  pushState (data, title, url) {
    this.stack.push(url);
    this.position++;

    window.history.pushState(data, title, url);
  }

  replaceState (data, title, url) {
    this.stack[this.stack.length - 1] = url;

    window.history.replaceState(data, title, url);
  }

  go (delta) {
    this.position = this.position + delta;
    window.history.go(delta);
  }
}

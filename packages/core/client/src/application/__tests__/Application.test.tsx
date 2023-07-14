import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import React, { Component } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { render, screen, sleep, userEvent } from 'testUtils';
import { describe } from 'vitest';
import { Application } from '../Application';
import { Plugin } from '../Plugin';

describe('Application', () => {
  beforeAll(() => {
    const mock = new MockAdapter(axios);
    mock.onGet('app:getPlugins').reply(200, {
      data: {},
    });
  });

  const router: any = { type: 'memory', initialEntries: ['/'] };
  const initialComponentsLength = 6;
  const initialProvidersLength = 2;
  it('basic', () => {
    const app = new Application({ router });
    expect(app.i18n).toBeDefined();
    expect(app.apiClient).toBeDefined();
    expect(app.components).toBeDefined();
    expect(app.pm).toBeDefined();
    expect(app.providers).toBeDefined();
    expect(app.router).toBeDefined();
    expect(app.scopes).toBeDefined();
    expect(app.providers).toHaveLength(initialProvidersLength);
    expect(Object.keys(app.components)).toHaveLength(initialComponentsLength);
  });

  describe('components', () => {
    const Hello = () => <div>Hello</div>;
    Hello.displayName = 'Hello';

    it('initial', () => {
      const app = new Application({ router, components: { Hello } });
      expect(app.components.Hello).toBe(Hello);
    });

    it('addComponents', () => {
      const app = new Application({ router });
      app.addComponents({ Hello });
      expect(app.components.Hello).toBe(Hello);
    });

    it('addComponent', () => {
      const app = new Application({ router });
      app.addComponent(Hello);
      expect(app.components.Hello).toBe(Hello);

      app.addComponent(Hello, 'Hello2');
      expect(app.components.Hello2).toBe(Hello);
    });

    it('addComponents without name, should error', () => {
      const app = new Application({ router });

      const fn = vitest.fn();
      const originalConsoleError = console.error;
      console.error = fn;
      app.addComponent(() => <div>123</div>);
      expect(fn).toBeCalled();
      console.error = originalConsoleError;
    });

    describe('getComponent', () => {
      let originalConsoleError: any;
      beforeEach(() => {
        originalConsoleError = console.error;
      });
      afterEach(() => {
        console.error = originalConsoleError;
      });

      it('arg is Class component', () => {
        class Foo extends Component {
          render() {
            return <div></div>;
          }
        }
        const app = new Application({ router });
        expect(app.getComponent(Foo)).toBe(Foo);
      });

      it('arg is Function component', () => {
        const Foo = () => <div></div>;
        const app = new Application({ router });
        expect(app.getComponent(Foo)).toBe(Foo);
      });

      it('arg is string', () => {
        const Foo = () => <div></div>;
        const app = new Application({ router, components: { Foo } });
        expect(app.getComponent('Foo')).toBe(Foo);
      });

      it('arg is string, but not found in components', () => {
        const app = new Application({ router });
        const fn = vitest.fn();
        console.error = fn;
        expect(app.getComponent('Foo')).toBeUndefined();
        expect(fn).toBeCalled();
      });

      it('arg is null or undefined', () => {
        const app = new Application({ router });
        const fn = vitest.fn();
        console.error = fn;
        expect(app.getComponent(null)).toBeUndefined();
        expect(fn).toBeCalled();
      });

      it('arg is other types', () => {
        const app = new Application({ router });
        const fn = vitest.fn();
        console.error = fn;
        expect(app.getComponent({} as any)).toBeUndefined();
        expect(fn).toBeCalled();
      });
    });

    it('renderComponent', () => {
      const Foo = (props) => <div>{props.name}</div>;
      const app = new Application({ router, components: { Foo } });
      expect(app.renderComponent('Foo', { name: 'bar' })).toEqual(<Foo name="bar" />);
    });
  });

  describe('scopes', () => {
    it('initial', () => {
      const scopes = { foo: 'bar' };
      const app = new Application({ router, scopes });
      expect(app.scopes).toEqual(scopes);
    });

    it('addScopes', () => {
      const app = new Application({ router });
      app.addScopes({ foo: 'bar' });
      expect(app.scopes).toEqual({ foo: 'bar' });
    });
  });

  describe('providers', () => {
    const Hello = (props) => <div>Hello {props.children}</div>;
    const World = (props) => (
      <div>
        <div>World</div>
        <div>{props.name}</div>
        <div>{props.children}</div>
      </div>
    );
    const Foo = (props) => <div>Foo {props.children}</div>;

    it('initial', () => {
      const app = new Application({ router, providers: [Hello, [World, { name: 'aaa' }]] });
      expect(app.providers.slice(initialProvidersLength)).toEqual([
        [Hello, undefined],
        [World, { name: 'aaa' }],
      ]);
    });

    it('addProviders', () => {
      const app = new Application({ router, providers: [Hello] });
      app.addProviders([[World, { name: 'aaa' }], Foo]);
      expect(app.providers.slice(initialProvidersLength)).toEqual([
        [Hello, undefined],
        [World, { name: 'aaa' }],
        [Foo, undefined],
      ]);
    });

    it('addProvider', () => {
      const app = new Application({ router, providers: [Hello] });
      app.addProvider(World, { name: 'aaa' });
      expect(app.providers.slice(initialProvidersLength)).toEqual([
        [Hello, undefined],
        [World, { name: 'aaa' }],
      ]);
    });

    it('use', () => {
      const app = new Application({ router, providers: [Hello] });
      app.use(World, { name: 'aaa' });
      expect(app.providers.slice(initialProvidersLength)).toEqual([
        [Hello, undefined],
        [World, { name: 'aaa' }],
      ]);
    });

    it('getComposeProviders', () => {
      const app = new Application({ router, providers: [Hello, [World, { name: 'aaa' }]] });
      const Providers = app.getComposeProviders();
      render(
        <Providers>
          <Foo />
        </Providers>,
      );
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('World')).toBeInTheDocument();
      expect(screen.getByText('aaa')).toBeInTheDocument();
      expect(screen.getByText('Foo')).toBeInTheDocument();
    });
  });

  describe('render', () => {
    it('getRootComponent', async () => {
      const app = new Application({
        router,
      });
      const Layout = () => (
        <div>
          <div>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </div>
          <Outlet />
        </div>
      );
      const Home = () => {
        return <div>HomeComponent</div>;
      };
      const About = () => {
        return <div>AboutComponent</div>;
      };

      const HelloProvider = ({ children }) => {
        return <div>Hello {children}</div>;
      };

      app.router.add('root', {
        element: <Layout />,
      });
      app.router.add('root.home', {
        path: '/',
        element: <Home />,
      });
      app.router.add('root.about', {
        path: '/about',
        element: <About />,
      });
      app.addProviders([HelloProvider]);

      const Root = app.getRootComponent();
      render(<Root />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      await sleep(10);
      expect(screen.getByText('HomeComponent')).toBeInTheDocument();
      await userEvent.click(screen.getByText('About'));
      expect(screen.getByText('AboutComponent')).toBeInTheDocument();
    });

    it('mount', async () => {
      const Hello = () => <div>Hello</div>;
      const app = new Application({
        router,
        providers: [Hello],
      });

      render(<div id="app"></div>);
      const root = app.mount('#app');
      expect(root).toBeDefined();

      await sleep(10);
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('mount root error', () => {
      const app = new Application({
        router,
      });
      const originalConsoleWarn = console.warn;

      const fn = vitest.fn();
      console.warn = fn;
      app.mount('#app');
      expect(fn).toBeCalled();

      console.warn = originalConsoleWarn;
    });

    it('plugin load error', async () => {
      const app = new Application({
        router,
      });
      class DemoPlugin extends Plugin {
        async load() {
          throw new Error('error');
        }
      }
      app.pm.add(DemoPlugin, { name: 'demo' });

      const Root = app.getRootComponent();
      render(<Root />);

      await sleep(10);
      expect(screen.getByText('Load Plugin Error')).toBeInTheDocument();
    });

    it('replace Component', async () => {
      const AppSpin = () => <div>AppSpin</div>;
      const AppMain = () => <div>AppMain</div>;
      const app = new Application({
        router,
        components: { AppSpin, AppMain },
      });
      const Root = app.getRootComponent();
      render(<Root />);
      expect(screen.getByText('AppSpin')).toBeInTheDocument();
      await sleep(10);
      expect(screen.getByText('AppMain')).toBeInTheDocument();
    });

    it('render component error', async () => {
      const app = new Application({
        router,
      });

      const ErrorFallback = () => {
        return <div>ErrorFallback</div>;
      };
      const Foo = () => {
        throw new Error('error');
        return null;
      };
      app.use(Foo);
      app.addComponents({
        ErrorFallback,
      });

      const originalConsoleWarn = console.error;
      const fn = vitest.fn();
      console.error = fn;

      const Root = app.getRootComponent();
      render(<Root />);
      await sleep(10);
      expect(fn).toBeCalled();

      expect(screen.getByText('ErrorFallback')).toBeInTheDocument();
      screen.debug();

      console.error = originalConsoleWarn;
    });
  });
});

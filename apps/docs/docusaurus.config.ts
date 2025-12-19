import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Saga Bus',
  tagline: 'MassTransit-style saga orchestration for TypeScript/Node.js',
  favicon: 'img/logo.svg',

  future: {
    v4: true,
  },

  // GitHub Pages deployment
  url: 'https://d-e-a-n-f.github.io',
  baseUrl: '/saga-bus/',
  organizationName: 'd-e-a-n-f',
  projectName: 'saga-bus',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/d-e-a-n-f/saga-bus/tree/main/apps/docs/',
          showLastUpdateTime: true,
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/saga-bus-social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    announcementBar: {
      id: 'beta',
      content: '🚀 Saga Bus is in active development. <a href="/saga-bus/docs/">Get started</a> today!',
      backgroundColor: '#0ea5e9',
      textColor: '#ffffff',
      isCloseable: true,
    },
    navbar: {
      title: 'Saga Bus',
      logo: {
        alt: 'Saga Bus Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/getting-started/quick-start',
          label: 'Quick Start',
          position: 'left',
        },
        {
          to: '/docs/examples/overview',
          label: 'Examples',
          position: 'left',
        },
        {
          href: 'https://www.npmjs.com/org/saga-bus',
          label: 'npm',
          position: 'right',
        },
        {
          href: 'https://github.com/d-e-a-n-f/saga-bus',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started/installation',
            },
            {
              label: 'Core Concepts',
              to: '/docs/core-concepts/overview',
            },
            {
              label: 'API Reference',
              to: '/docs/api/core',
            },
          ],
        },
        {
          title: 'Packages',
          items: [
            {
              label: '@saga-bus/core',
              href: 'https://www.npmjs.com/package/@saga-bus/core',
            },
            {
              label: '@saga-bus/transport-rabbitmq',
              href: 'https://www.npmjs.com/package/@saga-bus/transport-rabbitmq',
            },
            {
              label: '@saga-bus/store-postgres',
              href: 'https://www.npmjs.com/package/@saga-bus/store-postgres',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/d-e-a-n-f/saga-bus',
            },
            {
              label: 'Issues',
              href: 'https://github.com/d-e-a-n-f/saga-bus/issues',
            },
            {
              label: 'Releases',
              href: 'https://github.com/d-e-a-n-f/saga-bus/releases',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Saga Bus. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

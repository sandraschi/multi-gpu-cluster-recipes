const lightCodeTheme = require("prism-react-renderer").themes.github;
const darkCodeTheme = require("prism-react-renderer").themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Multi-GPU Cluster Recipes",
  tagline:
    "Budget multi-GPU local AI clusters for solo developers: RTX 4090 + 4060 Ti secondaries, over risers, OCuLink, or MCIO 8i docks.",
  url: "https://sandraschi.github.io",
  baseUrl: process.env.BASE_URL || "/multi-gpu-cluster-recipes/",
  organizationName: "sandraschi",
  projectName: "multi-gpu-cluster-recipes",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "throw",

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: "../docs",
          routeBasePath: "docs",
          sidebarPath: "./sidebars.js",
          editUrl:
            "https://github.com/sandraschi/multi-gpu-cluster-recipes/edit/main/docs/",
        },
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: "dark",
        disableSwitch: false,
        respectPrefersColorScheme: false,
      },
      navbar: {
        title: "Multi-GPU Cluster Recipes",
        items: [
          { to: "/docs/", position: "left", label: "Docs" },
          {
            href: "https://github.com/sandraschi/multi-gpu-cluster-recipes",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              {
                label: "Hardware Blueprint",
                to: "/docs/hardware-blueprint",
              },
              {
                label: "Worker Orchestration",
                to: "/docs/worker-orchestration",
              },
              {
                label: "Monitoring and Ops",
                to: "/docs/monitoring-and-ops",
              },
              {
                label: "Scale-Up: HPC Ladder",
                to: "/docs/scale-up-hpc",
              },
            ],
          },
          {
            title: "Repo",
            items: [
              {
                label: "GitHub",
                href: "https://github.com/sandraschi/multi-gpu-cluster-recipes",
              },
              {
                label: "Contributing",
                href: "https://github.com/sandraschi/multi-gpu-cluster-recipes/blob/main/CONTRIBUTING.md",
              },
              {
                label: "Changelog",
                href: "https://github.com/sandraschi/multi-gpu-cluster-recipes/blob/main/CHANGELOG.md",
              },
            ],
          },
        ],
        copyright: `Copyright (c) ${new Date().getFullYear()} multi-gpu-cluster-recipes contributors. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;

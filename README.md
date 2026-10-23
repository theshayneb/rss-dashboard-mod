<div align="center">
  <img src="assets/branding/logo.png" alt="RSS Dashboard Logo" width="180" />
</div>

# RSS Dashboard

Only the feeds you need. Stream the world's knowledge into your vault: RSS, podcasts, YouTube, and more, all in one dashboard.

[![Latest release](https://img.shields.io/github/v/release/amatya-aditya/obsidian-rss-dashboard?style=flat-square&color=573E7A&label=release)](https://github.com/amatya-aditya/obsidian-rss-dashboard/releases/latest)
[![License](https://img.shields.io/github/license/amatya-aditya/obsidian-rss-dashboard)](https://github.com/amatya-aditya/obsidian-rss-dashboard/blob/main/LICENSE)
![Total downloads](https://img.shields.io/github/downloads/amatya-aditya/obsidian-rss-dashboard/total)

**[Install](#installation)** · **[Documentation](docs/)** · **[Discord](https://discord.gg/9bu7V9BBbs)** · **[Latest Release](https://github.com/amatya-aditya/obsidian-rss-dashboard/releases/latest)** · **[Contributing](CONTRIBUTING.md)**

![RSS Dashboard reader view](assets/2.2/2.2_Dashboard_reader.jpg)

## What is RSS Dashboard?

A free, open-source Obsidian plugin that streams RSS, podcasts, YouTube, and more directly into your vault. Read, organize, and save content without leaving Obsidian.

**No ads. No trackers. No pop-ups. Open source.**

## Community & Philosophy

Built for people who value privacy and data ownership. Part of the Obsidian ecosystem—developed in the open, funded by the community, and designed to integrate seamlessly with your vault.

Want to help shape the next release? [Join Discord](https://discord.gg/9bu7V9BBbs)

## Read Without Distraction

Full article content fetched and rendered right in Obsidian. No ads, no distracting sidebars—just the text you came to read. Track your progress through articles, videos, and podcasts. Resume where you left off, distraction-free.

## Build Your Reading System

Your feeds, organized your way. Create folders and subfolders, add custom tags, filter by read status or feed, sort by date or category. Automatic refresh keeps your subscriptions current. Discover new feeds from our curated Discover page or browse smaller independent blogs through Kagi Smallweb.

![RSS Dashboard dashboard and organization](assets/2.2/2.2_Dashboard.jpg)

## Keep What Matters

Save articles directly to your vault as Markdown. Customize what gets saved with templates, frontmatter variables, and automatic tagging. Your archive, perfectly formatted.

## Own Your Data

Completely local. Completely open source. No ads, no tracking, no paywalls—just your data, stored on your device. Full control over what you read and how it's organized.

## Move Your Data Freely

Import and export your subscriptions as OPML. Support for RSS, Atom, JSON feeds, YouTube channels, podcasts, and Mastodon accounts. Migrating from Inoreader or FreshRSS? [Import your starred articles](docs/starred-import-guide.md) directly. Switch tools anytime—your data comes with you.

## Screenshots

> [!NOTE]
> These screenshots predate 2.7.0. The **Twitter** folder and the X/Twitter feeds in the sidebar relied on the Nitter integration, which was removed in 2.7.0 after Nitter shut down. See the [changelog](CHANGELOG.md) for details and alternatives.

![RSS Dashboard Discover page](assets/2.2/2.2_Discover.jpg)

## Version 2.2.0 Demo

Version 2.2.0 demo (core experience remains similar).

[![What's New in 2.2.0?](assets/2.2/video_thumbnail/2.2_Dashboard_video_thumbnail_youtube_icon.png)](https://www.youtube.com/watch?v=Lq2TRCZlqlQ)

## This fork: RSS Dashboard (Mod)

This repository is a personal fork, published as **RSS Dashboard (Mod)** with the plugin id `rss-dashboard-mod`, so it installs next to the original plugin rather than replacing it.

### Install with BRAT

1. Install **BRAT** from Obsidian's Community Plugins browser.
2. Run `BRAT: Add a beta plugin for testing` from the command palette.
3. Paste `https://github.com/theshayneb/rss-dashboard-mod` and choose the latest version.
4. Enable **RSS Dashboard (Mod)** under **Settings → Community plugins**.

BRAT picks up each new release from this repository's Releases page.

### Move your data from the original plugin

1. Keep the original **RSS Dashboard** enabled, and enable **RSS Dashboard (Mod)** alongside it.
2. In **Settings → RSS Dashboard (Mod) → Storage**, click **Import from original**, or run `Import feeds and settings from original RSS dashboard` from the command palette.
3. Review the confirmation and click to import.
4. Disable the original plugin, then reload Obsidian.

### Sync with Obsidian Sync

Feeds, settings, and read, starred, and tag state sync across devices once both of these are true:

1. On **every** device, open **Settings → Sync** and turn on **Sync all other types**, **Active community plugin list**, and **Installed community plugin list**.
2. In **Settings → RSS Dashboard (Mod) → Storage**, **Sync across devices** says storage is in folders Obsidian Sync carries. If it doesn't, click **Move to synced folder** on the device that has your data, and wait for Sync to finish before opening the plugin on other devices.

On a new device, let Sync report **Fully synced** before enabling the plugin, as described in [Syncing across devices](docs/syncing.md).

### Releasing

Bump the version with `npm version <x.y.z> --no-git-tag-version` (updates `package.json`, `manifest.json`, and `versions.json`), add a `CHANGELOG.md` entry, commit, then push a tag with the same version and no leading `v`, e.g. `git tag 2.7.3 && git push origin 2.7.3`. The release workflow builds and publishes the release BRAT installs. Tags like `2.8.0-beta.1` publish as prereleases. You can also run the **Release Obsidian plugin** workflow by hand from the Actions tab to release the version in `manifest.json` from a branch.

## Installation

1. Open **Settings** in Obsidian.
2. Go to **Community plugins** → disable **Restricted mode** (if enabled).
3. Click **Browse**.
4. Search **RSS Dashboard** and click **Install**.
5. Enable the plugin in Community plugins list.

For BRAT beta testing or manual installation, see [Installation Methods](docs/installation.md).

## Getting Started

1. Open RSS Dashboard from the ribbon or command palette.
2. Click **+** to add your first feed. Try a familiar URL (e.g., a news site or YouTube channel).
3. Click an article to read in the built-in reader.
4. Optionally save articles to your vault.

For detailed workflows, see [Getting Started Guide](docs/getting-started.md).

## Documentation

Complete guides, workflows, and reference: [Read the Docs](docs/)

## Roadmap

Feature direction and what's being explored: [Public Roadmap](docs/plans/public-roadmap.md)

## Support & Community

- 💬 [Discord Community](https://discord.gg/9bu7V9BBbs)
- 🐛 [GitHub Issues](https://github.com/amatya-aditya/obsidian-rss-dashboard/issues)
- ❓ [Troubleshooting](docs/troubleshooting.md)

## Contributing

Want to help? [See CONTRIBUTING.md](CONTRIBUTING.md)

## Support Development

If you find this plugin useful:

- [Buy me a coffee](https://www.buymeacoffee.com/amatya_aditya)
- [Ko-fi](https://ko-fi.com/Y8Y41FV4WI)

## License

MIT. See [LICENSE](LICENSE) for details.

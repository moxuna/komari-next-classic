# Security Policy

## Scope

This repository contains a **frontend theme only** — static assets, React components and build
scripts. It stores no credentials, runs no server-side code and performs no node-side execution.

The only runtime requests it makes are to your own Komari instance (plus an optional exchange-rate
lookup used by the asset overview). Everything else ships as static files.

## Reporting a vulnerability

Report issues privately through GitHub's
[Security Advisories](https://github.com/moxuna/komari-next-classic/security/advisories/new)
rather than in a public issue. Please include:

- affected version (`komari-theme.json` → `version`)
- steps to reproduce
- impact assessment

## Deployment notes

- Never commit real passwords, tokens, private hostnames or server IPs into the theme sources or
  configuration files.
- Review anything you put into theme settings (background/logo URLs are loaded by your visitors'
  browsers).
- The theme has no authentication of its own: it relies entirely on Komari's own session handling
  and API permissions.

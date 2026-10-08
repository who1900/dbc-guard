# Dedicated server deployment

Hostname: `dbc.whoim.space`. Use your own SSH host and deployment credentials.

This deployment uses only `/opt/dbc-guard`, `/etc/dbc-guard.env`, the `dbc-guard` system user/service, `/var/lib/dbc-guard/acme`, and one dedicated Nginx site. Never overwrite an existing path without first checking its owner and backing up its contents. Existing Nginx sites, application services and the server's global Node.js must remain intact.

## Installation sequence

1. Check existing services, ports, Nginx configuration, disk and memory. Reserve loopback port `4317`; confirm it is free. Record existing site/service status for comparison after deployment.
2. Install an official Node.js 22 LTS binary into `/opt/dbc-guard/runtime`, verifying its archive against the official `SHASUMS256.txt`. Do not update the global Node.js installation.
3. Create the system user/group `dbc-guard` without login. Install the application at `/opt/dbc-guard/app`, excluding `.env`, local `node_modules`, screenshots and other QA exports. Run `npm ci` and `npm run build` with the isolated Node runtime. Keep code root-owned and readable by the service user; it needs no application write directory.
4. Install `dbc-guard.env.example` as `/etc/dbc-guard.env` owned by root with mode `0600`. Public RPCs work without credentials but may rate-limit. Configure private RPCs here when available.
5. Install `dbc-guard.service` into `/etc/systemd/system/dbc-guard.service`. Reload systemd, enable and start only `dbc-guard`. Check `http://127.0.0.1:4317/api/health` and a live inspection. Logs: `journalctl -u dbc-guard`.
6. Create `/var/lib/dbc-guard/acme`. Install `nginx-http.conf` as a dedicated site named `dbc-guard`. Test with `sudo nginx -t` before every Nginx reload. Check the HTTP vhost with a `Host: dbc.whoim.space` request before public DNS resolves.
7. Point DNS A record `dbc.whoim.space` at your server's IPv4 address. Only publish an AAAA record when the server's IPv6 is configured and reachable.
8. After public DNS resolves, issue a certificate with Certbot webroot, not the Nginx installer. Install `certbot-deploy-hook.sh` as `/opt/dbc-guard/certbot-deploy-hook.sh`, root-owned and executable. Example: `certbot certonly --webroot -w /var/lib/dbc-guard/acme -d dbc.whoim.space --cert-name dbc.whoim.space --deploy-hook /opt/dbc-guard/certbot-deploy-hook.sh --agree-tos --register-unsafely-without-email --non-interactive`. An operator email is preferable when available.
9. Install `nginx-https.conf` over only the dedicated DBC Guard site. Run `sudo nginx -t` and then reload. The deploy hook belongs only to this certificate's renewal configuration and additionally verifies `RENEWED_LINEAGE`; do not install it into global renewal hook directories. Check Certbot's renewal timer without changing another certificate's renewal configuration.
10. Verify HTTPS health, frontend assets, a real pool report, HTTP redirect and certificate dates. Compare existing service/site status and global Node version to the predeployment record.

Express trusts only loopback proxy hops. Nginx replaces `X-Forwarded-For` with `$remote_addr`, so the internal 20-request/minute limiter applies per client. Keep the service bound to `127.0.0.1` and do not enable unrestricted `trust proxy`.

## Rollback

Stop/disable only `dbc-guard`. Remove only its dedicated Nginx enablement link after validating the exact target. Test `sudo nginx -t` before reloading. Preserve application files, logs and certificate until investigated; other sites and services require no change.

## Deployment record

Prepared 2026-10-08. User corrected the hostname to `dbc.whoim.space` and added its A record at Namecheap. Operational results and certificate status are recorded after server verification.

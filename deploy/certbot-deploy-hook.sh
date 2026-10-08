#!/bin/sh
set -eu
# A renewal of another project's certificate must not trigger this hook.
if [ "${RENEWED_LINEAGE:-}" != /etc/letsencrypt/live/dbc.whoim.space ]; then
    exit 0
fi
/usr/sbin/nginx -t
/bin/systemctl reload nginx

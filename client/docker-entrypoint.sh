#!/bin/sh
set -e

# BASE_PATH set at runtime (e.g. /boardgames). Must match safe pattern to avoid injection.
BASE_PATH="${REACT_APP_BASE_PATH:-${BASE_PATH:-}}"
# Allow only path-safe chars to prevent injection (e.g. in sed): / then alphanumeric, /, -, _
case "$BASE_PATH" in
  "") ;;
  /[a-zA-Z0-9/_-]*) ;;
  *) BASE_PATH="" ;;
esac

HTML_DIR="/usr/share/nginx/html"
NGINX_CONF="/etc/nginx/conf.d/default.conf"
TEMPLATE="/etc/nginx/nginx-path.conf.template"
ROOT_CONF="/etc/nginx/nginx-root.conf"

if [ -n "$BASE_PATH" ]; then
  sed "s|__BASE_PATH__|$BASE_PATH|g" "$TEMPLATE" > "$NGINX_CONF"
  sed -i "s|src=\"/|src=\"$BASE_PATH/|g" "$HTML_DIR/index.html"
  sed -i "s|href=\"/|href=\"$BASE_PATH/|g" "$HTML_DIR/index.html"
else
  cp "$ROOT_CONF" "$NGINX_CONF"
fi

exec nginx -g 'daemon off;'

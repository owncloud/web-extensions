#!/bin/bash
printenv
# replace oCIS domain in keycloak realm import
mkdir -p /opt/keycloak/data/import
sed -e "s/ocis.owncloud.test/${OCIS_DOMAIN}/g" /opt/keycloak/data/import-dist/ocis-realm.json > /opt/keycloak/data/import/oCIS-realm.json

# resolve jitsi-admin realm template placeholders, only when the jitsi-admin module mounted its dist file
if [ -f /opt/keycloak/data/import-dist/jitsiadmin-realm.json ]; then
  sed \
    -e "s|<clientUrl>|https://${JITSI_ADMIN_DOMAIN}|g" \
    -e "s|<clientsecret>|${JITSI_ADMIN_OIDC_CLIENT_SECRET}|g" \
    -e "s|<smtpHost>|${JITSI_ADMIN_SMTP_HOST}|g" \
    -e "s|<smtpPort>|${JITSI_ADMIN_SMTP_PORT}|g" \
    -e "s|<smtpUser>|${JITSI_ADMIN_SMTP_USER}|g" \
    -e "s|<smtpPassword>|${JITSI_ADMIN_SMTP_PASSWORD}|g" \
    -e "s|<smtpFrom>|${JITSI_ADMIN_SMTP_FROM}|g" \
    -e 's|<smtpEncyption>|"ssl": "false",\n    "starttls": "false",|g' \
    /opt/keycloak/data/import-dist/jitsiadmin-realm.json > /opt/keycloak/data/import/jitsiadmin-realm.json
fi

# run original docker-entrypoint
/opt/keycloak/bin/kc.sh "$@"

FROM postgres:16.1

RUN apt-get update \
    && apt-get install -y wget postgresql-16-postgis-3 postgis

COPY ./db.sql /docker-entrypoint-initdb.d/

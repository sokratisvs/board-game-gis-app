FROM postgres:16.1

# RUN apt-get update \
#     && apt-get install -y wget postgresql-16-postgis-3 postgis

RUN apt-get update \
&& apt-get install -y \
    wget \
    postgresql-16-postgis-3 \
    postgis \
&& rm -rf /var/lib/apt/lists/*

COPY ./db.sql /docker-entrypoint-initdb.d/

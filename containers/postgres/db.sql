CREATE EXTENSION postgis;

CREATE TABLE users (
	user_id serial PRIMARY KEY,
	username VARCHAR ( 50 ) UNIQUE NOT NULL,
	password VARCHAR ( 50 ) NOT NULL,
	email VARCHAR ( 255 ) UNIQUE NOT NULL,
	created_on TIMESTAMP NOT NULL,
    last_login TIMESTAMP);

-- CREATE IF NOT EXISTS TABLE user_roles (
--   user_id INT NOT NULL,
--   role_id INT NOT NULL,
--   grant_date TIMESTAMP,
--   PRIMARY KEY (user_id, role_id),
--   FOREIGN KEY (role_id)
--       REFERENCES roles (role_id),
--   FOREIGN KEY (user_id)
--       REFERENCES accounts (user_id)
-- );

CREATE TABLE location (
    user_id INT NOT NULL,
    gid serial NOT NULL,
    coordinates geometry(point, 4326),
    PRIMARY KEY (user_id, gid),
    FOREIGN KEY (user_id)
      REFERENCES users (user_id)
);

-- INSERT INTO geomtable(geom) VALUES (ST_GeomFromGeoJSON('{"type" : "Polygon",
--     "coordinates" : [[[-2.5162124633789067, 34.88787589057115],
--     [-2.516899108886719, 34.88696062580312],
--     [-2.515665292739868, 34.887752682446184]]]}'));


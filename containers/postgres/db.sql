CREATE EXTENSION postgis;

CREATE TYPE user_type AS ENUM ('user', 'shop', 'event', 'admin');

CREATE TABLE users (
    user_id serial PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    created_on TIMESTAMP NOT NULL,
    last_login TIMESTAMP,
    type user_type NOT NULL -- Added the user_type ENUM field
    active BOOLEAN NOT NULL DEFAULT true
);

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_set_active_by_type ON users;

-- Create updated function that only sets active on INSERT, not UPDATE
CREATE OR REPLACE FUNCTION set_active_by_type() RETURNS TRIGGER AS $$
BEGIN
    -- Only set active status automatically on INSERT, not UPDATE
    IF TG_OP = 'INSERT' THEN
        IF NEW.type IN ('shop', 'event', 'admin') THEN
            NEW.active = false;
        ELSE
            NEW.active = true;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger only for INSERT operations
CREATE TRIGGER trigger_set_active_by_type
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_active_by_type();

-- Alter the users table to add the type column
-- ALTER TABLE users
-- ADD COLUMN type user_type NOT NULL;

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
    UNIQUE (user_id),  -- Ensure uniqueness for ON CONFLICT
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_location_coordinates ON location USING GIST (coordinates) WHERE coordinates IS NOT NULL;

-- INSERT INTO geomtable(geom) VALUES (ST_GeomFromGeoJSON('{"type" : "Polygon",
--     "coordinates" : [[[-2.5162124633789067, 34.88787589057115],
--     [-2.516899108886719, 34.88696062580312],
--     [-2.515665292739868, 34.887752682446184]]]}'));

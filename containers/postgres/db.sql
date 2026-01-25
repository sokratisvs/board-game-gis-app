CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE user_type AS ENUM ('user', 'shop', 'event', 'admin');

CREATE TABLE users (
    user_id serial PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    created_on TIMESTAMP NOT NULL,
    last_login TIMESTAMP,
    type user_type NOT NULL, -- Added the user_type ENUM field
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

-- Add active column if it doesn't exist
-- DO $$
-- BEGIN
--     IF NOT EXISTS (
--         SELECT 1 FROM information_schema.columns 
--         WHERE table_name = 'users' AND column_name = 'active'
--     ) THEN
--         ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
--     END IF;
-- END $$;

-- Insert mock users (passwords are bcrypt hashed version of 'password123')
INSERT INTO users (username, password, email, created_on, type) VALUES
('Serena Rodriguez', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'serena@example.com', NOW(), 'user'),
('Maya Patel', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'mayab@example.com', NOW(), 'user'),
('Isaac Ramirez', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'isaac@example.com', NOW(), 'user'),
('Lambda Project', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'lamda.project@example.com', NOW(), 'event'),
('Nothing shop', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'empty@example.com', NOW(), 'shop');

-- Insert location data for the mock users (matching coordinates from your frontend)
INSERT INTO location (user_id, coordinates) VALUES
(1, ST_SetSRID(ST_Point(23.714480156086637, 37.942127583678776), 4326)),
(2, ST_SetSRID(ST_Point(23.726866021570746, 37.987086035192384), 4326)),
(3, ST_SetSRID(ST_Point(23.755277420683132, 37.9335636650263), 4326)),
(4, ST_SetSRID(ST_Point(23.72953503331404, 37.957637371954576), 4326)),
(5, ST_SetSRID(ST_Point(23.706172718146803, 37.959311695128626), 4326));

-- Verify the data was inserted correctly
SELECT u.user_id, u.username, u.email, u.type, u.active, 
       ST_X(l.coordinates) as longitude, ST_Y(l.coordinates) as latitude
FROM users u 
LEFT JOIN location l ON u.user_id = l.user_id
ORDER BY u.user_id;

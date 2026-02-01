CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_code TEXT UNIQUE NOT NULL,
    description TEXT
);

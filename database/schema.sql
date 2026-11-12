-- Multi-Vendor Clothing Marketplace: PostgreSQL schema
-- Run the whole file in pgAdmin's Query Tool (it is safe to re-run: it rebuilds everything).

DROP TABLE IF EXISTS product_sizes, product_materials, clothing_items, users,
                     stores, malls, sizes, materials, audiences, categories CASCADE;

CREATE TABLE malls (
    mall_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mall_name  VARCHAR(80) NOT NULL UNIQUE,
    area       VARCHAR(60)
);

CREATE TABLE stores (
    store_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mall_id      INTEGER NOT NULL REFERENCES malls (mall_id),
    store_name   VARCHAR(80) NOT NULL,
    floor_level  VARCHAR(20) NOT NULL,
    shop_number  VARCHAR(20),
    phone        VARCHAR(20),
    email        VARCHAR(100),
    UNIQUE (mall_id, floor_level, shop_number)
);

CREATE TABLE categories (
    category_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_name  VARCHAR(40) NOT NULL UNIQUE
);

CREATE TABLE audiences (
    audience_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    audience_name  VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE materials (
    material_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    material_name  VARCHAR(40) NOT NULL UNIQUE
);

CREATE TABLE sizes (
    size_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    size_label  VARCHAR(10) NOT NULL UNIQUE,
    size_type   VARCHAR(10) NOT NULL,
    sort_order  SMALLINT NOT NULL
);

CREATE TABLE clothing_items (
    product_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    store_id      INTEGER NOT NULL REFERENCES stores (store_id),
    category_id   INTEGER NOT NULL REFERENCES categories (category_id),
    audience_id   INTEGER NOT NULL REFERENCES audiences (audience_id),
    product_name  VARCHAR(100) NOT NULL,
    description   VARCHAR(255),
    colour        VARCHAR(30),
    price         NUMERIC(10,2) NOT NULL CHECK (price > 0),
    picture_path  VARCHAR(255)
);

CREATE TABLE product_materials (
    product_id   INTEGER NOT NULL REFERENCES clothing_items (product_id) ON DELETE CASCADE,
    material_id  INTEGER NOT NULL REFERENCES materials (material_id),
    PRIMARY KEY (product_id, material_id)
);

CREATE TABLE product_sizes (
    product_id          INTEGER NOT NULL REFERENCES clothing_items (product_id) ON DELETE CASCADE,
    size_id             INTEGER NOT NULL REFERENCES sizes (size_id),
    quantity_available  INTEGER NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
    PRIMARY KEY (product_id, size_id)
);

-- Store owner logins (one login per store). Store only HASHED passwords, never plain text.
CREATE TABLE users (
    user_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          VARCHAR(100) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    role           VARCHAR(10) NOT NULL CHECK (role IN ('owner', 'admin')),
    store_id       INTEGER REFERENCES stores (store_id),
    CHECK (role = 'admin' OR store_id IS NOT NULL)
);

-- Helpful for the search filters
CREATE INDEX idx_items_store     ON clothing_items (store_id);
CREATE INDEX idx_items_category  ON clothing_items (category_id);
CREATE INDEX idx_items_price     ON clothing_items (price);

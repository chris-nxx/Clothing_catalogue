-- Sample data. Run AFTER schema.sql. Mall, store and product details are placeholders.

INSERT INTO categories (category_name) VALUES
    ('Tops'),
    ('Trousers'),
    ('Dresses'),
    ('Jackets'),
    ('Skirts'),
    ('Shorts'),
    ('Shoes'),
    ('Accessories');

INSERT INTO audiences (audience_name) VALUES
    ('Women'),
    ('Men'),
    ('Kids'),
    ('Unisex');

INSERT INTO materials (material_name) VALUES
    ('Cotton'),
    ('Linen'),
    ('Satin'),
    ('Chiffon'),
    ('Polyester'),
    ('Denim'),
    ('Wool'),
    ('Leather'),
    ('Silk');

INSERT INTO sizes (size_label, size_type, sort_order) VALUES
    ('XS', 'Letter', 10),
    ('S', 'Letter', 20),
    ('M', 'Letter', 30),
    ('L', 'Letter', 40),
    ('XL', 'Letter', 50),
    ('XXL', 'Letter', 60),
    ('28', 'Numeric', 70),
    ('30', 'Numeric', 80),
    ('32', 'Numeric', 90),
    ('34', 'Numeric', 100),
    ('36', 'Numeric', 110),
    ('38', 'Numeric', 120),
    ('40', 'Numeric', 130);

INSERT INTO malls (mall_name, area) VALUES
    ('Sarit Centre', 'Westlands'),
    ('Garden City Mall', 'Thika Road'),
    ('Two Rivers Mall', 'Limuru Road'),
    ('The Junction', 'Ngong Road');

INSERT INTO stores (mall_id, store_name, floor_level, shop_number, phone, email)
SELECT m.mall_id, v.store_name, v.floor_level, v.shop_number, v.phone, v.email
FROM (VALUES
    ('Mama Achieng Fashions', 'Sarit Centre', 'Ground Floor', 'G12', '0700 000001', 'mamaachieng@example.com'),
    ('Toi Trendz', 'Garden City Mall', '1st Floor', 'F1-45', '0700 000002', 'toitrendz@example.com'),
    ('Urban Threads KE', 'Two Rivers Mall', '2nd Floor', '2-07', '0700 000003', 'urbanthreads@example.com'),
    ('Kids Corner', 'The Junction', 'Ground Floor', 'G03', '0700 000004', 'kidscorner@example.com')
) AS v (store_name, mall_name, floor_level, shop_number, phone, email)
JOIN malls m ON m.mall_name = v.mall_name;

INSERT INTO clothing_items (store_id, category_id, audience_id, product_name, description, colour, price, picture_path)
SELECT s.store_id, c.category_id, a.audience_id, v.product_name, v.description, v.colour, v.price, v.picture_path
FROM (VALUES
    ('Mama Achieng Fashions', 'Dresses', 'Women', 'Floral Summer Dress', 'Light floral print dress, knee length', 'Yellow', 2500, 'images/floral_summer_dress.jpg'),
    ('Mama Achieng Fashions', 'Dresses', 'Women', 'Satin Evening Dress', 'Fitted satin dress for evening events', 'Black', 3800, 'images/satin_evening_dress.jpg'),
    ('Mama Achieng Fashions', 'Tops', 'Women', 'Chiffon Wrap Blouse', 'Soft wrap blouse with long flowing sleeves', 'White', 1200, 'images/chiffon_wrap_blouse.jpg'),
    ('Mama Achieng Fashions', 'Jackets', 'Women', 'Wool Blend Coat', 'Warm long coat for cold mornings', 'Grey', 4800, 'images/wool_blend_coat.jpg'),
    ('Mama Achieng Fashions', 'Accessories', 'Women', 'Silk Scarf', 'Printed silk scarf, one size', 'Multicolour', 900, 'images/silk_scarf.jpg'),
    ('Mama Achieng Fashions', 'Trousers', 'Women', 'Linen Wide-Leg Trousers', 'Relaxed wide-leg trousers (sold out)', 'Cream', 2000, 'images/linen_wide_leg_trousers.jpg'),
    ('Toi Trendz', 'Tops', 'Men', 'Linen Button-Up Shirt', 'Breathable short-sleeve linen shirt', 'Beige', 1800, 'images/linen_button_up_shirt.jpg'),
    ('Toi Trendz', 'Trousers', 'Men', 'Slim Fit Jeans', 'Stretch slim fit denim jeans', 'Blue', 2200, 'images/slim_fit_jeans.jpg'),
    ('Toi Trendz', 'Skirts', 'Women', 'High-Waist Denim Skirt', 'High-waist denim skirt above the knee', 'Blue', 1500, 'images/high_waist_denim_skirt.jpg'),
    ('Urban Threads KE', 'Tops', 'Unisex', 'Classic Cotton T-Shirt', 'Plain everyday crew-neck t-shirt', 'White', 700, 'images/classic_cotton_t_shirt.jpg'),
    ('Urban Threads KE', 'Jackets', 'Men', 'Leather Biker Jacket', 'Zip-up faux-lined leather jacket', 'Black', 5500, 'images/leather_biker_jacket.jpg'),
    ('Urban Threads KE', 'Shorts', 'Men', 'Cotton Chino Shorts', 'Casual chino shorts', 'Khaki', 1300, 'images/cotton_chino_shorts.jpg'),
    ('Kids Corner', 'Tops', 'Kids', 'Kids Cotton Hoodie', 'Soft pullover hoodie for kids', 'Red', 1100, 'images/kids_cotton_hoodie.jpg'),
    ('Kids Corner', 'Trousers', 'Kids', 'Kids School Trousers', 'Hard-wearing school trousers', 'Grey', 900, 'images/kids_school_trousers.jpg')
) AS v (store_name, category_name, audience_name, product_name, description, colour, price, picture_path)
JOIN stores s ON s.store_name = v.store_name
JOIN categories c ON c.category_name = v.category_name
JOIN audiences a ON a.audience_name = v.audience_name;

INSERT INTO product_materials (product_id, material_id)
SELECT p.product_id, m.material_id
FROM (VALUES
    ('Floral Summer Dress', 'Cotton'),
    ('Floral Summer Dress', 'Linen'),
    ('Satin Evening Dress', 'Satin'),
    ('Chiffon Wrap Blouse', 'Chiffon'),
    ('Chiffon Wrap Blouse', 'Polyester'),
    ('Wool Blend Coat', 'Wool'),
    ('Wool Blend Coat', 'Polyester'),
    ('Silk Scarf', 'Silk'),
    ('Linen Wide-Leg Trousers', 'Linen'),
    ('Linen Button-Up Shirt', 'Linen'),
    ('Linen Button-Up Shirt', 'Cotton'),
    ('Slim Fit Jeans', 'Denim'),
    ('Slim Fit Jeans', 'Cotton'),
    ('High-Waist Denim Skirt', 'Denim'),
    ('Classic Cotton T-Shirt', 'Cotton'),
    ('Leather Biker Jacket', 'Leather'),
    ('Leather Biker Jacket', 'Polyester'),
    ('Cotton Chino Shorts', 'Cotton'),
    ('Kids Cotton Hoodie', 'Cotton'),
    ('Kids Cotton Hoodie', 'Polyester'),
    ('Kids School Trousers', 'Polyester'),
    ('Kids School Trousers', 'Cotton')
) AS v (product_name, material_name)
JOIN clothing_items p ON p.product_name = v.product_name
JOIN materials m ON m.material_name = v.material_name;

INSERT INTO product_sizes (product_id, size_id, quantity_available)
SELECT p.product_id, s.size_id, v.qty
FROM (VALUES
    ('Floral Summer Dress', 'XS', 2),
    ('Floral Summer Dress', 'S', 5),
    ('Floral Summer Dress', 'M', 4),
    ('Floral Summer Dress', 'L', 1),
    ('Satin Evening Dress', 'S', 3),
    ('Satin Evening Dress', 'M', 3),
    ('Satin Evening Dress', 'L', 2),
    ('Chiffon Wrap Blouse', 'S', 6),
    ('Chiffon Wrap Blouse', 'M', 8),
    ('Chiffon Wrap Blouse', 'L', 4),
    ('Chiffon Wrap Blouse', 'XL', 2),
    ('Wool Blend Coat', 'S', 2),
    ('Wool Blend Coat', 'M', 3),
    ('Wool Blend Coat', 'L', 2),
    ('Linen Wide-Leg Trousers', 'S', 0),
    ('Linen Wide-Leg Trousers', 'M', 0),
    ('Linen Wide-Leg Trousers', 'L', 0),
    ('Linen Button-Up Shirt', 'M', 5),
    ('Linen Button-Up Shirt', 'L', 6),
    ('Linen Button-Up Shirt', 'XL', 3),
    ('Slim Fit Jeans', '30', 4),
    ('Slim Fit Jeans', '32', 6),
    ('Slim Fit Jeans', '34', 5),
    ('Slim Fit Jeans', '36', 2),
    ('High-Waist Denim Skirt', 'XS', 3),
    ('High-Waist Denim Skirt', 'S', 4),
    ('High-Waist Denim Skirt', 'M', 4),
    ('Classic Cotton T-Shirt', 'S', 10),
    ('Classic Cotton T-Shirt', 'M', 12),
    ('Classic Cotton T-Shirt', 'L', 10),
    ('Classic Cotton T-Shirt', 'XL', 6),
    ('Leather Biker Jacket', 'M', 2),
    ('Leather Biker Jacket', 'L', 3),
    ('Leather Biker Jacket', 'XL', 1),
    ('Cotton Chino Shorts', '30', 5),
    ('Cotton Chino Shorts', '32', 5),
    ('Cotton Chino Shorts', '34', 3),
    ('Kids Cotton Hoodie', 'XS', 6),
    ('Kids Cotton Hoodie', 'S', 6),
    ('Kids Cotton Hoodie', 'M', 4),
    ('Kids School Trousers', 'XS', 8),
    ('Kids School Trousers', 'S', 8),
    ('Kids School Trousers', 'M', 5)
) AS v (product_name, size_label, qty)
JOIN clothing_items p ON p.product_name = v.product_name
JOIN sizes s ON s.size_label = v.size_label;

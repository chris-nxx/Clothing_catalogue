from fastapi import FastAPI, HTTPException, Depends, Request,Query
from dotenv import load_dotenv
import os
import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor
import psycopg2.errors
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from response_models import (ProductDetail, ProductSummary,ProductCreate,StockUpdate,ProductUpdate,
                             MaterialsUpdate, Category, Audience, Material, Size, Mall,Store,OwnerCreate,UserOut)
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from datetime import timezone,timedelta,datetime
import jwt

app = FastAPI()
app.mount("/images", StaticFiles(directory="images"), name="images")
load_dotenv()
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_connection():

    host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT")
    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")

    conn = psycopg2.connect(host=host, port=db_port, dbname=db_name, user=db_user, password=db_password)

    return conn

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload["sub"]
    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
                        SELECT user_id, email, role, store_id
                        FROM users
                        WHERE user_id = %s'''
                       ,(user_id,))
        user = cursor.fetchone()
        if user is None:
            raise HTTPException(status_code=401, detail="Incorrect username or password")

    finally:
        conn.close()

    return user

def get_product_detail(product_id:int):
    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('''
                        SELECT p.product_id, p.product_name, p.price, p.description, p.colour, p.picture_path,
                        a.audience_name,
                        c.category_name, 
                        m.mall_name,
                        s.store_name, s.floor_level
                        FROM clothing_items p
                        JOIN categories c ON c.category_id = p.category_id
                        JOIN stores s ON s.store_id = p.store_id
                        JOIN malls m ON m.mall_id = s.mall_id
                        JOIN audiences a ON a.audience_id = p.audience_id
                        WHERE p.product_id = %s
                       '''
                       , (product_id,)
                       )

        product = cursor.fetchone()

        if product is None:
            return None

        cursor.execute('''
                        SELECT m.material_name
                        FROM product_materials pm
                        JOIN materials m ON m.material_id = pm.material_id
                        WHERE pm.product_id = %s
                    '''
                       , (product_id,)
                       )

        materials = cursor.fetchall()

        cursor.execute('''
                            SELECT s.size_label, ps.quantity_available
                            FROM product_sizes ps
                            JOIN sizes s ON s.size_id = ps.size_id
                            WHERE ps.product_id = %s
                            ORDER BY s.sort_order
                        '''
                       , (product_id,)
                       )

        sizes = cursor.fetchall()

        product["materials"] = [r["material_name"] for r in materials]
        product["sizes"] = sizes

    finally:
        conn.close()

    return product

def check_product_owner(product_id, user):
    if user["store_id"] is None:
        raise HTTPException(status_code=403, detail="Only store owners can create products")
    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
                        SELECT store_id
                        FROM clothing_items
                        WHERE product_id = %s'''
                       ,(product_id,))
        product_store_id = cursor.fetchone()
        if product_store_id is None:
            raise HTTPException(status_code=404,detail="product not found")

        if product_store_id["store_id"] != user["store_id"]:
            raise HTTPException(status_code=403, detail="You can only change your own store’s products")

    finally:
        conn.close()

    return None

def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")

    return user

@app.exception_handler(psycopg2.errors.UniqueViolation)
def foreign_key_handler(request: Request, exc: psycopg2.errors.UniqueViolation):
    return JSONResponse(
        status_code=409,
        content={"detail": "Email already in use"}
    )

@app.exception_handler(psycopg2.errors.ForeignKeyViolation)
def foreign_key_handler(request: Request, exc: psycopg2.errors.ForeignKeyViolation):
    return JSONResponse(
        status_code=400,
        content={"detail": "One of the ids you sent does not exist"}
    )

@app.get("/products", response_model=list[ProductSummary])
def get_products(limit: int = Query(20, ge=1, le=100),
                 offset: int = Query(0, ge=0),
                 max_price: float|None = None,
                 category_id:int|None = None,
                 audience_id:int|None = None,
                 store_id:int|None = None,
                 mall_id:int|None = None,
                 min_price:float|None = None,
                 search: str | None = None,
                 material_id: int | None = None,
                 size_id: int | None = None):

    conditions = []
    parameters = []

    conn = get_connection()

    if max_price is not None:
        conditions.append("p.price <= %s")
        parameters.append(max_price)

    if category_id is not None:
        conditions.append("p.category_id = %s")
        parameters.append(category_id)

    if audience_id is not None:
        conditions.append("a.audience_id = %s")
        parameters.append(audience_id)

    if store_id is not None:
        conditions.append("s.store_id = %s")
        parameters.append(store_id)

    if mall_id is not None:
        conditions.append("m.mall_id = %s")
        parameters.append(mall_id)

    if min_price is not None:
        conditions.append("p.price >= %s")
        parameters.append(min_price)

    if material_id is not None:
        conditions.append('''p.product_id IN (
                            SELECT pm.product_id
                            FROM product_materials pm
                            WHERE pm.material_id = %s)''')
        parameters.append(material_id)

    if size_id is not None:
        conditions.append('''p.product_id IN (
                            SELECT ps.product_id
                            FROM product_sizes ps
                            WHERE ps.size_id = %s AND ps.quantity_available > 0)''')

        parameters.append(size_id)

    if search:
        pattern = f"%{search}%"
        conditions.append("(p.product_name ILIKE %s OR p.description ILIKE %s)")
        parameters.append(pattern)
        parameters.append(pattern)

    parameters.append(limit)
    parameters.append(offset)
    where_text = ""
    if conditions:
        where_text = "WHERE " + " AND ".join(conditions)

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute(f'''
                    SELECT p.product_id, p.product_name, p.price, p.description, p.colour, p.picture_path,
                    a.audience_name,
                    c.category_name, 
                    m.mall_name,
                    s.store_name, s.floor_level
                    FROM clothing_items p
                    JOIN categories c ON c.category_id = p.category_id
                    JOIN stores s ON s.store_id = p.store_id
                    JOIN malls m ON m.mall_id = s.mall_id
                    JOIN audiences a ON a.audience_id = p.audience_id
                    {where_text}
                    ORDER BY p.product_id
                    LIMIT %s OFFSET %s
                   '''
                   , tuple(parameters))

        rows = cursor.fetchall()

    finally:
        conn.close()

    return rows

@app.get("/my/products",response_model=list[ProductSummary])
def get_my_products(user: dict = Depends(get_current_user)):

    if user["store_id"] is None:
        raise HTTPException(status_code=403, detail="Only the respective store owner can see their products")

    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
                    SELECT p.product_id, p.product_name, p.price, p.description, p.colour, p.picture_path,
                    a.audience_name,
                    c.category_name, 
                    m.mall_name,
                    s.store_name, s.floor_level
                    FROM clothing_items p
                    JOIN categories c ON c.category_id = p.category_id
                    JOIN stores s ON s.store_id = p.store_id
                    JOIN malls m ON m.mall_id = s.mall_id
                    JOIN audiences a ON a.audience_id = p.audience_id
                    WHERE s.store_id = %s
                    ORDER BY p.product_id''',
                    (user["store_id"],))

        my_products = cursor.fetchall()

    finally:
        conn.close()

    return my_products

@app.get("/products/{product_id}", response_model=ProductDetail)
def get_product(product_id):

    product = get_product_detail(product_id)

    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    return product

@app.get("/categories", response_model=list[Category])
def get_categories():

    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('''
                    SELECT category_id, category_name
                    FROM categories
                    ORDER BY category_name
                '''
                   )

        categories_rows = cursor.fetchall()

    finally:
        conn.close()

    return categories_rows

@app.get("/audiences", response_model=list[Audience])
def get_audiences():

    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('''
                   SELECT audience_id, audience_name
                   FROM audiences
                   ORDER BY audience_name
                ''')

        audience_rows = cursor.fetchall()

    finally:
        conn.close()

    return audience_rows

@app.get("/materials", response_model=list[Material])
def get_materials():

    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('''
                    SELECT material_id, material_name
                    FROM materials
                    ORDER BY material_name
                    ''')

        materials_rows = cursor.fetchall()

    finally:
        conn.close()

    return materials_rows

@app.get("/sizes", response_model=list[Size])
def get_sizes():

    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('''
                    SELECT size_id, size_label
                    FROM sizes
                    ORDER BY sort_order
                    ''')

        sizes_rows = cursor.fetchall()

    finally:
        conn.close()

    return sizes_rows

@app.get("/malls", response_model=list[Mall])
def get_malls():

    conn = get_connection()

    try:

        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('''
                    SELECT mall_id, mall_name, area
                    FROM malls
                    ORDER BY mall_name
                    ''')

        malls_rows = cursor.fetchall()

    finally:
        conn.close()

    return malls_rows

@app.get("/stores", response_model=list[Store])
def get_stores():

    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
                        SELECT s.store_id, s.store_name, s.floor_level,
                        m.mall_name, s.shop_number, s.phone, s.email, m.area,
                        COUNT(p.product_id) AS product_count
                        FROM stores s
                        JOIN malls m ON m.mall_id = s.mall_id
                        LEFT JOIN clothing_items p ON p.store_id = s.store_id
                        GROUP BY s.store_id, m.mall_id
                        ORDER BY store_id''')

        store_rows = cursor.fetchall()

    finally:
        conn.close()

    return store_rows

@app.get("/stores/{store_id}", response_model=list[Store])
def get_store(store_id:int):
    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
                                SELECT s.store_id, s.store_name, s.floor_level,
                                m.mall_name, s.shop_number, s.phone, s.email, m.area,
                                COUNT(p.product_id) AS product_count
                                FROM stores s
                                JOIN malls m ON m.mall_id = s.mall_id
                                LEFT JOIN clothing_items p ON p.store_id = s.store_id
                                WHERE s.store_id = %s
                                GROUP BY s.store_id, m.mall_id''',
                                (store_id,))

        store_row = cursor.fetchall()
        if len(store_row) == 0:
            raise HTTPException(status_code=404, detail="Store not found")

    finally:
        conn.close()

    return store_row

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    conn = get_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
                        SELECT user_id, password_hash, role, store_id
                        FROM users
                        WHERE email = %s'''
                       ,(form_data.username,))
        user = cursor.fetchone()
    finally:
        conn.close()

    if user is None or not bcrypt.checkpw(form_data.password.encode(),user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    expires = datetime.now(timezone.utc) + timedelta(hours=4)
    payload ={"sub": str(user["user_id"]), "exp":expires}
    token = jwt.encode(payload, os.getenv("JWT_SECRET"), algorithm="HS256")

    return {"access_token": token, "token_type": "bearer"}

@app.get("/me")
def me(user: str = Depends(get_current_user)):
    return user

@app.post("/products",response_model=ProductSummary, status_code=201)
def create_product(product: ProductCreate, user: dict = Depends(get_current_user)):
    if user["store_id"] is None:
        raise HTTPException(status_code=403, detail="Only store owners can create products")
    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
                        INSERT INTO clothing_items
                        (store_id, category_id, audience_id, product_name, description, colour, price, picture_path)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                        RETURNING product_id''',
                        (user["store_id"],product.category_id,product.audience_id,product.product_name,
                         product.description,product.colour,product.price,product.picture_path))

        new_id = cursor.fetchone()["product_id"]
        conn.commit()

    finally:
        conn.close()

    return get_product_detail(new_id)

@app.delete("/products/{product_id}", status_code=203)
def delete_product(product_id: int, user: dict = Depends(get_current_user)):
    check_product_owner(product_id, user)
    conn = get_connection()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('''
                        DELETE FROM clothing_items
                        WHERE product_id = %s''',
                       (product_id,))

        conn.commit()

    finally:

        conn.close()

@app.put("/products/{product_id}/sizes/{size_id}", response_model= ProductDetail)
def update_stock(product_id:int, size_id:int, stock:StockUpdate, user: dict = Depends(get_current_user)):
    check_product_owner(product_id,user)

    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute('''
                        INSERT INTO product_sizes (product_id, size_id, quantity_available)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (product_id, size_id)
                        DO UPDATE SET quantity_available = EXCLUDED.quantity_available
                        ''',
                        (product_id, size_id, stock.quantity_available))

        conn.commit()

        updated_product = get_product_detail(product_id)

    finally:
        conn.close()

    return updated_product

@app.patch("/products/{product_id}", response_model=ProductDetail)
def update_product(product_id:int, product:ProductUpdate, user: dict = Depends(get_current_user)):

    check_product_owner(product_id,user)

    changes = product.model_dump(exclude_unset=True)

    if changes is None:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = []
    parameters= []

    for key,value in changes.items():
        set_parts.append(key + " = %s")
        parameters.append(value)

    set_text = "SET " + ", ".join(set_parts)
    parameters.append(product_id)

    conn =get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute(f'''
                        UPDATE clothing_items
                        {set_text}
                        WHERE product_id = %s''',
                       tuple(parameters))
        conn.commit()

    finally:
        conn.close()

    return get_product_detail(product_id)

@app.put("/products/{product_id}/materials", response_model=ProductDetail)
def set_material(product_id:int, product:MaterialsUpdate,user: dict = Depends(get_current_user)):
    check_product_owner(product_id, user)

    material_ids = set(product.material_id)

    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute('''
                        DELETE FROM product_materials
                        WHERE product_id = %s''',
                       (product_id,))
        for material_id in material_ids:
            cursor.execute('''
                            INSERT INTO product_materials (product_id, material_id)
                            VALUES (%s,%s)''',
                           (product_id,material_id))

        conn.commit()

    finally:
        conn.close()

    return get_product_detail(product_id)

@app.post("/admin/owners", response_model=UserOut, status_code=201)
def create_owner_account(owner: OwnerCreate,admin: dict = Depends(require_admin)):

    hash_text = bcrypt.hashpw(owner.password.encode(), bcrypt.gensalt()).decode()

    conn = get_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
                        INSERT INTO users (email, password_hash, role, store_id)
                        VALUES (%s, %s, 'owner', %s)
                        RETURNING user_id, email, role, store_id''',
                       (owner.email,hash_text,owner.store_id))
        new_owner = cursor.fetchone()

        conn.commit()
    finally:
        conn.close()

    return new_owner

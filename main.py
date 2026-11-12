from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from response_models import ProductDetail, ProductSummary, Category, Audience, Material, Size, Mall

app = FastAPI()
app.mount("/images", StaticFiles(directory="images"), name="images")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
load_dotenv()

def get_connection():

    host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT")
    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")

    conn = psycopg2.connect(host=host, port=db_port, dbname=db_name, user=db_user, password=db_password)

    return conn

@app.get("/products", response_model=list[ProductSummary])
def get_products(max_price: float|None = None,
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
                   '''
                   , tuple(parameters))

        rows = cursor.fetchall()

    finally:
        cursor.close()
        conn.close()

    return rows

@app.get("/product/{product_id}", response_model=ProductDetail)
def get_product(product_id):

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
                   ,(product_id,)
                   )

        product = cursor.fetchone()

        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")

        cursor.execute('''
                    SELECT m.material_name
                    FROM product_materials pm
                    JOIN materials m ON m.material_id = pm.material_id
                    WHERE pm.product_id = %s
                '''
                   ,(product_id,)
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
        cursor.close()
        conn.close()

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
        cursor.close()
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
        cursor.close()
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
        cursor.close()
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
        cursor.close()
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
        cursor.close()
        conn.close()

    return malls_rows

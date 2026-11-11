from dotenv import load_dotenv
import os
import psycopg2
from psycopg2.extras import RealDictCursor


max_price = 1000

load_dotenv()
host = os.getenv("DB_HOST")
db_port = os.getenv("DB_PORT")
db_name = os.getenv("DB_NAME")
db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")

conn = psycopg2.connect(host=host, port=db_port, dbname=db_name, user=db_user, password=db_password)

cursor =conn.cursor(cursor_factory=RealDictCursor)
cursor.execute("SELECT product_id, product_name, price FROM clothing_items WHERE price <= %s ORDER BY product_id", (max_price,))
row = cursor.fetchall()
for items in row:
    print(items["price"])

cursor.close()
conn.close()
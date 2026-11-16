import bcrypt
import getpass
from main import get_connection

email = input("Enter your email address: ")
password = getpass.getpass("Enter your password: ")

hash_text = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

conn = get_connection()
try:
    cursor = conn.cursor()
    cursor.execute('''
                    INSERT INTO users (email, password_hash, role, store_id)
                    VALUES (%s, %s, 'admin', NULL)
                    ''', (email,hash_text))
    conn.commit()

finally:
    conn.close()

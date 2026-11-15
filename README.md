# Clothing Marketplace Backend

FastAPI + PostgreSQL API for the multivendor clothing catalogue.

## What you need installed
- Python 3.10 or newer
- PostgreSQL (with pgAdmin): https://www.postgresql.org/download/

## Setup

### 1. Create the database
1. Open pgAdmin and connect to your PostgreSQL server.
2. Right-click Databases, choose Create, then Database. Name it `clothing_marketplace`.
3. Right-click the new database and choose Query Tool.
4. Open `database/schema.sql`, run it. This creates the tables.
5. Open a fresh Query Tool, open `database/sample_data.sql`, run it. This adds sample products.

### 2. Add your settings
1. Copy `.env.example` and name the copy `.env`.
2. Fill in `DB_PASSWORD` with the password you chose when installing PostgreSQL.
3. Never commit `.env` to GitHub.

### 3. Install the libraries
In a terminal in the project folder:

Windows:
```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Mac/Linux:
```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 4. Run the server
```
uvicorn main:app --reload
```
The API is now at http://localhost:8000

### 5. Check it works
Open http://localhost:8000/docs in your browser. Try `GET /products`. You should get 14 products.

## Endpoints (all GET)
- `/products` with optional filters: `search`, `min_price`, `max_price`, `category_id`, `audience_id`, `store_id`, `mall_id`, `material_id`, `size_id`
- `/products/{id}` one product with materials and sizes (404 if not found)
- `/categories`, `/audiences`, `/materials`, `/sizes`, `/malls` for the filter dropdowns

## Owner accounts and login

Store owners log in to manage their own store's products. Customers don't need to log in.

### Settings
Add one more line to your `.env` (see `.env.example`):
```
JWT_SECRET=
```
Generate a value with:
```
python -c "import secrets; print(secrets.token_hex(32))"
```
Keep it secret and never commit it.

### Create an owner account
Run the helper script from the project folder, with the virtual environment active:
```
python create_owner.py
```
It asks for an email, a password and the store id the owner belongs to (1 to 4 in the sample data). The password is stored hashed, never as plain text.

### Log in
`POST /login` with form fields `username` (the owner's email) and `password`. The reply contains an `access_token`. Send it on every owner request as a header:
```
Authorization: Bearer <access_token>
```
Tokens last 4 hours. In `/docs`, click **Authorize** and enter the email and password, and the token is attached automatically.

### Owner endpoints
All of these need the token. An owner can only change their own store's products (otherwise 403).



## Troubleshooting
- `password authentication failed`: wrong `DB_PASSWORD` in `.env`.
- `connection refused`: PostgreSQL isn't running.
- `relation ... does not exist`: run

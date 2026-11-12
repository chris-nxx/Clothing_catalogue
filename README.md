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

## Troubleshooting
- `password authentication failed`: wrong `DB_PASSWORD` in `.env`.
- `connection refused`: PostgreSQL isn't running.
- `relation ... does not exist`: run

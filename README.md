# Multi-Vendor Clothing Marketplace – Backend API
 
Group 3 database project (USIU-Africa). A PostgreSQL database and a FastAPI REST API for a marketplace where several stores, located in malls, sell clothing. A website frontend reads from this API. Store owners log in to manage only their own store's products.
 
## Tech stack
 
- PostgreSQL 16
- Python 3.11+ and FastAPI (served with uvicorn)
- psycopg2 (database access, parameterized queries)
- bcrypt (password hashing) and PyJWT (login tokens)
- python-dotenv (settings in a `.env` file)
## Project structure
 
```
.
├── main.py                 # the API: models, helpers, endpoints
├── response_models.py      # response models
├── create_owner.py         # script: create a store-owner login
├── create_admin.py         # script: create an admin login
├── database/
│   ├── schema.sql          # creates all tables
│   └── sample_data.sql     # malls, stores, products, categories, etc.
├── images/                 # product pictures, served at /images/<file>
├── requirements.txt
├── .env.example            # template for your .env
└── README.md
```
 
## Database design
 
Ten tables:
 
| Table | Purpose |
|---|---|
| `malls` | Malls that contain stores |
| `stores` | Stores, each in one mall (with floor) |
| `categories`, `audiences`, `materials`, `sizes` | Lookup tables |
| `clothing_items` | Products, each belonging to one store |
| `product_materials` | Link table: product ↔ materials (many-to-many) |
| `product_sizes` | Link table: product ↔ sizes, with `quantity_available` |
| `users` | Logins. Role is `owner` (tied to one store) or `admin` (no store) |
 
Design choices: identity primary keys, composite primary keys on link tables, `CHECK` constraints (e.g. price > 0, quantity >= 0), `UNIQUE` on emails, and `ON DELETE CASCADE` on link tables so deleting a product removes its material and size rows.
 
## Setup
 
### 1. Install the requirements
- PostgreSQL 16 (with pgAdmin)
- Python 3.11 or newer
- Git
### 2. Clone the project
```
git clone <your-repo-url>
cd <project-folder>
```
 
### 3. Create the database
In pgAdmin (or psql):
1. Create an empty database, for example `clothing_marketplace`.
2. Run `database/schema.sql` on it (creates the tables).
3. Run `database/sample_data.sql` on it (4 malls, 4 stores, 14 products, plus lookup values).
### 4. Create your `.env`
Copy `.env.example` to `.env` and fill it in:
 
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clothing_marketplace
DB_USER=postgres
DB_PASSWORD=your_password_here
JWT_SECRET=a_long_random_string
ALLOWED_ORIGINS=*
```
 
- `JWT_SECRET` signs login tokens. Generate one with:
  `python -c "import secrets; print(secrets.token_hex(32))"`
- `ALLOWED_ORIGINS` is the list of website addresses allowed to call the API, separated by commas, for example `http://localhost:5500,http://127.0.0.1:5500`. `*` allows everyone and is fine for development only.
- Never commit `.env`. It is already listed in `.gitignore`.
### 5. Create a virtual environment and install packages
```
python -m venv .venv
```
Activate it:
- Windows: `.venv\Scripts\activate`
- macOS/Linux: `source .venv/bin/activate`
Then:
```
pip install -r requirements.txt
```
 
### 6. Create the first admin
```
python create_admin.py
```
It asks for an email and a password (the password is not shown as you type, and is stored as a bcrypt hash).
 
### 7. Run the API
```
uvicorn main:app --reload
```
- API: http://localhost:8000
- Interactive docs (try every endpoint in the browser): http://localhost:8000/docs
The API must be running whenever the website is being tested.
 
## Endpoints
 
The full, always-current list with example requests is at `/docs`. Summary:
 
### Public (no login)
| Method | Path | Description |
|---|---|---|
| GET | `/products` | List products. Paginated. Optional filters (see below) |
| GET | `/products/{id}` | One product with its materials, sizes and stock |
| GET | `/stores` | All stores with `product_count` |
| GET | `/categories`, `/audiences`, `/materials`, `/sizes` | Values for filter dropdowns |
 
**Filters on `/products`** (all optional, combine freely): category, audience, material, size, store, mall, `min_price`, `max_price`.
**Pagination:** `limit` (default 20) and `offset` (default 0).
 
### Login
| Method | Path | Description |
|---|---|---|
| POST | `/login` | Form fields `username` (the email) and `password`. Returns `access_token` |
| GET | `/me` | Who you are logged in as |
 
Send the token on every protected request as a header:
```
Authorization: Bearer <access_token>
```
Tokens last 4 hours. After that, log in again.
 
### Store owner (needs an owner token)
Owners can only see and change products of **their own store**.
 
| Method | Path | Description |
|---|---|---|
| GET | `/my/products` | Products of my store |
| POST | `/products` | Create a product (price must be > 0) |
| PATCH | `/products/{id}` | Update some fields of a product |
| PUT | `/products/{id}/stock` | Set stock for a size (quantity >= 0) |
| PUT | `/products/{id}/materials` | Replace a product's list of materials |
| DELETE | `/products/{id}` | Delete a product |
 
### Admin (needs an admin token)
| Method | Path | Description |
|---|---|---|
| POST | `/admin/owners` | Create an owner login for a store: `email`, `password` (min length enforced), `store_id` |
 
> Paths above are the intended contract. If anything differs from what `/docs` shows, `/docs` is correct.
 
## Logging in from the docs page
1. Open `/docs`, click **Authorize**.
2. Enter the email as `username` and the password, then Authorize.
3. Every protected endpoint now sends your token automatically.
## Logging in with curl (Windows)
```
curl.exe -X POST http://localhost:8000/login -d "username=owner@example.com&password=yourpassword"
curl.exe http://localhost:8000/my/products -H "Authorization: Bearer <token>"
```
 
## Error codes
 
| Code | Meaning |
|---|---|
| 400 | A request id does not exist (e.g. unknown `store_id`, `category_id`) |
| 401 | Missing, wrong or expired token, or wrong email/password |
| 403 | Logged in, but not allowed (e.g. editing another store's product, or an owner calling an admin endpoint) |
| 404 | The thing you asked for doesn't exist |
| 409 | Already exists (e.g. an email already registered) |
| 422 | Invalid data (missing field, price <= 0, password too short) |
 
## Product pictures
`picture_path` looks like `images/silk_scarf.jpg`. The API serves the `images/` folder, so a page shows a picture with:
```
BASE_URL + "/" + picture_path     →   http://localhost:8000/images/silk_scarf.jpg
```
 
## For the frontend developer
- Base URL during development: `http://localhost:8000`.
- Add the website's address to `ALLOWED_ORIGINS` in `.env`, then restart the API, or the browser will block the calls (CORS).
- `/products` returns 20 items by default. Use `limit` and `offset` for more.
- A product's `materials` is a list of names, e.g. `["Cotton", "Linen"]`.
- Deleted ids are not reused (a product created after deleting id 16 gets 17). This is normal for identity columns.
## Security notes
- Passwords are stored only as bcrypt hashes, never returned by any endpoint.
- All SQL uses parameters (`%s`) to prevent SQL injection.
- Ownership is checked on the server for every owner action.
- Change `ALLOWED_ORIGINS` from `*` to the real site address before deploying.
## Possible future work
- `POST /admin/stores` and `/admin/malls` to add stores without pgAdmin
- Store owners updating stock through a login page on the website
- Importing real store inventories by scraping
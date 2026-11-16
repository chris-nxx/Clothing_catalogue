from pydantic import BaseModel, Field

class ProductSummary(BaseModel):
    product_id: int
    product_name: str
    price: float
    description: str | None = None
    colour: str | None = None
    picture_path: str | None = None
    audience_name: str
    category_name: str
    mall_name: str
    store_name: str
    floor_level: str

class SizeStock(BaseModel):
    size_label: str
    quantity_available: int

class ProductDetail(ProductSummary):
    materials: list[str]
    sizes: list[SizeStock]

class ProductCreate(BaseModel):
    product_name: str
    category_id: int
    audience_id: int
    price: float= Field(gt=0)
    description: str | None = None
    colour: str | None = None
    picture_path: str | None = None

class StockUpdate(BaseModel):
    quantity_available : int = Field(ge=0)

class ProductUpdate(BaseModel):
    product_name: str | None = None
    category_id: int | None = None
    audience_id: int | None = None
    price: float|None = Field(gt=0)
    description: str | None = None
    colour: str | None = None
    picture_path: str | None = None

class MaterialsUpdate(BaseModel):
    material_id : list[int]

class Category(BaseModel):
    category_id: int
    category_name: str

class Audience(BaseModel):
    audience_id: int
    audience_name: str

class Material(BaseModel):
    material_id: int
    material_name: str

class Size(BaseModel):
    size_id: int
    size_label: str

class Mall(BaseModel):
    mall_id: int
    mall_name: str

class Store(BaseModel):
    store_id: int
    store_name: str
    floor_level: str
    mall_name: str
    shop_number: str | None = None
    phone: str | None = None
    email: str | None = None
    area: str | None = None
    product_count: int

class OwnerCreate(BaseModel):
    email: str
    password: str = Field(min_length=8)
    store_id: int

class UserOut(BaseModel):
    user_id:int
    role: str
    email: str
    store_id: int | None = None
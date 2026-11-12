from pydantic import BaseModel

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
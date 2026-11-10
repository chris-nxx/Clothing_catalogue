from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    text: str = None
    is_done: bool = False


items = []

@app.get("/")
def root():
    return {"Hi how are you"}

@app.post("/items")
def create_items(item: Item):
    items.append(item)
    return items

@app.get("/items")
def list_items(limit: int = (len(items)-1)):
    return items[0:limit]


@app.get("/items/{item_id}")
def get_item(item_id: int) -> Item:
    if item_id < len(items):
        return items[item_id]
    else:
        raise HTTPException(status_code=404, detail="Item not found")

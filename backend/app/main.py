from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Product Scanner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/product_link")
def root():
    return {"message": "Product link found"}


@app.get("/abc")
def get_product_link():
    return {"link": "https://flipkart.com/product"}

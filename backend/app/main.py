from fastapi import FastAPI

app = FastAPI(title="Product Scanner API")


@app.get("/")
def root():
    return {"message": "Product Scanner API"}

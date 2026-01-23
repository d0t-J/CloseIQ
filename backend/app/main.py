from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import file_routes, query_routes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(file_routes.router)
app.include_router(query_routes.router)


@app.get("/")
def root():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

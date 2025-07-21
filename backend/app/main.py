from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import upload, analyze, export

app = FastAPI(title="Letterboxd Wrapped API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(analyze.router, prefix="/api/analyze", tags=["analyze"])
app.include_router(export.router, prefix="/api/export", tags=["export"])

@app.get("/")
def root():
    return {"message": "Letterboxd Wrapped API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
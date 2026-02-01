from fastapi import FastAPI
from src.routes import router
from src.db import engine
from src import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AntCrowd Trust Center",
    description="Public security & compliance transparency service",
    version="1.0.0",
)

app.include_router(router)

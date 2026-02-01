import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://antcrowd:antcrowd123@postgres:5432/antcrowd"
)

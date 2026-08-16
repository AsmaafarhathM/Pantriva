import os
from dotenv import load_dotenv

load_dotenv()

# CEDA API Settings
CEDA_API_KEY = os.getenv("CEDA_API_KEY")

# Default location for CEDA price lookups
# Defaults to Rajasthan (State 8), Bikaner/Alwar (District 104), Market 255
CEDA_STATE_ID = int(os.getenv("CEDA_STATE_ID", "8"))
CEDA_DISTRICT_ID = int(os.getenv("CEDA_DISTRICT_ID", "104"))
CEDA_MARKET_ID = int(os.getenv("CEDA_MARKET_ID", "255"))

# Database & Auth Settings
DATABASE_URL = os.getenv("DATABASE_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
JWT_SECRET = os.getenv("JWT_SECRET", "pantriva-development-secret-change-later")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

# CORS Settings
raw_cors = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
)
CORS_ORIGINS = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]
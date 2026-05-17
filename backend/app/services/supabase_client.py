import os
from functools import lru_cache
from typing import Any

from dotenv import load_dotenv

load_dotenv()


class SupabaseConfigurationError(RuntimeError):
    pass


def is_supabase_configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


@lru_cache(maxsize=1)
def get_supabase_service_client() -> Any:
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        raise SupabaseConfigurationError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")

    try:
        from supabase import create_client
    except ImportError as exc:
        raise SupabaseConfigurationError("Install backend dependencies with: pip install -r requirements.txt") from exc

    return create_client(url, service_key)

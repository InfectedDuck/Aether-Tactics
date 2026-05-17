from fastapi import HTTPException, Request

from app.services.supabase_client import get_supabase_service_client, is_supabase_configured


def get_bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not header:
        return None
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token.strip()


def get_authenticated_user_id(request: Request) -> str | None:
    token = get_bearer_token(request)
    if not token:
        return None
    try:
        user_response = get_supabase_service_client().auth.get_user(token)
        user = getattr(user_response, "user", None)
        user_id = getattr(user, "id", None)
        if user_id:
            return str(user_id)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Supabase session: {exc}") from exc
    raise HTTPException(status_code=401, detail="Invalid Supabase session.")


def resolve_owned_user_id(request: Request, supplied_user_id: str | None = None) -> str:
    authenticated_user_id = get_authenticated_user_id(request)
    if authenticated_user_id:
        if supplied_user_id and str(supplied_user_id) != authenticated_user_id:
            raise HTTPException(status_code=403, detail="Cannot access another commander profile.")
        return authenticated_user_id
    if is_supabase_configured():
        raise HTTPException(status_code=401, detail="A Supabase access token is required.")
    if not supplied_user_id:
        raise HTTPException(status_code=401, detail="A user id is required in demo mode.")
    return str(supplied_user_id)


def optional_owned_user_id(request: Request, supplied_user_id: str | None = None) -> str | None:
    authenticated_user_id = get_authenticated_user_id(request)
    if authenticated_user_id:
        if supplied_user_id and str(supplied_user_id) != authenticated_user_id:
            raise HTTPException(status_code=403, detail="Cannot access another commander profile.")
        return authenticated_user_id
    if is_supabase_configured() and supplied_user_id:
        raise HTTPException(status_code=401, detail="A Supabase access token is required.")
    return str(supplied_user_id) if supplied_user_id else None

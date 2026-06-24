"""Auth endpoints: register, login, me."""

from fastapi import APIRouter, status

from app.api.deps import SessionDep
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserRead
from app.security import CurrentUser
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, session: SessionDep) -> TokenResponse:
    return await AuthService(session).register(req)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, session: SessionDep) -> TokenResponse:
    return await AuthService(session).login(req)


@router.get("/me", response_model=UserRead)
async def me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)

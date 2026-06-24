"""Authentication orchestration: register + login → JWT."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ConflictError, UnauthorizedError
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserRead
from app.security import create_access_token, hash_password, verify_password


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.users = UserRepository(session)

    async def register(self, req: RegisterRequest) -> TokenResponse:
        email = req.email.strip().lower()
        if await self.users.get_by_email(email) is not None:
            raise ConflictError("An account with this email already exists.")
        user = await self.users.add(
            User(email=email, name=req.name, password_hash=hash_password(req.password))
        )
        return self._token(user)

    async def login(self, req: LoginRequest) -> TokenResponse:
        email = req.email.strip().lower()
        user = await self.users.get_by_email(email)
        if user is None or not verify_password(req.password, user.password_hash):
            raise UnauthorizedError("Invalid email or password.")
        return self._token(user)

    @staticmethod
    def _token(user: User) -> TokenResponse:
        return TokenResponse(
            access_token=create_access_token(user.id),
            user=UserRead.model_validate(user),
        )

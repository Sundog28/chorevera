from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
)


class UserRegister(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
        examples=[
            "John Treen",
        ],
    )

    email: EmailStr = Field(
        examples=[
            "john@example.com",
        ],
    )

    password: str = Field(
        min_length=12,
        max_length=128,
        examples=[
            "SecurePassword123!",
        ],
    )


class UserResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    name: str
    email: EmailStr
    is_active: bool
    is_email_verified: bool
    created_at: datetime


class RegistrationResponse(BaseModel):
    user: UserResponse
    message: str
    development_url: str | None = None


class AuthMessageResponse(BaseModel):
    message: str
    development_url: str | None = None


class EmailRequest(BaseModel):
    email: EmailStr


class TokenConfirm(BaseModel):
    token: str = Field(
        min_length=20,
        max_length=512,
    )


class PasswordResetConfirm(BaseModel):
    token: str = Field(
        min_length=20,
        max_length=512,
    )

    new_password: str = Field(
        min_length=12,
        max_length=128,
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenPayload(BaseModel):
    sub: str
    exp: int | None = None
    ver: int = 0

from pydantic import BaseModel


class MeOut(BaseModel):
    id: str
    email: str
    is_admin: bool

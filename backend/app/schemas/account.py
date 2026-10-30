from pydantic import BaseModel


class MeOut(BaseModel):
    id: str
    email: str
    is_admin: bool
    is_guest: bool = False
    has_full_access: bool = True

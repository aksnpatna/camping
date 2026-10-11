from pydantic import BaseModel, EmailStr


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkResponse(BaseModel):
    """
    Deliberately contains no token and no link.

    Returning the credential in the HTTP response would let any unauthenticated
    caller mint access to an arbitrary camper's trips, defeating the ownership
    check entirely. The token exists only inside the emailed link.
    """

    email: str
    message: str

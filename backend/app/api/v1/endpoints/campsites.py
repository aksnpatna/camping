from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.campsite import CampsiteCreate, CampsiteResponse
from app.crud import campsite as crud_campsite

router = APIRouter()

@router.post("/", response_model=CampsiteResponse)
def create_campsite(campsite: CampsiteCreate, db: Session = Depends(get_db)):
    return crud_campsite.create_campsite(db=db, campsite=campsite)

from typing import List, Optional
from fastapi import Query

@router.get("/", response_model=List[CampsiteResponse])
def read_campsites(
    skip: int = 0, 
    limit: int = 100, 
    dog_friendly: Optional[bool] = None,
    rig_access: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud_campsite.get_campsites(db, skip=skip, limit=limit, dog_friendly=dog_friendly, rig_access=rig_access)

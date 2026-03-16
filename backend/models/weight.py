"""Pydantic models for weight-related requests."""
from pydantic import BaseModel


class WeightLogReq(BaseModel):
    weight_kg: float

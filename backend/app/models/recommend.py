from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


RecommendationStrategy = Literal["random", "highest_rated", "newest"]


class UserPairRequest(BaseModel):
    usernames: list[str] = Field(..., min_length=2, max_length=2)


class RecommendFromCompareRequest(UserPairRequest):
    strategy: RecommendationStrategy = "random"


class FilmRecommendation(BaseModel):
    title: str
    year: str = ""
    reason: str
    poster_path: str = ""
    slug: str = ""
    letterboxd_slug: str = ""
    vote_average: Optional[float] = None
    release_date: str = ""
    director: Optional[str] = None
    overview: Optional[str] = None


class RecommendFromCompareResponse(BaseModel):
    recommendation: FilmRecommendation
    alternatives: list[FilmRecommendation]


class MutualProfile(BaseModel):
    top_genres: list[str]
    top_directors: list[str]
    era_overlap: str


class DateNightResponse(BaseModel):
    mutual_profile: MutualProfile
    recommendations: list[FilmRecommendation]

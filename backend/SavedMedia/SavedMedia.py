import json
from dataclasses import asdict, dataclass

@dataclass
class SavedMedia:
    ttid: str 
    type: int
    name: str
    poster_url: str
    year: int
    series_name: str | None
    episode_info: str | None


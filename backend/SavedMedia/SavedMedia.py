import json
from dataclasses import asdict, dataclass

@dataclass
class SavedMedia:
    ttid: str 
    type: int
    name: str
    poster_url: str
    year: str
    series_name: str | None
    episode_info: str | None


from dataclasses import asdict, dataclass
import datetime

@dataclass
class Counter:
    key: str
    name: str
    counter: int
    last_updated: datetime
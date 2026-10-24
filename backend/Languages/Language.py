from dataclasses import asdict, dataclass

@dataclass
class Language:
    id: int
    name: str
    code: str
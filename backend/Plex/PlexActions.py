import requests as _requests 
from dotenv import load_dotenv as _load_dotenv
import os as _os

def _refresh_all_environment_variables():
    global PLEX_API_KEY, PLEX_CLIENT_IDENTIFIER

    PLEX_API_KEY = _os.getenv("PLEX_API_KEY")
    PLEX_CLIENT_IDENTIFIER = _os.getenv("PLEX_CLIENT_IDENTIFIER")

def refresh_plex_libraries():
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = "http://localhost:32400/library/sections/all/refresh"
    headers = {
        "X-Plex-Token": PLEX_API_KEY,
        "Content-Type": "application/json"
    }
    response = _requests.get(url, headers=headers)
    
    if response.status_code in (200, 204):
        print("Plex libraries refreshed successfully.")
        return True
    raise Exception(f"Failed to refresh Plex libraries. Status code: {response.status_code}, Response: {response.text}")

def get_plex_users():
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = "https://plex.tv/api/v2/home/users"
    headers = {
        "X-Plex-Token": PLEX_API_KEY,
        "X-Plex-Client-Identifier": PLEX_CLIENT_IDENTIFIER,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    response = _requests.get(url, headers=headers)
    
    if response.status_code == 200:
        users = response.json()
        return users
    else:
        errorMessagesList = response.json().get('errors', [])
        if errorMessagesList:
            errorMessages = [error.get('message', 'Unknown error') for error in errorMessagesList]
            raise Exception(f"Failed to get Plex users. Status code: {response.status_code}, Response: {'; '.join(errorMessages)}")
        raise Exception(f"Failed to get Plex users. Status code: {response.status_code}, Response: No response text")